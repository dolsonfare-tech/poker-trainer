// Coach's Read eval harness — runs the REAL prompt (imported from
// api/coach-read.js, the only Anthropic caller) over the REAL aggregate()
// against synthetic TWENTY-session histories — the trailing ten the read speaks
// over, plus the ten before them that feed the accuracy comparison — one per
// player schema plus edge personas, and writes the reads to
// coach-eval-output.md (LIVE) or coach-eval-dry-prompts.md (--dry) for review
// against the F5 quality bar:
//   1. Names the pattern-level WHY (the mental model), not per-hand recaps
//   2. Names the DIRECTION of the mistakes (too passive vs too aggressive)
//   3. CONDITIONAL — when the window contains confident errors or repeated
//      spots, the read references the villain types in them, not just abstract
//      skills. Villains reach the prompt through those two lists and nowhere
//      else, so a window with neither carries no villain string at all and this
//      criterion does not apply to it. The Window block below prints both
//      counts; judge criterion 3 only where they are non-zero. A read that HAS
//      villain data and ignores it still fails.
//   4. Calls out clustered confident misses ("answered fast") directly
//   5. Human tone; no generic praise, no restating results the player saw
//   6. Stretch-scoped trend voice ("what I have been seeing lately"), never a
//      trait verdict ("you are a passive player") — Phase B reframe. Naming
//      the player's TYPE is the schema card's job, not the read's.
//
// Run:  CLAUDE_API_KEY=sk-... npm run eval:coach        (live calls, ~9 reads)
//       npm run eval:coach -- --dry                     (print prompts only)
//
// --dry writes a DIFFERENT file and can never overwrite a live artifact; both
// files state their own run mode and timestamp at the top. See OUT_LIVE below.
//
// The key is Vercel-only by design — never commit it, never put it in .env.

import { writeFileSync } from 'node:fs';
import SCENARIOS from '../src/data/scenarios.js';
import { aggregate } from '../src/utils/coachWindow.js';
import coach from '../api/coach-read.js';

// HEADLINE_RULE and WORD_CAPS come from the prompt module on purpose: the
// harness must measure what the prompt ASKS for, never a second copy of the
// numbers. See the comments beside their definitions in api/coach-read.js.
const { buildPrompt, callClaude, buildLookup, HEADLINE_RULE, WORD_CAPS } = coach;
const DRY = process.argv.includes('--dry');
// Offline exercise of the mechanical checks themselves — see the --selftest
// block further down. No API key, no artifact written.
const SELFTEST = process.argv.includes('--selftest');

// ── Artifact safety (live eval finding 1, July 29 2026) ───────────────────
// A dry run used to write the SAME coach-eval-output.md as a live run, filled
// with "(dry run — no API call)" placeholders. The file is gitignored and
// untracked, so there is no recovery. The founder inspected a prompt with --dry
// between two live runs, silently destroyed the live output, and then scored a
// full round of F5 measurements against placeholder text. Everything came back
// green and nothing in the harness could have said the green was fake.
//
// Two separate defences, because either alone can be undone by an edit:
//   1. The two modes write to DIFFERENT paths. A dry run cannot name the live
//      artifact, so it cannot destroy one.
//   2. Every artifact states its own mode and generation time on line 1 and in
//      the banner below it. Reading a stale file and guessing which run made it
//      is what turned a harmless mistake into a wasted measurement round.
// Behavioural negative control (create a live artifact, run dry, assert the
// live file is byte-identical) is check-invariants rule 32, so it runs on every
// `npm run gates` rather than on the day someone remembers.
const OUT_LIVE = 'coach-eval-output.md';
const OUT_DRY = 'coach-eval-dry-prompts.md';
const OUT = DRY ? OUT_DRY : OUT_LIVE;
// Defence in depth: if a future edit ever collapses the two constants, fail
// loudly instead of overwriting the artifact this whole block exists to protect.
if (DRY && OUT === OUT_LIVE) {
  console.error(`Refusing to run: dry mode resolved to the LIVE artifact path (${OUT_LIVE}).`);
  process.exit(1);
}

// Wrong-answer picker: prefer an option in `prefCls` that isn't the correct
// answer; fall back to any wrong option.
function pickWrong(s, prefCls = []) {
  const wrong = s.options.filter((o) => o.val !== s.correct);
  return wrong.find((o) => prefCls.includes(o.cls)) ?? wrong[0];
}

