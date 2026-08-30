// Production smoke test for the Coach's Read endpoint.
//
//   npm run smoke:coach                          (free: deploy + config, no token, no cost)
//   COACH_SMOKE_TOKEN=eyJ... npm run smoke:coach (adds the authed path — see the cost note)
//   npm run smoke:coach -- --url https://...     (point at a preview deployment)
//   npm run smoke:coach -- --selftest            (offline; exercises analyzeRead, no network)
//
// ── Why this gate exists ──────────────────────────────────────────────────
// Every OTHER check in this repo runs against local files. `npm run gates`
// loads the real ESM; jest loads the real ESM; `eval:coach` loads the real ESM.
// The one thing none of them can see is the DEPLOYED lambda, and that is
// precisely where this feature has already died once: on July 29, 2026 Vercel's
// builder transpiled the traced src/ files to CommonJS, `import()` wrapped
// module.exports a level deeper, and `scen.default.map is not a function` took
// every production read down while every local gate stayed green (see the
// nsNamed/nsDefault normalizers in api/coach-read.js).
//
// The monitoring answer at the time was "watch PostHog coach_read_failed". That
// signal is REACTIVE: it only fires when a real user triggers a read. Between
// 2026-08-02 and 2026-08-30 the product had no users, so the metric sat at zero
// — which is byte-identical to "everything is fine". A health check whose
// healthy state and whose no-data state are the same value is not a health
// check. This script is the active probe that replaces it.
//
// ── Two tiers, because the useful one costs money ─────────────────────────
// Tier 1 (always, free, no writes) infers the deployment's configuration from
// the handler's early-return ORDER — see STAGES below. It needs no credentials
// and is safe to run on every deploy.
//
// Tier 2 (only with COACH_SMOKE_TOKEN) crosses the auth wall, which is the only
// way to reach the dynamic import that failed in July. Against an account with
// sessions it spends ONE Sonnet call, one of that user's five daily reads, and
// stamps the result onto their newest session row. Against an account with NO
// sessions it costs nothing and still proves the module load — the empty-log
// guard sits AFTER loadModules(), so 400 and 500 discriminate for free.
//
// Caps are NOT enforced here. `eval:coach` owns that and single-sources the
// numbers from api/coach-read.js; a second enforcer is the exact harness/prompt
// drift that cost two live runs in July. V3_CAPS is imported for DISPLAY, so
// the measurements print against the real contract and can never disagree with
// it. What this script hard-fails on is what only production can tell you.
import coach from '../api/coach-read.js';

const { V3_CAPS } = coach;

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const BASE = arg('--url', 'https://www.checkraise.ai').replace(/\/$/, '');
const ENDPOINT = `${BASE}/api/coach-read`;
const TOKEN = process.env.COACH_SMOKE_TOKEN || '';
// Offline exercise of the content checks themselves. No network, no token, no
// cost — so it can run in `gates` where the live probes never could.
const SELFTEST = process.argv.includes('--selftest');

// The handler returns a DISTINCT error string at every failure stage, and that
// was a deliberate design decision after the July outage: a module-load failure
// had to become a logged, structured 500 rather than the platform's
// FUNCTION_INVOCATION_FAILED, which bypasses every client error path and is
// invisible outside Vercel's own logs (api/coach-read.js, the comment above
// loadModules). That taxonomy is what lets ONE request localize a fault instead
// of reporting "it's broken". Keep this table in sync with the handler's
// res.status(...).json({ error }) calls.
const STAGES = {
  'Method not allowed': 'the method guard — expected, the handler is alive',
  'Sign in required': 'the auth wall — expected without a token',
  'API key not configured':
    'CLAUDE_API_KEY is MISSING from the deployment environment. The read is dead for '
    + 'every user until it is restored in the Vercel dashboard (Sensitive, server-only)',
  'Coach unavailable':
    'the api/ -> src/ DYNAMIC IMPORT FAILED inside the lambda. This is the July 29, 2026 '
    + 'outage class: check the nsNamed/nsDefault normalizers in api/coach-read.js, that '
    + 'every relative import in the traced subtree is fully specified (invariants rule 29), '
    + 'and that engines.node is still pinned to 24.x',
  'Could not load session history':
    'the Supabase sessions query failed — a DB outage or a credentials problem, NOT an empty log',
  'No sessions to read':
    'authenticated, module load fine, but the log came back empty',
  'Upstream API error':
    'Anthropic REJECTED the call. A revoked or invalid CLAUDE_API_KEY lands here',
  'Upstream API call failed':
    'the model call threw — a network fault or a malformed request',
  'Daily coach limit reached':
    'this user has spent all five of today\'s reads; re-run tomorrow or use another account',
};

