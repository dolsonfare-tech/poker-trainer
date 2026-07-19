// Session-builder unit tests: unseen-first dealing, weak-skill weighting,
// missed-hand resurfacing with cooldown, least-recently-seen fallback, and
// the history rebuild from `sessions` rows.
import {
  buildSession, applyHandsToHistory, historyFromSessions,
  RESURFACE_COOLDOWN_SESSIONS, LADDER_SESSIONS, GRADUATION_TARGET, CONFIDENT_MISS_MS,
} from './spacedrep';

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

test('applyHandsToHistory records result, session number, and ladder state', () => {
  const h1 = applyHandsToHistory({}, [{ scenarioId: 'sc_1', result: 'incorrect' }], 3, '2026-07-03');
  expect(h1.sc_1).toEqual({
    seen: 1, lastResult: 'incorrect', lastSeenAt: 3, lastSeenDate: '2026-07-03',
    remediating: true, rung: 0, lastMissConfident: false,
  });
  const h2 = applyHandsToHistory(h1, [{ scenarioId: 'sc_1', result: 'correct' }], 6, '2026-07-06');
  expect(h2.sc_1).toEqual({
    seen: 2, lastResult: 'correct', lastSeenAt: 6, lastSeenDate: '2026-07-06',
    remediating: true, rung: 1, lastMissConfident: false, // one spaced correct: advanced, not cleared
  });
  expect(h1.sc_1.lastResult).toBe('incorrect'); // pure — input untouched
  expect(h1.sc_1.rung).toBe(0);                  // and the rung++ didn't mutate it
});

test('historyFromSessions offsets for sessions with no rows (pre-Supabase migration)', () => {
  // 10 sessions completed but only 2 logged rows → rows are sessions 9 and 10
  const rows = [
    { hands: [{ scenarioId: 'sc_1', result: 'incorrect' }] },
    { hands: [{ scenarioId: 'sc_1', result: 'correct' }, { scenarioId: 'sc_2', result: 'partial' }] },
  ];
  const history = historyFromSessions(rows, 10);
  expect(history.sc_1).toMatchObject({ seen: 2, lastResult: 'correct', lastSeenAt: 10 });
  expect(history.sc_2).toMatchObject({ seen: 1, lastResult: 'partial', lastSeenAt: 10 });
});

test('historyFromSessions derives the ladder + confident flag from created_at rows', () => {
  const rows = [
    { created_at: '2026-07-01T12:00:00Z', hands: [{ scenarioId: 'sc_1', result: 'incorrect', decisionMs: 4000 }] },
    { created_at: '2026-07-03T12:00:00Z', hands: [{ scenarioId: 'sc_1', result: 'correct' }] },
  ];
  const history = historyFromSessions(rows, 2);
  // Days two apart (TZ-robust) → the correct is spaced → one rung up, and the
  // fast miss (4s) is flagged confident.
  expect(history.sc_1).toMatchObject({ remediating: true, rung: 1, lastMissConfident: true });
});

// ── R1 graduation ladder ────────────────────────────────────────────────────

test('a miss needs GRADUATION_TARGET spaced corrects to graduate off the ladder', () => {
  expect(GRADUATION_TARGET).toBe(3);
  expect(LADDER_SESSIONS).toEqual([2, 5, 13]);
  let h = applyHandsToHistory({}, [{ scenarioId: 'sc_1', result: 'incorrect' }], 1, '2026-07-01');
  expect(h.sc_1).toMatchObject({ remediating: true, rung: 0 });
  h = applyHandsToHistory(h, [{ scenarioId: 'sc_1', result: 'correct' }], 3, '2026-07-03');
  expect(h.sc_1).toMatchObject({ remediating: true, rung: 1 });
  h = applyHandsToHistory(h, [{ scenarioId: 'sc_1', result: 'correct' }], 8, '2026-07-08');
  expect(h.sc_1).toMatchObject({ remediating: true, rung: 2 });
  h = applyHandsToHistory(h, [{ scenarioId: 'sc_1', result: 'correct' }], 21, '2026-07-21');
  expect(h.sc_1).toMatchObject({ remediating: false, rung: 0 }); // cleared
});