const bySkills = (skills) => SCENARIOS.filter((s) => skills.includes(s.skill));
// Narrow a pool to scenarios whose RECOMMENDED play has this cls — e.g. the
// Gambler persona needs spots where folding is right so his call is truly
// price-blind, not merely under-aggressive.
const byCorrectCls = (pool, cls) =>
  pool.filter((s) => s.options.find((o) => o.val === s.correct)?.cls === cls);

// The harness now exercises the REAL aggregate(), the REAL prompt and the REAL
// lookup, so the hand-synced copy of the payload mapping is gone. Personas are
// expressed as stored hands — { scenarioId, skill, result, choiceVal,
// decisionMs } — which is exactly what sessions.hands holds in the database.
//
// buildLookup is imported rather than reimplemented: a second copy of the
// mapping would let a rename of `villain.label` pass the eval while breaking the
// endpoint, which is the drift this harness exists to catch.
const lookup = buildLookup(SCENARIOS);

// One stored hand. `choiceVal` is the option the persona ACTUALLY chose (null
// on a timeout, matching useSessionRun) — it is what schema.js reads to
// classify the direction of the error, so it must be the wrongCls-preferred
// option and not an independently re-picked one, or every persona's leak would
// collapse into the same directional noise.
// decisionMs: under CONFIDENT_MISS_MS (15000) marks the fast/confident misses;
// null on a timeout, which is the freeze signal and never a confident miss.
const storedHand = (s, choseOpt, result, fast) => ({
  scenarioId: s.id,
  skill: s.skill,
  result,
  choiceVal: choseOpt ? choseOpt.val : null,
  decisionMs: choseOpt == null ? null : (fast && result !== 'correct' ? 4000 : 30000),
});

// Build a persona's hands: `plan` is a list of
// { pool, wrongCls | correct: true | timeout: true, fast?: true } — one hand each.
function buildDecisions(plan) {
  const used = new Set();
  return plan.map((step) => {
    // A wrongCls step needs a scenario where that wrong answer EXISTS (e.g. a
    // "calls without the price" persona needs a spot where the recommended
    // play is NOT call) — otherwise the persona plays the wrong leak and the
    // eval judges the coach against a session it wasn't given.
    const fits = (sc) => !used.has(sc.id) && (
      !step.wrongCls ||
      sc.options.some((o) => o.val !== sc.correct && step.wrongCls.includes(o.cls))
    );
    const s = step.pool.find(fits) ?? step.pool.find((sc) => !used.has(sc.id))
      ?? SCENARIOS.find((sc) => !used.has(sc.id));
    used.add(s.id);
    const correctOpt = s.options.find((o) => o.val === s.correct);
    if (step.timeout) {
      return storedHand(s, null, 'incorrect', false);
    }
    if (step.correct) {
      return storedHand(s, correctOpt, 'correct', false);
    }
    const choseOpt = pickWrong(s, step.wrongCls ?? []);
    const result = s.grading[choseOpt.val]?.g ?? 'incorrect';
    return storedHand(s, choseOpt, result, !!step.fast && result !== 'correct');
  });
}

// A trend review fed one session's worth of hands would not exercise the prompt
// it is judging, so each persona's five-step leak shape is repeated ten times
// rather than authoring fifty new steps.
//
// NOTE: `used` in buildDecisions spans a whole stretch, so no scenario repeats
// within one. That keeps every hand a distinct spot, and it means aggregate()'s
// `repeats` (same scenario missed more than once) is always empty here — the
// prompt renders its "No spot was missed more than once." branch for all nine
// personas. Real players DO repeat spots (the R1 ladder re-deals missed hands),
// so that prompt branch is live in production but knowingly unexercised here.
const TEN_SESSIONS = (steps) => Array.from({ length: 10 }, () => steps).flat();

// The stretch BEFORE the one the read speaks about — the same persona playing at
// a different level. `priorCorrect` is how many of its five steps landed correct
// back then, against the same five pools.
//
// This is sound because of how aggregate() is scoped: `skills`, `direction`,
// `confidentMisses` and `repeats` all read slice(0, COACH_WINDOW) — the WINDOW
// only — so the older stretch reaches the prompt through previous.correct/total
// and nothing else. Every persona's diagnosis is untouched; the comparison
// sentence just gets something real to compare against. `fast` and `timeout` are
// deliberately dropped: they would be invisible anyway.
const priorSteps = (steps, priorCorrect) =>
  steps.map((st, i) => (i < priorCorrect
    ? { pool: st.pool, correct: true }
    : { pool: st.pool, wrongCls: st.wrongCls ?? ['fold', 'call', 'raise'] }));

