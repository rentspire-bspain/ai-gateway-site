// team — org/team administration for ai.spaincos.com (G3).
// Owner/admin gated (checked server-side on EVERY mutating action):
//   members, invites by email, roles (owner/admin/member), sign-in allowlist.
// Tables (service-role only — no anon/authenticated grants; this function is the
// sole writer and enforces permissions itself): org_members, org_allowlist.
//
// Actions (POST JSON {action}, Bearer = user JWT):
//   whoami            — {email, role, is_admin} (also activates invited members)
//   members           — [{email, role, status, created_at}]
//   invite {email, role}      — add invited member + allowlist entry
//   set_role {email, role}    — owner/admin only (owner role: owner-only)
//   remove_member {email}     — owner/admin only (owner row is immutable)
//   allowlist_list            — [email]
//   allowlist_add {email}     — admin+
//   allowlist_remove {email} — admin+ (owner email is permanent)
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "https://bnxermyboeigvwonfrzx.supabase.co";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OWNER_EMAIL = "bspain@spaincos.com"; // Brett — immutable owner
const ALLOWED_EMAILS = ["bspain@spaincos.com", "eval-bot@spaincos.com"];

// ---- teammate templates (server-side enforced; see qa/teammate-templates-schema.sql) ----
// Presets live here (server-trusted): clients send only template_id, never instruction text.
export const TEMPLATES: Record<string, { name: string; instructions: string }> = {
  "research-analyst": { name: "Research Analyst", instructions: "Research the question across multiple sources, cross-check claims, and cite every source. Separate facts from inference and state confidence and gaps." },
  "code-reviewer": { name: "Code Reviewer", instructions: "Review code for correctness, security, and maintainability. List issues by severity with file/line references and a concrete fix for each. Do not rewrite unrelated code." },
  "data-extractor": { name: "Data Extractor", instructions: "Extract the requested fields from the supplied material into a structured table or JSON. Never guess: mark missing values as null and quote the source text for each." },
  "summarizer": { name: "Summarizer", instructions: "Summarize the material in a short brief: key points, decisions, open questions, and next steps. Keep it faithful to the source and under 200 words unless asked." },
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

function rest(key: string) {
  const h: Record<string, string> = { "apikey": key, "Authorization": `Bearer ${key}`, "Content-Type": "application/json" };
  return async (method: string, path: string, body?: unknown, prefer = "return=representation") => {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
      method, headers: { ...h, Prefer: prefer }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000),
    });
    const t = await r.text();
    if (!r.ok) throw new Error(`db ${r.status}: ${t.slice(0, 200)}`);
    return t ? JSON.parse(t) : null;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let b: any = {};
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = String(b?.action || "");

  // ---- AUTH ----
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Not authenticated — sign in again." }, 401);
  const token = authHeader.slice(7).trim();
  const authCheck = await fetch(`${SB_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: ANON }, signal: AbortSignal.timeout(10_000) });
  if (!authCheck.ok) return json({ error: "Not authenticated — sign in again." }, 401);
  const user = await authCheck.json();
  const email = String(user?.email ?? "").toLowerCase();
  if (!email) return json({ error: "Not authenticated — sign in again." }, 401);
  if (!SVC) return json({ error: "team admin unavailable" }, 500);
  const db = rest(SVC);

  // ---- helpers ----
  // Ensure the owner row exists (idempotent; also keeps the owner allowlisted).
  // SPEED: the two upserts are independent -> run in parallel (was 2 sequential round trips).
  async function ensureOwner() {
    await Promise.all([
      db("POST", "org_members?on_conflict=email", {
        email: OWNER_EMAIL, role: "owner", status: "active", user_id: user?.id ?? null,
      }, "resolution=ignore-duplicates"),
      db("POST", "org_allowlist?on_conflict=email", {
        email: OWNER_EMAIL, added_by: "system",
      }, "resolution=ignore-duplicates"),
    ]);
  }
  async function memberOf(e: string): Promise<{ role: string | null; status: string | null }> {
    const rows = await db("GET", `org_members?select=role,status&email=eq.${encodeURIComponent(e)}&limit=1`);
    return { role: rows?.[0]?.role ?? null, status: rows?.[0]?.status ?? null };
  }
  async function roleOf(e: string): Promise<string | null> {
    return (await memberOf(e)).role;
  }
  function validEmail(s: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

  try {
    // ---- ensureOwner on every authenticated call ----
    // SPEED: for a non-owner caller the membership lookup does not depend on the owner
    // row, so run both together (was 4 sequential round trips before the action itself).
    // The owner caller keeps the original order (owner row must exist before the lookup).
    let me: { role: string | null; status: string | null };
    if (email === OWNER_EMAIL) { await ensureOwner(); me = await memberOf(email); }
    else { [, me] = await Promise.all([ensureOwner(), memberOf(email)]); }
    const myRole = me.role;

    // Activate the caller if they were invited and have now signed in.
    // SPEED: the PATCH is filtered to status=invited, so skip the round trip when the
    // row we just read is not 'invited' (identical outcome, one fewer DB call).
    if (myRole && me.status === "invited") {
      await db("PATCH", `org_members?email=eq.${encodeURIComponent(email)}&status=eq.invited`, { status: "active", user_id: user?.id ?? null });
    }

    switch (action) {
      case "whoami": {
        return json({ email, role: myRole, is_admin: myRole === "owner" || myRole === "admin" });
      }
      case "members": {
        if (!myRole) return json({ error: "You are not a member of this team." }, 403);
        const members = await db("GET", "org_members?select=email,role,status,created_at&order=role.asc,email.asc&limit=200");
        return json({ members });
      }
      case "invite": {
        if (myRole !== "owner" && myRole !== "admin") return json({ error: "Only owners and admins can invite." }, 403);
        const invEmail = String(b.email || "").trim().toLowerCase();
        const invRole = String(b.role || "member");
        if (!validEmail(invEmail)) return json({ error: "A valid email is required." }, 400);
        if (!["member", "admin"].includes(invRole)) return json({ error: "Role must be member or admin." }, 400);
        if (invRole === "admin" && myRole !== "owner") return json({ error: "Only the owner can grant admin." }, 403);
        if (await roleOf(invEmail)) return json({ error: "That email is already on the team." }, 400);
        await Promise.all([
          db("POST", "org_members?on_conflict=email", {
            email: invEmail, role: invRole, status: "invited", invited_by: email,
          }, "resolution=ignore-duplicates"),
          db("POST", "org_allowlist?on_conflict=email", {
            email: invEmail, added_by: email,
          }, "resolution=ignore-duplicates"),
        ]);
        // v3: actually create the sign-in account (public signup is off, so this admin
        // call is the ONLY way an invited person gets credentials). A one-time temp
        // password is generated and returned to the inviting owner — never emailed.
        let tempPassword: string | null = null;
        let accountCreated = false;
        let accountNote = "";
        try {
          const raw = crypto.getRandomValues(new Uint8Array(12));
          tempPassword = "Sc" + Array.from(raw).map((x) => "abcdefghjkmnpqrstuvwxyz23456789"[x % 31]).join("");
          const cr = await fetch(`${SB_URL}/auth/v1/admin/users`, {
            method: "POST",
            headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" },
            body: JSON.stringify({ email: invEmail, password: tempPassword, email_confirm: true, user_metadata: { invited_by: email } }),
            signal: AbortSignal.timeout(15_000),
          });
          if (cr.ok) { accountCreated = true; }
          else {
            const err = await cr.text().catch(() => "");
            if (/already (registered|been registered)|already exists/i.test(err)) { tempPassword = null; accountNote = "A sign-in account already exists for this email — they can use their existing password."; accountCreated = true; }
            else { tempPassword = null; accountNote = `Account creation failed (${cr.status}) — the member is invited and allowlisted, but create their account in the Supabase dashboard (Auth → Users → Add user).`; }
          }
        } catch (_e) {
          tempPassword = null;
          accountNote = "Account creation failed — the member is invited and allowlisted, but create their account in the Supabase dashboard (Auth → Users → Add user).";
        }
        return json({ ok: true, account_created: accountCreated, temp_password: tempPassword, note: accountNote });
      }
      case "set_role": {
        if (myRole !== "owner" && myRole !== "admin") return json({ error: "Only owners and admins can change roles." }, 403);
        const target = String(b.email || "").trim().toLowerCase();
        const to = String(b.role || "");
        if (!target || !["member", "admin", "owner"].includes(to)) return json({ error: "email and a valid role are required." }, 400);
        if (target === OWNER_EMAIL) return json({ error: "The owner role is fixed." }, 400);
        if (to === "owner" || to === "admin") {
          if (myRole !== "owner") return json({ error: "Only the owner can grant admin or owner." }, 403);
        }
        const existing = await roleOf(target);
        if (!existing) return json({ error: "Member not found." }, 404);
        if (existing === "owner") return json({ error: "The owner role is fixed." }, 400);
        const rows = await db("PATCH", `org_members?email=eq.${encodeURIComponent(target)}`, { role: to });
        return rows?.length ? json({ ok: true }) : json({ error: "not found" }, 404);
      }
      case "remove_member": {
        if (myRole !== "owner" && myRole !== "admin") return json({ error: "Only owners and admins can remove members." }, 403);
        const target = String(b.email || "").trim().toLowerCase();
        if (!target) return json({ error: "email required" }, 400);
        if (target === OWNER_EMAIL) return json({ error: "The owner cannot be removed." }, 400);
        const existing = await roleOf(target);
        if (!existing) return json({ error: "Member not found." }, 404);
        if (existing === "admin" && myRole !== "owner") return json({ error: "Only the owner can remove admins." }, 403);
        const rows = await db("DELETE", `org_members?email=eq.${encodeURIComponent(target)}`);
        return rows?.length ? json({ ok: true }) : json({ error: "not found" }, 404);
      }
      case "allowlist_list": {
        if (!myRole) return json({ error: "You are not a member of this team." }, 403);
        const rows = await db("GET", "org_allowlist?select=email&order=email.asc&limit=500");
        return json({ allowlist: (rows ?? []).map((r: any) => r.email) });
      }
      case "allowlist_add": {
        if (myRole !== "owner" && myRole !== "admin") return json({ error: "Only owners and admins can manage the allowlist." }, 403);
        const add = String(b.email || "").trim().toLowerCase();
        if (!validEmail(add)) return json({ error: "A valid email is required." }, 400);
        await db("POST", "org_allowlist?on_conflict=email", { email: add, added_by: email }, "resolution=ignore-duplicates");
        return json({ ok: true });
      }
      case "allowlist_remove": {
        if (myRole !== "owner" && myRole !== "admin") return json({ error: "Only owners and admins can manage the allowlist." }, 403);
        const rm = String(b.email || "").trim().toLowerCase();
        if (!rm) return json({ error: "email required" }, 400);
        if (rm === OWNER_EMAIL) return json({ error: "The owner must stay allowlisted." }, 400);
        const rows = await db("DELETE", `org_allowlist?email=eq.${encodeURIComponent(rm)}`);
        return rows?.length ? json({ ok: true }) : json({ error: "not found" }, 404);
      }
      case "template_get": {
        if (!myRole) return json({ error: "You are not a member of this team." }, 403);
        const admin = myRole === "owner" || myRole === "admin";
        const rows = await db("GET", `teammate_template_assignments?select=member_email,template_id,updated_at${admin ? "" : `&member_email=eq.${encodeURIComponent(email)}`}&limit=500`);
        return json({ templates: Object.entries(TEMPLATES).map(([id, t]) => ({ id, name: t.name })), assignments: rows ?? [] });
      }
      case "template_set": {
        if (myRole !== "owner" && myRole !== "admin") return json({ error: "Only owners and admins can assign templates." }, 403);
        const target = String(b.email || "").trim().toLowerCase();
        if (!validEmail(target)) return json({ error: "A valid email is required." }, 400);
        if (!(await roleOf(target))) return json({ error: "Member not found." }, 404);
        const tid = String(b.template_id ?? "");
        if (tid === "") {
          await db("DELETE", `teammate_template_assignments?member_email=eq.${encodeURIComponent(target)}`);
          return json({ ok: true, email: target, template_id: null });
        }
        const t = Object.prototype.hasOwnProperty.call(TEMPLATES, tid) ? TEMPLATES[tid] : null;
        if (!t) return json({ error: "Unknown template." }, 400);
        await db("POST", "teammate_template_assignments?on_conflict=member_email", { member_email: target, template_id: tid, instructions: t.instructions, assigned_by: email, updated_at: new Date().toISOString() }, "resolution=merge-duplicates");
        return json({ ok: true, email: target, template_id: tid });
      }
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error).message).slice(0, 200) }, 500);
  }
});
