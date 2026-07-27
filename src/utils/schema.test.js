// Schema v2: direction-of-error classification, the Balanced fallback, tally
// weighting, and the hybrid direction/skill diagnosis.
//
// MOD-001 (Wave 3): split out of userStorage.test.js alongside the source.
import { classifyDirection, directionOfHand, addHandsToDirectionTally,
         EMPTY_DIRECTION_TALLY, deriveSchema } from './schema';
import { createUser } from './session';

// ── Schema v2: direction-of-error classification (docs/findings/PERSONA_PLAYTEST_FINDINGS.md F2) ─
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
