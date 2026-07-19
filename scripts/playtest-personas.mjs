// Synthetic playtesting personas — plays the REAL product loop at volume.
//
// Run:  npm run playtest:personas   (or: node scripts/playtest-personas.mjs)
//
// Where simulate-schemas.mjs tests deriveSchema in isolation with uniformly
// random skill draws, this harness runs the WHOLE learning loop the way a
// player experiences it: the real session builder (spaced-rep v2 + R4 contrast
// pairs) deals from the real pool, a persona with a poker personality answers
// each hand, and the results fold through the real applySessionResults
// (ratings, schema, IQ, streak, graduation ladder). 40 sessions per persona
// over simulated days — the volumes real users will generate, observed before
// any real user lives them.
//
// Personas are DIRECTIONAL: they err by fold/call/raise tendency, not by a
// per-skill accuracy dial, because direction is what separates the player
// schemas (the v2 design note in CLAUDE.md: identical accuracy, opposite
// mistakes). Expected-vs-actual schema rows are observations, not assertions —
// the current engine scores accuracy only, and this harness exists to measure
// what that means for realistic players.
//
// Mechanical INVARIANTS (session shape, replay/pair/preflop caps, same-day
// resurface suppression) are hard-checked and exit 1 on violation.

import { register } from 'node:module';
register(new URL('ext-resolver.mjs', import.meta.url));

// ── Simulated clock: patch Date before importing the engine ─────────────────
let DAY_OFFSET = 0;
const RealDate = Date;
const OFFSET_MS = () => DAY_OFFSET * 86400000;
// eslint-disable-next-line no-global-assign
Date = class extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(RealDate.now() + OFFSET_MS());
    else super(...args);
  }
  static now() { return RealDate.now() + OFFSET_MS(); }
};

const { default: SCENARIOS } = await import('../src/data/scenarios.js');
const { buildSession, SURGE_QUEUE_THRESHOLD } = await import('../src/utils/spacedrep.js');
const userStorage = await import('../src/utils/userStorage.js');
const { applySessionResults, createUser, derivePokerScore, toLocalDateString } = userStorage;

const SESSIONS = 40;
const LENGTH = 5;

// ── Seeded RNG (mulberry32) — reproducible runs ─────────────────────────────
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Personas ────────────────────────────────────────────────────────────────
// accFor(scenario, sessionIdx) → probability of choosing the correct option.
// wrongBias → weights over the cls of the WRONG option picked {fold,call,raise}.
// fastWrong → wrong answers come fast (confident miss, ≤15s).
const clsOfCorrect = (s) => s.options.find((o) => o.val === s.correct)?.cls ?? 'call';

const PERSONAS = [
  {
    key: 'conflict-avoider', label: 'Conflict Avoider (folds when raising is right)',
    accFor: (s) => (clsOfCorrect(s) === 'raise' ? 0.30 : clsOfCorrect(s) === 'fold' ? 0.90 : 0.75),
    wrongBias: { fold: 0.7, call: 0.3, raise: 0 },
  },
  {
    key: 'overaggressor', label: 'Overaggressor (raises when caution is right)',
    accFor: (s) => (clsOfCorrect(s) === 'fold' ? 0.35 : clsOfCorrect(s) === 'call' ? 0.55 : 0.90),
    wrongBias: { fold: 0, call: 0.25, raise: 0.75 },
  },
  {
    key: 'gambler', label: 'Gambler (calls without the price)',
    accFor: (s) => (clsOfCorrect(s) === 'fold' ? 0.35 : 0.80),
    wrongBias: { fold: 0.05, call: 0.85, raise: 0.10 },
  },
  {
    key: 'positional', label: 'Positional Blind Spot (seat-blind)',
    accFor: (s) => (s.skill === 'position' || s.skill === 'preflop' ? 0.35 : 0.80),
    wrongBias: { fold: 0.34, call: 0.33, raise: 0.33 },
  },
  {
    key: 'exploitable-reg', label: 'Exploitable Regular (villain-blind)',
    accFor: (s) => (s.skill === 'opponent' || s.skill === 'reads' ? 0.35 : 0.80),
    wrongBias: { fold: 0.34, call: 0.33, raise: 0.33 },
  },
  {
    key: 'confident-misser', label: 'Confident misser (villain-blind, fast + sure)',
    accFor: (s) => (s.skill === 'opponent' || s.skill === 'reads' ? 0.35 : 0.80),
    wrongBias: { fold: 0.34, call: 0.33, raise: 0.33 },
    fastWrong: true,
  },
  {
    key: 'improver', label: 'Improver (45% → 85% over 40 sessions)',
    accFor: (_s, i) => 0.45 + (0.40 * Math.min(i, SESSIONS - 1)) / (SESSIONS - 1),
    wrongBias: { fold: 0.34, call: 0.33, raise: 0.33 },
  },
  {
    key: 'steady-strong', label: 'Steady strong player (85% flat)',
    accFor: () => 0.85,
    wrongBias: { fold: 0.34, call: 0.33, raise: 0.33 },
  },
];

