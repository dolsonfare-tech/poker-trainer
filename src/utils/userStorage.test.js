// Streak-mechanics unit tests (M1–M3, RESEARCH_LEARNING_SCIENCE.md Piece 3):
// the Rebuy earn/consume/cap ladder, the streak-break reset, and milestone
// proximity. calcStreak reads new Date() at call time, so fixtures set
// lastSessionDate relative to today rather than mocking the clock.
import { calcStreak, createUser, toLocalDateString, milestoneProximity, REBUY_CAP, parseCoachRead, derivePokerScore, applySessionResults, RECENT_HANDS_CAP, RECENT_WINDOW, COACH_READS_CAP, classifyDirection, directionOfHand, addHandsToDirectionTally, EMPTY_DIRECTION_TALLY, deriveSchema } from './userStorage';

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalDateString(d);
};

const user = (over) => ({ ...createUser('Streaker'), streak: 0, rebuys: 0, ...over });

test('new user starts with zero Rebuys', () => {
  expect(createUser('X').rebuys).toBe(0);
});

test('a consecutive day advances the streak without touching Rebuys', () => {
  const r = calcStreak(user({ streak: 3, lastSessionDate: daysAgo(1) }));
  expect(r.streak).toBe(4);
  expect(r.rebuys).toBe(0);
  expect(r.rebuyUsed).toBe(false);
});

test('a second session the same day changes nothing', () => {
  const r = calcStreak(user({ streak: 4, rebuys: 1, lastSessionDate: daysAgo(0) }));
  expect(r).toEqual({ streak: 4, lastSessionDate: daysAgo(0), rebuys: 1, rebuyUsed: false });
});

test('the first-ever session opens a streak of 1', () => {
  const r = calcStreak(user({ streak: 0, lastSessionDate: null }));
  expect(r.streak).toBe(1);
  expect(r.rebuys).toBe(0);
});

test('hitting a 7-day milestone earns a Rebuy', () => {
  const r = calcStreak(user({ streak: 6, rebuys: 0, lastSessionDate: daysAgo(1) }));
  expect(r.streak).toBe(7);
  expect(r.rebuys).toBe(1);
});

test('Rebuys are capped at REBUY_CAP', () => {
  const r = calcStreak(user({ streak: 6, rebuys: REBUY_CAP, lastSessionDate: daysAgo(1) }));
  expect(r.streak).toBe(7);        // milestone hit…
  expect(r.rebuys).toBe(REBUY_CAP); // …but the balance can't exceed the cap
});

test('a single missed day silently consumes one Rebuy and the streak survives', () => {
  const r = calcStreak(user({ streak: 10, rebuys: 1, lastSessionDate: daysAgo(2) }));
  expect(r.streak).toBe(11);
  expect(r.rebuys).toBe(0);
  expect(r.rebuyUsed).toBe(true);
});

test('two missed days consume two Rebuys when the balance covers them', () => {
  const r = calcStreak(user({ streak: 10, rebuys: 2, lastSessionDate: daysAgo(3) }));
  expect(r.streak).toBe(11);
  expect(r.rebuys).toBe(0);
  expect(r.rebuyUsed).toBe(true);
});

test('a gap wider than the Rebuy balance breaks the streak and clears Rebuys', () => {
  const r = calcStreak(user({ streak: 10, rebuys: 1, lastSessionDate: daysAgo(3) }));
  expect(r.streak).toBe(1);        // fresh run
  expect(r.rebuys).toBe(0);
  expect(r.rebuyUsed).toBe(false);
});

test('a missed day with no Rebuys resets to a fresh streak', () => {
  const r = calcStreak(user({ streak: 8, rebuys: 0, lastSessionDate: daysAgo(2) }));
  expect(r.streak).toBe(1);
  expect(r.rebuys).toBe(0);
  expect(r.rebuyUsed).toBe(false);
});

