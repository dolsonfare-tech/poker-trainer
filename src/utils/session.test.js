// Session application: what a finished session does to the user record,
// including the Coach's Notebook history.
//
// MOD-001 (Wave 3): split out of userStorage.test.js alongside the source.
import { applySessionResults, createUser } from './session';
import { COACH_READS_CAP } from './coachRead';
import { toLocalDateString } from './dates';

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
