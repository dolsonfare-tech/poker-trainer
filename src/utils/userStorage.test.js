// Streak-mechanics unit tests (M1–M3, RESEARCH_LEARNING_SCIENCE.md Piece 3):
// the Rebuy earn/consume/cap ladder, the streak-break reset, and milestone
// proximity. calcStreak reads new Date() at call time, so fixtures set
// lastSessionDate relative to today rather than mocking the clock.
import { calcStreak, createUser, toLocalDateString, milestoneProximity, REBUY_CAP, parseCoachRead, derivePokerScore, applySessionResults, RECENT_HANDS_CAP, RECENT_WINDOW } from './userStorage';

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
