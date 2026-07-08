// Session-builder unit tests: unseen-first dealing, weak-skill weighting,
// missed-hand resurfacing with cooldown, least-recently-seen fallback, and
// the history rebuild from `sessions` rows.
import { buildSession, applyHandsToHistory, historyFromSessions, RESURFACE_COOLDOWN_SESSIONS } from './spacedrep';

// Minimal scenario stand-ins — the builder reads id, skill, and board (the
// preflop-street cap keys off `board: null`). Default to a flop board so
// street capping only applies where a test asks for it.
const mk = (id, skill, board = ['K♥', '9♦', '4♣']) => ({ id, skill, board });
const mkPre = (id, skill) => mk(id, skill, null);

const SKILLS = ['preflop', 'position', 'aggression', 'betsize', 'bluffing', 'potodds', 'reads', 'opponent'];
const poolOf = (n) => Array.from({ length: n }, (_, i) => mk(`sc_${i}`, SKILLS[i % SKILLS.length]));

const seenCorrect = (at) => ({ seen: 1, lastResult: 'correct', lastSeenAt: at });
const seenMissed = (at) => ({ seen: 1, lastResult: 'incorrect', lastSeenAt: at });

test('deals the requested length with no duplicate scenarios', () => {
  const session = buildSession(poolOf(40), { length: 5 });
  expect(session).toHaveLength(5);
  expect(new Set(session.map(s => s.id)).size).toBe(5);
});

test('serves the whole pool when it is smaller than the session length', () => {
  const session = buildSession(poolOf(3), { length: 5 });
  expect(session).toHaveLength(3);
});

test('prefers unseen scenarios over seen ones', () => {
  const pool = poolOf(10);
  // First 5 already seen (and answered correctly) — the other 5 must be dealt
  const history = Object.fromEntries(pool.slice(0, 5).map(s => [s.id, seenCorrect(1)]));
  const session = buildSession(pool, { history, sessionsCompleted: 5, length: 5 });
  expect(session.map(s => s.id).sort()).toEqual(pool.slice(5).map(s => s.id).sort());
});

test('resurfaces one cooled-down miss, tagged replay', () => {
  const pool = poolOf(20);
  const history = {
    [pool[0].id]: seenMissed(1), // missed long ago — eligible
  };
  const session = buildSession(pool, {
    history,
    sessionsCompleted: 1 + RESURFACE_COOLDOWN_SESSIONS,
    length: 5,
  });
  const replays = session.filter(s => s.replay);
  expect(replays).toHaveLength(1);
  expect(replays[0].id).toBe(pool[0].id);
});

test('caps resurfaced misses at one per session (oldest first)', () => {
  const pool = poolOf(20);
  const history = {
    [pool[0].id]: seenMissed(2),
    [pool[1].id]: seenMissed(1), // older miss — wins the slot
    [pool[2].id]: seenMissed(3),
  };
  const session = buildSession(pool, { history, sessionsCompleted: 10, length: 5 });
  const replays = session.filter(s => s.replay);
  expect(replays).toHaveLength(1);
  expect(replays[0].id).toBe(pool[1].id);
});

test('a recent miss stays in cooldown', () => {
  const pool = poolOf(20);
  const lastSeenAt = 5;
  const history = { [pool[0].id]: seenMissed(lastSeenAt) };
  const session = buildSession(pool, {
    history,
    sessionsCompleted: lastSeenAt + RESURFACE_COOLDOWN_SESSIONS - 1, // one short
    length: 5,
  });
  expect(session.some(s => s.id === pool[0].id)).toBe(false);
});

test('weights two slots toward the weakest rated skills', () => {
  // 4 potodds scenarios + 16 others, potodds rated red → exactly 2 potodds
  // dealt (weak target 2, per-skill cap 2, plenty of other unseen)
  const pool = [
    ...Array.from({ length: 4 }, (_, i) => mk(`po_${i}`, 'potodds')),
    ...Array.from({ length: 16 }, (_, i) => mk(`ot_${i}`, SKILLS[i % 4])), // preflop..betsize
  ];
  const skills = { potodds: { rating: 'red', attempts: 10, correct: 2 } };
  for (let run = 0; run < 10; run++) {
    const session = buildSession(pool, { skills, length: 5 });
    expect(session.filter(s => s.skill === 'potodds')).toHaveLength(2);
  }
});

test('falls back to least-recently-seen when everything has been played', () => {
  const pool = poolOf(10);
  const history = Object.fromEntries(pool.map((s, i) => [s.id, seenCorrect(i + 1)]));
  const session = buildSession(pool, { history, sessionsCompleted: 10, length: 5 });
  // The 5 oldest (lastSeenAt 1..5) are dealt again
  expect(session.map(s => s.id).sort()).toEqual(pool.slice(0, 5).map(s => s.id).sort());
});

test('caps preflop-street hands at 2 per 5-hand session', () => {
  const pool = [
    ...Array.from({ length: 20 }, (_, i) => mkPre(`pre_${i}`, SKILLS[i % 8])),
    ...Array.from({ length: 20 }, (_, i) => mk(`post_${i}`, SKILLS[i % 8])),
  ];
  for (let run = 0; run < 20; run++) {
    const session = buildSession(pool, { length: 5 });
    expect(session).toHaveLength(5);
    expect(session.filter(s => !s.board).length).toBeLessThanOrEqual(2);
  }
});

test('preflop cap holds even when the weak skill is preflop', () => {
  // A red preflop skill pulls preflop-street hands — the cap keeps it to 2
  const pool = [
    ...Array.from({ length: 6 }, (_, i) => mkPre(`pf_${i}`, 'preflop')),
    ...Array.from({ length: 14 }, (_, i) => mk(`ot_${i}`, SKILLS[(i % 4) + 1])),
  ];
  const skills = { preflop: { rating: 'red', attempts: 10, correct: 2 } };
  for (let run = 0; run < 10; run++) {
    const session = buildSession(pool, { skills, length: 5 });
    expect(session.filter(s => !s.board).length).toBe(2); // weak target met, cap not breached
  }
});

test('preflop cap yields when the pool leaves no choice', () => {
  const pool = Array.from({ length: 5 }, (_, i) => mkPre(`pre_${i}`, SKILLS[i]));
  expect(buildSession(pool, { length: 5 })).toHaveLength(5);
});

test('applyHandsToHistory records last result and session number', () => {
  const h1 = applyHandsToHistory({}, [{ scenarioId: 'sc_1', result: 'incorrect' }], 3);
  expect(h1.sc_1).toEqual({ seen: 1, lastResult: 'incorrect', lastSeenAt: 3 });
  const h2 = applyHandsToHistory(h1, [{ scenarioId: 'sc_1', result: 'correct' }], 6);
  expect(h2.sc_1).toEqual({ seen: 2, lastResult: 'correct', lastSeenAt: 6 });
  expect(h1.sc_1.lastResult).toBe('incorrect'); // pure — input untouched
});

test('historyFromSessions offsets for sessions with no rows (pre-Supabase migration)', () => {
  // 10 sessions completed but only 2 logged rows → rows are sessions 9 and 10
  const rows = [
    { hands: [{ scenarioId: 'sc_1', result: 'incorrect' }] },
    { hands: [{ scenarioId: 'sc_1', result: 'correct' }, { scenarioId: 'sc_2', result: 'partial' }] },
  ];
  const history = historyFromSessions(rows, 10);
  expect(history.sc_1).toEqual({ seen: 2, lastResult: 'correct', lastSeenAt: 10 });
  expect(history.sc_2).toEqual({ seen: 1, lastResult: 'partial', lastSeenAt: 10 });
});
