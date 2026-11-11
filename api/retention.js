// /api/retention — the 12-month retention policy for ai.spaincos.com (SOC 2 CC6.1)
// Deletes conversation data older than 12 months: threads and their messages,
// imported context documents (the Perplexity history imports), and revoked
// shared-thread copies. Also trims ops_health_runs to 14 days (operational
// hygiene, per the 2026-11-11 DB hygiene report — not PII).
//
// Auth: Vercel cron invocations (x-vercel-cron: 1) or a Bearer token equal to
// GATEWAY_TOKEN (constant-time compare; the token is never echoed).
//
// Safety: the DEFAULT mode is a DRY RUN — counts only, deletes nothing.
// Pass execute=1 to actually delete. The scheduled cron (vercel.json) passes
// execute=1; a bare curl always previews first.
//
// Env: PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE, GATEWAY_TOKEN.
const { Pool } = require('pg');

const PG_CONFIG = {
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT || '5432', 10),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE || 'postgres',
  ssl: { rejectUnauthorized: false },
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
};

let pool = null;
function getPool() {
  if (!pool) {
    if (!process.env.PG_HOST || !process.env.PG_USER || !process.env.PG_PASSWORD) {
      throw new Error('Missing required environment variables: PG_HOST, PG_USER, PG_PASSWORD');
    }
    pool = new Pool(PG_CONFIG);
  }
  return pool;
}

// Each entry: table, window, the matching predicate (must be usable in both
// DELETE ... WHERE and SELECT count(*) WHERE), and a note.
const RETENTION_RULES = [
  {
    table: 'thread_messages',
    predicate: "thread_id IN (SELECT id FROM threads WHERE updated_at < now() - interval '12 months')",
    note: 'messages of threads inactive for 12 months'
  },
  {
    table: 'threads',
    predicate: "updated_at < now() - interval '12 months'",
    note: 'threads inactive for 12 months (user-visible history expires)'
  },
  {
    table: 'context_documents',
    predicate: "created_at < now() - interval '12 months'",
    note: 'imported Perplexity history / uploaded context older than 12 months'
  },
  {
    table: 'shared_threads',
    predicate: "revoked_at IS NOT NULL AND revoked_at < now() - interval '12 months'",
    note: 'revoked share copies (contain full message copies) older than 12 months'
  },
  {
    table: 'ops_health_runs',
    predicate: "created_at < now() - interval '14 days'",
    note: 'operational health-run trim (14 days, hygiene)'
  }
];

module.exports = async (req, res) => {
  const crypto = require('crypto');
  const tok = (process.env.GATEWAY_TOKEN || '').trim();
  const got = ((req.headers.authorization || '').replace(/^Bearer /i, '')).trim();
  const isCron = (req.headers['x-vercel-cron'] || '') === '1';
  let authed = false;
  if (isCron) {
    authed = true; // Vercel cron invocations carry the platform header
  } else if (tok && got && got.length === tok.length) {
    authed = crypto.timingSafeEqual(Buffer.from(got), Buffer.from(tok));
  }
  if (!authed) {
    res.writeHead(401, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
    return;
  }

  const execute = (req.url || '').includes('execute=1');
  const results = [];
  let client = null;
  try {
    client = await getPool().connect();
    for (const rule of RETENTION_RULES) {
      try {
        if (execute) {
          const r = await client.query(
            `DELETE FROM ${rule.table} WHERE ${rule.predicate} RETURNING 1`
          );
          results.push({ table: rule.table, mode: 'execute', deleted: r.rowCount, note: rule.note });
        } else {
          const r = await client.query(
            `SELECT count(*)::int AS n FROM ${rule.table} WHERE ${rule.predicate}`
          );
          results.push({ table: rule.table, mode: 'dry-run', would_delete: r.rows[0].n, note: rule.note });
        }
      } catch (e) {
        // One table's failure (unknown column, missing grant) must not block the others.
        results.push({ table: rule.table, mode: execute ? 'execute' : 'dry-run', error: String(e && e.message || e).slice(0, 200) });
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      ok: true,
      policy: '12-month thread/history retention (SOC 2 CC6.1), 14-day ops_health_runs trim',
      mode: execute ? 'execute' : 'dry-run (pass execute=1 to delete)',
      executed_at: new Date().toISOString(),
      results
    }, null, 2));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: false, error: String(e && e.message || e).slice(0, 200) }));
  } finally {
    if (client) client.release();
  }
};
