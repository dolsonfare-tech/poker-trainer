// Coach's Read eval harness — runs the REAL prompt (imported from
// api/coach-read.js, the only Anthropic caller) against synthetic sessions,
// one per player schema plus edge personas, and writes the reads to
// coach-eval-output.md for review against the F5 quality bar:
//   1. Names the pattern-level WHY (the mental model), not per-hand recaps
//   2. Names the DIRECTION of the mistakes (too passive vs too aggressive)
//   3. References the villain types involved, not just abstract skills
//   4. Calls out clustered confident misses ("answered fast") directly
//   5. Human tone; no generic praise, no restating results the player saw
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
  sections.push(`## ${p.name}\n\n**Expected:** ${p.expect}\n\n**Session:**\n${summary}\n\n**Coach's Read:**\n> ${read.replace(/\n/g, '\n> ')}\n`);
}

const doc = `# Coach's Read eval — ${DRY ? 'DRY RUN' : 'live'} output\n\n` +
  `*Generated by scripts/eval-coach.mjs. Judge each read against the F5 bar: pattern-level why · direction of error · villain context · confident-miss callout · human tone, no restating.*\n\n` +
  sections.join('\n---\n\n');
writeFileSync(OUT, doc);
console.log(`\nWrote ${OUT} (${PERSONAS.length} personas)`);
