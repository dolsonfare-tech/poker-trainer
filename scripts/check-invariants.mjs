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
// CA-047: also assert that db.js itself uses no dynamic table names —
// every .from( in db.js must be followed immediately by a string/template
// literal so a generic helper can't launder variable table names.
onlyIn('db-access', /\.from\(\s*['"`]/, ['src/utils/db.js'], srcFiles,
  'all Supabase reads/writes live in src/utils/db.js');
{
  const dbSrc = read(join(ROOT, 'src/utils/db.js'));
  // Match .from( NOT followed by a quote or backtick (dynamic table name).
  const dynamic = dbSrc.match(/\.from\(\s*[^'"`\s)]/g);
  if (dynamic)
    flag('ERROR', 'db-access',
      `src/utils/db.js contains a dynamic .from() — every table name must be a string literal ('${dynamic[0].trim().slice(0, 60)}'); no generic query helpers allowed`);
}

// ── 3. PostHog touched only by src/utils/analytics.js ──────────────────
// CA-046: also catch CJS require('posthog-js') so the rule can't be evaded
// by switching from ESM import to CommonJS require.
onlyIn('posthog',
  /from\s+['"]posthog-js['"]|require\s*\(\s*['"]posthog-js['"]\s*\)|posthog\.(capture|identify|init|reset)/,
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
// CA-053: widened from /(^|\/)\.env(\.|$)/ to also catch backup/old names
// like .env_backup, .env-old, env.bak — any path segment starting with
// ".env" followed by a non-lowercase-letter (covers dots, underscores,
// hyphens, digits, and end-of-string). The (?!.*\.example$) guard keeps
// the .env.example allowance. Note: the rule scans `git ls-files` output
// (tracked-file paths), not file contents, so .gitignore's own text
// mentioning ".env" does not false-positive here.
const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n');
for (const f of tracked) {
  if (/(^|\/)\.env([^a-z]|$)/i.test(f) && !f.endsWith('.example'))
    flag('ERROR', 'env-tracked', `${f} is tracked by git — .env must never be committed (caught by widened pattern: .env_backup/.env-old style names also flagged)`);
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

// ── 10. Sentry touched only by src/utils/sentry.js ──────────────────────
// CA-051: primary trigger is now the IMPORT (ESM or CJS) — a file cannot
// call any Sentry method without first importing the package, so the import
// check is the load-bearing gate. The per-method pattern is kept as a
// belt-and-suspenders catch for any Sentry global that slips in without an
// import (e.g. via a CDN window.Sentry shim), but the import trigger alone
// closes the captureMessage/addBreadcrumb/configureScope bypass.
onlyIn('sentry',
  /from\s+['"]@sentry\/|require\s*\(\s*['"]@sentry\/|Sentry\.[a-zA-Z]+\(/,
  ['src/utils/sentry.js'], srcFiles,
  'components call setSentryUser()/clearSentryUser() from src/utils/sentry.js instead');

// ── 11. Google Fonts must load asynchronously (CA-013, July 2026) ────────
// A blocking <link rel="stylesheet" href="fonts.googleapis.com/css2..."> adds
// ~790ms to mobile first paint. Enforce the media-print swap pattern.
// Every fonts.googleapis.com/css2 stylesheet link must either have
// media="print" (the async pattern) or be inside a <noscript> block.
// Note: noscript may be inline (open+close on one line) — check each line
// for a self-contained <noscript>...</noscript> span before using the
// multi-line state machine.
{
  const indexHtml = read(join(ROOT, 'public/index.html'));
  const lines = indexHtml.split('\n');
  let insideNoscript = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Inline noscript: <noscript>...</noscript> on one line — skip entirely.
    if (/<noscript[^>]*>.*<\/noscript>/i.test(line)) continue;
    // Multi-line noscript: track open/close across lines.
    if (/<noscript/i.test(line)) insideNoscript = true;
    if (/<\/noscript>/i.test(line)) insideNoscript = false;
    if (!insideNoscript &&
        /fonts\.googleapis\.com\/css2/.test(line) &&
        /rel=["']stylesheet["']/.test(line) &&
        !/media=["']print["']/.test(line)) {
      flag('ERROR', 'fonts-async',
        `public/index.html line ${i + 1}: fonts.googleapis.com stylesheet link is render-blocking — use media="print" onload="this.media='all'" (async swap pattern) or place inside <noscript>`);
    }
  }
}

// ── 12. CI on main must actually be green (July 26, 2026) ───────────────
// The CI workflow failed silently on every push from July 19–26 (lockfile
// out of sync under npm 10) and nobody noticed — the "bug net" layer was
// dead for a week. Best-effort check of the latest completed run on main;
// WARN (not ERROR) so offline work and in-flight fixes aren't blocked, but
// the red status is shouted on every local gate run. Skipped inside CI
// itself (the run in progress can't see its own conclusion).
if (!process.env.CI) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const res = await fetch(
      'https://api.github.com/repos/dolsonfare-tech/poker-trainer/actions/runs?branch=main&status=completed&per_page=1',
      { signal: ctl.signal, headers: { accept: 'application/vnd.github+json' } });
    clearTimeout(t);
    if (res.ok) {
      const { workflow_runs: runs } = await res.json();
      if (runs?.[0] && runs[0].conclusion !== 'success')
        flag('WARN', 'ci-status',
          `latest completed CI run on main is ${runs[0].conclusion.toUpperCase()} (run #${runs[0].run_number}, '${runs[0].display_title.slice(0, 50)}') — the push-time bug net is down; fix CI before relying on it`);
    }
  } catch { /* offline / rate-limited — skip silently, never block local work */ }
}

// ── 13. Dead legacy layout stays dead (CA-027/CA-026/CA-018, July 2026) ──
// The two-column felt/cream gameplay layout (LegacyLayout + DecisionPanel +
// TableVisual behind the USE_SINGLE_CANVAS flag) was DELETED — CanvasLayout
// is the only render path. These identifiers reappearing in src/ means a
// stale revert or copy-paste resurrection; the code lives in git history if
// ever genuinely needed. (This rule file itself is outside src/, so naming
// the identifiers here can't self-trip.)
{
  const deadLayout = /\b(USE_SINGLE_CANVAS|LegacyLayout|DecisionPanel|TableVisual)\b/;
  for (const f of srcFiles) {
    const m = read(f).match(deadLayout);
    if (m)
      flag('ERROR', 'dead-layout', `${rel(f)} references '${m[1]}' — the legacy two-column layout was deleted July 2026; CanvasLayout is the only gameplay layout. Do not resurrect via stale revert (git history has the code).`);
  }
}

// ── 14. Asset byte-budget (CA-019, July 2026) ───────────────────────────
// favicon.ico is fetched on every page load; a bloated ICO (~279 KB pre-fix)
// was the top CA-019 finding. The regenerated multi-res 16/32/48 ICO weighs
// ~9 KB. icon-512.png is the PWA splash/homescreen icon. Hard ceilings leave
// headroom for a legitimate re-export without silently regressing to the old
// sizes. Thresholds: favicon ≤ 60 000 B (6× the target), icon-512 ≤ 150 000 B
// (~30% above the 116 KB 256-colour re-encode).
{
  const faviconPath = join(ROOT, 'public', 'favicon.ico');
  const icon512Path = join(ROOT, 'public', 'icons', 'icon-512.png');
  try {
    const faviconSize = statSync(faviconPath).size;
    if (faviconSize > 60_000)
      flag('ERROR', 'asset-budget',
        `public/favicon.ico is ${faviconSize} bytes (limit 60 000) — regenerate as a 16/32/48 multi-res ICO from public/icons/icon-512.png (see CA-019)`);
  } catch { /* file missing — caught by other checks or not yet created */ }
  try {
    const icon512Size = statSync(icon512Path).size;
    if (icon512Size > 150_000)
      flag('ERROR', 'asset-budget',
        `public/icons/icon-512.png is ${icon512Size} bytes (limit 150 000) — recompress with sharp/palette reduction (see CA-019)`);
  } catch { /* file missing */ }
}

// ── 15. No new root-level docs (CA-035, July 2026) ──────────────────────
// The Phase 2 docs restructure moved everything into docs/ — the repo root
// carries exactly the allowlisted files below. Any other tracked *.md at the
// root is drift back toward the 19k-word-constitution era. The allowlist
// match is case-insensitive: decision-log.md is deliberately tracked
// non-CAPS at root, and the CLAUDE.md case normalization (git tracked
// `Claude.md` until the Task 8 rename) must not red-flag itself here —
// the rule's spirit is no NEW root docs, not case enforcement (rule 7's
// case-sensitivity check owns public/ paths, where case actually 404s).
{
  const rootDocAllowlist = ['claude.md', 'readme.md', 'founder_briefing.md', 'playtest_brief.md', 'decision-log.md'];
  for (const f of tracked) {
    if (!f || f.includes('/') || !f.toLowerCase().endsWith('.md')) continue;
    if (!rootDocAllowlist.includes(f.toLowerCase()))
      flag('ERROR', 'root-docs', `${f} is a tracked root-level doc outside the allowlist {CLAUDE.md, README.md, FOUNDER_BRIEFING.md, PLAYTEST_BRIEF.md, decision-log.md} — new docs live in docs/ (see docs/INDEX.md for where)`);
  }
}

// ── 16. CLAUDE.md stays lean (CA-035, July 2026) ────────────────────────
// CLAUDE.md is the per-session law, budgeted at ≤400 lines; depth lives in
// the docs/ tree. Without a mechanical ceiling the file regrows one "just
// this once" paragraph at a time (it hit ~19k words before the restructure).
{
  try {
    const claudeMd = read(join(ROOT, 'CLAUDE.md'));
    const lineCount = claudeMd.split('\n').length;
    if (lineCount > 400)
      flag('ERROR', 'claude-md-budget', `CLAUDE.md is ${lineCount} lines (budget 400) — move the excess into the docs/ tree (docs/INDEX.md is the map) and leave a pointer`);
  } catch {
    flag('ERROR', 'claude-md-budget', 'CLAUDE.md not found at repo root — the per-session law file is missing');
  }
}

// ── 17. shuffle() touched only by src/utils/random.js (CA-029, Wave 1) ──
onlyIn('shuffle', /function\s+shuffle\s*\(/, ['src/utils/random.js'], srcFiles,
  'the shuffle primitive is single-sourced in src/utils/random.js — import it instead of redefining');

// ── 18. dummyUser.js stays deleted (CA-035/MOD-012, Wave 1) ─────────────
// Legacy shape reference, unimported everywhere; the July 2026 audit found it
// dead. A regenerated copy (e.g. from an old branch merge) is drift.
{
  const dummyUserPath = join(ROOT, 'src/data/dummyUser.js');
  try {
    statSync(dummyUserPath);
    flag('ERROR', 'dummy-user-deleted', 'src/data/dummyUser.js exists — it was deleted as unused legacy content (CA-035); delete it again rather than reintroducing it');
  } catch {
    // absent, as expected
  }
}

// ── Report ──────────────────────────────────────────────────────────────
const errors = findings.filter(f => f.sev === 'ERROR');
const warns = findings.filter(f => f.sev === 'WARN');
for (const f of findings) console.log(`${f.sev}  [${f.rule}]  ${f.msg}`);
console.log(`\n${tables.length} tables checked, ${srcFiles.length} src files scanned — ${errors.length} error(s), ${warns.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