// Twenty sessions, NEWEST FIRST: the trailing ten the read speaks over, then the
// ten before them that only feed the accuracy comparison. Each stretch gets its
// own buildDecisions call (and so its own `used` set), which keeps both leak
// shapes intact; overlap between the two is harmless since nothing cross-reads.
const chunk = (hands) => {
  const out = [];
  for (let i = 0; i < hands.length; i += 5) out.push({ hands: hands.slice(i, i + 5) });
  return out;
};
const buildWindow = (p) => [
  ...chunk(buildDecisions(TEN_SESSIONS(p.plan))),
  ...chunk(buildDecisions(TEN_SESSIONS(priorSteps(p.plan, p.priorCorrect)))),
];

// One persona per schema (leak expressed in the schema's direction on its
// primary skills), plus edge personas the prompt must also handle well.
const PERSONAS = [
  {
    name: 'Conflict Avoider',
    priorCorrect: 1,   // improving  20% -> 40%
    expect: 'Over-folding / passivity named as the pattern; direction = too passive.',
    plan: [
      { pool: bySkills(['aggression', 'bluffing']), wrongCls: ['fold', 'call'] },
      { pool: bySkills(['aggression']), wrongCls: ['fold', 'call'] },
      { pool: bySkills(['betsize']), wrongCls: ['fold', 'call'] },
      { pool: bySkills(['potodds']), correct: true },
      { pool: bySkills(['preflop']), correct: true },
    ],
  },
  {
    name: 'Overaggressor',
    priorCorrect: 3,   // regressing 60% -> 40%
    expect: 'Forcing action / raising into strength named; direction = too aggressive.',
    plan: [
      { pool: bySkills(['potodds', 'reads']), wrongCls: ['raise'] },
      { pool: bySkills(['bluffing']), wrongCls: ['raise'] },
      { pool: bySkills(['reads']), wrongCls: ['raise'] },
      { pool: bySkills(['aggression']), correct: true },
      { pool: bySkills(['position']), correct: true },
    ],
  },
  {
    name: 'The Gambler',
    priorCorrect: 1,   // improving  20% -> 40%
    expect: 'Calling without the price / any-two-cards named; loose continuance.',
    // Each wrong step fires 10x against a `used` set spanning the whole stretch,
    // so each needs a fold-correct pool of at least 10 or it falls through to
    // SCENARIOS.find(unused) in file order and injects under/over into what
    // should be a pure `loose` tally. These three pools are disjoint BY SKILL
    // and sized 16/13/20, which is what takes the fallbacks to zero.
    plan: [
      { pool: byCorrectCls(bySkills(['potodds', 'reads']), 'fold'), wrongCls: ['call'] },
      { pool: byCorrectCls(bySkills(['preflop', 'position']), 'fold'), wrongCls: ['call', 'raise'] },
      { pool: byCorrectCls(bySkills(['opponent', 'bluffing', 'betsize', 'aggression']), 'fold'), wrongCls: ['call'] },
      { pool: bySkills(['opponent']), correct: true },
      { pool: bySkills(['reads']), correct: true },
    ],
  },
  {
    name: 'Positional Blind Spot',
    priorCorrect: 3,   // regressing 60% -> 40%
    expect: 'Position-driven mistakes named as the common thread across villains.',
    plan: [
      { pool: bySkills(['position']), wrongCls: ['call', 'raise'] },
      { pool: bySkills(['position']), wrongCls: ['fold', 'call'] },
      { pool: bySkills(['preflop']), wrongCls: ['call'] },
      { pool: bySkills(['betsize']), correct: true },
      { pool: bySkills(['reads']), correct: true },
    ],
  },
  {
    name: 'Exploitable Regular',
    priorCorrect: 1,   // improving  20% -> 40%
    expect: 'Ignoring the villain type (one-size-fits-all play) named explicitly.',
    plan: [
      { pool: bySkills(['opponent']), wrongCls: ['call', 'raise'] },
      { pool: bySkills(['opponent']), wrongCls: ['fold', 'call'] },
      { pool: bySkills(['reads']), wrongCls: ['call'] },
      { pool: bySkills(['preflop']), correct: true },
      { pool: bySkills(['potodds']), correct: true },
    ],
  },
  {
    name: 'The Resulter (mixed misses)',
    priorCorrect: 3,   // regressing 60% -> 40%
    expect: 'No single direction — a mixed pattern honestly described, not forced.',
    plan: [
      { pool: bySkills(['bluffing']), wrongCls: ['raise'] },
      { pool: bySkills(['potodds']), wrongCls: ['fold'] },
      { pool: bySkills(['opponent']), wrongCls: ['call'] },
      { pool: bySkills(['position']), correct: true },
      { pool: bySkills(['aggression']), correct: true },
    ],
  },
  {
    name: 'Confident misser (F2 hook)',
    priorCorrect: 4,   // regressing 80% -> 40%
    // Interpolated, not restated: this sentence, the prompt rule and the
    // checkRead assertion below are one string (finding 3).
    expect: `The fast-and-sure cluster called out directly: the ${HEADLINE_RULE}.`,
    plan: [
      { pool: bySkills(['potodds']), wrongCls: ['call'], fast: true },
      { pool: bySkills(['opponent']), wrongCls: ['raise'], fast: true },
      { pool: bySkills(['reads']), wrongCls: ['call'], fast: true },
      { pool: bySkills(['preflop']), correct: true },
      { pool: bySkills(['position']), correct: true },
    ],
  },
  {
    name: 'Froze twice (timeouts)',
    priorCorrect: 5,   // regressing 100% -> 60%
    expect: 'Freezing under the clock treated as its own signal, not generic error.',
    plan: [
      { pool: bySkills(['potodds']), timeout: true },
      { pool: bySkills(['betsize']), timeout: true },
      { pool: bySkills(['preflop']), correct: true },
      { pool: bySkills(['reads']), correct: true },
      { pool: bySkills(['aggression']), correct: true },
    ],
  },
  {
    name: 'Perfect session',
    priorCorrect: 3,   // improving  60% -> 100%
    expect: 'Brief acknowledgment + one watch-area; no invented weakness.',
    plan: [
      { pool: bySkills(['preflop']), correct: true },
      { pool: bySkills(['position']), correct: true },
      { pool: bySkills(['potodds']), correct: true },
      { pool: bySkills(['reads']), correct: true },
      { pool: bySkills(['bluffing']), correct: true },
    ],
  },
];