let failed = false;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { console.log(`  ✗ ${m}`); failed = true; };
const warn = (m) => console.log(`  ⚠ ${m}`);
const why = (e) => (STAGES[e] ? `\n      → ${STAGES[e]}` : '');

async function call(method, headers = {}) {
  const res = await fetch(ENDPOINT, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(method === 'POST' ? { body: '{}' } : {}),
  });
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON: reported as a raw status */ }
  return { status: res.status, body, error: body?.error };
}

if (SELFTEST) runSelftest(); // never returns — exits with its own status

console.log(`\nCoach's Read — production smoke\n  target: ${ENDPOINT}\n  mode:   ${TOKEN ? 'tier 1 + 2 (token supplied)' : 'tier 1 only (no COACH_SMOKE_TOKEN)'}\n`);

// ── Tier 1: the endpoint is deployed, and configured ──────────────────────
// Free, unauthenticated, no writes. Each assertion below is load-bearing for a
// DIFFERENT deployment failure, which is why both are checked rather than one.
console.log('Tier 1 — deploy + configuration (free)');

const get = await call('GET');
if (get.status === 405 && get.error === 'Method not allowed') {
  ok('GET → 405 Method not allowed — the lambda deploys, routes, and boots');
} else {
  bad(`GET → ${get.status} ${JSON.stringify(get.body)} — expected 405.${why(get.error)}\n`
    + '      A 404 means the function is not deployed at this path; a 500 means it '
    + 'crashed before reaching the method guard (a top-level require failing).');
}

// This one assertion covers THREE environment variables at once, by exploiting
// the handler's early-return order:
//   - CLAUDE_API_KEY missing        → 500 'API key not configured' (checked first)
//   - SUPABASE_URL/SECRET_KEY missing → the whole auth block is skipped, so
//     sessions stays [] and the handler falls to 400 'No sessions to read'.
//     It fails CLOSED, which is correct, but it also means auth, the daily cap
//     and the tenant scope are all silently disabled — so 400 here is a
//     security finding, not just a dead feature.
//   - all three present             → 401 'Sign in required'
const anon = await call('POST');
if (anon.status === 401 && anon.error === 'Sign in required') {
  ok('POST (no auth) → 401 Sign in required — CLAUDE_API_KEY, SUPABASE_URL and '
    + 'SUPABASE_SECRET_KEY are all present, and the auth wall is up');
} else if (anon.status === 400 && anon.error === 'No sessions to read') {
  bad('POST (no auth) → 400 No sessions to read — SUPABASE_URL or SUPABASE_SECRET_KEY is '
    + 'MISSING. The handler skipped its entire auth block, which disables the sign-in '
    + 'requirement, the per-user daily cap AND the .eq(user_id) tenant scope at once. '
    + 'It fails closed today only because the empty window stops it downstream.');
} else {
  bad(`POST (no auth) → ${anon.status} ${JSON.stringify(anon.body)} — expected 401.${why(anon.error)}`);
}

// ── Tier 2: across the auth wall ──────────────────────────────────────────
if (!TOKEN) {
  console.log('\nTier 2 — SKIPPED (no COACH_SMOKE_TOKEN)');
  console.log('  The dynamic api/ -> src/ import sits BEHIND the auth wall, so tier 1 cannot');
  console.log('  reach it. That import is the line that took production down in July, so a');
  console.log('  green tier 1 is NOT a verified read. To cover it, sign in at the target and:');
  console.log('    COACH_SMOKE_TOKEN="$(...access_token from localStorage...)" npm run smoke:coach');
  console.log('  An account with NO sessions proves the module load for free (400, no model call).');
} else {
  console.log('\nTier 2 — authenticated path (token supplied)');
  const authed = await call('POST', { Authorization: `Bearer ${TOKEN}` });

  if (authed.status === 400 && authed.error === 'No sessions to read') {
    // The free win: loadModules() runs BEFORE the sessions query, so reaching the
    // empty-log guard at all proves the import resolved inside the lambda.
    ok('POST (authed, empty log) → 400 No sessions to read — the api/ -> src/ dynamic '
      + 'import RESOLVED in the lambda. No model call, no write, no cap charge.');
    warn('the model call, the structured-output schema and the stamp-back are NOT covered '
      + 'by this account — re-run against a user with at least one session for full coverage');
  } else if (authed.status === 200 && authed.body?.text) {
    ok('POST (authed) → 200 — the FULL path works: module load, window query, aggregate, '
      + 'the Claude call, and the structured-output schema');
    checkRead(authed.body.text);
  } else if (authed.status === 401) {
    bad('POST (authed) → 401 Sign in required — the token was rejected. Supabase access '
      + 'tokens expire in about an hour; grab a fresh one and re-run.');
  } else {
    bad(`POST (authed) → ${authed.status} ${JSON.stringify(authed.body)}.${why(authed.error)}`);
  }
}

