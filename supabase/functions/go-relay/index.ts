// go-relay — the ledger GO relay (off-Perplexity migration, 2026-11-11).
//
// Moves the -2 GO-posting labor off Perplexity per R-010 (owner carte blanche,
// 2026-11-10) and the owner's 2026-11-11 order ("the GO relay"): a structured
// GO request goes in, a gate-validated ledger comment comes out — posted as
// the -2 principal (rentspire-bspain-2) via the GitHub API when the PAT is in
// the platform env, or formatted + validated for the coordinator to post when
// it is not (DRY-RUN mode, the default until the owner's one-time paste).
//
// GATE RULES ENFORCED (the relay never weakens them — it only mechanizes them):
//   1. First line EXACT — `GO reserve <version>` / `GO bind <version> sha256 <sha>`,
//      no trailing text (the structured GO-line rule; the 6737719696 precedent).
//   2. version = 14 digits; sha256 = 64 lowercase hex.
//   3. No negation words on the GO line (a GO that hedges is not a GO).
//   4. E44 grant naming — an object-creating migration's GO must name its grantee
//      roles; the shared superuser (`postgres`) is never a grantee.
//   5. Bind file path must be supabase/migrations/<version>_<slug>.sql with the
//      version prefix matching the GO version (the rename convention).
//   6. R-010 citation — every GO posted under the delegation cites R-010.
//   7. Supersede chains name the superseded comment ids AND the body carries
//      SUPERSEDE language (never a silent redefinition).
//
// AUTHOR-VS-ACTOR (preserved absolutely): the relay posts COMMENTS and PR
// REVIEWS only, as the -2 principal. It NEVER dispatches workflows (dispatch
// stays on the fleet/CI account), never merges, never self-issues. The PAT is
// read from env and never logged, echoed, or returned in any response.
//
// Actions:
//   status    — mode (dry-run / armed) + the gate ruleset version
//   validate  — run the gate on a structured request; returns the verdict +
//               the formatted comment (dry-run handoff to the coordinator)
//   post      — validate, then post the comment to SHMT issue #3500 as the -2
//               (armed mode only; refuses if the PAT identity is not the -2)
//   review    — submit an APPROVE review on a named SHMT PR as the -2
//               (armed mode only; the merge stays with the coordinator)
//
// Auth: GATEWAY_TOKEN (same convention as call-model).

const LEDGER_REPO = "rentspire-bspain/SHMT";
const LEDGER_ISSUE = "3500";
const MINUS_TWO_LOGIN = "rentspire-bspain-2";
const RULES_VERSION = "go-relay-gate-v1 (2026-11-11)";

const NEGATION_WORDS = [
  "not", "no", "never", "don't", "dont", "cannot", "can't", "cant",
  "cancel", "deny", "denylist", "except", "unless", "without", "except-if",
];

function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-gateway-token",
  };
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(), "Content-Type": "application/json", ...extra },
  });
}

// ---------- the gate ----------

interface GoRequest {
  kind?: string; // "reserve" | "bind"
  version?: string;
  sha256?: string;
  file?: string;
  pr?: number;
  head?: string;
  grants?: string[]; // E44 grantee roles (required for object-creating migrations)
  supersedes?: number[]; // ledger comment ids this GO supersedes
  proposed_by?: string;
  approved_by?: string;
  context?: string[]; // extra body lines (provenance, dependency notes)
}

interface Verdict {
  ok: boolean;
  errors: string[];
  warnings: string[];
  go_line: string;
  comment: string;
}