const apiKey = process.env.CLAUDE_API_KEY;
if (!apiKey && !DRY && !SELFTEST) {
  console.error('CLAUDE_API_KEY not set. Run with the key from Vercel:\n' +
    '  CLAUDE_API_KEY=sk-... npm run eval:coach\n' +
    'or preview the prompts without calling the API:\n' +
    '  npm run eval:coach -- --dry');
  process.exit(1);
}

// The Coach's Read is now structured JSON (headline/evidence/watchFor via
// output_config json_schema). callClaude returns the model's raw text — the
// JSON string — which the serverless handler re-serializes on the wire; here we
// parse it directly to pretty-print and to run mechanical checks.
function renderRead(read) {
  let obj;
  try { obj = JSON.parse(read); } catch { return read; }
  if (!obj || typeof obj !== 'object') return read;
  const parts = [`**${obj.headline ?? '(no headline)'}**`, ''];
  if (Array.isArray(obj.evidence)) for (const e of obj.evidence) parts.push(`- ${e}`);
  if (obj.watchFor) { parts.push(''); parts.push(`*Watch for:* ${obj.watchFor}`); }
  return parts.join('\n');
}

const wordCount = (s) => s.trim().split(/\s+/).filter(Boolean).length;

// Mechanical checks on one live read. Soft checks (⚠) report but never fail the
// harness — the eval is a review aid, not a CI gate. Only run against real
// output (skipped in dry mode, where there's no JSON to check).
//
// Every check REPORTS ITS MEASUREMENT, not just its verdict (finding 4). A
// harness that prints ticks cannot distinguish "all clean" from "matched
// nothing", and that indistinguishability is precisely how finding 1's fake
// green survived a whole scoring round. `cov` accumulates how much was actually
// measured across the nine personas; the totals are printed under the doc.
// `persona` is deliberately NOT a parameter. Both conditional checks used to key
// off the persona's PLAN (`plan.some(s => s.fast)`), which is a proxy for the
// condition the prompt actually states — "if there are confident errors above".
// The proxy and the prompt agreed only by construction. They read the summary
// now, which is the same thing the prompt renders.
function checkRead(read, summary, cov) {
  let obj;
  try { obj = JSON.parse(read); } catch {
    cov.unparsed += 1;
    return ['- ✗ did not parse as JSON'];
  }
  cov.parsed += 1;
  const lines = [];
  const has3 = typeof obj.headline === 'string'
    && Array.isArray(obj.evidence) && typeof obj.watchFor === 'string';
  lines.push(`- ${has3 ? '✓' : '✗'} three fields present (headline, evidence[], watchFor)`);
  // Bounds come from WORD_CAPS in api/coach-read.js — the same object the prompt
  // interpolates — so the check and the ask cannot disagree. They drifted once
  // already (1–3 items at ≤15 words against a prompt asking 1–2 at ≤12), which
  // prints ✓ on nine systematically over-long reads and sends the founder a
  // clean-looking report on a run that measured the wrong thing.
  const [minItems, maxItems] = WORD_CAPS.evidenceItems;
  if (Array.isArray(obj.evidence)) {
    const n = obj.evidence.length;
    cov.evidenceLists += 1;
    const ok = n >= minItems && n <= maxItems;
    if (!ok) cov.evidenceCountBad += 1;
    lines.push(`- ${ok ? '✓' : '✗'} evidence has ${minItems}–${maxItems} items (${n})`);
    // Each item measured and PRINTED. This cap was not checked at all before;
    // live run 2 had one item at 22 words and the report said nothing.
    const over = [];
    for (const e of obj.evidence) {
      if (typeof e !== 'string') continue;
      const w = wordCount(e);
      cov.evidenceItems += 1;
      if (w > WORD_CAPS.evidence) { cov.evidenceOver += 1; over.push(w); }
    }
    const widths = obj.evidence.filter(e => typeof e === 'string').map(wordCount);
    lines.push(`- ${over.length === 0 ? '✓' : '✗'} evidence items ≤ ${WORD_CAPS.evidence} words`
      + ` (measured ${widths.length}: ${widths.join('w, ')}w`
      + `${over.length ? ` — ${over.length} over` : ''})`);
  }
  const fields = [obj.headline, ...(Array.isArray(obj.evidence) ? obj.evidence : []), obj.watchFor]
    .filter((f) => typeof f === 'string');
  if (typeof obj.headline === 'string') {
    const words = wordCount(obj.headline);
    cov.headlines += 1;
    const ok = words <= WORD_CAPS.headline;
    if (!ok) cov.headlinesOver += 1;
    // Hard ✗, not the old soft ⚠: the prompt states this as a requirement, and
    // 4 of 9 reads in live run 2 were over it (13–14w) while the report warned.
    lines.push(`- ${ok ? '✓' : '✗'} headline ${words}w (cap ${WORD_CAPS.headline})`);
    // Finding 3: the rule fires on the DATA (does this window contain confident
    // errors?), which is the prompt's own condition — not on the persona's plan
    // shape, which was only ever a proxy for it.
    if (summary.confidentMisses.length > 0) {
      cov.confidentApplicable += 1;
      const hit = /\b(confiden|fast|quick|sure|snap|autopilot|instinct|reflex|rush)/i.test(obj.headline);
      if (hit) cov.confidentPass += 1;
      lines.push(`- ${hit ? '✓' : '✗'} ${HEADLINE_RULE}`
        + ` (window has ${summary.confidentMisses.length} confident errors)`);
    }
  }
  // The third cap, also unchecked before: live run 2 put 4 of 9 watchFor
  // sentences at exactly 19 words against an 18 cap and nothing reported it.
  if (typeof obj.watchFor === 'string') {
    const words = wordCount(obj.watchFor);
    cov.watchFor += 1;
    const ok = words <= WORD_CAPS.watchFor;
    if (!ok) cov.watchForOver += 1;
    lines.push(`- ${ok ? '✓' : '✗'} watchFor ${words}w (cap ${WORD_CAPS.watchFor})`);
  }
  // The freezer persona's counterpart to the confident-misser check above. 20 of
  // its 50 hands are timeouts and they carry no direction, so a read that never
  // mentions them has silently dropped the persona's whole story. Scans all three
  // fields: the prompt asks for freezing to be its own pattern, not specifically
  // a headline.
  if (summary.timeouts > 0) {
    cov.freezeApplicable += 1;
    const hit = /\b(timeout|timed out|clock|freez|froze|frozen|stall|hesitat|ran out of time|never acted|no action)/i
      .test(fields.join(' '));
    if (hit) cov.freezePass += 1;
    lines.push(`- ${hit ? '✓' : '✗'} freezer read names the timeout/clock pattern`
      + ` (window has ${summary.timeouts} timeouts)`);
  }
  // Voice reframe (July 22, 2026), tightened in Phase B: the read is a trend
  // review, never a trait verdict. Flag identity AND habitual claims in any
  // field — "you always fold the river" is the same verdict wearing different
  // words, and the prompt now bans it explicitly. Soft — phrases like "you are
  // getting 3.5:1" are legitimate, so a human still judges.
  const verdicty = /\byou (are|'re) (a|an|too|the)\b|\byou (always|never)\b|\byour game\b|\bas a player\b/i;
  const verdictHit = fields.some((f) => verdicty.test(f));
  cov.voiceScanned += 1;
  if (verdictHit) cov.voiceFlagged += 1;
  lines.push(`- ${verdictHit ? '⚠' : '✓'} session-scoped voice, no trait verdicts`
    + ` (${fields.length} fields scanned)${verdictHit ? ' — found "you are a / you always / your game" [soft]' : ''}`);
  return lines;
}

// How much was actually measured. A verdict without a denominator cannot tell a
// clean run from a run that matched nothing — see the header on checkRead.
const newCoverage = () => ({
  personas: 0, parsed: 0, unparsed: 0,
  headlines: 0, headlinesOver: 0,
  evidenceLists: 0, evidenceCountBad: 0, evidenceItems: 0, evidenceOver: 0,
  watchFor: 0, watchForOver: 0,
  confidentApplicable: 0, confidentPass: 0,
  freezeApplicable: 0, freezePass: 0,
  voiceScanned: 0, voiceFlagged: 0,
});

const coverageReport = (cov, dry) => [
  '## Coverage — what this run actually measured',
  '',
  ...(dry
    ? ['**Nothing.** This is a dry run: no reads exist, so zero checks ran. '
       + 'The zeros below are the point — a report with no denominators cannot be '
       + 'told apart from a clean pass.', '']
    : []),
  `- personas rendered: ${cov.personas} · reads parsed as JSON: ${cov.parsed}/${cov.personas}`
    + (cov.unparsed ? ` · UNPARSED: ${cov.unparsed}` : ''),
  `- headlines checked: ${cov.headlines}/${cov.personas} · over the ${WORD_CAPS.headline}w cap: ${cov.headlinesOver}`,
  `- evidence lists checked: ${cov.evidenceLists}/${cov.personas} · item-count violations: ${cov.evidenceCountBad}`,
  `- evidence items checked: ${cov.evidenceItems} · over the ${WORD_CAPS.evidence}w cap: ${cov.evidenceOver}`,
  `- watchFor checked: ${cov.watchFor}/${cov.personas} · over the ${WORD_CAPS.watchFor}w cap: ${cov.watchForOver}`,
  `- ${HEADLINE_RULE}: applicable to ${cov.confidentApplicable} persona(s) · passed ${cov.confidentPass}`,
  `- freezer timeout rule: applicable to ${cov.freezeApplicable} persona(s) · passed ${cov.freezePass}`,
  `- voice scan: ${cov.voiceScanned} reads scanned · flagged ${cov.voiceFlagged} [soft]`,
].join('\n');

// ── Self-test (--selftest) ────────────────────────────────────────────────
// checkRead's arithmetic is only reachable on a LIVE run — that is, only when
// the founder spends money. A cap checker whose first execution is the paid gate
// it is meant to protect is the same blind spot findings 1 and 4 came out of, so
// it is exercised here against reads with KNOWN shapes. check-invariants rule 31
// runs this, which puts it in `npm run gates`.
//
// Both directions are asserted. A checker that only ever sees passing input
// cannot be told apart from one that returns ✓ unconditionally.
if (SELFTEST) {
  const nWords = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
  const mkRead = (o) => JSON.stringify({ headline: 'a b c', evidence: ['e f'], watchFor: 'g h', ...o });
  const mkSummary = (o) => ({ confidentMisses: [], timeouts: 0, ...o });
  const oneMiss = [{ villain: 'Tight Nit', scenario: 'Pot Odds', spot: 'BB J♥8♥ preflop', skill: 'potodds' }];
  const { headline: H, evidence: E, watchFor: W } = WORD_CAPS;

  const cases = [
    // Each cap, at the bound and one word past it.
    [`headline at the ${H}w cap passes`, mkRead({ headline: nWords(H) }), mkSummary(), `✓ headline ${H}w (cap ${H})`],
    [`headline at ${H + 1}w fails`, mkRead({ headline: nWords(H + 1) }), mkSummary(), `✗ headline ${H + 1}w (cap ${H})`],
    [`evidence item at the ${E}w cap passes`, mkRead({ evidence: [nWords(E)] }), mkSummary(), `✓ evidence items ≤ ${E} words`],
    [`evidence item at ${E + 1}w fails`, mkRead({ evidence: [nWords(E + 1)] }), mkSummary(), `✗ evidence items ≤ ${E} words`],
    [`watchFor at the ${W}w cap passes`, mkRead({ watchFor: nWords(W) }), mkSummary(), `✓ watchFor ${W}w (cap ${W})`],
    // The exact live-run-2 shape: 19 words against an 18 cap, four times over,
    // reported by nothing. It is reported now.
    [`watchFor at ${W + 1}w fails`, mkRead({ watchFor: nWords(W + 1) }), mkSummary(), `✗ watchFor ${W + 1}w (cap ${W})`],
    // Evidence item COUNT, both bounds.
    ['too many evidence items fails', mkRead({ evidence: ['a', 'b', 'c'] }), mkSummary(), '✗ evidence has'],
    ['an empty evidence list fails', mkRead({ evidence: [] }), mkSummary(), '✗ evidence has'],
    // Finding 3, both directions: the rule fires on the DATA, and only on it.
    ['confident errors present + headline names them passes',
      mkRead({ headline: 'Fast calls keep missing' }), mkSummary({ confidentMisses: oneMiss }), `✓ ${HEADLINE_RULE}`],
    ['confident errors present + headline ignores them fails',
      mkRead({ headline: 'Position leaks keep showing up' }), mkSummary({ confidentMisses: oneMiss }), `✗ ${HEADLINE_RULE}`],
    // Non-JSON must not silently count as a pass.
    ['unparseable output is reported', 'not json at all', mkSummary(), '✗ did not parse as JSON'],
  ];

  const failures = [];
  for (const [name, read, summary, want] of cases) {
    const out = checkRead(read, summary, newCoverage()).join('\n');
    if (!out.includes(want)) failures.push(`  ✗ ${name}\n     wanted a line containing: ${want}\n     got:\n${out.replace(/^/gm, '       ')}`);
  }
  // A read with no confident errors must not be judged against a rule the
  // prompt did not give it — the inverse of the drift finding 3 fixed.
  const quiet = checkRead(mkRead({}), mkSummary(), newCoverage()).join('\n');
  if (quiet.includes(HEADLINE_RULE))
    failures.push(`  ✗ the headline rule fired on a window with zero confident errors`);

  // Coverage must count what was measured, not what was declared.
  const c = newCoverage();
  checkRead(mkRead({ evidence: ['a b', 'c d'] }), mkSummary({ timeouts: 3 }), c);
  checkRead('not json', mkSummary(), c);
  const wantCov = { parsed: 1, unparsed: 1, headlines: 1, evidenceItems: 2, watchFor: 1, freezeApplicable: 1 };
  for (const [k, v] of Object.entries(wantCov))
    if (c[k] !== v) failures.push(`  ✗ coverage.${k} is ${c[k]}, expected ${v} — the totals must reflect real measurements`);

  console.log(failures.length
    ? `eval-coach selftest FAILED (${failures.length}):\n${failures.join('\n')}`
    : `eval-coach selftest OK — ${cases.length + 1 + Object.keys(wantCov).length} assertions over caps ${H}/${E}/${W}w, item range ${WORD_CAPS.evidenceItems.join('–')}, the headline rule and the coverage totals`);
  process.exit(failures.length ? 1 : 0);
}

const sections = [];
const cov = newCoverage();
for (const p of PERSONAS) {
  cov.personas += 1;
  // Built through the REAL window + aggregate seam — the same function the
  // serverless handler calls, so the harness can no longer drift from it.
  const summary = aggregate(buildWindow(p), lookup);
  // The doc shows the AGGREGATE the model actually saw, not fifty raw hands:
  // that aggregate is the prompt's entire input now.
  const window = [
    `  - ${summary.sessions} sessions · ${summary.hands} hands · ${summary.accuracy.correct}/${summary.accuracy.total} correct`
      + (summary.previous ? ` (previous stretch ${summary.previous.correct}/${summary.previous.total})` : ' (no previous stretch)'),
    `  - direction: under ${summary.direction.under} · over ${summary.direction.over} · loose ${summary.direction.loose} (evidence ${summary.direction.evidence})`,
    `  - skills sent: ${summary.skills.map((k) => `${k.skill} ${k.correct}/${k.attempts}`).join(', ') || '(none)'}`,
    // Shown so the founder can see WHAT was withheld and why the prompt is
    // silent about it: below MIN_RATED_ATTEMPTS the ledger greys the skill out
    // and the recent-form strip will not name it, so neither may the read.
    `  - skills withheld (under MIN_RATED_ATTEMPTS): ${summary.unratedSkills.join(', ') || '(none)'}`,
    `  - confident misses: ${summary.confidentMisses.length} · repeat-offender spots: ${summary.repeats.length}`
      + (summary.confidentMisses.length + summary.repeats.length === 0
        ? ' → no villain data in this prompt, so F5 criterion 3 does not apply'
        : ' → villain data present, so F5 criterion 3 APPLIES'),
  ].join('\n');
  let read = '(dry run — no API call)';
  if (!DRY) {
    try {
      read = await callClaude(summary, apiKey);
    } catch (err) {
      read = `ERROR: ${err.message}`;
    }
    console.log(`✓ ${p.name}`);
  } else {
    console.log(`— ${p.name} (dry)\n${buildPrompt(summary)}\n`);
  }
  const checks = DRY ? '' : `\n**Checks:**\n${checkRead(read, summary, cov).join('\n')}\n`;
  sections.push(`## ${p.name}\n\n**Expected:** ${p.expect}\n\n**Window:**\n${window}\n\n**Coach's Read:**\n\n${renderRead(read)}\n${checks}`);
}

// The banner is the artifact's identity (finding 1). Mode first, on line 1 and
// again in the banner, with the generation time — so a file found on disk can
// never be mistaken for the other kind of run.
const stamp = new Date().toISOString();
const banner = DRY
  ? `> **RUN MODE: DRY — no API calls were made.** Every "Coach's Read" below is the placeholder \`(dry run — no API call)\`, and NO quality check ran against any of them.\n`
    + `> Generated ${stamp} by \`scripts/eval-coach.mjs --dry\`. Live output is a different file (\`${OUT_LIVE}\`) and this run did not touch it.\n`
    + `> Use this to read the PROMPTS. Never score an F5 round against it.`
  : `> **RUN MODE: LIVE — nine real API calls.** Generated ${stamp} by \`scripts/eval-coach.mjs\`.\n`
    + `> A dry run cannot overwrite this file; it writes \`${OUT_DRY}\` instead (check-invariants rule 32).`;

const doc = `# Coach's Read eval — ${DRY ? 'DRY RUN (prompts only)' : 'LIVE output'}\n\n` +
  `${banner}\n\n` +
  `*Generated by scripts/eval-coach.mjs over the real aggregate() of a ten-session window. Reads are structured JSON (headline/evidence/watchFor). Judge each against the F5 bar: pattern-level why · direction of error · villain context WHERE THE WINDOW HAS IT · confident-miss callout · human tone, no restating · stretch-scoped trend voice (never a trait verdict — naming the player's type is the schema card's job). Villains reach the prompt ONLY through confident errors and repeated spots, so on a persona whose Window shows 0 of each there is no villain string to reference and that criterion does not apply; where the counts are non-zero, a read that ignores the villain fails. The mechanical Checks block flags structural issues; the F5 judgment is still yours.*\n\n` +
  `${coverageReport(cov, DRY)}\n\n---\n\n` +
  sections.join('\n---\n\n');
writeFileSync(OUT, doc);
console.log(`\n${coverageReport(cov, DRY)}\n`);
console.log(`Wrote ${OUT} (${DRY ? 'DRY RUN' : 'LIVE'}, ${PERSONAS.length} personas)`
  + (DRY ? ` — the live artifact ${OUT_LIVE} was NOT touched` : ''));
