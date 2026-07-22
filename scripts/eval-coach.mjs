// Coach's Read eval harness — runs the REAL prompt (imported from
// api/coach-read.js, the only Anthropic caller) against synthetic sessions,
// one per player schema plus edge personas, and writes the reads to
// coach-eval-output.md for review against the F5 quality bar:
//   1. Names the pattern-level WHY (the mental model), not per-hand recaps
//   2. Names the DIRECTION of the mistakes (too passive vs too aggressive)
//   3. References the villain types involved, not just abstract skills
//   4. Calls out clustered confident misses ("answered fast") directly
//   5. Human tone; no generic praise, no restating results the player saw
//   6. Session-scoped field-notes voice ("what I noticed today"), never a
//      trait verdict ("you are a passive player") — July 22, 2026 reframe
//
// Run:  CLAUDE_API_KEY=sk-... npm run eval:coach        (live calls, ~9 reads)
//       npm run eval:coach -- --dry                     (print prompts only)
//
// The key is Vercel-only by design — never commit it, never put it in .env.

import { writeFileSync } from 'node:fs';
import SCENARIOS from '../src/data/scenarios.js';
import coach from '../api/coach-read.js';

const { buildPrompt, callClaude } = coach;
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

// Build one synthetic session: `plan` is a list of
// { pool, wrongCls | correct: true | timeout: true, fast?: true } — one hand each.
function buildSession(plan) {
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
    const hero = s.positions.find((p) => p.state === 'hero');
    const correctOpt = s.options.find((o) => o.val === s.correct);
    if (step.timeout) {
      return mk(s, hero, null, correctOpt, 'incorrect', false);
    }
    if (step.correct) {
      return mk(s, hero, correctOpt, correctOpt, 'correct', false);
    }
    const choseOpt = pickWrong(s, step.wrongCls ?? []);
    const result = s.grading[choseOpt.val]?.g ?? 'incorrect';
    return mk(s, hero, choseOpt, correctOpt, result, !!step.fast && result !== 'correct');
  });
}

// Mirrors the decisionsPlayed mapping in src/utils/claude.js (kept in sync by
// hand — claude.js imports browser-only modules and can't load under node).
function mk(s, hero, choseOpt, correctOpt, result, confidentMiss) {
  return {
    scenario: s.tag,
    villain: s.villain.label,
    villainNotes: s.villain.notes,
    tableContext: s.tableContext || null,
    hand: s.hand.map((c) => c.r + c.s).join(''),
    position: hero ? hero.label : '',
    chose: choseOpt ? choseOpt.label : 'Timed out (no action)',
    correctAction: correctOpt ? correctOpt.label : '',
    result,
    confidentMiss,
  };
}

// One persona per schema (leak expressed in the schema's direction on its
// primary skills), plus edge personas the prompt must also handle well.
const PERSONAS = [
  {
    name: 'Conflict Avoider',
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
    expect: 'Calling without the price / any-two-cards named; loose continuance.',
    plan: [
      { pool: byCorrectCls(bySkills(['potodds']), 'fold'), wrongCls: ['call'] },
      { pool: byCorrectCls(bySkills(['preflop']), 'fold'), wrongCls: ['call', 'raise'] },
      { pool: byCorrectCls(bySkills(['potodds', 'reads']), 'fold'), wrongCls: ['call'] },
      { pool: bySkills(['opponent']), correct: true },
      { pool: bySkills(['reads']), correct: true },
    ],
  },
  {
    name: 'Positional Blind Spot',
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
    name: 'Results Thinker (mixed misses)',
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
  if (Array.isArray(obj.evidence)) {
    const n = obj.evidence.length;
    lines.push(`- ${n >= 1 && n <= 3 ? '✓' : '✗'} evidence has 1–3 items (${n})`);
  }
  if (typeof obj.headline === 'string') {
    const words = obj.headline.trim().split(/\s+/).filter(Boolean).length;
    lines.push(`- ${words <= 15 ? '✓' : '⚠'} headline ≤ ~15 words (${words}) [soft]`);
    // The confident-misser persona's headline MUST name the fast/confident leak.
    if (persona.plan.some((s) => s.fast)) {
      const hit = /\b(confiden|fast|quick|sure|snap|autopilot|instinct|reflex|rush)/i.test(obj.headline);
      lines.push(`- ${hit ? '✓' : '✗'} confident-misser headline names the fast/confident pattern`);
    }
  }
  // Voice reframe (July 22, 2026): the read is session-scoped field notes, not
  // a trait verdict. Flag identity/always claims in any field. Soft — phrases
  // like "you are getting 3.5:1" are legitimate, so a human still judges.
  const verdicty = /\byou (are|'re) (a|an|too|the)\b|\byou (always|never)\b|\byour game\b|\bas a player\b/i;
  const fields = [obj.headline, ...(Array.isArray(obj.evidence) ? obj.evidence : []), obj.watchFor]
    .filter((f) => typeof f === 'string');
  const verdictHit = fields.some((f) => verdicty.test(f));
  lines.push(`- ${verdictHit ? '⚠' : '✓'} session-scoped voice, no trait verdicts${verdictHit ? ' (found "you are a / you always / your game") [soft]' : ''}`);
  return lines;
}

const sections = [];
for (const p of PERSONAS) {
  const decisions = buildSession(p.plan);
  const summary = decisions.map((d) =>
    `  - [${d.result}${d.confidentMiss ? ' · fast' : ''}] ${d.scenario} vs ${d.villain}: chose "${d.chose}" (best "${d.correctAction}")`
  ).join('\n');
  let read = '(dry run — no API call)';
  if (!DRY) {
    try {
      read = await callClaude(decisions, apiKey);
    } catch (err) {
      read = `ERROR: ${err.message}`;
    }
    console.log(`✓ ${p.name}`);
  } else {
    console.log(`— ${p.name} (dry)\n${buildPrompt(decisions)}\n`);
  }
  const checks = DRY ? '' : `\n**Checks:**\n${checkRead(read, p).join('\n')}\n`;
  sections.push(`## ${p.name}\n\n**Expected:** ${p.expect}\n\n**Session:**\n${summary}\n\n**Coach's Read:**\n\n${renderRead(read)}\n${checks}`);
}

const doc = `# Coach's Read eval — ${DRY ? 'DRY RUN' : 'live'} output\n\n` +
  `*Generated by scripts/eval-coach.mjs. Reads are structured JSON (headline/evidence/watchFor). Judge each against the F5 bar: pattern-level why · direction of error · villain context · confident-miss callout · human tone, no restating · session-scoped field-notes voice (never a trait verdict). The mechanical Checks block flags structural issues; the F5 judgment is still yours.*\n\n` +
  sections.join('\n---\n\n');
writeFileSync(OUT, doc);
console.log(`\nWrote ${OUT} (${PERSONAS.length} personas)`);
