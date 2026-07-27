// Streak mechanics: run length, Rebuy grant/consume, milestone proximity, and
// whether a stored streak is still alive.
//
// MOD-001 (Wave 3): split out of userStorage.test.js alongside the source, so
// each module carries its own coverage rather than inheriting a shared file.
import { calcStreak, milestoneProximity, streakAlive, REBUY_CAP } from './streak';
import { toLocalDateString } from './dates';
import { createUser } from './session';


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

// ── streakAlive (CA-039) ────────────────────────────────────────────────────
// True iff playing today would CONTINUE the stored streak.
describe('streakAlive', () => {
  const now = new Date('2026-07-26T20:00:00');
  it('true when last session was today', () =>
    expect(streakAlive({ streak: 3, lastSessionDate: '2026-07-26', rebuys: 0 }, now)).toBe(true));
  it('true when last session was yesterday', () =>
    expect(streakAlive({ streak: 3, lastSessionDate: '2026-07-25', rebuys: 0 }, now)).toBe(true));
  it('true when gap is covered by rebuys (2-day gap, 1 rebuy)', () =>
    expect(streakAlive({ streak: 7, lastSessionDate: '2026-07-24', rebuys: 1 }, now)).toBe(true));
  it('false when gap exceeds rebuys (2-day gap, 0 rebuys)', () =>
    expect(streakAlive({ streak: 7, lastSessionDate: '2026-07-24', rebuys: 0 }, now)).toBe(false));
  it('false for a 205-day-stale streak', () =>
    expect(streakAlive({ streak: 3, lastSessionDate: '2026-01-01', rebuys: 2 }, now)).toBe(false));
  it('false when streak is 0 or lastSessionDate missing', () => {
    expect(streakAlive({ streak: 0, lastSessionDate: '2026-07-25' }, now)).toBe(false);
    expect(streakAlive({ streak: 3 }, now)).toBe(false);
  });
});