// Validates the wire format the client actually renders. normalizeCoachRead()
// re-serializes to canonical two-field JSON on success and passes the model's
// raw text through on any parse failure, so prose here is not a crash — it is
// the documented degradation, and it means the model broke its schema.
//
// PURE, and separated from the printing on purpose: this is the only branch of
// the script that a green tier-1 run never executes, so without an offline way
// to exercise it a typo in here would report success on a broken read forever.
// That is the July 29, 2026 defect class exactly — a tick that meant only
// "control reached this line". --selftest below drives this function over
// fixtures; the network path just prints what it returns.
function analyzeRead(text) {
  const out = [];
  const ok_ = (m) => out.push({ level: 'ok', msg: m });
  const bad_ = (m) => out.push({ level: 'bad', msg: m });

  let read;
  try {
    read = JSON.parse(text);
  } catch {
    bad_('the read is NOT JSON — normalizeCoachRead passed raw text through, so the model '
      + 'broke the structured-output schema and the client is rendering legacy prose:\n'
      + `      ${String(text).slice(0, 160)}`);
    return { findings: out, measured: null };
  }

  const str = (v) => typeof v === 'string' && v.trim().length > 0;
  if (!read || typeof read !== 'object' || !str(read.headline) || !str(read.watchFor)) {
    bad_(`wrong wire format — got keys [${Object.keys(read ?? {}).join(', ')}], expected exactly `
      + 'headline and watchFor as non-empty strings');
    return { findings: out, measured: null };
  }
  ok_('canonical v3 wire format — headline and watchFor, both non-empty strings');

  // v3 dropped `evidence`, and COACH_SCHEMA sets additionalProperties:false. An
  // extra key means the deployed schema is not the one in this repo.
  const extras = Object.keys(read).filter((k) => k !== 'headline' && k !== 'watchFor');
  if (extras.length) {
    bad_(`unexpected field(s) [${extras.join(', ')}] — the DEPLOYED COACH_SCHEMA is not the `
      + 'two-field v3 schema in api/coach-read.js. Is the deployment stale?');
  }

  // The one absolute rule of v3, so it is the one hard content gate here:
  // no digit may appear in either field, in any form.
  for (const field of ['headline', 'watchFor']) {
    const digits = read[field].match(/\d/g) ?? [];
    if (digits.length) {
      bad_(`${field} contains ${digits.length} numeral(s) [${digits.join('')}] — v3 bans every `
        + 'digit in both fields; thresholds belong in words');
    } else {
      ok_(`${field} contains no numerals`);
    }
  }

  // Reported, never enforced — eval:coach owns the caps and their ±2 tolerance
  // across nine personas. One real read is n=1 and is not a basis for a verdict.
  const count = (s) => s.trim().split(/\s+/).filter(Boolean).length;
  const headline = count(read.headline);
  const watchFor = count(read.watchFor);
  return {
    findings: out,
    measured: { headline, watchFor, total: headline + watchFor, read },
  };
}

// Prints what analyzeRead found, against the imported V3_CAPS so the displayed
// caps can never drift from the contract the prompt actually states.
function checkRead(text) {
  const { findings, measured } = analyzeRead(text);
  for (const f of findings) (f.level === 'ok' ? ok : bad)(f.msg);
  if (!measured) return;
  console.log('\n  measured (reported, not gated — eval:coach enforces these):');
  console.log(`    headline ${measured.headline}w / cap ${V3_CAPS.headline}   `
    + `watchFor ${measured.watchFor}w / cap ${V3_CAPS.watchFor}   `
    + `total ${measured.total}w / cap ${V3_CAPS.total}`);
  console.log(`\n  headline: ${measured.read.headline}`);
  console.log(`  watchFor: ${measured.read.watchFor}`);
}