test('a Rebuy can be consumed and a new one earned in the same recompute', () => {
  // Day-6 streak, one Rebuy, missed a day → consume covers the gap (streak 7),
  // and landing on the milestone re-earns one.
  const r = calcStreak(user({ streak: 6, rebuys: 1, lastSessionDate: daysAgo(2) }));
  expect(r.streak).toBe(7);
  expect(r.rebuyUsed).toBe(true);
  expect(r.rebuys).toBe(1);
});

// ── Milestone proximity (M3) ────────────────────────────────────────────────
test('milestone proximity fires only within reach of the next milestone', () => {
  expect(milestoneProximity(5)).toEqual({ remaining: 2, name: 'a full week' });
  expect(milestoneProximity(4)).toEqual({ remaining: 3, name: 'a full week' });
  expect(milestoneProximity(3)).toBeNull();   // 4 away — outside the window
  expect(milestoneProximity(7)).toBeNull();   // the milestone itself, not approaching
  expect(milestoneProximity(28)).toEqual({ remaining: 2, name: 'a full month' });
  expect(milestoneProximity(98)).toEqual({ remaining: 2, name: 'a hundred days' });
  expect(milestoneProximity(0)).toBeNull();
});

// ── parseCoachRead (structured JSON with legacy-prose fallback) ──────────────
test('parseCoachRead reads a valid structured JSON read', () => {
  const raw = JSON.stringify({
    headline: 'You fold too much to river pressure',
    evidence: ['Folded top pair to the nit on K94r', 'Passed on a value raise vs the station'],
    watchFor: 'When a passive player checks the river, bet for value',
  });
  const out = parseCoachRead(raw);
  expect(out.legacy).toBeUndefined();
  expect(out.structured.headline).toMatch(/fold too much/);
  expect(out.structured.evidence).toHaveLength(2);
  expect(out.structured.watchFor).toMatch(/passive player/);
});

test('parseCoachRead treats prose as a legacy read', () => {
  const prose = 'You are folding too often against aggressive regulars. Tighten up.';
  expect(parseCoachRead(prose)).toEqual({ legacy: prose });
});

test('parseCoachRead falls back to legacy when JSON is not a read shape', () => {
  // Valid JSON, but not the coach-read object (no string headline)
  expect(parseCoachRead('[1,2,3]')).toEqual({ legacy: '[1,2,3]' });
  expect(parseCoachRead('{"foo":"bar"}')).toEqual({ legacy: '{"foo":"bar"}' });
  expect(parseCoachRead('42')).toEqual({ legacy: '42' });
});

test('parseCoachRead tolerates a structured read missing optional fields', () => {
  const out = parseCoachRead(JSON.stringify({ headline: 'Clean session, keep watching pot odds' }));
  expect(out.structured.headline).toMatch(/Clean session/);
  expect(out.structured.evidence).toEqual([]);
  expect(out.structured.watchFor).toBe('');
});

test('parseCoachRead returns null for empty or missing input', () => {
  expect(parseCoachRead(null)).toBeNull();
  expect(parseCoachRead('')).toBeNull();
  expect(parseCoachRead('   ')).toBeNull();
  expect(parseCoachRead(undefined)).toBeNull();
});

// ── Recency-weighted Poker IQ (PERSONA_PLAYTEST_FINDINGS.md F3) ──────────────
const stream = (skill, results) => results.map(result => ({ skill, result }));

test('derivePokerScore: a red-lifetime skill reads high when recent form is high', () => {
  // preflop 4/20 lifetime = 20%, but the recent window is all wins → 100, not 20.
  const skills = { preflop: { rating: 'red', attempts: 20, correct: 4 } };
  const recent = stream('preflop', Array(RECENT_WINDOW + 4).fill('correct'));
  expect(derivePokerScore(skills, recent)).toBe(100);
});

