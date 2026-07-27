// Recency-weighted Poker IQ (PERSONA_PLAYTEST_FINDINGS.md F3).
//
// MOD-001 (Wave 3): split out of userStorage.test.js alongside the source.
import { derivePokerScore, RECENT_HANDS_CAP, RECENT_WINDOW } from './iq';
// applySessionResults lives in session.js but is exercised here: the recency
// window is only observable through a real session being applied, which is the
// whole point of F3 (a score that tracks current form, not lifetime accuracy).
import { applySessionResults, createUser } from './session';

// ── Recency-weighted Poker IQ (docs/findings/PERSONA_PLAYTEST_FINDINGS.md F3) ──────────────
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
