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

// HEADLINE_RULE and V3_CAPS come from the prompt module on purpose: the harness
// must measure what the prompt ASKS for, never a second copy of the numbers.
// See the comments beside their definitions in api/coach-read.js.
const { buildPrompt, callClaude, buildLookup, HEADLINE_RULE, TRAJECTORY_RULE, V3_CAPS } = coach;
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
    expect: 'TIER 2 (improving, no confident errors): sentence one opens with the improvement as a CLAUSE, then names the over-folding; sentence two says why a passive line costs against these opponents and lands an if-then for next session. Direction = too passive. No numerals anywhere.',
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
    expect: 'TIER 3 (plain pattern, declining stretch): forcing the action / raising into strength named in sentence one, scoped with "lately". Sentence two teaches why that costs against a player who is not folding, then an if-then. NO improvement wording — the stretch declined.',
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
    expect: 'TIER 2 (improving, no confident errors): improvement clause, then calling without the price / loose continuance. Sentence two explains the price in WORDS ("less than half the pot", never a figure) and lands an if-then.',
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
    expect: 'TIER 3 (plain pattern, declining stretch): position-driven mistakes named as the common thread in sentence one; sentence two teaches why acting out of position costs and gives a cue-then-action. No improvement wording.',
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
    expect: 'TIER 2 (improving, no confident errors): improvement clause, then playing one-size-fits-all against different opponents. Sentence two is the F1 lever doing its job — what a specific villain type actually does, and the adjustment that follows from it.',
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
    expect: 'TIER 3, declining: no single direction, so the mixed pattern is described honestly in two sentences rather than forced into one story. The hardest register test — advice voice without a single clean leak to point at.',
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
    expect: `TIER 1, which always wins: the fast-and-sure cluster owns sentence one — the ${HEADLINE_RULE}. Sentence two teaches why those spots are not the automatic call they feel like. This is the persona the worked example was written from, so it is also where parroting would show first.`,
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
    expect: 'TIER 3 (freezer variant), declining: freezing on the clock named as its own pattern, not folded into a passive or aggressive story. Sentence two gives them something to DO when the timer runs low. No improvement wording.',
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
    expect: 'TIER 2 (improving, no confident errors), the no-leak case: the improvement clause earns sentence one, and sentence two gives one thing to keep watching. No invented weakness, no filler praise.',
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

// The Coach's Read is structured JSON (headline/watchFor via output_config
// json_schema). callClaude returns the model's raw text — the JSON string —
// which the serverless handler re-serializes on the wire; here we parse it
// directly to pretty-print and to run mechanical checks.
//
// Rendered JOINED, exactly as LastSessionRead joins it (v3, August 2 2026). The
// acceptance test for this surface is the founder reading all nine aloud and
// hearing one coach talking, so the artifact has to show the paragraph the
// player sees — not the two fields in a layout only this file uses. The v2
// renderer's bold-headline-then-bullets shape flattered reads that did not
// actually run together as speech.
function renderRead(read) {
  let obj;
  try { obj = JSON.parse(read); } catch { return read; }
  if (!obj || typeof obj !== 'object') return read;
  const joined = [obj.headline, obj.watchFor].filter(Boolean).join(' ');
  return joined || read;
}

const wordCount = (s) => s.trim().split(/\s+/).filter(Boolean).length;