test('a new miss resets the ladder to rung 0', () => {
  let h = applyHandsToHistory({}, [{ scenarioId: 'sc_1', result: 'incorrect' }], 1, '2026-07-01');
  h = applyHandsToHistory(h, [{ scenarioId: 'sc_1', result: 'correct' }], 3, '2026-07-03');
  expect(h.sc_1.rung).toBe(1);
  h = applyHandsToHistory(h, [{ scenarioId: 'sc_1', result: 'incorrect' }], 5, '2026-07-05');
  expect(h.sc_1).toMatchObject({ remediating: true, rung: 0 });
});

test('a partial neither advances nor resets the ladder', () => {
  let h = applyHandsToHistory({}, [{ scenarioId: 'sc_1', result: 'incorrect' }], 1, '2026-07-01');
  h = applyHandsToHistory(h, [{ scenarioId: 'sc_1', result: 'partial' }], 3, '2026-07-03');
  expect(h.sc_1).toMatchObject({ remediating: true, rung: 0, lastResult: 'partial' });
});

test('the resurface interval expands as the ladder advances', () => {
  const pool = poolOf(20);
  const id = pool[0].id;
  const atRung = (rung, lastSeenAt) => ({
    [id]: { seen: 1, lastResult: 'correct', lastSeenAt, lastSeenDate: '2026-07-01', remediating: true, rung },
  });
  const resurfaced = (history, sessionsCompleted) =>
    buildSession(pool, { history, sessionsCompleted, currentDate: '2026-07-30', length: 5 })
      .some(s => s.id === id && s.replay);

  // rung 0 → interval LADDER_SESSIONS[0] (2): due at 2 elapsed, not at 1
  expect(resurfaced(atRung(0, 10), 11)).toBe(false);
  expect(resurfaced(atRung(0, 10), 12)).toBe(true);
  // rung 1 → interval 5
  expect(resurfaced(atRung(1, 10), 14)).toBe(false);
  expect(resurfaced(atRung(1, 10), 15)).toBe(true);
  // rung 2 → interval 13
  expect(resurfaced(atRung(2, 10), 22)).toBe(false);
  expect(resurfaced(atRung(2, 10), 23)).toBe(true);
});

test('a miss answered correct once still comes back (not v0 one-and-done)', () => {
  const pool = poolOf(20);
  const id = pool[0].id;
  // Missed, then answered correctly once (rung 1, still remediating). At the
  // rung-1 interval it must resurface again — v0 would have cleared it.
  const history = {
    [id]: { seen: 2, lastResult: 'correct', lastSeenAt: 10, lastSeenDate: '2026-07-01', remediating: true, rung: 1 },
  };
  const session = buildSession(pool, { history, sessionsCompleted: 16, currentDate: '2026-07-30', length: 5 });
  expect(session.some(s => s.id === id && s.replay)).toBe(true);
});

// ── R2 calendar-day floor ─────────────────────────────────────────────────

test('the R2 day floor suppresses a same-day miss even when sessions are due', () => {
  const pool = poolOf(20);
  const id = pool[0].id;
  const history = {
    [id]: { seen: 1, lastResult: 'incorrect', lastSeenAt: 10, lastSeenDate: '2026-07-15', remediating: true, rung: 0 },
  };
  // 3 sessions elapsed (>= interval 2) but the SAME calendar day → suppressed
  const sameDay = buildSession(pool, { history, sessionsCompleted: 13, currentDate: '2026-07-15', length: 5 });
  expect(sameDay.some(s => s.id === id)).toBe(false);
  // Next day, same session count → resurfaces
  const nextDay = buildSession(pool, { history, sessionsCompleted: 13, currentDate: '2026-07-16', length: 5 });
  expect(nextDay.some(s => s.id === id && s.replay)).toBe(true);
});

test('a same-day correct does not advance the ladder (massed, not spaced)', () => {
  let h = applyHandsToHistory({}, [{ scenarioId: 'sc_1', result: 'incorrect' }], 1, '2026-07-01');
  h = applyHandsToHistory(h, [{ scenarioId: 'sc_1', result: 'correct' }], 2, '2026-07-01'); // same day
  expect(h.sc_1).toMatchObject({ remediating: true, rung: 0 });
  h = applyHandsToHistory(h, [{ scenarioId: 'sc_1', result: 'correct' }], 3, '2026-07-02'); // next day
  expect(h.sc_1).toMatchObject({ remediating: true, rung: 1 });
});