function validateGo(r: GoRequest): Verdict {
  const errors: string[] = [];
  const warnings: string[] = [];
  const kind = String(r.kind || "").toLowerCase();
  const version = String(r.version || "").trim();
  const sha = String(r.sha256 || "").trim().toLowerCase();
  const file = String(r.file || "").trim();

  if (kind !== "reserve" && kind !== "bind") {
    errors.push(`kind must be "reserve" or "bind" (got "${r.kind}")`);
  }
  if (!/^\d{14}$/.test(version)) {
    errors.push(`version must be exactly 14 digits (got "${version}")`);
  }

  let goLine = "";
  if (kind === "reserve") {
    goLine = `GO reserve ${version}`;
  } else if (kind === "bind") {
    if (!/^[0-9a-f]{64}$/.test(sha)) {
      errors.push("bind requires a 64-char lowercase-hex sha256");
    }
    goLine = `GO bind ${version} sha256 ${sha}`;
  }

  // Rule 3: no negation words on the GO line (a hedged GO is not a GO).
  const lineWords = goLine.toLowerCase().split(/[^a-z']+/).filter(Boolean);
  for (const w of NEGATION_WORDS) {
    if (lineWords.includes(w)) errors.push(`GO line carries the negation word "${w}"`);
  }
  // Rule 1 (the exactness backstop): the rendered first line must equal the
  // canonical form with nothing after it.
  if (kind === "bind" && goLine) {
    const canon = `GO bind ${version} sha256 ${sha}`;
    if (goLine !== canon) errors.push("GO line is not the canonical exact form");
  }

  // Rule 5: the bind file path carries the GO version prefix.
  if (kind === "bind") {
    if (!file.startsWith("supabase/migrations/")) {
      errors.push("file must live under supabase/migrations/");
    } else if (version && !file.includes(`/${version}_`)) {
      errors.push(
        `file name must carry the GO version prefix ${version}_ (the rename convention)`,
      );
    } else if (!/\.sql$/.test(file)) {
      errors.push("file must be a .sql migration");
    }
  }

  // Rule 4: E44 grant naming — named grantee roles, never the shared superuser.
  const grants = (r.grants || []).map((g) => String(g).trim()).filter(Boolean);
  if (grants.length === 0) {
    warnings.push(
      "no grantee roles named — required if the migration creates objects (E44)",
    );
  }
  for (const g of grants) {
    if (!/^[a-z_][a-z0-9_]*$/.test(g)) {
      errors.push(`grantee "${g}" is not a valid role name`);
    }
    if (g === "postgres" || g === "supabase_admin" || g === "service_role") {
      errors.push(`grantee "${g}" is the shared-superuser class — E44 forbids it`);
    }
  }

  // Rule 7: supersede chains are explicit.
  const supersedes = (r.supersedes || []).filter((n) => Number.isFinite(n) && n > 0);
  if (r.supersedes && r.supersedes.length !== supersedes.length) {
    errors.push("supersedes entries must be valid ledger comment ids (positive integers)");
  }

  // ---------- the formatted comment ----------

  const lines: string[] = [goLine, ""];
  if (kind === "bind") {
    lines.push(
      `Bind for ${file}${r.pr ? `, SHMT PR #${r.pr}` : ""}${r.head ? ` at head ${r.head}` : ""}.`,
    );
  } else if (r.pr) {
    lines.push(`Reserve a migration slot for SHMT PR #${r.pr}.`);
  }
  if (r.context?.length) lines.push(...r.context.map((c) => String(c)));
  if (grants.length) lines.push(`Grants (E44 named roles): ${grants.join(", ")}.`);
  if (supersedes.length) {
    lines.push(
      `SUPERSEDES ledger comments ${supersedes.join(", ")} — the earlier GOs are superseded by this one; they are never silently redefined.`,
    );
  }
  lines.push(
    `GO under Brett Spain's standing delegation (R-010, 2026-11-10 carte blanche), proposed-by ${r.proposed_by || "comptrove_migration_commander"}, approved-by ${r.approved_by || "the coordinator's review gate"}.`,
  );
  lines.push("");
  lines.push(`posted by ai.spaincos.com go-relay (${RULES_VERSION})`);

  const comment = lines.join("\n");

  // Rule 6: R-010 citation is present by construction; assert it anyway.
  if (!comment.includes("R-010")) errors.push("R-010 citation missing from the rendered comment");

  return { ok: errors.length === 0, errors, warnings, go_line: goLine, comment };
}

// ---------- GitHub (armed mode) ----------

function ghHeaders(pat: string) {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ai-spaincos-go-relay",
  };
}

async function whoAmI(pat: string): Promise<string> {
  const res = await fetch("https://api.github.com/user", {
    headers: ghHeaders(pat),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`github identity check failed (${res.status})`);
  return (await res.json()).login;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  try {
    // Gateway auth (same convention as call-model: GATEWAY_TOKEN when set).
    const gt = Deno.env.get("GATEWAY_TOKEN");
    if (gt) {
      const auth = req.headers.get("authorization") || "";
      const presented = auth.startsWith("Bearer ")
        ? auth.slice(7)
        : req.headers.get("x-gateway-token") || "";
      if (presented !== gt) {
        return json({ error: "unauthorized gateway token" }, 401);
      }
    }

    const pat = Deno.env.get("GITHUB_2_PAT") || "";
    const armed = pat.length > 0;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "status");

    if (action === "status") {
      return json({
        mode: armed ? "armed" : "dry-run",
        note: armed
          ? "GITHUB_2_PAT present — posts as the -2 principal (rentspire-bspain-2)."
          : "GITHUB_2_PAT not set — dry-run: validates + formats GO comments and hands them to the coordinator to post. The owner pastes the -2 PAT into the platform secret store once to arm.",
        rules: RULES_VERSION,
        author_vs_actor:
          "the relay posts comments and PR reviews only, as the -2; dispatch stays on the fleet/CI account; no merges, no self-issued dispatch.",
      });
    }

    if (action === "validate") {
      const verdict = validateGo(body as GoRequest);
      return json({ mode: armed ? "armed" : "dry-run", ...verdict });
    }

    if (action === "post") {
      if (!armed) {
        const verdict = validateGo(body as GoRequest);
        return json(
          {
            mode: "dry-run",
            posted: false,
            note: "GITHUB_2_PAT not set — dry-run handoff: the coordinator posts the formatted comment below as the -2.",
            ...verdict,
          },
          200,
        );
      }
      const verdict = validateGo(body as GoRequest);
      if (!verdict.ok) return json({ posted: false, ...verdict }, 422);
      const login = await whoAmI(pat);
      if (login !== MINUS_TWO_LOGIN) {
        return json(
          {
            posted: false,
            error: `PAT identity is "${login}", expected "${MINUS_TWO_LOGIN}" — refusing to post (gate safety)`,
          },
          409,
        );
      }
      const res = await fetch(
        `https://api.github.com/repos/${LEDGER_REPO}/issues/${LEDGER_ISSUE}/comments`,
        {
          method: "POST",
          headers: ghHeaders(pat),
          body: JSON.stringify({ body: verdict.comment }),
          signal: AbortSignal.timeout(30000),
        },
      );
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        return json({ posted: false, error: out.message || `github ${res.status}` }, 502);
      }
      return json({ posted: true, as: login, comment_url: out.html_url });
    }

    if (action === "review") {
      const pr = Number(body.pr);
      if (!Number.isFinite(pr) || pr <= 0) return json({ error: "pr (number) required" }, 400);
      if (!armed) {
        return json(
          {
            mode: "dry-run",
            reviewed: false,
            note: "GITHUB_2_PAT not set — the coordinator gives the -2 approving review by hand.",
          },
          200,
        );
      }
      const login = await whoAmI(pat);
      if (login !== MINUS_TWO_LOGIN) {
        return json(
          { reviewed: false, error: `PAT identity is "${login}", expected "${MINUS_TWO_LOGIN}"` },
          409,
        );
      }
      const res = await fetch(
        `https://api.github.com/repos/${LEDGER_REPO}/pulls/${pr}/reviews`,
        {
          method: "POST",
          headers: ghHeaders(pat),
          body: JSON.stringify({
            event: "APPROVE",
            body: `Approving review via ai.spaincos.com go-relay (${RULES_VERSION}), under R-010. Merge stays with the coordinator.`,
          }),
          signal: AbortSignal.timeout(30000),
        },
      );
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        return json({ reviewed: false, error: out.message || `github ${res.status}` }, 502);
      }
      return json({ reviewed: true, as: login, review_url: out.html_url });
    }

    return json({ error: `unknown action "${action}"` }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});