function choose(persona, scenario, sessionIdx, rand) {
  const correctOpt = scenario.options.find((o) => o.val === scenario.correct);
  if (rand() < persona.accFor(scenario, sessionIdx)) return correctOpt;
  const wrong = scenario.options.filter((o) => o.val !== scenario.correct);
  const weights = wrong.map((o) => persona.wrongBias[o.cls] ?? 0.2);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return wrong[Math.floor(rand() * wrong.length)];
  let r = rand() * total;
  for (let i = 0; i < wrong.length; i++) { r -= weights[i]; if (r <= 0) return wrong[i]; }
  return wrong[wrong.length - 1];
}

// ── Simulation ──────────────────────────────────────────────────────────────
let invariantFailures = 0;
const violation = (persona, session, msg) => {
  console.error(`✗ INVARIANT [${persona}] session ${session}: ${msg}`);
  invariantFailures++;
};

function runPersona(persona, difficulty) {
  const rand = rng(0xC0FFEE ^ persona.key.length * 7919);
  const pool = SCENARIOS.filter((s) => s.difficulty === difficulty);
  DAY_OFFSET = 0;
  let user = { ...createUser(persona.label), scenarioHistory: {} };

  const perSession = [];
  const softYields = { preflop: 0, skill: 0 };
  let exhaustedAt = null;
  let pairFires = 0;
  const missedToday = new Map(); // dateStr -> Set of ids missed that day

  for (let si = 0; si < SESSIONS; si++) {
    // Timeline: one session per day, but every 5th session chains onto the
    // previous day (exercises the R2 same-day floor under realistic chaining).
    if (si > 0 && si % 5 !== 4) DAY_OFFSET++;
    const today = toLocalDateString(new Date());

    // Pre-session pool-scoped remediation depth — the surge trigger. A 2-replay
    // session is only legal when this exceeded SURGE_QUEUE_THRESHOLD.
    const remediatingInPool = pool.filter((s) => {
      const h = user.scenarioHistory?.[s.id];
      return h && (h.remediating ?? h.lastResult === 'incorrect');
    }).length;

    const dealt = buildSession(pool, {
      history: user.scenarioHistory ?? {},
      skills: user.skills,
      sessionsCompleted: user.sessionsCompleted,
      length: LENGTH,
      currentDate: today,
    });

    // — hard invariants on the dealt session —
    if (dealt.length !== LENGTH) violation(persona.key, si, `dealt ${dealt.length} hands`);
    const ids = dealt.map((s) => s.id);
    if (new Set(ids).size !== ids.length) violation(persona.key, si, `duplicate ids: ${ids}`);
    const replays = dealt.filter((s) => s.replay);
    // Up to 2 replays allowed, but only via the surge — and the surge is only
    // legal when the pre-session pool-scoped queue exceeded the threshold.
    if (replays.length > 2) violation(persona.key, si, `${replays.length} replay hands`);
    if (replays.length === 2 && remediatingInPool <= SURGE_QUEUE_THRESHOLD)
      violation(persona.key, si, `surged to 2 replays with queue ${remediatingInPool} <= ${SURGE_QUEUE_THRESHOLD}`);
    for (const r of replays) {
      const h = user.scenarioHistory[r.id];
      if (!h || !(h.remediating ?? h.lastResult === 'incorrect'))
        violation(persona.key, si, `replay ${r.id} not remediating`);
      if (missedToday.get(today)?.has(r.id))
        violation(persona.key, si, `same-day resurface of ${r.id}`);
    }
    // Soft caps (deliberate engine yields — phase 2b drops both caps rather
    // than under-fill; the seen-re-deal phase only respects the preflop cap):
    // counted and reported, never a failure.
    const preflop = dealt.filter((s) => !s.board || s.board.length === 0).length;
    if (preflop > 2) softYields.preflop++;
    const perSkill = {};
    for (const s of dealt) perSkill[s.skill] = (perSkill[s.skill] ?? 0) + 1;
    if (Object.values(perSkill).some((n) => n > 2)) softYields.skill++;

    // — contrast-pair detection (adjacent same-group ids) —
    let pairedThisSession = false;
    for (let i = 0; i + 1 < dealt.length; i++) {
      const a = dealt[i].id, b = dealt[i + 1].id;
      if (isContrastPair(a, b)) { pairedThisSession = true; break; }
    }
    if (pairedThisSession) pairFires++;

    const unseenBefore = pool.filter((s) => !user.scenarioHistory[s.id]).length;
    if (exhaustedAt === null && unseenBefore === 0) exhaustedAt = si;

    // — persona plays the hands —
    const hands = dealt.map((s) => {
      const opt = choose(persona, s, si, rand);
      const grade = s.grading[opt.val]?.g ?? 'incorrect';
      const wrong = grade !== 'correct';
      if (wrong) {
        if (!missedToday.has(today)) missedToday.set(today, new Set());
        missedToday.get(today).add(s.id);
      }
      const decisionMs = persona.fastWrong && wrong
        ? 5000 + Math.floor(rand() * 5000)
        : 18000 + Math.floor(rand() * 20000);
      return { scenarioId: s.id, skill: s.skill, result: grade, choiceVal: opt.val, decisionMs };
    });

    user = applySessionResults(user, hands, null);

    const remediating = Object.values(user.scenarioHistory)
      .filter((h) => h.remediating ?? h.lastResult === 'incorrect').length;
    perSession.push({
      si, day: DAY_OFFSET,
      correct: hands.filter((h) => h.result === 'correct').length,
      iq: user.pokerScore,
      schema: user.schema?.name ?? '(none)',
      replays: replays.length,
      paired: pairedThisSession,
      unseenBefore,
      remediating,
    });
  }
  return { perSession, exhaustedAt, pairFires, softYields, user };
}

