// Schema-diagnosis simulation harness — tests deriveSchema (the REAL production
// function, imported from userStorage.js) against synthetic player profiles.
//
// Run:  npm run simulate:schemas   (or: node scripts/simulate-schemas.mjs)
//
// Why this exists: the July 2026 v1 bug (Conflict Avoider firing ~90% under
// uniform play) was a STRUCTURAL bias — detectable with synthetic players, no
// real data needed. This harness is the regression test for that class of bug.
//
// Schema v2 (July 18, 2026 — the hybrid direction/skill model): diagnosis is no
// longer accuracy-only. The three DIRECTION schemas (Conflict Avoider, The
// Gambler, The Overaggressor) are scored from a direction-of-error TALLY —
// which fold/call/raise mistake a player makes — not from per-skill accuracy;
// the three SKILL schemas (Positional Blind Spot, Results Thinker, Exploitable
// Regular) keep their absolute per-skill-weakness scoring. So each profile now
// carries BOTH:
//   • an accuracy dial (`acc`/`base`) that drives skill ratings → skill schemas
//     + the Balanced tie, exactly as before, AND
//   • a synthesized direction tally (`dir` shares, scaled by session volume):
//     direction-leak profiles get a dominant cell at realistic evidence
//     matching their archetype (a Conflict Avoider's mistakes skew 'under'); the
//     skill-leak and balanced profiles get a NEAR-NEUTRAL tally that stays below
//     the severity gate, so no direction schema can steal their diagnosis.
// The exit-1 structural-bias gate is unchanged: with abundant data the expected
// diagnosis must dominate.
//
// Model: each session = 5 hands; each hand tests a uniformly random skill
// (approximates the shuffled scenario draw); the player answers correctly with
// their true per-skill accuracy, else incorrectly (partial credit not modeled
// here — the persona harness models it; this harness isolates the diagnosis).

import { register } from 'node:module';
register(new URL('ext-resolver.mjs', import.meta.url));

const { deriveSchema } = await import('../src/utils/userStorage.js');
const { applyHandToSkill } = await import('../src/data/constants.js');

const SKILLS = ['preflop', 'position', 'aggression', 'betsize', 'bluffing', 'potodds', 'reads', 'opponent'];
const TRIALS = 500;
const SESSION_COUNTS = [5, 10, 20, 40];
const HANDS_PER_SESSION = 5;

// Neutral direction shares — what a uniform-random mistaker produces on the pool
// (mirrors computeDirectionBaseline in userStorage.js; 'under' absorbs 3 of the
// 6 ordered mispairs so it sits near 0.53 even for a balanced player). A profile
// with these shares has zero excess over baseline → no direction schema fires,
// however much evidence it accrues.
const NEUTRAL_DIR = { under: 0.53, over: 0.33, loose: 0.14 };
// Evidence a mistaking player accrues per session (a couple of direction-bearing
// misses). 5 sessions → 10 evidence, already clear of MIN_DIRECTION_EVIDENCE.
const EVIDENCE_PER_SESSION = 2;

// Direction shares for the leak profiles are taken from what the REAL directional
// personas produce in playtest-personas (Conflict Avoider under≈0.88, The
// Overaggressor over≈0.77, The Gambler loose≈0.62) — so the sim exercises the
// same excess-over-baseline severities the live loop does.
const CA_DIR = { under: 0.88, over: 0.02, loose: 0.10 };
const OA_DIR = { under: 0.06, over: 0.77, loose: 0.17 };
const GAMBLER_DIR = { under: 0.23, over: 0.15, loose: 0.62 };

