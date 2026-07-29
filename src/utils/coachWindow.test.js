import { aggregate, COACH_WINDOW } from './coachWindow';

const LOOKUP = {
  sc_bluff: { tag: 'Bluff Frequency', skill: 'bluffing', villain: 'Calling Station' },
  sc_odds:  { tag: 'Pot Odds', skill: 'potodds', villain: 'Tight Nit' },
};
const lookup = (id) => LOOKUP[id] ?? null;

const hand = (id, result, over = {}) => ({
  scenarioId: id, skill: LOOKUP[id].skill, result, choiceVal: 'fold', decisionMs: 30000, ...over,
});
const session = (hands) => ({ hands });

test('an empty window aggregates to a zeroed, non-crashing shape', () => {
  const out = aggregate([], lookup);
  expect(out).toMatchObject({ sessions: 0, hands: 0, previous: null });
  expect(out.skills).toEqual([]);
  expect(out.confidentMisses).toEqual([]);
  expect(out.repeats).toEqual([]);
});

test('the window is the newest COACH_WINDOW sessions, the rest is the comparison', () => {
  const recent = Array.from({ length: COACH_WINDOW }, () => session([hand('sc_odds', 'correct')]));
  const older  = Array.from({ length: COACH_WINDOW }, () => session([hand('sc_odds', 'incorrect')]));
  const out = aggregate([...recent, ...older], lookup);
  expect(out.sessions).toBe(COACH_WINDOW);
  expect(out.accuracy).toEqual({ correct: COACH_WINDOW, total: COACH_WINDOW });
  expect(out.previous).toEqual({ correct: 0, total: COACH_WINDOW });
});

test('per-skill tallies come out attempts-desc, and skills with no attempts are absent', () => {
  const out = aggregate([session([
    hand('sc_bluff', 'incorrect'), hand('sc_bluff', 'correct'), hand('sc_odds', 'correct'),
  ])], lookup);
  expect(out.skills).toEqual([
    { skill: 'bluffing', attempts: 2, correct: 1 },
    { skill: 'potodds', attempts: 1, correct: 1 },
  ]);
  expect(out.skills.find(s => s.skill === 'preflop')).toBeUndefined();
});

// F2: fast AND wrong is the confident miss — the leak the player does not know
// they have. Slow-wrong is an ordinary miss; fast-RIGHT is not a miss at all.
test('only fast AND wrong counts as a confident miss', () => {
  const out = aggregate([session([
    hand('sc_bluff', 'incorrect', { decisionMs: 4000 }),   // fast + wrong  -> yes
    hand('sc_odds', 'incorrect', { decisionMs: 40000 }),   // slow + wrong  -> no
    hand('sc_odds', 'correct', { decisionMs: 3000 }),      // fast + right  -> no
    hand('sc_bluff', 'incorrect', { decisionMs: null }),   // timeout       -> no
  ])], lookup);
  expect(out.confidentMisses).toEqual([
    { skill: 'bluffing', villain: 'Calling Station', scenario: 'Bluff Frequency' },
  ]);
});

test('a scenario missed more than once in the window is a repeat offender', () => {
  const out = aggregate([
    session([hand('sc_bluff', 'incorrect')]),
    session([hand('sc_bluff', 'incorrect')]),
    session([hand('sc_odds', 'incorrect')]),
  ], lookup);
  expect(out.repeats).toEqual([
    { scenario: 'Bluff Frequency', villain: 'Calling Station', misses: 2 },
  ]);
});

// The lookup is a parameter precisely so this module never imports the lazy
// scenario chunk. An unknown id must degrade, not throw.
test('an unknown scenario id degrades instead of throwing', () => {
  const out = aggregate([session([
    { scenarioId: 'sc_gone', skill: 'reads', result: 'incorrect', choiceVal: 'call', decisionMs: 2000 },
  ])], lookup);
  expect(out.hands).toBe(1);
  expect(out.skills).toEqual([{ skill: 'reads', attempts: 1, correct: 0 }]);
  expect(out.confidentMisses[0]).toMatchObject({ skill: 'reads', villain: 'Unknown' });
});

test('partial credit counts as an attempt but not as correct', () => {
  const out = aggregate([session([hand('sc_odds', 'partial')])], lookup);
  expect(out.skills).toEqual([{ skill: 'potodds', attempts: 1, correct: 0 }]);
  expect(out.accuracy).toEqual({ correct: 0, total: 1 });
});
