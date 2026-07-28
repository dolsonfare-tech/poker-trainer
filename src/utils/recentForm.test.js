import { RECENT_SESSIONS_CAP, appendRecentSession } from './recentForm';

const session = (date, correct, total = 5) => ({
  date, correct, total,
  hands: Array.from({ length: total }, (_, i) => ({
    skill: 'potodds', result: i < correct ? 'correct' : 'incorrect',
  })),
});

test('a new session goes on the front — newest first, like coachReads', () => {
  const out = appendRecentSession([session('2026-07-01', 1)], session('2026-07-02', 4));
  expect(out).toHaveLength(2);
  expect(out[0].date).toBe('2026-07-02');
  expect(out[1].date).toBe('2026-07-01');
});

test('the list is capped and drops the OLDEST, never the newest', () => {
  // Fixture is newest-first (index 0 = most recent), matching the invariant
  // appendRecentSession assumes for its input — same ordering as coachReads.
  const existing = Array.from({ length: RECENT_SESSIONS_CAP }, (_, i) =>
    session(`2026-06-${String(RECENT_SESSIONS_CAP - i).padStart(2, '0')}`, 3));
  const out = appendRecentSession(existing, session('2026-07-02', 5));
  expect(out).toHaveLength(RECENT_SESSIONS_CAP);
  expect(out[0].date).toBe('2026-07-02');
  expect(out.map(s => s.date)).not.toContain('2026-06-01');
});

test('a missing or malformed prior list is treated as empty, not a crash', () => {
  expect(appendRecentSession(undefined, session('2026-07-02', 2))).toHaveLength(1);
  expect(appendRecentSession(null, session('2026-07-02', 2))).toHaveLength(1);
});