describe('R2 day floor derived from the real clock (fake timers)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  test('a chained same-day session cannot resurface tonight’s miss', () => {
    jest.setSystemTime(new Date('2026-07-15T21:00:00'));
    const pool = poolOf(20);
    const id = pool[0].id;
    const history = applyHandsToHistory({}, [{ scenarioId: id, result: 'incorrect' }], 10, today());
    // Two more sessions chained the same night: session count is due, day floor is not
    const chained = buildSession(pool, { history, sessionsCompleted: 12, currentDate: today(), length: 5 });
    expect(chained.some(s => s.id === id)).toBe(false);

    jest.setSystemTime(new Date('2026-07-16T09:00:00'));
    const nextDay = buildSession(pool, { history, sessionsCompleted: 12, currentDate: today(), length: 5 });
    expect(nextDay.some(s => s.id === id && s.replay)).toBe(true);
  });
});

// ── F2 confident (fast + wrong) misses ─────────────────────────────────────

test('a fast wrong answer is flagged confident; slow and timeout are not', () => {
  const fast = applyHandsToHistory({}, [{ scenarioId: 'a', result: 'incorrect', decisionMs: CONFIDENT_MISS_MS - 1 }], 1, '2026-07-01');
  expect(fast.a.lastMissConfident).toBe(true);
  const slow = applyHandsToHistory({}, [{ scenarioId: 'b', result: 'incorrect', decisionMs: CONFIDENT_MISS_MS + 1 }], 1, '2026-07-01');
  expect(slow.b.lastMissConfident).toBe(false);
  const timeout = applyHandsToHistory({}, [{ scenarioId: 'c', result: 'incorrect', decisionMs: null }], 1, '2026-07-01');
  expect(timeout.c.lastMissConfident).toBe(false);
});

test('a confident miss jumps the resurface queue and tags the replay', () => {
  const pool = poolOf(20);
  // pool[1] is the older miss but ordinary; pool[0] is newer but confident.
  const history = {
    [pool[0].id]: { seen: 1, lastResult: 'incorrect', lastSeenAt: 3, lastSeenDate: '2026-07-03', remediating: true, rung: 0, lastMissConfident: true },
    [pool[1].id]: { seen: 1, lastResult: 'incorrect', lastSeenAt: 1, lastSeenDate: '2026-07-01', remediating: true, rung: 0, lastMissConfident: false },
  };
  const session = buildSession(pool, { history, sessionsCompleted: 10, currentDate: '2026-07-30', length: 5 });
  const replays = session.filter(s => s.replay);
  expect(replays).toHaveLength(1);
  expect(replays[0].id).toBe(pool[0].id);       // confident wins the single slot
  expect(replays[0].confidentMiss).toBe(true);  // and the flag rides the object
});

// ── R4 contrast-pair-aware dealing ─────────────────────────────────────────
// Tests pass their own `contrastPairs` so they're independent of the authored
// real map; the mock ids never intersect the real CONTRAST_PAIRS, which is also
// why every test above (using the default map) sees zero pairing.

test('a weak-skill pick with a contrast partner deals both, adjacent, within length 5', () => {
  const pool = [
    mk('X', 'potodds'),                                            // the weak pick
    mk('Y', 'reads'),                                              // its contrast partner
    ...Array.from({ length: 12 }, (_, i) => mk(`f_${i}`, 'aggression')),
  ];
  const skills = { potodds: { rating: 'red', attempts: 10, correct: 2 } };
  const contrastPairs = [['X', 'Y']];
  for (let run = 0; run < 30; run++) {
    const session = buildSession(pool, { skills, contrastPairs, length: 5 });
    expect(session).toHaveLength(5);
    const ix = session.findIndex(s => s.id === 'X');
    const iy = session.findIndex(s => s.id === 'Y');
    expect(ix).toBeGreaterThanOrEqual(0);
    expect(iy).toBeGreaterThanOrEqual(0);
    expect(Math.abs(ix - iy)).toBe(1); // juxtaposed — the contrast is the mechanism
  }
});