test('derivePokerScore: fewer than 8 recent entries falls back to lifetime accuracy', () => {
  const skills = { preflop: { rating: 'red', attempts: 20, correct: 4 } }; // 20% lifetime
  const recent = stream('preflop', ['correct','correct','correct','correct','correct']); // 5 < 8
  expect(derivePokerScore(skills, recent)).toBe(20);
});

test('derivePokerScore: no stream is identical to the lifetime formula', () => {
  const skills = {
    preflop: { rating: 'green', attempts: 10, correct: 8 }, // 80
    potodds: { rating: 'yellow', attempts: 14, correct: 10 }, // ~71.4
    reads:   { rating: 'gray', attempts: 2, correct: 1 }, // ungated
  };
  const lifetime = Math.round((80 + (10 / 14) * 100) / 2); // 76
  expect(derivePokerScore(skills)).toBe(lifetime);
  expect(derivePokerScore(skills, [])).toBe(lifetime);
  expect(derivePokerScore(skills, undefined)).toBe(lifetime);
});

test('derivePokerScore: window is per skill and capped at the last RECENT_WINDOW', () => {
  const skills = {
    preflop: { rating: 'green', attempts: 30, correct: 30 }, // 100 lifetime
    potodds: { rating: 'red', attempts: 30, correct: 3 },    // 10 lifetime
  };
  // preflop recent: all correct → windowed 100. potodds recent: all incorrect →
  // windowed 0. Each skill windows independently. IQ = (100 + 0)/2 = 50.
  const recent = [
    ...stream('preflop', Array(RECENT_WINDOW + 5).fill('correct')),
    ...stream('potodds', Array(RECENT_WINDOW + 5).fill('incorrect')),
  ];
  expect(derivePokerScore(skills, recent)).toBe(50);
});

test('derivePokerScore: gate unchanged — null when nothing is rated', () => {
  const skills = { preflop: { rating: 'gray', attempts: 3, correct: 2 } };
  expect(derivePokerScore(skills, stream('preflop', ['correct','correct','correct']))).toBeNull();
});

test('applySessionResults appends the session hands to the recent buffer', () => {
  const u = { ...createUser('Buf'), recentHands: [] };
  const hands = [
    { scenarioId: 1, skill: 'preflop', result: 'correct' },
    { scenarioId: 2, skill: 'potodds', result: 'incorrect' },
  ];
  const out = applySessionResults(u, hands, null);
  expect(out.recentHands).toEqual([
    { skill: 'preflop', result: 'correct' },
    { skill: 'potodds', result: 'incorrect' },
  ]);
});

test('applySessionResults trims the recent buffer to the cap (newest kept)', () => {
  const full = Array.from({ length: RECENT_HANDS_CAP }, () => ({ skill: 'preflop', result: 'incorrect' }));
  const u = { ...createUser('Buf'), recentHands: full };
  const hands = [{ scenarioId: 1, skill: 'reads', result: 'correct' }];
  const out = applySessionResults(u, hands, null);
  expect(out.recentHands).toHaveLength(RECENT_HANDS_CAP);
  // The oldest entry rolled off; the new hand is last.
  expect(out.recentHands[RECENT_HANDS_CAP - 1]).toEqual({ skill: 'reads', result: 'correct' });
});

test('applySessionResults: legacy user with no recentHands field seeds the buffer', () => {
  const { recentHands, ...legacy } = createUser('Legacy'); // strip the field
  void recentHands;
  const out = applySessionResults(legacy, [{ scenarioId: 1, skill: 'preflop', result: 'correct' }], null);
  expect(out.recentHands).toEqual([{ skill: 'preflop', result: 'correct' }]);
});

