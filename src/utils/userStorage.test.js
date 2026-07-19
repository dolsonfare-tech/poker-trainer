// Streak-mechanics unit tests (M1–M3, RESEARCH_LEARNING_SCIENCE.md Piece 3):
// the Rebuy earn/consume/cap ladder, the streak-break reset, and milestone
// proximity. calcStreak reads new Date() at call time, so fixtures set
// lastSessionDate relative to today rather than mocking the clock.
import { calcStreak, createUser, toLocalDateString, milestoneProximity, REBUY_CAP, parseCoachRead } from './userStorage';

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