test('at most one contrast pair per session even when two weak picks both qualify', () => {
  // Both partners are already SEEN, so neither can enter via ordinary unseen
  // fill — a partner in the session can only be there because it was PAIRED.
  // Plenty of unseen fillers keep the pool from exhausting into the seen
  // fallback, so exactly one partner present == exactly one pair seated.
  const pool = [
    mk('X1', 'potodds'), mk('Y1', 'reads'),
    mk('X2', 'bluffing'), mk('Y2', 'position'),
    ...Array.from({ length: 12 }, (_, i) => mk(`f_${i}`, 'aggression')),
  ];
  const skills = {
    potodds: { rating: 'red', attempts: 10, correct: 2 },
    bluffing: { rating: 'red', attempts: 10, correct: 2 },
  };
  const history = { Y1: seenCorrect(1), Y2: seenCorrect(1) };
  const contrastPairs = [['X1', 'Y1'], ['X2', 'Y2']];
  for (let run = 0; run < 30; run++) {
    const session = buildSession(pool, { skills, history, sessionsCompleted: 1, contrastPairs, length: 5 });
    const partnersDealt = ['Y1', 'Y2'].filter(id => session.some(s => s.id === id)).length;
    expect(partnersDealt).toBe(1); // the 1-pair cap held
  }
});

test('pairing leaves the resurfaced-miss slot and its cooldown untouched', () => {
  const pool = [
    mk('M', 'aggression'),                    // the due miss (resurfaces)
    mk('X', 'potodds'), mk('Y', 'reads'),     // the contrast pair
    ...Array.from({ length: 12 }, (_, i) => mk(`f_${i}`, 'opponent')),
  ];
  const skills = { potodds: { rating: 'red', attempts: 10, correct: 2 } };
  const history = { M: { seen: 1, lastResult: 'incorrect', lastSeenAt: 1, lastSeenDate: '2026-07-01', remediating: true, rung: 0 } };
  const contrastPairs = [['X', 'Y']];
  for (let run = 0; run < 30; run++) {
    const session = buildSession(pool, {
      skills, history, sessionsCompleted: 10, currentDate: '2026-07-30', contrastPairs, length: 5,
    });
    expect(session).toHaveLength(5);
    const replays = session.filter(s => s.replay);
    expect(replays).toHaveLength(1);      // still exactly one comeback hand
    expect(replays[0].id).toBe('M');      // the pairing didn't displace it
    expect(session.some(s => s.id === 'M' && !s.replay)).toBe(false); // nor duplicate it
    // The pair still co-deals adjacently alongside the replay
    const ix = session.findIndex(s => s.id === 'X');
    const iy = session.findIndex(s => s.id === 'Y');
    expect(Math.abs(ix - iy)).toBe(1);
  }
});

test('a same-skill contrast pair does not breach the per-skill cap', () => {
  // X and Y are both betsize (like sc_088 + sc_113). X is the only UNSEEN
  // betsize, so the weak slot always seats X and pairs its (seen) partner Y —
  // a guaranteed same-skill pair. bs_0 is a would-be third betsize; the pair
  // consumes both betsize slots, so the per-skill cap must keep it out.
  const NON_BETSIZE = SKILLS.filter(k => k !== 'betsize');
  const pool = [
    mk('X', 'betsize'), mk('Y', 'betsize'), mk('bs_0', 'betsize'),
    ...Array.from({ length: 12 }, (_, i) => mk(`ot_${i}`, NON_BETSIZE[i % NON_BETSIZE.length])),
  ];
  const skills = { betsize: { rating: 'red', attempts: 10, correct: 2 } };
  const history = { Y: seenCorrect(1), bs_0: seenCorrect(1) };
  const contrastPairs = [['X', 'Y']];
  for (let run = 0; run < 30; run++) {
    const session = buildSession(pool, { skills, history, sessionsCompleted: 1, contrastPairs, length: 5 });
    expect(session.filter(s => s.skill === 'betsize')).toHaveLength(2); // the pair, no third
    expect(session.some(s => s.id === 'X')).toBe(true);
    expect(session.some(s => s.id === 'Y')).toBe(true); // seen partner pulled in only by pairing
  }
});

test('with no matching partner the session builds exactly as pre-R4 (weak weighting intact)', () => {
  // Same shape as the "weights two slots" test but with pairing wired: an empty
  // map (and, by extension, any pool whose ids miss the real map) must not
  // perturb the weak-skill composition.
  const pool = [
    ...Array.from({ length: 4 }, (_, i) => mk(`po_${i}`, 'potodds')),
    ...Array.from({ length: 16 }, (_, i) => mk(`ot_${i}`, SKILLS[i % 4])),
  ];
  const skills = { potodds: { rating: 'red', attempts: 10, correct: 2 } };
  for (let run = 0; run < 20; run++) {
    const session = buildSession(pool, { skills, contrastPairs: [], length: 5 });
    expect(session).toHaveLength(5);
    expect(session.filter(s => s.skill === 'potodds')).toHaveLength(2);
  }
});
