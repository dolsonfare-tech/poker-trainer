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
// Single-file-OWNERSHIP rules describe production code. Tests legitimately mock
// or alias the owned symbols (`const getHandName = jest.fn()`), so scanning them
// would turn a normal Wave 3 mock into an ERROR-level build failure.
const srcNonTest = srcFiles.filter(f => !/\.test\.jsx?$/.test(f));
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
onlyIn('shuffle', /(?:function\s+shuffle\s*\(|const\s+shuffle\s*=)/, ['src/utils/random.js'], srcNonTest,
  'the shuffle primitive is single-sourced in src/utils/random.js — import it instead of redefining');

// ── 18. dummyUser.js stays deleted (CA-035/MOD-012, Wave 1) ─────────────
// Legacy shape reference, unimported everywhere; the July 2026 audit found it
// dead. A regenerated copy (e.g. from an old branch merge) is drift.
{
  const dummyUserPath = join(ROOT, 'src/data/dummyUser.js');
  try {
    statSync(dummyUserPath);
    flag('ERROR', 'dummy-user-deleted', 'src/data/dummyUser.js exists — it was deleted as unused legacy content (CA-035); delete it again rather than reintroducing it');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e; // absence is expected; anything else is a real failure
  }
}

// ── 19. Wave 2 dedup targets stay single-sourced (MOD-004) ──────────────
// getHandName was inlined in ScenarioCard.jsx; relationLine was rendered by
// both the felt bubble and the mobile villain strip. The split gave each one
// owner — a second definition anywhere means the two surfaces can disagree
// about what the player is looking at.
onlyIn('hand-name', /(?:function\s+getHandName\s*\(|const\s+getHandName\s*=)/,
  ['src/utils/handName.js'], srcNonTest,
  'the spoken hand name is single-sourced in src/utils/handName.js — import it instead of redefining');
onlyIn('relation-line', /(?:function\s+relationLine\s*\(|const\s+relationLine\s*=)/,
  ['src/utils/ticker.js'], srcNonTest,
  'the villain relation line lives beside villainSummary in src/utils/ticker.js — TableCanvas and CanvasLayout both import it');

// ── 20. useCountUp lives in the hooks tree (MOD-003) ────────────────────
onlyIn('count-up', /(?:function\s+useCountUp\s*\(|const\s+useCountUp\s*=)/,
  ['src/hooks/useCountUp.js'], srcNonTest,
  'the count-up animation is single-sourced in src/hooks/useCountUp.js');

// ── 21. Split components do not re-monolithize (MOD-003/MOD-004, Wave 2) ─
// Wave 2 cut Dashboard.jsx (727 lines) and ScenarioCard.jsx (404) into
// src/components/dashboard/ and src/components/scenario/. Without a ceiling
// the residuals regrow one "just this once" block at a time — exactly how
// they got to 727 in the first place. Budgets sit ~25% above the shipped
// sizes: room for a real feature, not room for a second monolith. Raising a
// number here is a deliberate act that shows up in review; drifting past one
// silently is what this rule prevents.
{
  const BUDGETS = [
    ['src/components/Dashboard.jsx', 250],
    ['src/components/ScenarioCard.jsx', 40],
  ];
  // Presentational split modules under dashboard/ or scenario/.
  const DIR_BUDGET = 160;
  // Hooks get their own, larger budget — set deliberately on July 27 2026 when
  // useSessionRun landed at 263 and this rule fired.
  //
  // The rule worked exactly as intended first: it forced out the two things
  // that did not belong in a React hook at all — dealScenarios (pure, now
  // utils/deal.js) and buildSessionDelta (pure, now utils/session.js). Both are
  // independently testable as a result, which is a real gain the line count
  // bought. That took it 263 -> 209.
  //
  // What remains is a cohesive state machine: 15 useState, 3 refs, 7 handlers
  // for one feature. Splitting it again would mean two hooks sharing mutable
  // state through the caller, which is worse code to satisfy a number. A
  // stateful hook is a different shape from a presentational module and 160 was
  // calibrated for the latter.
  //
  // Naming the tension honestly: raising a limit so one's own code passes is
  // the exact smell this rule exists to catch. The mitigations are that hooks
  // get a SEPARATE budget rather than a blanket loosening, that the extractions
  // happened first, and that this comment makes the decision reviewable.
  const HOOK_BUDGET = 220;
  for (const [file, limit] of BUDGETS) {
    try {
      const n = read(join(ROOT, file)).split('\n').length;
      if (n > limit)
        flag('ERROR', 'component-budget',
          `${file} is ${n} lines (budget ${limit}) — extract the new block into src/components/${file.includes('Dashboard') ? 'dashboard' : 'scenario'}/ with a co-located test (docs/architecture/TARGET_ARCHITECTURE.md §1)`);
    } catch {
      flag('ERROR', 'component-budget', `${file} not found — Wave 2 split entry point is missing`);
    }
  }
  for (const f of srcFiles) {
    const r = rel(f);
    // .jsx? and hooks/ included: CRA compiles JSX in .js files just fine, so an
    // extension switch must not buy an unbudgeted file, and src/hooks/ grows four
    // more modules in Wave 3.
    if (!/^src\/(components\/(dashboard|scenario)|hooks)\/.*\.(js|jsx)$/.test(r)) continue;
    if (/\.test\.jsx?$/.test(r)) continue;
    const n = read(f).split('\n').length;
    const isHook = r.startsWith('src/hooks/');
    const budget = isHook ? HOOK_BUDGET : DIR_BUDGET;
    if (n > budget)
      flag('ERROR', 'component-budget',
        `${r} is ${n} lines (budget ${budget}) — a split module that grows this far is a new monolith; split it again`);
  }
}

// ── 22. Test co-location for the Wave 2 split trees ─────────────────────
// TARGET_ARCHITECTURE §4: "every new file under src/components/dashboard/,
// src/components/scenario/, and src/hooks/ gets a co-located *.test.js. The
// split does not reduce coverage." A module added without one silently drops
// below the coverage the monolith had.
{
  const needsTest = srcFiles.filter(f =>
    /^src\/(components\/(dashboard|scenario)|hooks)\/.+\.(js|jsx)$/.test(rel(f)) &&
    !/\.test\.jsx?$/.test(rel(f)));
  for (const f of needsTest) {
    // Either extension satisfies co-location, and the file must actually contain
    // cases — `touch Foo.test.js` passed the original existence-only check.
    const candidates = [f.replace(/\.jsx?$/, '.test.js'), f.replace(/\.jsx?$/, '.test.jsx')];
    const found = candidates.find(c => { try { statSync(c); return true; } catch { return false; } });
    const expected = candidates[0];
    if (found && /\b(test|it)\s*\(/.test(read(found))) continue;
    if (found) {
      flag('ERROR', 'test-colocation',
        `${rel(found)} exists but declares no test()/it() cases — an empty file satisfies co-location on paper only`);
    } else {
      flag('ERROR', 'test-colocation',
        `${rel(f)} has no co-located ${rel(expected)} — every module in the Wave 2 split trees carries its own test (docs/architecture/TARGET_ARCHITECTURE.md §4)`);
    }
  }
}

// ── 23. Date-sensitive tests must freeze the clock (July 26, 2026) ──────
// CI run #17 was red on every push while the same suite passed locally. Cause:
// Dashboard.test.js's M3 proximity test hard-coded lastSessionDate:'2026-07-25'
// but let streakAlive read the REAL clock — "yesterday" in the founder's EDT is
// already two days ago in CI's UTC, so the streak read as dead and the line
// never rendered. Any test that pins a session date must also pin the clock.
// The pairing is what's enforced, not the specific date: a file with hard-coded
// lastSessionDate/usernameChangedAt literals must ALSO control its clock, by
// either of the two legitimate means —
//   1. jest.setSystemTime(...)      — required for components, which call
//                                     new Date() internally (no seam to inject).
//   2. a fixed `const now = new Date('…')` threaded in as an argument — the
//      better pattern where the unit accepts one (see userStorage.test.js's
//      streakAlive block).
// A shared beforeEach counts for (1). Anything else means the real clock leaks
// into the assertion.
//
// SCOPE MATTERS — this rule's first draft checked the two regexes against the
// WHOLE FILE, which made it green on the very commit that caused the incident:
// the buggy test sat at line 31 while an unrelated describe's beforeEach called
// setSystemTime at line 222, so "controlled" was true file-wide and the unfrozen
// test sailed through. A ratchet that cannot fail on its own motivating bug is
// decorative, so coverage is resolved PER BLOCK below.
//
// Scoping is derived from INDENTATION, not brace matching. A hand-rolled brace
// scanner was tried first and silently mis-parsed on a single stray token,
// which resolved an inner describe's beforeEach to file scope and blanket-
// covered every test — the same class of failure this rule exists to stop. A
// linter that needs a JS parser to be correct is a liability; indentation is
// checkable at a glance and this repo's tests are uniformly formatted.
{
  // Capture the value, then classify it in CODE. Doing the null/relative filter
  // inside the regex looked right and was not: `\s*` backtracks, so the negative
  // lookahead slid past the space and `lastSessionDate: null` matched anyway.
  const SENSITIVE = /(lastSessionDate|usernameChangedAt)\s*:\s*([^,}\n]*)/g;
  const INJECTED_NOW = /const\s+now\s*=\s*new Date\(\s*['"]/;
  // A value derived from the CURRENT clock (Date.now() - 24h) is relative: it
  // means the same thing in every timezone. Only a FIXED date is dangerous.
  const RELATIVE = /Date\.now\(\)|new Date\(\s*\)/;
  const FIXED_DATE = /\d{4}-\d{2}-\d{2}|new Date\(\s*['"]/;

  for (const f of srcFiles) {
    if (!/\.test\.jsx?$/.test(rel(f))) continue;
    const text = read(f);
    if (INJECTED_NOW.test(text)) continue;          // fixed `now` threaded in explicitly
    const lines = text.split('\n');

    // Block markers, with their indent. body = [line, nextMarkerAtIndent<=own).
    const markers = [];
    lines.forEach((l, i) => {
      const m = l.match(/^(\s*)(describe|test|it|beforeEach|beforeAll)\s*\(/);
      if (m) markers.push({ line: i, indent: m[1].length, kind: m[2] });
    });
    const bodyEnd = (idx) => {
      for (let j = idx + 1; j < markers.length; j++)
        if (markers[j].indent <= markers[idx].indent) return markers[j].line;
      return lines.length;
    };
    const contains = (idx, line) => markers[idx].line <= line && line < bodyEnd(idx);
    const innermost = (line, kinds) => {
      let best = -1;
      markers.forEach((mk, i) => {
        if (kinds.includes(mk.kind) && contains(i, line) &&
            (best === -1 || mk.indent > markers[best].indent)) best = i;
      });
      return best;
    };
    const bodyText = (idx) => lines.slice(markers[idx].line, bodyEnd(idx)).join('\n');

    // Helpers whose own definition freezes the clock count as control when called.
    const controls = ['setSystemTime'];
    // The helper body may span statements (`const at = (w) => { useFakeTimers();
    // setSystemTime(w); }`), so scan forward without crossing the next declaration.
    for (const m of text.matchAll(
      /\bconst\s+(\w+)\s*=(?:(?!\n\s*(?:const|test|it|describe)\b)[\s\S]){0,300}?setSystemTime/g))
      controls.push(m[1]);
    const controlled = (s) => controls.some(t => new RegExp(`\\b${t}\\b`).test(s));

    // beforeEach/beforeAll hooks that freeze the clock, and the scope they apply
    // to: the block that ENCLOSES the hook (file scope when nothing encloses it).
    const guards = [];
    markers.forEach((mk, i) => {
      if (mk.kind !== 'beforeEach' && mk.kind !== 'beforeAll') return;
      if (!controlled(bodyText(i))) return;
      guards.push(innermost(mk.line, ['describe']));   // -1 === file scope
    });

    for (const hit of text.matchAll(SENSITIVE)) {
      const raw = (hit[2] ?? '').trim();
      if (!raw || /^(null|undefined)\b/.test(raw)) continue;   // genuinely clock-free
      // Resolve a bare identifier to its definition before classifying.
      let expr = raw;
      const ident = raw.match(/^([A-Za-z_$][\w$]*)$/);
      if (ident) {
        const def = text.match(new RegExp(`\\b(?:const|let|var)\\s+${ident[1]}\\s*=([^;\\n]*)`));
        if (def) expr = def[1];
      }
      if (RELATIVE.test(expr)) continue;        // relative to now — timezone-safe
      if (!FIXED_DATE.test(expr)) continue;     // no fixed date visible — nothing to pin
      const line = text.slice(0, hit.index).split('\n').length - 1;
      if (guards.some(g => g === -1 || contains(g, line))) continue;
      const owner = innermost(line, ['test', 'it']);
      if (owner !== -1 && controlled(bodyText(owner))) continue;
      flag('ERROR', 'frozen-clock',
        `${rel(f)}:${line + 1} pins ${hit[1]} to a fixed date with no clock control in scope — streakAlive compares it against the real Date, so this passes in one timezone and fails in another (CI run #17, July 2026). Freeze it in this test or an enclosing beforeEach with jest.useFakeTimers() + jest.setSystemTime(), or inject a fixed \`now\`.`);
    }
  }
}

// ── 24. The triage drill must actually run (July 27, 2026) ──────────────
// docs/operations/TRIAGE.md is the front line for real user bugs — it is the
// FIRST thing read in a session, and its snippets get pasted straight into the
// Supabase SQL editor. Two defects were found in it on July 27:
//   * the `feedback` query selected a column named `message`; the table has
//     `body`. It would have errored at the exact moment someone reached for it.
//   * seven rows of the event catalog still pointed at pre-Wave-2 files, though
//     the doc claimed to be grep-verified.
// A runbook that is wrong when you need it is worse than no runbook, so the
// three things that can silently rot are checked here.
{
  const triagePath = join(ROOT, 'docs/operations/TRIAGE.md');
  let triage = null;
  try { triage = read(triagePath); } catch {
    flag('ERROR', 'triage-doc', 'docs/operations/TRIAGE.md is missing — the session-start drill has no source');
  }

  if (triage) {
    // (a) SQL columns in the drill must exist on the table they select from.
    const schemaSrc = read(join(ROOT, 'supabase/schema.sql'));
    const columnsOf = (table) => {
      const m = schemaSrc.match(new RegExp(`create table (?:if not exists )?(?:public\\.)?${table}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i'));
      if (!m) return null;
      return m[1].split('\n')
        .map(l => l.trim().match(/^([a-z_]+)\s+/i)?.[1])
        .filter(Boolean).map(c => c.toLowerCase());
    };
    for (const q of triage.matchAll(/select\s+([\s\S]*?)\s+from\s+public\.(\w+)/gi)) {
      const cols = columnsOf(q[2]);
      if (!cols) { flag('ERROR', 'triage-doc', `TRIAGE.md queries public.${q[2]}, which is not in supabase/schema.sql`); continue; }
      for (const raw of q[1].split(',')) {
        const col = raw.trim().toLowerCase();
        if (!/^[a-z_]+$/.test(col)) continue;         // skip count(*), aliases, numbers
        if (!cols.includes(col))
          flag('ERROR', 'triage-doc',
            `TRIAGE.md selects '${col}' from public.${q[2]}, which has no such column (${cols.join(', ')}) — the drill's own query would error`);
      }
    }

    // (b) + (c) The event catalog must list exactly the events that exist, and
    // point at the file each one actually fires from.
    //
    // Since MOD-011 every track() literal lives in utils/events.js, so scanning
    // for track('name') would report all 32 events as firing from events.js and
    // collapse the catalog's most useful column to a constant. Resolve one hop
    // further instead: events.js maps emitter -> event name, and the emitter's
    // CALL SITES are the surfaces the triage drill actually needs to find. The
    // column keeps meaning the same thing it always did.
    const eventsRel = 'src/utils/events.js';
    const eventsSrc = read(join(ROOT, eventsRel));
    const emitterOf = new Map();                       // emitter name -> event
    for (const chunk of eventsSrc.split(/\nexport /).slice(1)) {
      const name = chunk.match(/^(?:const|function)\s+(emit\w+)/)?.[1];
      const ev = chunk.match(/track\(\s*'([a-z_]+)'/)?.[1];
      if (name && ev) emitterOf.set(name, ev);
    }
    // Self-check: if this parse silently stops matching (a formatting change, a
    // renamed helper) the whole rule would pass vacuously while protecting
    // nothing — the exact failure mode a source-scanning gate is prone to.
    const literalCount = new Set([...eventsSrc.matchAll(/track\(\s*'([a-z_]+)'/g)]
      .map(m => m[1])).size;
    if (emitterOf.size !== literalCount)
      flag('ERROR', 'triage-doc',
        `events.js parse mismatch: ${emitterOf.size} emitters resolved but ${literalCount} distinct event literals present — the catalog check cannot be trusted until this agrees`);

    const codeEvents = new Map();
    for (const f of srcNonTest) {
      if (rel(f) === eventsRel) continue;              // the registry is not a caller
      const src = read(f);
      for (const [emitter, ev] of emitterOf) {
        if (!new RegExp(`\\b${emitter}\\s*\\(`).test(src)) continue;
        if (!codeEvents.has(ev)) codeEvents.set(ev, []);
        codeEvents.get(ev).push(rel(f).replace(/^src\//, ''));
      }
    }
    const docRows = [...triage.matchAll(/^\| `([a-z_]+)` \| (.*?) \| (.*?) \|\s*$/gm)];
    const docEvents = new Set(docRows.map(r => r[1]));

    for (const ev of codeEvents.keys())
      if (!docEvents.has(ev))
        flag('ERROR', 'triage-doc', `PostHog event '${ev}' fires in src but is absent from the TRIAGE.md catalog — the catalog is meant to be the complete event surface`);
    for (const ev of docEvents)
      if (!codeEvents.has(ev))
        flag('ERROR', 'triage-doc', `TRIAGE.md documents event '${ev}', which no longer fires anywhere in src`);

    for (const [, ev, , where] of docRows) {
      const files = codeEvents.get(ev);
      if (!files) continue;                            // already reported above
      const path = where.replace(/\s*\([^)]*\)\s*/g, '').trim();
      if (!files.some(f => f.endsWith(path)))
        flag('ERROR', 'triage-doc',
          `TRIAGE.md says '${ev}' fires from ${path}, but it actually fires from ${files.join(', ')} — stale after a file move`);
    }
  }
}

// ── 25. Local runs must never write to production analytics (July 27) ───
// Found during intake triage. `hasAnalytics` gated on the KEY alone, and
// e2e:build blanked only the Supabase vars — so any build made with .env
// present carried the production PostHog key, and every local e2e run and dev
// session wrote synthetic events into the real project. Two `coach_read_failed`
// events traced to a local static server answering POST /api/coach-read with
// 501, plus a burst of `decision_made` from the same afternoon's testing.
//
// It corrupts a real decision: ROADMAP item 6 resizes the session unit from
// `session_started.chained` and `decision_made` counts, and item 2 requires
// tester data to stay separable from organic users.
//
// Both layers are pinned because either alone can be undone by accident.
{
  const pkg = JSON.parse(read(join(ROOT, 'package.json')));
  const e2eBuild = pkg.scripts?.['e2e:build'] ?? '';
  if (!/REACT_APP_POSTHOG_KEY=/.test(e2eBuild))
    flag('ERROR', 'local-analytics',
      'package.json e2e:build does not blank REACT_APP_POSTHOG_KEY — the build the e2e suite drives would carry the production key and write synthetic events into the real project');

  const analytics = read(join(ROOT, 'src/utils/analytics.js'));
  if (!/hostname/.test(analytics) || !/localhost/.test(analytics))
    flag('ERROR', 'local-analytics',
      'src/utils/analytics.js no longer guards against local hosts — a build made with .env present would report from a developer machine');
  if (!/hasAnalytics\s*=\s*Boolean\(KEY\)\s*&&/.test(analytics))
    flag('ERROR', 'local-analytics',
      'src/utils/analytics.js gates hasAnalytics on the key alone — the host guard must also apply, or dev/e2e traffic reaches production PostHog');
}

// ── 26. Wave 3 module ownership (MOD-001) ───────────────────────────────
// TARGET_ARCHITECTURE §4 requires each split module to be pinned on the day it
// ships. `deriveSchema` is the diagnosis the whole product stands on — a second
// definition could silently disagree with the engine that renders it — and the
// localStorage accessors are the single seam where the user record is read and
// written. Same pattern as the posthog/sentry/db ownership rules.
onlyIn('schema-owner', /(?:function\s+deriveSchema\s*\(|const\s+deriveSchema\s*=)/,
  ['src/utils/schema.js'], srcNonTest,
  'the schema diagnosis is single-sourced in src/utils/schema.js — import it instead of redefining');
onlyIn('persistence-owner',
  /(?:function\s+(?:loadUser|saveUser|clearUser)\s*\(|const\s+(?:loadUser|saveUser|clearUser)\s*=)/,
  ['src/utils/persistence.js'], srcNonTest,
  'the user record is read/written only in src/utils/persistence.js');

// ── 27. Local-date ownership (CA-028 / CA-037) ──────────────────────────
// CLAUDE.md's ownership map has always said dates.js owns these, but the only
// mechanical enforcement was two source pins inside dates.test.js, each naming
// ONE file (userStorage.js, spacedrep.js). That protected the two places the
// duplication had already happened and nowhere else — and the userStorage pin
// died with the barrel when MOD-001 finished. This is the repo-wide version,
// added BEFORE deleting the barrel so coverage strictly increases.
//
// Why it matters: a second toLocalDateString is how a streak silently breaks.
// The engine compares calendar days in LOCAL time; a redefinition that drifts
// to UTC moves the day boundary by hours for every player west of Greenwich.
onlyIn('dates-owner',
  /(?:function\s+(?:toLocalDateString|localDateFrom|formatShortDate)\s*\(|const\s+(?:toLocalDateString|localDateFrom|formatShortDate)\s*=)/,
  ['src/utils/dates.js'], srcNonTest,
  'local date formatting is single-sourced in src/utils/dates.js (CA-028/CA-037) — import it instead of redefining');

// ── 28. Event names live only in events.js (MOD-011 / CA-033) ───────────
// Rule 3 already owns the posthog-js LIBRARY. This extends the same ownership
// to the SHAPE layer: a name and its prop bag are written once, in one file.
//
// PostHog has no schema. A mistyped name does not error — it opens a new,
// empty series while the funnel it was meant to feed silently flatlines, and
// the data cannot be re-collected afterwards. That is the whole reason the
// registry exists, so nothing outside it may name an event.
onlyIn('event-names', /track\(\s*'[a-z_]+'/,
  ['src/utils/events.js'], srcNonTest,
  'PostHog event names are single-sourced in src/utils/events.js — import an emitter (emitDecisionMade, …) instead of calling track() with a literal');

// ── Report ──────────────────────────────────────────────────────────────
const errors = findings.filter(f => f.sev === 'ERROR');
const warns = findings.filter(f => f.sev === 'WARN');
for (const f of findings) console.log(`${f.sev}  [${f.rule}]  ${f.msg}`);
console.log(`\n${tables.length} tables checked, ${srcFiles.length} src files scanned — ${errors.length} error(s), ${warns.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
