// db.js pure-derivation units. The Supabase client is mocked out — these test
// the recent-hands buffer rebuild (F3) that assembleUser runs on load.
import { recentHandsFromSessions, directionTallyFromSessions, coachReadsFromSessions } from './db';
import { RECENT_HANDS_CAP, COACH_READS_CAP } from './userStorage';

jest.mock('./supabase', () => ({ supabase: null, hasSupabase: false }));

test('recentHandsFromSessions flattens session rows oldest→newest into {skill,result}', () => {
  // Rows arrive created_at ascending (oldest first); the buffer keeps that order.
  const rows = [
    { hands: [
      { scenarioId: 1, skill: 'preflop', result: 'correct' },
      { scenarioId: 2, skill: 'potodds', result: 'incorrect' },
    ] },
    { hands: [
      { scenarioId: 3, skill: 'reads', result: 'partial' },
    ] },
  ];
  expect(recentHandsFromSessions(rows)).toEqual([
    { skill: 'preflop', result: 'correct' },
    { skill: 'potodds', result: 'incorrect' },
    { skill: 'reads', result: 'partial' },
  ]);
});

test('recentHandsFromSessions caps at RECENT_HANDS_CAP, keeping the newest', () => {
  // 60 rows × 5 hands = 300 hands; only the last CAP survive. Tag each hand with
  // its global index in the correct order so we can assert which ones remain.
  let idx = 0;
  const rows = Array.from({ length: 60 }, () => ({
    hands: Array.from({ length: 5 }, () => ({ skill: 'preflop', result: String(idx++) })),
  }));
  const out = recentHandsFromSessions(rows);
  expect(out).toHaveLength(RECENT_HANDS_CAP);
  expect(out[0].result).toBe(String(300 - RECENT_HANDS_CAP)); // oldest survivor
  expect(out[RECENT_HANDS_CAP - 1].result).toBe('299');       // newest
});

test('recentHandsFromSessions tolerates null / empty / missing hands', () => {
  expect(recentHandsFromSessions(null)).toEqual([]);
  expect(recentHandsFromSessions([])).toEqual([]);
  expect(recentHandsFromSessions([{ hands: null }, {}])).toEqual([]);
});

// ── directionTallyFromSessions (schema v2) ────────────────────────────────────
// Lifetime, order-independent rebuild of the direction-of-error tally from the
// append-only session log. Scenario id 1 is legacy/numeric: correct 'call', with
// 'fold' (under) and 'raise' (over) as the mis-picks.
test('directionTallyFromSessions folds every row into a lifetime tally', () => {
  const rows = [
    { hands: [
      { scenarioId: 1, skill: 'preflop', result: 'incorrect', choiceVal: 'fold' },  // under +1.0
      { scenarioId: 1, skill: 'preflop', result: 'partial',   choiceVal: 'raise' }, // over  +0.5
    ] },
    { hands: [
      { scenarioId: 1, skill: 'preflop', result: 'incorrect', choiceVal: 'raise' }, // over +1.0
      { scenarioId: 1, skill: 'preflop', result: 'correct',   choiceVal: 'call' },  // skipped
    ] },
  ];
  expect(directionTallyFromSessions(rows)).toEqual({ under: 1.0, over: 1.5, loose: 0, evidence: 2.5, hands: 4 });
});

test('directionTallyFromSessions skips hands with no choiceVal (pre-v2 rows) and tolerates empties', () => {
  const rows = [
    { hands: [{ scenarioId: 1, skill: 'preflop', result: 'incorrect' }] }, // no choiceVal → skip
    { hands: null },
    {},
  ];
  expect(directionTallyFromSessions(rows)).toEqual({ under: 0, over: 0, loose: 0, evidence: 0, hands: 1 });
  expect(directionTallyFromSessions(null)).toEqual({ under: 0, over: 0, loose: 0, evidence: 0, hands: 0 });
});

// ── coachReadsFromSessions (Coach's Notebook) ─────────────────────────────────
// Rows arrive created_at ascending (oldest first); the history is newest first,
// dated from created_at, null/empty reads skipped, capped.
test('coachReadsFromSessions derives newest-first, dating each read from created_at', () => {
  const rows = [
    { created_at: '2026-07-17T12:00:00Z', coach_read: 'older read' },
    { created_at: '2026-07-18T12:00:00Z', coach_read: 'newer read' },
  ];
  const out = coachReadsFromSessions(rows);
  expect(out.map(r => r.body)).toEqual(['newer read', 'older read']);
  // Dated via the local-date helper (compare against the same derivation).
  expect(out[0].date).toBe(new Date('2026-07-18T12:00:00Z').getFullYear() +
    '-' + String(new Date('2026-07-18T12:00:00Z').getMonth() + 1).padStart(2, '0') +
    '-' + String(new Date('2026-07-18T12:00:00Z').getDate()).padStart(2, '0'));
});

test('coachReadsFromSessions skips null / empty reads and tolerates empties', () => {
  const rows = [
    { created_at: '2026-07-16T12:00:00Z', coach_read: null },
    { created_at: '2026-07-17T12:00:00Z', coach_read: '   ' },
    { created_at: '2026-07-18T12:00:00Z', coach_read: 'kept' },
    { created_at: '2026-07-19T12:00:00Z' }, // missing field
  ];
  expect(coachReadsFromSessions(rows).map(r => r.body)).toEqual(['kept']);
  expect(coachReadsFromSessions(null)).toEqual([]);
  expect(coachReadsFromSessions([])).toEqual([]);
});

test('coachReadsFromSessions caps at COACH_READS_CAP, keeping the newest', () => {
  // 40 rows ascending; only the last CAP reads survive, newest first.
  const rows = Array.from({ length: 40 }, (_, i) => ({
    created_at: `2026-01-01T00:00:00Z`, coach_read: `read ${i}`,
  }));
  const out = coachReadsFromSessions(rows);
  expect(out).toHaveLength(COACH_READS_CAP);
  expect(out[0].body).toBe('read 39');                       // newest
  expect(out[COACH_READS_CAP - 1].body).toBe(`read ${40 - COACH_READS_CAP}`); // oldest survivor
});