// True per-skill accuracy for each synthetic archetype, its (optional) direction
// tally shares, and the diagnosis a correct engine should produce. `acc` sets
// listed skills; `base` covers the rest. `dir` omitted → NEUTRAL_DIR.
const PROFILES = [
  { label: 'Uniform beginner (all 45%)',            base: 0.45, acc: {},                                       expect: 'The Student of the Game' },
  { label: 'Uniform mediocre (all 65%)',            base: 0.65, acc: {},                                       expect: 'The Student of the Game' },
  { label: 'Uniform strong (all 85%)',              base: 0.85, acc: {},                                       expect: 'The Balanced Player' },
  { label: 'Coin-flipper (all 50%)',                base: 0.50, acc: {},                                       expect: 'The Student of the Game' },
  // Direction-leak profiles: diagnosed from `dir`, NOT accuracy. Their weak
  // skills (aggression/bluffing/preflop/potodds/betsize) are no longer scored by
  // any schema, so they name nothing on their own — the tally does the work.
  { label: 'Conflict Avoider (under-dominant)',     base: 0.80, acc: { aggression: 0.4, bluffing: 0.4 }, dir: CA_DIR,      expect: 'The Conflict Avoider' },
  { label: 'Gambler (loose-dominant)',              base: 0.80, acc: { preflop: 0.4, potodds: 0.4 },     dir: GAMBLER_DIR, expect: 'The Gambler' },
  { label: 'Overaggressor (over-dominant)',         base: 0.80, acc: { betsize: 0.4 },                   dir: OA_DIR,      expect: 'The Overaggressor' },
  // Skill-leak profiles: a genuinely red primary skill + a near-neutral tally.
  { label: 'Positional Blind Spot (position 40%)',  base: 0.80, acc: { position: 0.4 },                        expect: 'The Positional Blind Spot' },
  { label: 'Results Thinker (reads 40%)',           base: 0.80, acc: { reads: 0.4 },                           expect: 'The Results Thinker' },
  { label: 'Exploitable Regular (opponent 40%)',    base: 0.80, acc: { opponent: 0.4 },                        expect: 'The Exploitable Regular' },
  // Fallback voice is level-aware (founder, July 19, 2026): no-dominant-leak +
  // majority-green ledger → 'The Balanced Player'; otherwise 'The Student of
  // the Game' — uniform weakness must not read as reassurance.
  // Yellow-only leak reads as Balanced BY DESIGN since the July 2026 bar raise
  // (SCHEMA_MIN_SEVERITY 1.25): the schema card only names a leak when a skill
  // is genuinely red; yellow shows in the skill ledger instead.
  { label: 'Mild single leak (position 60%)',       base: 0.85, acc: { position: 0.6 },                        expect: 'The Balanced Player' },
  // position scores 2.0 alone → Positional; the aggression red is inert under v2
  // (aggression no longer names a schema — Conflict Avoider is direction-scored),
  // and this profile's near-neutral tally can't fire a direction schema.
  { label: 'Two leaks (aggression 40%, position 40%)', base: 0.80, acc: { aggression: 0.4, position: 0.4 },    expect: 'The Positional Blind Spot' },
  // Guard: an under-dominant tally must NOT overpower a genuinely red skill leak
  // — a seat-blind player who also happens to over-fold is still Positional here
  // (position 2.0 > CA severity ~1.9). Protects the "direction can't hijack a
  // real skill leak" boundary.
  { label: 'Positional + mild under-skew',          base: 0.80, acc: { position: 0.4 }, dir: CA_DIR,           expect: 'The Positional Blind Spot' },
];

// Synthesize a lifetime direction tally scaled to the session volume.
function synthTally(profile, sessions) {
  const shares = profile.dir ?? NEUTRAL_DIR;
  const ev = EVIDENCE_PER_SESSION * sessions;
  return { under: shares.under * ev, over: shares.over * ev, loose: shares.loose * ev, evidence: ev };
}

function simulatePlayer(profile, sessions) {
  const skills = Object.fromEntries(SKILLS.map(k => [k, { rating: 'gray', attempts: 0, correct: 0 }]));
  for (let h = 0; h < sessions * HANDS_PER_SESSION; h++) {
    const skill = SKILLS[Math.floor(Math.random() * SKILLS.length)];
    const p = profile.acc[skill] ?? profile.base;
    const result = Math.random() < p ? 'correct' : 'incorrect';
    skills[skill] = applyHandToSkill(skills[skill], result);
  }
  return deriveSchema(skills, sessions, synthTally(profile, sessions));
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
