// Architecture invariant checker — mechanically enforces the "Key Decisions —
// Do Not Reverse" and "What to Never Do" rules from CLAUDE.md, so any model
// (or human) that violates one gets a red build instead of a silent drift.
//
// Run:  npm run check:invariants   (node scripts/check-invariants.mjs)
// Exit code 1 if any ERROR-level findings (safe for CI).
//
// When adding a new invariant: state WHICH CLAUDE.md rule it enforces, and
// prefer patterns that can't false-positive (e.g. `.from('` with a quote
// catches Supabase table access but not Array.from).

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const findings = [];
const flag = (sev, rule, msg) => findings.push({ sev, rule, msg });

// ── File walker ─────────────────────────────────────────────────────────
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
const srcFiles = walk(join(ROOT, 'src')).filter(f => /\.(js|jsx)$/.test(f));
const rel = (f) => relative(ROOT, f);
const read = (f) => readFileSync(f, 'utf8');

// Assert that `pattern` appears ONLY in the allowed files. `where` filters
// which files are scanned at all.
const onlyIn = (rule, pattern, allowed, files, why) => {
  for (const f of files) {
    if (allowed.some(a => rel(f) === a)) continue;
    const m = read(f).match(pattern);
    if (m) flag('ERROR', rule, `${rel(f)} matches ${pattern} ('${m[0].trim().slice(0, 60)}') — ${why}`);
  }
};

// ── 1. Supabase client created only in src/utils/supabase.js ───────────
// (api/ is server-side and creates its own client with the secret key.)
onlyIn('supabase-client', /createClient\s*\(/, ['src/utils/supabase.js'], srcFiles,
  'browser code must get the client from src/utils/supabase.js');

// ── 2. Supabase reads/writes only in src/utils/db.js ───────────────────
// Table access always passes a string literal: .from('profiles').
onlyIn('db-access', /\.from\(\s*['"`]/, ['src/utils/db.js'], srcFiles,
  'all Supabase reads/writes live in src/utils/db.js');

// ── 3. PostHog touched only by src/utils/analytics.js ──────────────────
onlyIn('posthog', /from\s+['"]posthog-js['"]|posthog\.(capture|identify|init|reset)/,
  ['src/utils/analytics.js'], srcFiles,
  'components call track()/identify() from src/utils/analytics.js instead');

// ── 4. Anthropic API + server secrets never reach the browser ──────────
const clientFiles = [...srcFiles, ...walk(join(ROOT, 'public')).filter(f => /\.(html|js|json|txt|xml)$/.test(f))];
for (const f of clientFiles) {
  const text = read(f);
  for (const secret of ['CLAUDE_API_KEY', 'SUPABASE_SECRET_KEY', 'api.anthropic.com', 'sk-ant-']) {
    if (text.includes(secret))
      flag('ERROR', 'secrets', `${rel(f)} references '${secret}' — server-only, must stay in api/`);
  }
  const m = text.match(/REACT_APP_[A-Z_]*(SECRET|PRIVATE|SERVICE)[A-Z_]*/);
  if (m) flag('ERROR', 'secrets', `${rel(f)} uses ${m[0]} — REACT_APP_ vars are public; never prefix a secret with it`);
}

// ── 5. AdSense touched only by ads.js + AdSlot.jsx ──────────────────────
onlyIn('adsense', /adsbygoogle|googlesyndication/,
  ['src/utils/ads.js', 'src/components/AdSlot.jsx'], srcFiles,
  'ad code lives in src/utils/ads.js (loader) + src/components/AdSlot.jsx (placement)');

// ── 6. No async onAuthStateChange callback (deadlock, July 2026) ────────
for (const f of srcFiles) {
  if (/onAuthStateChange\(\s*async/.test(read(f)))
    flag('ERROR', 'auth-deadlock', `${rel(f)} passes an async callback to onAuthStateChange — supabase-js holds its auth lock during the callback; defer with setTimeout(async () => {...}, 0)`);
}

// ── 7. Git hygiene: no .env tracked, no uppercase paths in public/ ──────
const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n');
for (const f of tracked) {
  if (/(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.example'))
    flag('ERROR', 'env-tracked', `${f} is tracked by git — .env must never be committed`);
  if (f.startsWith('public/') && /[A-Z]/.test(f))
    flag('ERROR', 'case-sensitivity', `${f} has uppercase in its path — Vercel is case-sensitive and macOS hides case-only renames (icon 404 bug, July 2026); use lowercase and verify with git ls-files`);
}

// ── 8. schema.sql: every table has RLS enabled + at least one policy ────
const schema = read(join(ROOT, 'supabase/schema.sql')).toLowerCase();
const tables = [...schema.matchAll(/create table (?:if not exists )?(?:public\.)?(\w+)/g)].map(m => m[1]);
for (const t of tables) {
  if (!new RegExp(`alter table (?:public\\.)?${t}\\s+enable row level security`).test(schema))
    flag('ERROR', 'rls', `table '${t}' in supabase/schema.sql has no ENABLE ROW LEVEL SECURITY — every table gets RLS, no exceptions`);
  else if (!new RegExp(`create policy [^;]+ on (?:public\\.)?${t}[\\s(]`).test(schema))
    flag('WARN', 'rls', `table '${t}' has RLS but no policy in schema.sql — locked to service-role only; confirm that's intended`);
}

// ── 9. Profile creation never overwrites existing rows (July 2026) ──────
// createRemoteProfile is reachable by players who already HAVE a profile
// (any state that lands on UsernameEntry); a plain upsert there zeroes their
// stats in the DB. Every upsert in that function must ignoreDuplicates.
{
  const db = read(join(ROOT, 'src/utils/db.js'));
  const fn = db.split(/export (?:async )?function /).find(s => s.startsWith('createRemoteProfile'));
  if (!fn) {
    flag('WARN', 'create-no-clobber', 'createRemoteProfile not found in src/utils/db.js — rule 9 needs updating');
  } else {
    const upserts = fn.match(/\.upsert\([^;]*?\)/gs) ?? [];
    for (const u of upserts) {
      if (!/ignoreDuplicates:\s*true/.test(u))
        flag('ERROR', 'create-no-clobber', `src/utils/db.js: an upsert in createRemoteProfile lacks ignoreDuplicates: true ('${u.trim().slice(0, 60)}…') — the create path must never overwrite an existing profile/skills row`);
    }
  }
}

// ── Report ──────────────────────────────────────────────────────────────
const errors = findings.filter(f => f.sev === 'ERROR');
const warns = findings.filter(f => f.sev === 'WARN');
for (const f of findings) console.log(`${f.sev}  [${f.rule}]  ${f.msg}`);
console.log(`\n${tables.length} tables checked, ${srcFiles.length} src files scanned — ${errors.length} error(s), ${warns.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