// contrast-pair membership (mirrors the exported map without re-importing App code)
const { CONTRAST_PAIRS } = await import('../src/data/scenarios.js');
const PAIR_SET = new Set(CONTRAST_PAIRS.map(([a, b]) => `${a}|${b}`));
const isContrastPair = (a, b) => PAIR_SET.has(`${a}|${b}`) || PAIR_SET.has(`${b}|${a}`);

// ── Run + report ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DIFF = args.includes('--intermediate') ? 'intermediate' : 'beginner';
console.log(`\nPersona playtest — ${SESSIONS} sessions each, '${DIFF}' pool (${SCENARIOS.filter((s) => s.difficulty === DIFF).length} scenarios)\n`);

const TRIALS = (() => {
  const t = args.find((a) => a.startsWith('--trials='));
  return t ? Math.max(1, Number(t.split('=')[1]) || 1) : 1;
})();
if (TRIALS > 1) console.log(`(${TRIALS} trials per persona — dealer shuffles are unseeded, so schema/queue outcomes are distributions)\n`);

const results = [];
for (const p of PERSONAS) {
  if (TRIALS > 1) {
    const runs = Array.from({ length: TRIALS }, () => runPersona(p, DIFF));
    const finals = {};
    for (const r of runs) {
      const f = r.perSession[SESSIONS - 1].schema;
      finals[f] = (finals[f] ?? 0) + 1;
    }
    const med = (arr) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)];
    const endQ = runs.map((r) => r.perSession[SESSIONS - 1].remediating);
    const pairs = runs.map((r) => r.pairFires);
    const exh = runs.map((r) => (r.exhaustedAt === null ? SESSIONS + 1 : r.exhaustedAt + 1));
    const accs = runs.map((r) => r.perSession.reduce((a, x) => a + x.correct, 0) / (SESSIONS * LENGTH));
    const iqEnd = runs.map((r) => r.perSession[SESSIONS - 1].iq);
    console.log(`■ ${p.label}`);
    console.log(`  acc ${(100 * accs.reduce((a, b) => a + b, 0) / TRIALS).toFixed(0)}% · final schema over ${TRIALS} trials: ${Object.entries(finals).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ×${v}`).join(' · ')}`);
    console.log(`  end IQ median ${med(iqEnd)} · remediating queue end median ${med(endQ)} (min ${Math.min(...endQ)} max ${Math.max(...endQ)}) · pairs/40 median ${med(pairs)} (max ${Math.max(...pairs)}) · exhaustion median s${med(exh)}`);
    results.push({ persona: p, runs });
    continue;
  }
  const r = runPersona(p, DIFF);
  results.push({ persona: p, ...r });

  const s = r.perSession;
  const schemaAt = (i) => s[i]?.schema ?? '—';
  const firstStable = (() => {
    // first session from which the final schema never changes again
    const final = s[s.length - 1].schema;
    for (let i = 0; i < s.length; i++) if (s.slice(i).every((x) => x.schema === final)) return { i, final };
    return { i: -1, final };
  })();
  const totalReplays = s.reduce((a, x) => a + x.replays, 0);
  const acc = s.reduce((a, x) => a + x.correct, 0) / (SESSIONS * LENGTH);

  console.log(`■ ${p.label}`);
  console.log(`  realized accuracy ${(acc * 100).toFixed(0)}% · IQ ${s.find((x) => x.iq != null)?.iq ?? '—'}→${s[s.length - 1].iq} · schema s5='${schemaAt(4)}' s15='${schemaAt(14)}' s40='${schemaAt(39)}' (stable '${firstStable.final}' from s${firstStable.i + 1})`);
  const q = (i) => s[i]?.remediating ?? '—';
  console.log(`  unseen exhausted at s${r.exhaustedAt === null ? '>40' : r.exhaustedAt + 1} · replays ${totalReplays} (${(totalReplays / SESSIONS).toFixed(2)}/session) · remediating queue s5=${q(4)} s10=${q(9)} s20=${q(19)} s30=${q(29)} s40=${q(39)} · pairs fired ${r.pairFires}/${SESSIONS} · soft-cap yields preflop=${r.softYields.preflop} skill=${r.softYields.skill}`);
  const iqCurve = [0, 9, 19, 29, 39].map((i) => `s${i + 1}=${s[i]?.iq ?? '—'}`).join(' ');
  console.log(`  IQ curve: ${iqCurve}`);
}

// machine-readable dump for analysis
import { writeFileSync } from 'node:fs';
writeFileSync('persona-playtest-raw.json', JSON.stringify(
  results.map((r) => r.runs
    ? { key: r.persona.key, trials: r.runs.map((x) => ({ exhaustedAt: x.exhaustedAt, pairFires: x.pairFires, perSession: x.perSession })) }
    : { key: r.persona.key, exhaustedAt: r.exhaustedAt, pairFires: r.pairFires, perSession: r.perSession }), null, 1));
console.log('\nWrote persona-playtest-raw.json');

if (invariantFailures > 0) {
  console.error(`\n${invariantFailures} INVARIANT VIOLATION(S)`);
  process.exit(1);
}
console.log('All mechanical invariants held.');
