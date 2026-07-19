// db.js pure-derivation units. The Supabase client is mocked out — these test
// the recent-hands buffer rebuild (F3) that assembleUser runs on load.
import { recentHandsFromSessions } from './db';
import { RECENT_HANDS_CAP } from './userStorage';

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
