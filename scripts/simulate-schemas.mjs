// Schema-diagnosis simulation harness — tests deriveSchema (the REAL production
// function, imported from userStorage.js) against synthetic player profiles.
//
// Run:  npm run simulate:schemas   (or: node scripts/simulate-schemas.mjs)
//
// Why this exists: the July 2026 v1 bug (Conflict Avoider firing ~90% under
// uniform play) was a STRUCTURAL bias — detectable with synthetic players, no
// real data needed. This harness is the regression test for that class of bug,
// and the pre-calibration testbed for the post-launch v2 relative-weakness
// model: implement a candidate scorer, point it at these profiles, and see
// whether every archetype gets the right diagnosis before touching thresholds.
//
// Model: each session = 5 hands; each hand tests a uniformly random skill
// (approximates the shuffled scenario draw); the player answers correctly with
// their true per-skill accuracy, else incorrectly (partial credit not modeled).
// Results are folded through the production applyHandToSkill accounting.

import { register } from 'node:module';
register(new URL('ext-resolver.mjs', import.meta.url));

const { deriveSchema } = await import('../src/utils/userStorage.js');
const { applyHandToSkill } = await import('../src/data/constants.js');

const SKILLS = ['preflop', 'position', 'aggression', 'betsize', 'bluffing', 'potodds', 'reads', 'opponent'];
const TRIALS = 500;
const SESSION_COUNTS = [5, 10, 20, 40];
const HANDS_PER_SESSION = 5;

// True per-skill accuracy for each synthetic archetype, and the diagnosis a
// correct engine should produce. `acc` sets listed skills; `base` covers the rest.
const PROFILES = [
  { label: 'Uniform beginner (all 45%)',            base: 0.45, acc: {},                                       expect: 'The Balanced Player' },
  { label: 'Uniform mediocre (all 65%)',            base: 0.65, acc: {},                                       expect: 'The Balanced Player' },
  { label: 'Uniform strong (all 85%)',              base: 0.85, acc: {},                                       expect: 'The Balanced Player' },
  { label: 'Coin-flipper (all 50%)',                base: 0.50, acc: {},                                       expect: 'The Balanced Player' },
  { label: 'Conflict Avoider (aggr/bluff 40%)',     base: 0.80, acc: { aggression: 0.4, bluffing: 0.4 },       expect: 'The Conflict Avoider' },
  { label: 'Gambler (preflop/potodds 40%)',         base: 0.80, acc: { preflop: 0.4, potodds: 0.4 },           expect: 'The Gambler' },
  { label: 'Positional Blind Spot (position 40%)',  base: 0.80, acc: { position: 0.4 },                        expect: 'The Positional Blind Spot' },
  { label: 'Results Thinker (reads 40%)',           base: 0.80, acc: { reads: 0.4 },                           expect: 'The Results Thinker' },
  { label: 'Exploitable Regular (opponent 40%)',    base: 0.80, acc: { opponent: 0.4 },                        expect: 'The Exploitable Regular' },
  { label: 'Overaggressor (betsize 40%)',           base: 0.80, acc: { betsize: 0.4 },                         expect: 'The Overaggressor' },
  // Yellow-only leak reads as Balanced BY DESIGN since the July 2026 bar raise
  // (SCHEMA_MIN_SEVERITY 1.25): the schema card only names a leak when a skill
  // is genuinely red; yellow shows in the skill ledger instead.
  { label: 'Mild single leak (position 60%)',       base: 0.85, acc: { position: 0.6 },                        expect: 'The Balanced Player' },
  { label: 'Two leaks (aggression 40%, position 40%)', base: 0.80, acc: { aggression: 0.4, position: 0.4 },    expect: 'The Positional Blind Spot' }, // position scores 2.0 alone; CA averages in healthy bluffing
];

function simulatePlayer(profile, sessions) {
  const skills = Object.fromEntries(SKILLS.map(k => [k, { rating: 'gray', attempts: 0, correct: 0 }]));
  for (let h = 0; h < sessions * HANDS_PER_SESSION; h++) {
    const skill = SKILLS[Math.floor(Math.random() * SKILLS.length)];
    const p = profile.acc[skill] ?? profile.base;
    const result = Math.random() < p ? 'correct' : 'incorrect';
    skills[skill] = applyHandToSkill(skills[skill], result);
  }
  return deriveSchema(skills, sessions);
}

let structuralFailures = 0;

for (const profile of PROFILES) {
  console.log(`\n${profile.label}  →  expect: ${profile.expect}`);
  for (const sessions of SESSION_COUNTS) {
    const tally = {};
    for (let t = 0; t < TRIALS; t++) {
      const result = simulatePlayer(profile, sessions);
      const name = result === null ? '(locked)' : result.name;
      tally[name] = (tally[name] ?? 0) + 1;
    }
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const pct = (n) => `${Math.round((n / TRIALS) * 100)}%`;
    const hit = pct(tally[profile.expect] ?? 0);
    const top = sorted.slice(0, 3).map(([n, c]) => `${n} ${pct(c)}`).join(' · ');
    console.log(`  ${String(sessions).padStart(2)} sessions: expected ${hit.padStart(4)} | ${top}`);

    // Structural-bias gate: with plenty of data, the expected diagnosis must
    // dominate. 40 sessions ≈ 25 attempts/skill — sampling noise is small there.
    if (sessions === 40 && (tally[profile.expect] ?? 0) / TRIALS < 0.5) {
      structuralFailures++;
      console.log(`  ⚠️  STRUCTURAL: expected diagnosis under 50% even at 40 sessions`);
    }
  }
}

console.log(`\n${structuralFailures === 0 ? '✅ No structural bias detected at high sample sizes.' : `🔴 ${structuralFailures} profile(s) misdiagnosed even with abundant data — structural bias.`}`);
console.log('Low-session rows quantify sampling noise (expected to be messy at 5 sessions — 25 hands across 8 skills).');
process.exit(structuralFailures ? 1 : 0);