// Sentence splitter for the one-sentence-per-field rule. Terminal punctuation
// followed by whitespace ends a sentence; a closing quote or bracket may sit
// between them ('... go in." Next ...').
//
// The digit guard is not decoration. "3.5:1" and "1.5 big blinds" carry periods
// that are not sentence ends, and a splitter without the guard would report two
// sentences for one — turning the numeral check's job into a phantom structure
// failure and pointing the founder at the wrong defect. v3 bans numerals
// outright, so a read that trips the guard is already failing the numeral check;
// the guard exists so it fails as ITSELF and not as something else.
//
// The sentinel is written as an ESCAPE, never as a raw byte: a literal control
// character in source makes the file binary to grep and to everything built on
// grep, which is a silent way to lose a file from every future search.
const SENT_MASK = '\u0000';
const sentences = (s) => {
  const t = (s ?? '').trim();
  if (!t) return [];
  return t
    .replace(/(\d)\.(\d)/g, `$1${SENT_MASK}$2`)
    .split(/(?<=[.!?])["'’)\]]*\s+/)
    .map((x) => x.replaceAll(SENT_MASK, '.').trim())
    .filter(Boolean);
};

const endsTerminal = (s) => /[.!?]["'’)\]]*$/.test((s ?? '').trim());
const hasNumeral = (s) => /\d/.test(s ?? '');

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
// One vocabulary, two symmetric checks: an IMPROVED stretch's tier-2 headline
// must use it, a DECLINED stretch's read must not (that would be spin). A word
// added here tightens/loosens both sides at once — which is the point.
const IMPROVEMENT_VOCAB = /\b(up from|improv\w*|climb\w*|rose|rising|sharper|stronger|better)\b/i;

// ── Example-fingerprint scan (v3, August 2 2026 — soft ⚠) ──────────────────
// The lesson this whole prompt is built on is that the model mimics the worked
// example with near-perfect fidelity. That is the mechanism v3 RELIES on for
// voice; one step further, the same mechanism is parroting — the example's
// CONTENT arriving on a persona whose data says nothing of the kind. With
// numbers gone from every field, phrase-leak is what number-leak used to be,
// so this scan replaces the copy-only checks rather than adding to them.
//
// Each fingerprint carries the condition that WARRANTS it, read off the same
// summary the prompt was built from — so the scan flags a fabrication, not a
// coincidence. "Snap calling tight players" is exactly right for a player who
// confidently misplayed against a nit and is invented for anyone else.
// Soft, because warranted-looking phrasing can still be the right words: the
// scan points, a human judges.
const FINGERPRINTS = [
  {
    phrase: 'snap calling tight players',
    warrants: 'a confident error against a tight villain',
    warranted: (s) => (s.confidentMisses ?? []).some((m) => /tight/i.test(m.villain ?? '')),
  },
  {
    phrase: 'half the pot',
    warrants: 'a pot-odds or bet-sizing skill in the window',
    warranted: (s) => (s.skills ?? []).some((k) => /potodds|betsize/i.test(k.skill ?? '')),
  },
  {
    phrase: 'any choice beats no choice',
    warrants: 'at least one timeout in the window',
    warranted: (s) => (s.timeouts ?? 0) > 0,
  },
];

// ── Word-cap tolerance (founder-delegated call, July 29 2026, evening) ──────
// Four live runs converged on this shape: every substance check green twice
// running (false-direction guard, trajectory tiers, confident-error headline,
// freezer, voice) while length lands within a word or two of the caps —
// sampling noise inherent to models counting their own words, not drift.
// Re-rolling paid runs until the noise lands green would be a worse kind of
// dishonesty than an explicit tolerance, so the verdict line moves ONCE, in
// the open, pre-committed for all future runs:
//   within the cap     → ✓
//   over by 1-2 words  → ⚠ reported with its measurement, never fails the persona
//   over by 3 or more  → ✗ hard failure
// The PROMPT still states the caps as hard limits (the pressure on the model
// stays), every measurement still prints, and SUBSTANCE checks have no
// tolerance at any margin. Widening this constant to green a run is the same
// sin as moving a cap — it does not happen.
const CAP_TOLERANCE = 2;
const capLine = (label, words, cap) => {
  if (words <= cap) return { hard: false, text: `- ✓ ${label} ${words}w (cap ${cap})` };
  if (words <= cap + CAP_TOLERANCE)
    return { hard: false, text: `- ⚠ ${label} ${words}w (cap ${cap}; +${words - cap} inside the ${CAP_TOLERANCE}-word tolerance) [soft]` };
  return { hard: true, text: `- ✗ ${label} ${words}w (cap ${cap}; +${words - cap} exceeds the ${CAP_TOLERANCE}-word tolerance)` };
};

function checkRead(read, summary, cov) {
  let obj;
  try { obj = JSON.parse(read); } catch {
    cov.unparsed += 1;
    return ['- ✗ did not parse as JSON'];
  }
  cov.parsed += 1;
  const lines = [];
  const has2 = typeof obj.headline === 'string' && typeof obj.watchFor === 'string';
  lines.push(`- ${has2 ? '✓' : '✗'} two fields present (headline, watchFor)`);
  // v3 dropped `evidence`, and COACH_SCHEMA's additionalProperties:false means
  // the model cannot put it back. One arriving here says the schema and the
  // prompt have come apart upstream — a louder failure than a quiet extra key.
  if ('evidence' in obj)
    lines.push('- ✗ read still carries an `evidence` field — v3 dropped it from COACH_SCHEMA');

  // Named pairs so every structural line can say WHICH field it measured; the
  // bare list is what the whole-read scans (voice, spin, freezer) read.
  const named = [['headline', obj.headline], ['watchFor', obj.watchFor]]
    .filter(([, v]) => typeof v === 'string');
  const fields = named.map(([, v]) => v);

  // ── Structure (v3): one sentence, terminal punctuation, zero numerals ─────
  // Structure is NOT sampling noise, so none of these three carry the word-cap
  // tolerance. A two-sentence "headline" is not a long field, it is a different
  // shape than the one the renderers join into a paragraph; and a numeral is the
  // founder's "numbers gone everywhere" call failing outright, not by a margin.
  for (const [name, text] of named) {
    const sents = sentences(text);
    cov.sentenceFields += 1;
    const okSent = sents.length === V3_CAPS.sentencesPerField;
    if (!okSent) cov.sentenceBad += 1;
    lines.push(`- ${okSent ? '✓' : '✗'} ${name} is exactly ${V3_CAPS.sentencesPerField} sentence`
      + ` (measured ${sents.length})`);

    cov.punctFields += 1;
    const okPunct = endsTerminal(text);
    if (!okPunct) cov.punctBad += 1;
    lines.push(`- ${okPunct ? '✓' : '✗'} ${name} ends in terminal punctuation`
      + ` (ends "${text.trim().slice(-14)}")`);

    const digits = text.match(/\d/g) ?? [];
    cov.numeralFields += 1;
    if (digits.length) cov.numeralBad += 1;
    lines.push(`- ${digits.length ? '✗' : '✓'} ${name} contains no numerals`
      + ` (${digits.length} found${digits.length ? `: ${digits.join(' ')}` : ''})`);
  }

  // ── Length: the two render guards, plus the total the founder actually set ──
  // The total is the real bound ("two sentences a coach would say"); the two
  // per-field numbers are render guards on the card. All three come from
  // V3_CAPS in api/coach-read.js — the same object the prompt interpolates — so
  // the check and the ask cannot disagree. They drifted once already, which
  // prints ✓ on nine systematically over-long reads.
  if (typeof obj.headline === 'string') {
    const words = wordCount(obj.headline);
    cov.headlines += 1;
    if (words > V3_CAPS.headline) cov.headlinesOver += 1;
    const hRes = capLine('headline', words, V3_CAPS.headline);
    if (hRes.hard) cov.headlinesOverHard += 1;
    lines.push(hRes.text);
  }
  if (typeof obj.watchFor === 'string') {
    const words = wordCount(obj.watchFor);
    cov.watchFor += 1;
    if (words > V3_CAPS.watchFor) cov.watchForOver += 1;
    const wRes = capLine('watchFor', words, V3_CAPS.watchFor);
    if (wRes.hard) cov.watchForOverHard += 1;
    lines.push(wRes.text);
  }
  if (has2) {
    const words = wordCount(`${obj.headline} ${obj.watchFor}`);
    cov.totals += 1;
    if (words > V3_CAPS.total) cov.totalsOver += 1;
    const tRes = capLine('total, both sentences', words, V3_CAPS.total);
    if (tRes.hard) cov.totalsOverHard += 1;
    lines.push(tRes.text);
  }

  if (typeof obj.headline === 'string') {
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
    // Tier 2, now a CLAUSE (v3). Same keying discipline as the confident-error
    // check above — fires on the summary's own data, exactly when the prompt's
    // stated condition fires (no confident errors AND the previous stretch is
    // given AND accuracy improved on it).
    //
    // The counts-receipt half of this check is RETIRED with `evidence` and with
    // numerals: there is nowhere left for a copied figure to live, so demanding
    // one would fail every correct read. The prose-vocabulary half is the whole
    // check now, and it stays symmetric with the false-improvement guard below —
    // one vocabulary, used to require improvement wording here and to forbid it
    // there.
    const improved = summary.previous
      && (summary.accuracy.correct / summary.accuracy.total)
        > (summary.previous.correct / summary.previous.total);
    if (summary.confidentMisses.length === 0 && improved) {
      cov.trajectoryApplicable += 1;
      const hit = IMPROVEMENT_VOCAB.test(obj.headline);
      if (hit) cov.trajectoryPass += 1;
      lines.push(`- ${hit ? '✓' : '✗'} trajectory clause opens the headline: ${TRAJECTORY_RULE}`
        + ` (${summary.previous.correct} → ${summary.accuracy.correct} correct)`);
    }
    // False-direction guard (live run 2, July 29 2026): two REGRESSING personas
    // mimicked the tier-2 template and wrote "20/50 up from 30/50" — a decline
    // dressed as progress — and nothing flagged it. Keyed off the summary like
    // every conditional check here: fires only when the comparison exists and
    // did NOT improve, and scans BOTH fields, because a spun comparison in
    // sentence two is the same lie in a different place.
    const declined = summary.previous
      && (summary.accuracy.correct / summary.accuracy.total)
        <= (summary.previous.correct / summary.previous.total);
    if (declined) {
      cov.directionApplicable += 1;
      const spun = fields.some((f) => IMPROVEMENT_VOCAB.test(f));
      if (!spun) cov.directionPass += 1;
      lines.push(`- ${spun ? '✗' : '✓'} no false improvement claim on a declined stretch`
        + ` (${summary.previous.correct} → ${summary.accuracy.correct})`);
    }
  }
  // The freezer persona's counterpart to the confident-misser check above. 20 of
  // its 50 hands are timeouts and they carry no direction, so a read that never
  // mentions them has silently dropped the persona's whole story. Scans both
  // fields: the prompt asks for freezing to be its own pattern, not specifically
  // sentence one.
  if (summary.timeouts > 0) {
    cov.freezeApplicable += 1;
    const hit = /\b(timeout|timed out|clock|freez|froze|frozen|stall|hesitat|ran out of time|never acted|no action)/i
      .test(fields.join(' '));
    if (hit) cov.freezePass += 1;
    lines.push(`- ${hit ? '✓' : '✗'} freezer read names the timeout/clock pattern`
      + ` (window has ${summary.timeouts} timeouts)`);
  }
  // Voice reframe (July 22, 2026), tightened in Phase B and again in v3: the
  // read is a trend review, never a trait verdict. Flag identity AND habitual
  // claims in either field — "you always fold the river" is the same verdict
  // wearing different words, and the prompt bans it explicitly.
  //
  // "you tend to" and its kin joined the regex in v3 (spec §5). They arrived
  // through the founder's OWN draft — "you tend to fold too early" — which is
  // warm, reads well, and collides head-on with their own July 22 law: a
  // trait-tensed claim about ~50 hands. The resolution kept the warmth and
  // moved the scope ("lately you've been folding too early"), so the banned
  // form has to be mechanical or the next warm draft reintroduces it.
  // Soft — a human still judges, since some "you are" phrasings are innocent.
  const verdicty = /\byou (are|'re) (a|an|too|the)\b|\byou (always|never|tend to|usually|often)\b|\byour game\b|\bas a player\b/i;
  const verdictHit = fields.some((f) => verdicty.test(f));
  cov.voiceScanned += 1;
  if (verdictHit) cov.voiceFlagged += 1;
  lines.push(`- ${verdictHit ? '⚠' : '✓'} stretch-scoped voice, no trait verdicts`
    + ` (${fields.length} fields scanned)`
    + `${verdictHit ? ' — found "you are a / you always / you tend to / your game" [soft]' : ''}`);

  // Example-fingerprint scan (soft) — see FINGERPRINTS above. Reported with its
  // denominator like every other check here: "0 flagged" and "nothing scanned"
  // must not render the same way.
  const joined = fields.join(' ').toLowerCase();
  const leaked = FINGERPRINTS.filter((f) => joined.includes(f.phrase) && !f.warranted(summary));
  cov.fingerprintScanned += 1;
  if (leaked.length) cov.fingerprintFlagged += 1;
  lines.push(`- ${leaked.length ? '⚠' : '✓'} no worked-example phrasing the data does not warrant`
    + ` (${FINGERPRINTS.length} fingerprints scanned)`
    + `${leaked.length ? ` — ${leaked.map((f) => `"${f.phrase}" needs ${f.warrants}`).join('; ')} [soft]` : ''}`);

  // Em dashes (soft). Banned by the prompt and by the house voice; the tell that
  // the model has slipped out of speech and into writing.
  const dashes = fields.join(' ').match(/[—–]/g) ?? [];
  cov.emdashScanned += 1;
  if (dashes.length) cov.emdashFlagged += 1;
  lines.push(`- ${dashes.length ? '⚠' : '✓'} no em dashes`
    + ` (${dashes.length} found in ${fields.length} fields)${dashes.length ? ' [soft]' : ''}`);
  return lines;
}

// How much was actually measured. A verdict without a denominator cannot tell a
// clean run from a run that matched nothing — see the header on checkRead.
const newCoverage = () => ({
  personas: 0, parsed: 0, unparsed: 0,
  personasClean: 0, personasErrored: 0, personasFailed: 0,
  headlines: 0, headlinesOver: 0, headlinesOverHard: 0,
  watchFor: 0, watchForOver: 0, watchForOverHard: 0,
  totals: 0, totalsOver: 0, totalsOverHard: 0,
  sentenceFields: 0, sentenceBad: 0,
  punctFields: 0, punctBad: 0,
  numeralFields: 0, numeralBad: 0,
  confidentApplicable: 0, confidentPass: 0,
  trajectoryApplicable: 0, trajectoryPass: 0,
  directionApplicable: 0, directionPass: 0,
  freezeApplicable: 0, freezePass: 0,
  voiceScanned: 0, voiceFlagged: 0,
  fingerprintScanned: 0, fingerprintFlagged: 0,
  emdashScanned: 0, emdashFlagged: 0,
});

// ── Per-persona verdict + exit status (live eval findings 1 and 2, July 29) ──
// The console used to print `✓ ${p.name}` AFTER the try/catch closed,
// unconditionally. It certified that control reached that statement, nothing
// more: a persona whose API call threw printed the same tick as a clean one, and
// the three genuine ✗ results of the founder's July 29 run (watchFor 19w against
// the 18 cap, one evidence item one over, a 13w headline against the 12 cap) sat
// in the artifact where nobody watching the console would ever see them. Same
// bug class as the two before it — a signal must not certify more than it
// actually measured.
//
// So the verdict is DERIVED FROM THE CHECK LINES the artifact prints. Not a
// second judgement that could disagree with the document the founder reads: the
// console and the artifact are the same measurement rendered twice.
//
// Three states, never collapsed:
//   errored — the call itself failed. Never a tick, whatever the checks say.
//   failed  — the read came back and one or more HARD checks were ✗.
//   clean   — the read came back and every hard check passed.
// Soft ⚠ lines (the voice scan) are reported and never fail a persona: the scan
// is a judgement aid for a human, not a pass/fail rule, and phrases like "you
// are getting 3.5:1" are legitimate.
const ERROR_PREFIX = 'ERROR: ';
const isErroredRead = (read) => typeof read === 'string' && read.startsWith(ERROR_PREFIX);

function personaVerdict(read, checkLines) {
  const failed = checkLines.filter((l) => l.startsWith('- ✗')).length;
  const soft = checkLines.filter((l) => l.startsWith('- ⚠')).length;
  const errored = isErroredRead(read);
  return { errored, failed, soft, clean: !errored && failed === 0 };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function verdictLine(name, v) {
  const soft = v.soft ? ` (+${plural(v.soft, 'soft flag')})` : '';
  if (v.errored) return `✗ ${name} — API CALL FAILED, no read to check`;
  if (v.failed > 0) return `✗ ${name} — ${plural(v.failed, 'check')} FAILED${soft}`;
  return `✓ ${name} — all checks passed${soft}`;
}

// Finding 2: the exit code has to tell a clean run from a dirty one, or nothing
// downstream (a founder's shell, a future wrapper) can. The artifact is written
// EITHER WAY — the founder needs to read the reads regardless of the verdict —
// so only the exit status changes.
const runExitCode = (cov) => (cov.personasClean === cov.personas ? 0 : 1);

const runVerdictLine = (cov) =>
  `${cov.personasClean} of ${cov.personas} personas passed cleanly`
  + (cov.personasFailed ? ` · ${plural(cov.personasFailed, 'persona')} with failing checks` : '')
  + (cov.personasErrored ? ` · ${plural(cov.personasErrored, 'API call')} failed` : '')
  + ` — exit ${runExitCode(cov)}`;

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
  `- sentence count: ${cov.sentenceFields} fields checked · not exactly ${V3_CAPS.sentencesPerField} sentence: ${cov.sentenceBad} (hard)`,
  `- terminal punctuation: ${cov.punctFields} fields checked · missing: ${cov.punctBad} (hard)`,
  `- numeral scan: ${cov.numeralFields} fields checked · containing digits: ${cov.numeralBad} (hard)`,
  `- headlines checked: ${cov.headlines}/${cov.personas} · over the ${V3_CAPS.headline}w render guard: ${cov.headlinesOver} · beyond the +${CAP_TOLERANCE} tolerance (hard): ${cov.headlinesOverHard}`,
  `- watchFor checked: ${cov.watchFor}/${cov.personas} · over the ${V3_CAPS.watchFor}w render guard: ${cov.watchForOver} · beyond the +${CAP_TOLERANCE} tolerance (hard): ${cov.watchForOverHard}`,
  `- totals checked: ${cov.totals}/${cov.personas} · over the ${V3_CAPS.total}w cap: ${cov.totalsOver} · beyond the +${CAP_TOLERANCE} tolerance (hard): ${cov.totalsOverHard}`,
  `- ${HEADLINE_RULE}: applicable to ${cov.confidentApplicable} persona(s) · passed ${cov.confidentPass}`,
  `- trajectory clause (tier 2): applicable to ${cov.trajectoryApplicable} persona(s) · passed ${cov.trajectoryPass}`,
  `- no false improvement claim on declined stretches: applicable to ${cov.directionApplicable} persona(s) · passed ${cov.directionPass}`,
  `- freezer timeout rule: applicable to ${cov.freezeApplicable} persona(s) · passed ${cov.freezePass}`,
  `- voice scan: ${cov.voiceScanned} reads scanned · flagged ${cov.voiceFlagged} [soft]`,
  `- example-fingerprint scan: ${cov.fingerprintScanned} reads scanned against ${FINGERPRINTS.length} phrases · flagged ${cov.fingerprintFlagged} [soft]`,
  `- em-dash scan: ${cov.emdashScanned} reads scanned · flagged ${cov.emdashFlagged} [soft]`,
  ...(dry ? [] : ['', `**Run verdict: ${runVerdictLine(cov)}**`]),
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
  // n words, exactly one sentence, terminal punctuation, and NO DIGITS — the
  // filler has to satisfy every v3 structure check or a cap case would fail for
  // the wrong reason. (The old `w0 w1 w2` filler is now itself a numeral
  // violation, which is a neat demonstration that the check has teeth.)
  const nWords = (n) => Array.from({ length: n },
    (_, i) => String.fromCharCode(97 + (i % 26)).repeat(2)).join(' ') + '.';
  const mkRead = (o) => JSON.stringify({ headline: 'aa bb cc.', watchFor: 'dd ee ff.', ...o });
  const mkSummary = (o) => ({ confidentMisses: [], timeouts: 0, skills: [], ...o });
  const oneMiss = [{ villain: 'Tight Nit', scenario: 'Pot Odds', spot: 'BB J♥8♥ preflop', skill: 'potodds' }];
  const { headline: H, watchFor: W, total: T, sentencesPerField: S } = V3_CAPS;

  const cases = [
    // ── Each cap, at the bound and past it ────────────────────────────────
    [`headline at the ${H}w render guard passes`, mkRead({ headline: nWords(H) }), mkSummary(), `✓ headline ${H}w (cap ${H})`],
    [`headline at ${H + 1}w is a soft warning inside the tolerance`, mkRead({ headline: nWords(H + 1) }), mkSummary(), `⚠ headline ${H + 1}w (cap ${H}`],
    [`headline at ${H + 3}w hard-fails beyond the tolerance`, mkRead({ headline: nWords(H + 3) }), mkSummary(), `✗ headline ${H + 3}w (cap ${H}`],
    [`watchFor at the ${W}w render guard passes`, mkRead({ watchFor: nWords(W) }), mkSummary(), `✓ watchFor ${W}w (cap ${W})`],
    [`watchFor at ${W + 1}w is a soft warning inside the tolerance`, mkRead({ watchFor: nWords(W + 1) }), mkSummary(), `⚠ watchFor ${W + 1}w (cap ${W}`],
    [`watchFor at ${W + 3}w hard-fails beyond the tolerance`, mkRead({ watchFor: nWords(W + 3) }), mkSummary(), `✗ watchFor ${W + 3}w (cap ${W}`],
    // The TOTAL is a real constraint, not one implied by the two render guards:
    // both fields can sit inside their own caps and still bust the pair. That is
    // the case the founder's "two sentences, forty words" call actually bounds.
    [`both fields inside their guards can still bust the ${T}w total`,
      mkRead({ headline: nWords(H), watchFor: nWords(W) }), mkSummary(), `✗ total, both sentences ${H + W}w (cap ${T}`],
    [`a pair at exactly ${T}w passes`,
      mkRead({ headline: nWords(H), watchFor: nWords(T - H) }), mkSummary(), `✓ total, both sentences ${T}w (cap ${T})`],
    [`a pair at ${T + 1}w is a soft warning inside the tolerance`,
      mkRead({ headline: nWords(H), watchFor: nWords(T - H + 1) }), mkSummary(), `⚠ total, both sentences ${T + 1}w (cap ${T}`],
    // ── Structure: one sentence, terminal punctuation, zero numerals ───────
    [`a ${S}-sentence headline passes`, mkRead({ headline: 'aa bb cc.' }), mkSummary(), `✓ headline is exactly ${S} sentence (measured ${S})`],
    ['two sentences in one field hard-fail',
      mkRead({ headline: 'Aa bb cc. Dd ee ff.' }), mkSummary(), `✗ headline is exactly ${S} sentence (measured 2)`],
    ['a question mark still counts as one sentence',
      mkRead({ headline: 'Aa bb cc?' }), mkSummary(), `✓ headline is exactly ${S} sentence`],
    ['a field with no terminal punctuation hard-fails',
      mkRead({ watchFor: 'dd ee ff' }), mkSummary(), '✗ watchFor ends in terminal punctuation'],
    ['a closing quote after the full stop still counts as terminal',
      mkRead({ watchFor: 'dd ee "ff."' }), mkSummary(), '✓ watchFor ends in terminal punctuation'],
    ['a numeral anywhere hard-fails',
      mkRead({ watchFor: 'Bet 3 times.' }), mkSummary(), '✗ watchFor contains no numerals (1 found'],
    // The splitter's digit guard, which is the reason it exists: "3.5" must not
    // read as a sentence boundary. The read still fails — on the NUMERAL check,
    // which is the true defect — instead of on a phantom two-sentence one.
    ['a decimal does not split a sentence in two',
      mkRead({ watchFor: 'Take 3.5 to one.' }), mkSummary(), `✓ watchFor is exactly ${S} sentence (measured ${S})`],
    ['a decimal is still caught as a numeral',
      mkRead({ watchFor: 'Take 3.5 to one.' }), mkSummary(), '✗ watchFor contains no numerals'],
    // v3 dropped evidence; the schema forbids it, so its presence is a defect.
    ['a leftover evidence field is reported',
      JSON.stringify({ headline: 'aa bb.', watchFor: 'cc dd.', evidence: ['ee'] }), mkSummary(), '✗ read still carries an `evidence` field'],
    // ── Finding 3, both directions: the rule fires on the DATA, and only on it.
    ['confident errors present + headline names them passes',
      mkRead({ headline: 'Fast calls keep missing.' }), mkSummary({ confidentMisses: oneMiss }), `✓ ${HEADLINE_RULE}`],
    ['confident errors present + headline ignores them fails',
      mkRead({ headline: 'Position leaks keep showing up.' }), mkSummary({ confidentMisses: oneMiss }), `✗ ${HEADLINE_RULE}`],
    // ── Tier 2 (v3): the prose clause is the WHOLE check — the counts receipt
    // retired with `evidence` and with numerals.
    ['improved stretch: an improvement clause in the headline passes',
      mkRead({ headline: 'You are playing sharper lately, but calls still go loose.' }),
      mkSummary({ accuracy: { correct: 20, total: 50 }, previous: { correct: 10, total: 50 } }),
      '✓ trajectory clause'],
    ['improved stretch: headline without improvement wording fails',
      mkRead({ headline: 'Calls keep going in too loose lately.' }),
      mkSummary({ accuracy: { correct: 20, total: 50 }, previous: { correct: 10, total: 50 } }),
      '✗ trajectory clause'],
    // ── False-direction guard: a decline spun as progress.
    ['declined stretch: improvement wording in either field fails',
      mkRead({ headline: 'Position spots keep missing.', watchFor: 'A sharper stretch than before.' }),
      mkSummary({ accuracy: { correct: 20, total: 50 }, previous: { correct: 30, total: 50 } }),
      '✗ no false improvement claim'],
    ['declined stretch: honest decline passes',
      mkRead({ headline: 'Position spots keep missing.', watchFor: 'Slow down before calling.' }),
      mkSummary({ accuracy: { correct: 20, total: 50 }, previous: { correct: 30, total: 50 } }),
      '✓ no false improvement claim'],
    // ── The v3 voice ban, the phrase that prompted it (spec §5).
    ['"you tend to" is flagged as a trait verdict',
      mkRead({ headline: 'You tend to fold too early.' }), mkSummary(), '⚠ stretch-scoped voice'],
    ['the stretch-scoped rewrite of the same sentence is clean',
      mkRead({ headline: "Lately you've been folding too early." }), mkSummary(), '✓ stretch-scoped voice'],
    // ── Example fingerprints, both directions.
    ['an example phrase the data does not warrant is flagged',
      mkRead({ headline: 'You have been snap calling tight players lately.' }), mkSummary(),
      '⚠ no worked-example phrasing the data does not warrant'],
    ['the same phrase is clean when the window has a tight-villain confident error',
      mkRead({ headline: 'You have been snap calling tight players lately.' }),
      mkSummary({ confidentMisses: oneMiss }), '✓ no worked-example phrasing'],
    ['a freezer phrase is clean when the window has timeouts',
      mkRead({ watchFor: 'Commit, because any choice beats no choice.' }),
      mkSummary({ timeouts: 4 }), '✓ no worked-example phrasing'],
    ['a freezer phrase on a window with no timeouts is flagged',
      mkRead({ watchFor: 'Commit, because any choice beats no choice.' }),
      mkSummary(), '⚠ no worked-example phrasing'],
    // ── Em dashes.
    ['an em dash is flagged', mkRead({ watchFor: 'Slow down — then call.' }), mkSummary(), '⚠ no em dashes (1 found'],
    ['a clean read reports the em-dash denominator', mkRead({}), mkSummary(), '✓ no em dashes (0 found'],
    // Non-JSON must not silently count as a pass.
    ['unparseable output is reported', 'not json at all', mkSummary(), '✗ did not parse as JSON'],
  ];

  const failures = [];
  for (const [name, read, summary, want] of cases) {
    const out = checkRead(read, summary, newCoverage()).join('\n');
    if (!out.includes(want)) failures.push(`  ✗ ${name}\n     wanted a line containing: ${want}\n     got:\n${out.replace(/^/gm, '       ')}`);
  }
  // ── The founder-signed worked examples must pass this harness ────────────
  // The three examples in the prompt are the founder's own register, signed off
  // August 2 2026, and they go into the prompt verbatim. So they are the one
  // input whose correct verdict is known in advance: if the harness fails them,
  // the HARNESS is wrong — a cap mistyped, a splitter too eager, a scan too
  // broad — and every ✗ it prints on a live run is noise pointing at the model.
  //
  // Each is paired with the window that WARRANTS it, so the conditional checks
  // (confident-error headline, trajectory clause, freezer, fingerprints) are
  // exercised on their passing side rather than skipped. Zero hard failures AND
  // zero soft flags: a worked example that trips a soft scan is an example that
  // teaches the model to trip it.
  const SIGNED_EXAMPLES = [
    ['tier 1 (confident errors)',
      { headline: "You've been snap calling tight players a lot lately.",
        watchFor: 'A Tight Nit rarely bluffs and rarely plays a bad hand, so make sure yours is strong before the chips go in.' },
      mkSummary({ confidentMisses: oneMiss, accuracy: { correct: 20, total: 50 }, previous: { correct: 40, total: 50 } })],
    ['tier 2 (improving stretch)',
      { headline: "You're playing sharper lately, but you're still folding too early when the price is good.",
        watchFor: 'When the bet is less than half the pot, pause and look at your draws before letting the hand go.' },
      mkSummary({ skills: [{ skill: 'potodds', correct: 4, attempts: 10 }],
        accuracy: { correct: 20, total: 50 }, previous: { correct: 10, total: 50 } })],
    ['tier 3 (freezer variant)',
      { headline: 'The clock has been making too many of your decisions for you.',
        watchFor: 'When the timer gets low, pick the safest line you see and commit, because any choice beats no choice.' },
      mkSummary({ timeouts: 8, accuracy: { correct: 20, total: 50 }, previous: { correct: 30, total: 50 } })],
  ];
  for (const [label, read, summary] of SIGNED_EXAMPLES) {
    const out = checkRead(JSON.stringify(read), summary, newCoverage());
    const hard = out.filter((l) => l.startsWith('- ✗'));
    const soft = out.filter((l) => l.startsWith('- ⚠'));
    if (hard.length || soft.length)
      failures.push(`  ✗ the founder-signed ${label} example does not pass this harness\n`
        + `     (the example is signed off and ships verbatim, so this is a HARNESS defect)\n`
        + [...hard, ...soft].map((l) => `     ${l}`).join('\n'));
  }

  // A read with no confident errors must not be judged against a rule the
  // prompt did not give it — the inverse of the drift finding 3 fixed.
  const quiet = checkRead(mkRead({}), mkSummary(), newCoverage()).join('\n');
  if (quiet.includes(HEADLINE_RULE))
    failures.push(`  ✗ the headline rule fired on a window with zero confident errors`);

  // Coverage must count what was measured, not what was declared. Every v3
  // counter is asserted here: a check that silently stops running would show up
  // as a zero in the report, and a zero is indistinguishable from "clean" to
  // anyone reading it — which is the exact shape of finding 1.
  const c = newCoverage();
  checkRead(mkRead({}), mkSummary({ timeouts: 3 }), c);
  checkRead('not json', mkSummary(), c);
  const wantCov = {
    parsed: 1, unparsed: 1,
    headlines: 1, watchFor: 1, totals: 1,
    sentenceFields: 2, punctFields: 2, numeralFields: 2,
    freezeApplicable: 1, voiceScanned: 1, fingerprintScanned: 1, emdashScanned: 1,
  };
  for (const [k, v] of Object.entries(wantCov))
    if (c[k] !== v) failures.push(`  ✗ coverage.${k} is ${c[k]}, expected ${v} — the totals must reflect real measurements`);

  // ── Findings 1 and 2: the console verdict and the exit status ────────────
  // Exercised offline for the same reason the cap checks are: a verdict whose
  // first execution is the paid gate it protects has never been shown to work.
  // The errored-read case in particular can now be proven WITHOUT a real API
  // call — the harness's only failure channel is the `ERROR: ` prefix it writes
  // into `read`, so feeding that string is the same input a thrown fetch
  // produces.
  const lines = (read, summary = mkSummary()) => checkRead(read, summary, newCoverage());
  const errRead = `${ERROR_PREFIX}fetch failed`;
  const errV = personaVerdict(errRead, lines(errRead));
  const badRead = mkRead({ headline: nWords(H + 3) });
  const badV = personaVerdict(badRead, lines(badRead));
  const okV = personaVerdict(mkRead({}), lines(mkRead({})));
  // Hard checks all pass; only the soft voice scan trips. Must stay clean.
  const softRead = mkRead({ headline: 'You are a maniac lately.' });
  const softV = personaVerdict(softRead, lines(softRead));
  const covOf = (personas, clean) => ({ ...newCoverage(), personas, personasClean: clean });

  const verdictCases = [
    ['an errored read is never ticked', () => !verdictLine('P', errV).includes('✓')],
    ['an errored read is named as a failed API call', () => verdictLine('P', errV).includes('API CALL FAILED')],
    ['an errored read is not counted clean', () => errV.clean === false && errV.errored === true],
    ['a failing check is reported with its count', () => verdictLine('P', badV) === '✗ P — 1 check FAILED'],
    ['a clean read is ticked', () => verdictLine('P', okV) === '✓ P — all checks passed'],
    ['a soft voice flag is surfaced but does not fail the persona',
      () => softV.clean === true && verdictLine('P', softV) === '✓ P — all checks passed (+1 soft flag)'],
    ['a dirty run exits 1', () => runExitCode(covOf(9, 8)) === 1],
    ['a clean run exits 0', () => runExitCode(covOf(9, 9)) === 0],
    ['the run verdict states the denominator and the exit code',
      () => runVerdictLine(covOf(9, 8)).includes('8 of 9 personas passed cleanly')
        && runVerdictLine(covOf(9, 8)).includes('exit 1')],
  ];
  for (const [name, fn] of verdictCases) if (!fn()) failures.push(`  ✗ ${name}`);

  const total = cases.length + SIGNED_EXAMPLES.length + 1
    + Object.keys(wantCov).length + verdictCases.length;
  console.log(failures.length
    ? `eval-coach selftest FAILED (${failures.length}):\n${failures.join('\n')}`
    : `eval-coach selftest OK — ${total} assertions over caps ${H}/${W}/${T}w at ${S} sentence per field,`
      + ' the structure checks (sentences, terminal punctuation, numerals), the headline rule,'
      + ' the trajectory clause, the fingerprint and em-dash scans, the coverage totals,'
      + ' the per-persona verdict and the exit status');
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
      read = `${ERROR_PREFIX}${err.message}`;
    }
  } else {
    console.log(`— ${p.name} (dry) — prompt written to ${OUT}`);
  }
  // The dry artifact carries the ASSEMBLED PROMPTS (August 2, 2026). It is named
  // coach-eval-dry-prompts.md and its own banner says "use this to read the
  // PROMPTS", and until now it contained none of them: they went to stdout only,
  // while the file held nine "(dry run — no API call)" placeholders. Anyone
  // reviewing a prompt change by opening the file — which is what its name
  // invites — reviewed nothing and had no way to tell. Same failure class as
  // findings 1 and 4: an artifact that certifies more than it carries.
  const promptBlock = DRY
    ? `\n**Assembled prompt** — verbatim, exactly what the model would receive:\n\n`
      + '```\n' + buildPrompt(summary) + '\n```\n'
    : '';
  // The checks run BEFORE anything is printed about this persona. The old order
  // printed the tick first and measured afterwards, which is how a failed call
  // and three real ✗ results all rendered as ✓ (finding 1).
  const checkLines = DRY ? [] : checkRead(read, summary, cov);
  if (!DRY) {
    const v = personaVerdict(read, checkLines);
    if (v.clean) cov.personasClean += 1;
    if (v.errored) cov.personasErrored += 1;
    else if (v.failed > 0) cov.personasFailed += 1;
    console.log(verdictLine(p.name, v));
  }
  const checks = DRY ? '' : `\n**Checks:**\n${checkLines.join('\n')}\n`;
  sections.push(`## ${p.name}\n\n**Expected:** ${p.expect}\n\n**Window:**\n${window}\n${promptBlock}\n**Coach's Read:**\n\n${renderRead(read)}\n${checks}`);
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
  `*Generated by scripts/eval-coach.mjs over the real aggregate() of a ten-session window. Reads are structured JSON (headline/watchFor) and are printed here JOINED, as one paragraph, because that is exactly how the card renders them.*\n\n` +
  `**Read all nine aloud.** That is the acceptance test v3 was written for: they should sound like one coach talking, not nine reports. The mechanical Checks block below each read covers structure (two sentences, terminal punctuation, zero numerals, the word caps) and the substance rules (confident errors own sentence one · the trajectory clause only on genuinely improving stretches · declines never spun · freezing named as its own pattern · no trait verdicts). None of it can judge VOICE, which is the only thing that decides whether v3 ships.\n\n` +
  `*Also judge: does sentence two actually TEACH — a real claim about the villain type or the concept — and does it land an if-then the player can run next session? Does anything read as parroted from the worked examples rather than earned by this persona's data (the fingerprint scan flags the three phrases it can see; you can see the rest)? Villains reach the prompt ONLY through confident errors and repeated spots, so on a persona whose Window shows 0 of each there is no villain string to reference; where the counts are non-zero, a read that ignores the villain fails.*\n\n` +
  `${coverageReport(cov, DRY)}\n\n---\n\n` +
  sections.join('\n---\n\n');
// Written BEFORE the verdict is applied, and unconditionally: the founder needs
// to read the nine reads whether the run was clean or dirty. Only the exit
// status reflects the verdict (finding 2).
writeFileSync(OUT, doc);
console.log(`\n${coverageReport(cov, DRY)}\n`);
console.log(`Wrote ${OUT} (${DRY ? 'DRY RUN' : 'LIVE'}, ${PERSONAS.length} personas)`
  + (DRY ? ` — the live artifact ${OUT_LIVE} was NOT touched` : ''));
if (!DRY) {
  console.log(runVerdictLine(cov));
  // exitCode rather than exit(): the artifact is on disk and stdout still has to
  // flush. A dry run has measured nothing, so it has no verdict to report and
  // stays at 0 (check-invariants rule 32 runs it and requires success).
  process.exitCode = runExitCode(cov);
}