// ── Schema v2: direction-of-error classification (PERSONA_PLAYTEST_FINDINGS F2) ─
// The fold(0) < call(1) < raise(2) ordinal axis. `loose` (call-when-fold) is
// carved out of the too-loose delta BEFORE `over`, so a call-when-fold is
// Gambler evidence, never Overaggressor evidence.
test('classifyDirection maps every mistake cell', () => {
  // too passive → under (Conflict Avoider)
  expect(classifyDirection('fold', 'call')).toBe('under');   // fold-when-call
  expect(classifyDirection('fold', 'raise')).toBe('under');  // fold-when-raise
  expect(classifyDirection('call', 'raise')).toBe('under');  // call-when-raise
  // call-when-fold → loose (Gambler), NOT over
  expect(classifyDirection('call', 'fold')).toBe('loose');
  // raise over the mark → over (Overaggressor)
  expect(classifyDirection('raise', 'call')).toBe('over');   // raise-when-call
  expect(classifyDirection('raise', 'fold')).toBe('over');   // raise-when-fold
});

test('classifyDirection returns null for same-cls or unknown cls', () => {
  expect(classifyDirection('call', 'call')).toBeNull();   // wrong size, same direction
  expect(classifyDirection('raise', 'raise')).toBeNull();
  expect(classifyDirection('shove', 'call')).toBeNull();  // unknown cls
  expect(classifyDirection('fold', undefined)).toBeNull();
});

// directionOfHand resolves cls from the REAL scenario pool. Scenario id 1 is
// NUMERIC (legacy): correct 'call' (cls call); 'fold' is cls fold, 'raise' cls
// raise — a clean under/over probe that also proves the numeric-id lookup.
test('directionOfHand resolves cls from a numeric scenario id', () => {
  expect(directionOfHand({ scenarioId: 1, choiceVal: 'fold', result: 'incorrect' })).toBe('under');
  expect(directionOfHand({ scenarioId: 1, choiceVal: 'raise', result: 'partial' })).toBe('over');
});

test('directionOfHand returns null for correct answers, timeouts, and unknown ids', () => {
  expect(directionOfHand({ scenarioId: 1, choiceVal: 'call', result: 'correct' })).toBeNull(); // correct
  expect(directionOfHand({ scenarioId: 1, choiceVal: null, result: 'incorrect' })).toBeNull(); // timeout/freeze
  expect(directionOfHand({ scenarioId: 'sc_does_not_exist', choiceVal: 'fold', result: 'incorrect' })).toBeNull();
  expect(directionOfHand(null)).toBeNull();
});

// ── Level-aware Balanced fallback (founder, July 19, 2026) ──────────────────
const uniformSkills = (rating, correct, attempts = 10) => Object.fromEntries(
  ['preflop','position','aggression','betsize','bluffing','potodds','reads','opponent']
    .map(k => [k, { rating, attempts, correct }])
);

test('no-dominant-leak + mostly-yellow ledger reads as The Student of the Game', () => {
  const schema = deriveSchema(uniformSkills('yellow', 6), 10);
  expect(schema.name).toBe('The Student of the Game');
});

test('no-dominant-leak + majority-green ledger stays The Balanced Player', () => {
  const skills = { ...uniformSkills('green', 8), potodds: { rating: 'yellow', attempts: 10, correct: 6 } };
  const schema = deriveSchema(skills, 10);
  expect(schema.name).toBe('The Balanced Player');
});

test('an exact half-green ledger reads as Student (majority means MORE than half)', () => {
  const skills = {
    ...Object.fromEntries(['preflop','position','aggression','betsize'].map(k => [k, { rating: 'green', attempts: 10, correct: 8 }])),
    ...Object.fromEntries(['bluffing','potodds','reads','opponent'].map(k => [k, { rating: 'yellow', attempts: 10, correct: 6 }])),
  };
  expect(deriveSchema(skills, 10).name).toBe('The Student of the Game');
});

