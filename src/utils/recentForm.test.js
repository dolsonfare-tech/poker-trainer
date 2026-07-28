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

import { deriveRecentForm, RECENT_FORM_WINDOW } from './recentForm';

// Build a session whose hands are all one skill, so attempt counts are exact.
const skillSession = (date, skill, correct, total) => ({
  date, correct, total,
  hands: Array.from({ length: total }, (_, i) => ({
    skill, result: i < correct ? 'correct' : 'incorrect',
  })),
});

const SKILLS = { potodds: { attempts: 40, correct: 20, rating: 'yellow' } }; // lifetime 50%

test('the trailing window totals this window and the one before it', () => {
  const sessions = [
    ...Array.from({ length: 6 }, (_, i) => skillSession(`2026-07-1${i}`, 'potodds', 4, 5)),
    ...Array.from({ length: 6 }, (_, i) => skillSession(`2026-07-0${i}`, 'potodds', 2, 5)),
  ];
  const out = deriveRecentForm({ recentSessions: sessions, skills: SKILLS, scenarioHistory: {} });
  expect(out.windowSize).toBe(RECENT_FORM_WINDOW);
  expect(out).toMatchObject({ correct: 24, total: 30 });
  expect(out.prev).toEqual({ correct: 12, total: 30 });
});

test('with no previous window there is no comparison, not a fake zero', () => {
  const sessions = Array.from({ length: 3 }, (_, i) => skillSession(`2026-07-0${i}`, 'potodds', 3, 5));
  const out = deriveRecentForm({ recentSessions: sessions, skills: SKILLS, scenarioHistory: {} });
  expect(out.windowSize).toBe(3);
  expect(out.prev).toBeNull();
});

// ── The gate, both directions ──────────────────────────────────────────────
// Six sessions is ~30 hands across 8 skills — under 4 attempts each, against a
// product-wide MIN_RATED_ATTEMPTS of 5 that the skill ledger already enforces.
// Naming a skill below that bar would break the evidence discipline the rest of
// the product holds, so the strip stays SILENT rather than hedging.
test('a skill is named when it clears MIN_RATED_ATTEMPTS inside the window', () => {
  const sessions = [skillSession('2026-07-10', 'potodds', 5, 5), skillSession('2026-07-09', 'potodds', 5, 5)];
  const out = deriveRecentForm({ recentSessions: sessions, skills: SKILLS, scenarioHistory: {} });
  expect(out.moved).toEqual({ skill: 'potodds', dir: 'up' });  // 100% window vs 50% lifetime
});

test('a skill BELOW the bar is not named — the line is absent, not hedged', () => {
  const sessions = [skillSession('2026-07-10', 'potodds', 4, 4)]; // 4 attempts < 5
  const out = deriveRecentForm({ recentSessions: sessions, skills: SKILLS, scenarioHistory: {} });
  expect(out.moved).toBeNull();
});

test('movement is reported in both directions, not just slips', () => {
  const sessions = [skillSession('2026-07-10', 'potodds', 0, 5), skillSession('2026-07-09', 'potodds', 0, 5)];
  const out = deriveRecentForm({ recentSessions: sessions, skills: SKILLS, scenarioHistory: {} });
  expect(out.moved).toEqual({ skill: 'potodds', dir: 'down' });
});

test('the biggest mover wins, tie-broken by attempts then alphabetically', () => {
  const mixed = {
    date: '2026-07-10', correct: 5, total: 10,
    hands: [
      ...Array.from({ length: 5 }, () => ({ skill: 'potodds', result: 'correct' })),
      ...Array.from({ length: 5 }, () => ({ skill: 'bluffing', result: 'correct' })),
    ],
  };
  const skills = {
    potodds:  { attempts: 40, correct: 36, rating: 'green' },  // lifetime 90% → moves +10
    bluffing: { attempts: 40, correct: 8,  rating: 'red' },    // lifetime 20% → moves +80
  };
  const out = deriveRecentForm({ recentSessions: [mixed], skills, scenarioHistory: {} });
  expect(out.moved.skill).toBe('bluffing');
});

test('queue depth is reported straight from the ladder', () => {
  const out = deriveRecentForm({
    recentSessions: [skillSession('2026-07-10', 'potodds', 3, 5)],
    skills: SKILLS,
    scenarioHistory: { sc_001: { remediating: true }, sc_002: { remediating: false } },
  });
  expect(out.queueDepth).toBe(1);
});

test('an empty history derives a zeroed, non-crashing shape', () => {
  const out = deriveRecentForm({ recentSessions: [], skills: {}, scenarioHistory: {} });
  expect(out).toMatchObject({ windowSize: 0, correct: 0, total: 0, prev: null, moved: null, queueDepth: 0 });
});
