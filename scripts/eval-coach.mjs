// Coach's Read eval harness — runs the REAL prompt (imported from
// api/coach-read.js, the only Anthropic caller) over the REAL aggregate()
// against synthetic TWENTY-session histories — the trailing ten the read speaks
// over, plus the ten before them that feed the accuracy comparison — one per
// player schema plus edge personas, and writes the reads to
// coach-eval-output.md for review against the F5 quality bar:
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
// The key is Vercel-only by design — never commit it, never put it in .env.

import { writeFileSync } from 'node:fs';
import SCENARIOS from '../src/data/scenarios.js';
import { aggregate } from '../src/utils/coachWindow.js';
import coach from '../api/coach-read.js';

const { buildPrompt, callClaude, buildLookup } = coach;
const DRY = process.argv.includes('--dry');
const OUT = 'coach-eval-output.md';

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
    expect: 'The fast-and-sure cluster called out directly as the headline.',
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
if (!apiKey && !DRY) {
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

// Mechanical checks on one live read. Soft checks (⚠) report but never fail the
// harness — the eval is a review aid, not a CI gate. Only run against real
// output (skipped in dry mode, where there's no JSON to check).
function checkRead(read, persona) {
  let obj;
  try { obj = JSON.parse(read); } catch { return ['- ✗ did not parse as JSON']; }
  const lines = [];
  const has3 = typeof obj.headline === 'string'
    && Array.isArray(obj.evidence) && typeof obj.watchFor === 'string';
  lines.push(`- ${has3 ? '✓' : '✗'} three fields present (headline, evidence[], watchFor)`);
  // These bounds MUST match what the prompt asks for. They drifted once already
  // (1–3 items and ≤15 words against a prompt asking 1–2 and ≤12), which would
  // have printed ✓ on nine systematically over-long reads and sent the founder a
  // clean-looking report on a run that measured the wrong thing.
  if (Array.isArray(obj.evidence)) {
    const n = obj.evidence.length;
    lines.push(`- ${n >= 1 && n <= 2 ? '✓' : '✗'} evidence has 1–2 items (${n})`);
  }
  const fields = [obj.headline, ...(Array.isArray(obj.evidence) ? obj.evidence : []), obj.watchFor]
    .filter((f) => typeof f === 'string');
  if (typeof obj.headline === 'string') {
    const words = obj.headline.trim().split(/\s+/).filter(Boolean).length;
    lines.push(`- ${words <= 12 ? '✓' : '⚠'} headline ≤ 12 words (${words}) [soft]`);
    // The confident-misser persona's headline MUST name the fast/confident leak.
    if (persona.plan.some((s) => s.fast)) {
      const hit = /\b(confiden|fast|quick|sure|snap|autopilot|instinct|reflex|rush)/i.test(obj.headline);
      lines.push(`- ${hit ? '✓' : '✗'} confident-misser headline names the fast/confident pattern`);
    }
  }
  // The freezer persona's counterpart to the confident-misser check above. 20 of
  // its 50 hands are timeouts and they carry no direction, so a read that never
  // mentions them has silently dropped the persona's whole story. Scans all three
  // fields: the prompt asks for freezing to be its own pattern, not specifically
  // a headline.
  if (persona.plan.some((s) => s.timeout)) {
    const hit = /\b(timeout|timed out|clock|freez|froze|frozen|stall|hesitat|ran out of time|never acted|no action)/i
      .test(fields.join(' '));
    lines.push(`- ${hit ? '✓' : '✗'} freezer read names the timeout/clock pattern`);
  }
  // Voice reframe (July 22, 2026), tightened in Phase B: the read is a trend
  // review, never a trait verdict. Flag identity AND habitual claims in any
  // field — "you always fold the river" is the same verdict wearing different
  // words, and the prompt now bans it explicitly. Soft — phrases like "you are
  // getting 3.5:1" are legitimate, so a human still judges.
  const verdicty = /\byou (are|'re) (a|an|too|the)\b|\byou (always|never)\b|\byour game\b|\bas a player\b/i;
  const verdictHit = fields.some((f) => verdicty.test(f));
  lines.push(`- ${verdictHit ? '⚠' : '✓'} session-scoped voice, no trait verdicts${verdictHit ? ' (found "you are a / you always / your game") [soft]' : ''}`);
  return lines;
}

const sections = [];
for (const p of PERSONAS) {
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
  const checks = DRY ? '' : `\n**Checks:**\n${checkRead(read, p).join('\n')}\n`;
  sections.push(`## ${p.name}\n\n**Expected:** ${p.expect}\n\n**Window:**\n${window}\n\n**Coach's Read:**\n\n${renderRead(read)}\n${checks}`);
}

const doc = `# Coach's Read eval — ${DRY ? 'DRY RUN' : 'live'} output\n\n` +
  `*Generated by scripts/eval-coach.mjs over the real aggregate() of a ten-session window. Reads are structured JSON (headline/evidence/watchFor). Judge each against the F5 bar: pattern-level why · direction of error · villain context WHERE THE WINDOW HAS IT · confident-miss callout · human tone, no restating · stretch-scoped trend voice (never a trait verdict — naming the player's type is the schema card's job). Villains reach the prompt ONLY through confident errors and repeated spots, so on a persona whose Window shows 0 of each there is no villain string to reference and that criterion does not apply; where the counts are non-zero, a read that ignores the villain fails. The mechanical Checks block flags structural issues; the F5 judgment is still yours.*\n\n` +
  sections.join('\n---\n\n');
writeFileSync(OUT, doc);
console.log(`\nWrote ${OUT} (${PERSONAS.length} personas)`);