// ── addHandsToDirectionTally: weighting + skips ──────────────────────────────
test('addHandsToDirectionTally weights incorrect 1.0 and partial 0.5', () => {
  const hands = [
    { scenarioId: 1, choiceVal: 'fold',  result: 'incorrect' }, // under +1.0
    { scenarioId: 1, choiceVal: 'raise', result: 'partial' },   // over  +0.5
    { scenarioId: 1, choiceVal: 'call',  result: 'correct' },   // skipped
    { scenarioId: 1, choiceVal: null,    result: 'incorrect' }, // timeout — skipped
  ];
  const t = addHandsToDirectionTally(EMPTY_DIRECTION_TALLY, hands);
  expect(t).toEqual({ under: 1.0, over: 0.5, loose: 0, evidence: 1.5, hands: 4 });
});

test('addHandsToDirectionTally accumulates onto a prior tally and tolerates a missing one', () => {
  const prior = { under: 2, over: 1, loose: 0.5, evidence: 3.5 };
  const t = addHandsToDirectionTally(prior, [{ scenarioId: 1, choiceVal: 'fold', result: 'incorrect' }]);
  expect(t).toEqual({ under: 3, over: 1, loose: 0.5, evidence: 4.5, hands: 1 });
  // undefined prior tally starts from zero (legacy users / no-tally callers)
  expect(addHandsToDirectionTally(undefined, [])).toEqual({ under: 0, over: 0, loose: 0, evidence: 0, hands: 0 });
});

// ── deriveSchema hybrid (direction schemas + skill schemas) ──────────────────
const GREEN = { rating: 'green', attempts: 10, correct: 9 };
const allGreen = () => Object.fromEntries(
  ['preflop','position','aggression','betsize','bluffing','potodds','reads','opponent'].map(k => [k, { ...GREEN }])
);

test('deriveSchema fires a direction schema on a dominant tally', () => {
  // under-dominant (share 0.85) over the ~0.53 neutral baseline → Conflict Avoider.
  const tally = { under: 17, over: 1, loose: 2, evidence: 20 };
  expect(deriveSchema(allGreen(), 10, tally).name).toBe('The Conflict Avoider');
  // loose-dominant → The Gambler; over-dominant → The Overaggressor.
  expect(deriveSchema(allGreen(), 10, { under: 3, over: 2, loose: 15, evidence: 20 }).name).toBe('The Gambler');
  expect(deriveSchema(allGreen(), 10, { under: 1, over: 17, loose: 2, evidence: 20 }).name).toBe('The Overaggressor');
});

test('deriveSchema: below the evidence floor no direction schema is named', () => {
  const tally = { under: 4, over: 0, loose: 1, evidence: 5 }; // < MIN_DIRECTION_EVIDENCE (6)
  expect(deriveSchema(allGreen(), 10, tally)).toEqual(expect.objectContaining({ name: 'The Balanced Player' }));
});

test('deriveSchema: a near-even direction split reads Balanced (no cell dominates)', () => {
  const tally = { under: 8, over: 7, loose: 5, evidence: 20 };
  expect(deriveSchema(allGreen(), 10, tally).name).toBe('The Balanced Player');
});

test('deriveSchema: a genuinely red skill leak outscores an under-skewed tally', () => {
  // position red (severity 2.0) vs a Conflict-Avoider tally (severity ~1.9) →
  // the real skill leak wins. Direction can't hijack a measured skill weakness.
  const skills = { ...allGreen(), position: { rating: 'red', attempts: 12, correct: 3 } };
  const tally = { under: 18, over: 1, loose: 1, evidence: 20 }; // under share 0.9
  expect(deriveSchema(skills, 10, tally).name).toBe('The Positional Blind Spot');
});

test('deriveSchema: a direction schema outscores a merely-yellow skill', () => {
  // position yellow (severity 1.0) loses to an under-dominant tally (~1.9).
  const skills = { ...allGreen(), position: { rating: 'yellow', attempts: 12, correct: 7 } };
  const tally = { under: 18, over: 1, loose: 1, evidence: 20 };
  expect(deriveSchema(skills, 10, tally).name).toBe('The Conflict Avoider');
});