console.log(`\n${failed ? 'COACH SMOKE FAILED' : 'coach smoke passed'}${TOKEN ? '' : ' (tier 1 only — the module-load path is unverified)'}\n`);
process.exit(failed ? 1 : 0);

// ── --selftest: does analyzeRead actually catch anything? ─────────────────
// The success branch only runs on a live 200, so on a normal day nothing here
// executes and a defect in it is invisible. Every case below is a NEGATIVE
// control except the first: each supplies a read that is broken in exactly one
// way and asserts the specific complaint, so a check that silently stopped
// working fails this instead of passing production.
function runSelftest() {
  // The known-good fixture is the ACTUAL first verified production read
  // (2026-08-30). Pinning the real shipped payload means the happy path is
  // asserted against something the deployed system genuinely produced, not
  // against a hand-written guess at its shape.
  const REAL = JSON.stringify({
    headline: "You've been snap calling confidently against tight players lately, and it's costing you.",
    watchFor: 'A Tight Nit rarely opens light, so when one raises, pause before continuing '
      + 'and tighten your calling range to hands that beat theirs.',
  });
  const mk = (o) => JSON.stringify(o);
  const good = { headline: 'You have been folding too early lately.', watchFor: 'Pause and count your outs.' };

  // [name, payload, expected /bad/ pattern or null for "must be clean"]
  const CASES = [
    ['the real production read passes clean', REAL, null],
    ['prose instead of JSON is caught',
      'You have been playing too passively lately.', /NOT JSON/],
    ['a missing watchFor is caught', mk({ headline: good.headline }), /wrong wire format/],
    ['an empty headline is caught', mk({ ...good, headline: '   ' }), /wrong wire format/],
    ['a non-string field is caught', mk({ ...good, watchFor: 42 }), /wrong wire format/],
    ['the v2 three-field shape is caught',
      mk({ ...good, evidence: 'four of nine' }), /unexpected field\(s\) \[evidence\]/],
    ['a numeral in watchFor is caught',
      mk({ ...good, watchFor: 'Bet 3 times.' }), /watchFor contains 1 numeral/],
    ['a numeral in the headline is caught',
      mk({ ...good, headline: 'You folded 4 times lately.' }), /headline contains 1 numeral/],
    ['a decimal is still caught', mk({ ...good, watchFor: 'Call at 2.5 to one.' }),
      /watchFor contains 2 numeral/],
    ['a spelled-out threshold is NOT flagged',
      mk({ ...good, watchFor: 'When the bet is less than half the pot, look again.' }), null],
  ];

  console.log('\nsmoke-coach --selftest (offline, no network)\n');
  let bad_ = 0;
  for (const [name, payload, expect] of CASES) {
    const { findings } = analyzeRead(payload);
    const complaints = findings.filter((f) => f.level === 'bad').map((f) => f.msg);
    const hit = expect ? complaints.some((m) => expect.test(m)) : complaints.length === 0;
    if (hit) {
      console.log(`  ✓ ${name}`);
    } else {
      bad_ += 1;
      console.log(`  ✗ ${name}`);
      console.log(`      expected: ${expect ? expect.source : '(no complaints)'}`);
      console.log(`      got:      ${complaints.length ? complaints.join(' | ').slice(0, 200) : '(none)'}`);
    }
  }

  // Pins the word counter itself. Without this the caps could be printed from a
  // counter that had quietly started splitting differently, and every reported
  // measurement would be wrong while all the checks above stayed green.
  const m = analyzeRead(REAL).measured;
  const EXPECT = { headline: 13, watchFor: 23, total: 36 };
  if (m && m.headline === EXPECT.headline && m.watchFor === EXPECT.watchFor && m.total === EXPECT.total) {
    console.log(`  ✓ word counts on the real read: ${m.headline}/${m.watchFor}/${m.total}`);
  } else {
    bad_ += 1;
    console.log(`  ✗ word counts drifted — expected ${EXPECT.headline}/${EXPECT.watchFor}/${EXPECT.total}, `
      + `got ${m ? `${m.headline}/${m.watchFor}/${m.total}` : '(no measurement)'}`);
  }

  console.log(`\n${bad_ ? `SELFTEST FAILED (${bad_})` : `selftest passed (${CASES.length + 1} checks)`}\n`);
  process.exit(bad_ ? 1 : 0);
}