test('deriveSchema: no tally argument → legacy behavior for skill schemas only', () => {
  const skills = { ...allGreen(), reads: { rating: 'red', attempts: 12, correct: 3 } };
  // Skill schema still fires with no direction tally...
  expect(deriveSchema(skills, 10).name).toBe('The Results Thinker');
  // ...and direction schemas simply can't qualify without a tally.
  expect(deriveSchema(allGreen(), 10).name).toBe('The Balanced Player');
});

test('deriveSchema: direction schema returns the unchanged shape with empty affected', () => {
  const out = deriveSchema(allGreen(), 10, { under: 17, over: 1, loose: 2, evidence: 20 });
  expect(out).toEqual({ name: 'The Conflict Avoider', quote: expect.any(String), index: '01', total: '06', affected: [] });
});

test('deriveSchema stays locked under 5 sessions', () => {
  expect(deriveSchema(allGreen(), 4, { under: 17, over: 1, loose: 2, evidence: 20 })).toBeNull();
});

// ── Coach's Notebook history (applySessionResults) ───────────────────────────
const oneHand = [{ scenarioId: 1, skill: 'preflop', result: 'correct' }];

test('createUser seeds an empty coachReads history', () => {
  expect(createUser('X').coachReads).toEqual([]);
});

test('applySessionResults prepends a read, newest first, storing the raw body', () => {
  const today = toLocalDateString(new Date());
  const u = { ...createUser('N'), coachReads: [{ date: '2026-07-17', body: 'older read' }] };
  const out = applySessionResults(u, oneHand, 'newest read');
  expect(out.coachReads).toEqual([
    { date: today, body: 'newest read' },
    { date: '2026-07-17', body: 'older read' },
  ]);
});

test('applySessionResults does not append when there is no coach read', () => {
  const u = { ...createUser('N'), coachReads: [{ date: '2026-07-17', body: 'older read' }] };
  const out = applySessionResults(u, oneHand, null);
  expect(out.coachReads).toEqual([{ date: '2026-07-17', body: 'older read' }]);
});

test('applySessionResults trims the notebook to COACH_READS_CAP (newest kept)', () => {
  const full = Array.from({ length: COACH_READS_CAP }, (_, i) => ({ date: '2026-01-01', body: `read ${i}` }));
  const u = { ...createUser('N'), coachReads: full };
  const out = applySessionResults(u, oneHand, 'freshest');
  expect(out.coachReads).toHaveLength(COACH_READS_CAP);
  expect(out.coachReads[0].body).toBe('freshest');
  // The oldest entry rolled off the end.
  expect(out.coachReads[COACH_READS_CAP - 1].body).toBe(`read ${COACH_READS_CAP - 2}`);
});

test('applySessionResults tolerates a legacy user with no coachReads field', () => {
  const { coachReads, ...legacy } = createUser('Legacy'); // strip the field
  void coachReads;
  expect(applySessionResults(legacy, oneHand, null).coachReads).toEqual([]);
  expect(applySessionResults(legacy, oneHand, 'first read').coachReads).toEqual([
    { date: toLocalDateString(new Date()), body: 'first read' },
  ]);
});

test('applySessionResults maintains the lifetime direction tally', () => {
  const u = createUser('Dir');
  const hands = [
    { scenarioId: 1, skill: 'preflop', result: 'incorrect', choiceVal: 'fold' },  // under
    { scenarioId: 1, skill: 'preflop', result: 'partial',   choiceVal: 'raise' }, // over 0.5
  ];
  const out = applySessionResults(u, hands, null);
  expect(out.directionTally).toEqual({ under: 1, over: 0.5, loose: 0, evidence: 1.5, hands: 2 });
  // Next session accumulates onto it (lifetime, not per-session).
  const out2 = applySessionResults(out, [{ scenarioId: 1, skill: 'preflop', result: 'incorrect', choiceVal: 'fold' }], null);
  expect(out2.directionTally).toEqual({ under: 2, over: 0.5, loose: 0, evidence: 2.5, hands: 3 });
});
