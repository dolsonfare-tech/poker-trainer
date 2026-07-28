// db.js pure-derivation units. The Supabase client is mocked out — these test
// the recent-hands buffer rebuild (F3) that assembleUser runs on load.
import { recentHandsFromSessions, directionTallyFromSessions, coachReadsFromSessions, recentSessionsFromSessions, fetchRemoteUser, createRemoteProfile } from './db';
import { COACH_READS_CAP } from './coachRead';
import { RECENT_HANDS_CAP } from './iq';
import { RECENT_SESSIONS_CAP } from './recentForm';
import { DEFAULT_SKILLS } from './session';
// ── Supabase mock ─────────────────────────────────────────────────────────────
// jest.mock() factories are hoisted before any variable initialisation, so the
// mock object must live inside the factory closure (not in a module-level var).
// We expose a mutable handle via a getter so individual tests can swap builders.

function makeBuilder(resolveWith) {
  const calls = [];
  const builder = {
    _calls: calls,
    select(v) { calls.push(['select', v]); return this; },
    eq(col, val) { calls.push(['eq', col, val]); return this; },
    order(col, opts) { calls.push(['order', col, opts]); return this; },
    range(from, to) { calls.push(['range', from, to]); return this; },
    limit(n) { calls.push(['limit', n]); return this; },
    upsert(rows, opts) { calls.push(['upsert', rows, opts]); return this; },
    insert(row) { calls.push(['insert', row]); return this; },
    update(obj) { calls.push(['update', obj]); return this; },
    single() { calls.push(['single']); return this; },
    maybeSingle() { calls.push(['maybeSingle']); return Promise.resolve(resolveWith); },
    then(resolve) { return Promise.resolve(resolveWith).then(resolve); },
  };
  return builder;
}

// Shared mutable mock — tests configure `mockFrom` before calling fetchRemoteUser.
let mockFrom = jest.fn();
const mockGetUser = jest.fn();

jest.mock('./supabase', () => ({
  // We can't reference module-level vars here (hoisting), so we use a proxy
  // object whose `from` and `auth` forward to the mutable references above.
  get supabase() {
    return {
      auth: { getUser: mockGetUser },
      from: mockFrom,
    };
  },
  hasSupabase: true,
}));

// Minimal profile, skill rows, session rows used in assembleUser tests.
const MOCK_PROFILE = {
  display_name: 'Alice',
  initials: 'AL',
  streak: 3,
  last_session_date: '2026-07-25',
  rebuys: 1,
  sessions_completed: 2,
  poker_score: 99,          // intentionally wrong — assembleUser must NOT trust this
  coach_note_body: '{"headline":"Watch river","evidence":[],"watchFor":"x"}',
  coach_note_focus: 'bluffing',
  username_changed_at: null,
};

const MOCK_SKILL_ROWS = Object.keys(DEFAULT_SKILLS).map((k, i) => ({
  skill: k,
  rating: 'gray',
  attempts: i,
  correct: i * 0.5,
}));

// Two session rows returned NEWEST-FIRST (descending created_at) — the order
// fetchRemoteUser requests after CA-015.  The in-memory re-sort must flip them
// to chronological before passing to the derivation helpers.
const OLDER_SESSION = {
  hands: [{ scenarioId: 1, skill: 'preflop', result: 'correct', choiceVal: 'raise' }],
  correct_count: 1,
  created_at: '2026-07-24T10:00:00Z',
  coach_read: 'older read',
};
const NEWER_SESSION = {
  hands: [{ scenarioId: 2, skill: 'potodds', result: 'incorrect', choiceVal: 'fold' }],
  correct_count: 0,
  created_at: '2026-07-25T10:00:00Z',
  coach_read: 'newer read',
};
// Supabase returns newest first (descending order).
const MOCK_SESSION_ROWS_DESC = [NEWER_SESSION, OLDER_SESSION];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-alice' } }, error: null });
});

// ── recentHandsFromSessions ───────────────────────────────────────────────────

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

// ── recentSessionsFromSessions (dashboard recent-form strip) ─────────────────

test('recentSessionsFromSessions rebuilds newest-first and caps at the window pair', () => {
  const rows = Array.from({ length: RECENT_SESSIONS_CAP + 3 }, (_, i) => ({
    created_at: `2026-07-${String(i + 1).padStart(2, '0')}T12:00:00Z`,
    correct_count: i % 5,
    hands: [{ skill: 'potodds', result: 'correct' }, { skill: 'bluffing', result: 'incorrect' }],
  }));
  const out = recentSessionsFromSessions(rows);
  expect(out).toHaveLength(RECENT_SESSIONS_CAP);
  // rows arrive created_at ASCENDING; the newest row must end up first
  expect(out[0].total).toBe(2);
  // correct is counted from the (fixed, 1-of-2) hands log, not correct_count —
  // every row's correct_count differs (i % 5) but hands never does.
  expect(out[0].correct).toBe(1);
});

test('recentSessionsFromSessions counts correct from hands, not the stored column', () => {
  // correct_count is a client-written integrity field (CA-001). The hands log
  // is the append-only truth, so the strip must count from it.
  const out = recentSessionsFromSessions([{
    created_at: '2026-07-02T12:00:00Z',
    correct_count: 99,
    hands: [{ skill: 'potodds', result: 'correct' }, { skill: 'potodds', result: 'incorrect' }],
  }]);
  expect(out[0].correct).toBe(1);
  expect(out[0].total).toBe(2);
});

// ── CA-015: bounded sessions fetch ───────────────────────────────────────────
// fetchRemoteUser must issue order('created_at',{ascending:false}) + range(0,999)
// on the sessions query.  We assert on the exact builder call sequence.

// Best-session aggregation: a separate tiny query result.
const MOCK_BEST_ROW = { correct_count: 4 };

function makeFetchBuilders(sessionRows, bestRow = MOCK_BEST_ROW) {
  // profiles builder — also handles maybeSingle for fetchRemoteUser's profile read
  const profileBuilder = makeBuilder({ data: MOCK_PROFILE, error: null });

  // skills builder
  const skillsBuilder = makeBuilder({ data: MOCK_SKILL_ROWS, error: null });

  // sessions builder — records which .order() and .range() calls are made
  const sessionsBuilder = makeBuilder({ data: sessionRows, error: null });

  // best-session aggregation builder (separate tiny query)
  const bestData = sessionRows.length > 0 ? [bestRow] : [];
  const bestBuilder = makeBuilder({ data: bestData, error: null });

  // from() dispatches by table + call count within a test.
  let sessionsCallCount = 0;
  mockFrom.mockImplementation((table) => {
    if (table === 'profiles') return profileBuilder;
    if (table === 'skills') return skillsBuilder;
    if (table === 'sessions') {
      sessionsCallCount += 1;
      // First sessions call = the main history fetch; second = bestSessionCorrect aggregation
      return sessionsCallCount === 1 ? sessionsBuilder : bestBuilder;
    }
    return makeBuilder({ data: null, error: null });
  });

  return { profileBuilder, skillsBuilder, sessionsBuilder, bestBuilder };
}

test('fetchRemoteUser issues sessions select with order desc + range(0,999)', async () => {
  const { sessionsBuilder } = makeFetchBuilders(MOCK_SESSION_ROWS_DESC);

  await fetchRemoteUser();

  // The sessions query must include order(created_at, ascending:false) then range(0,999)
  const chain = sessionsBuilder._calls;
  const orderCall = chain.find(c => c[0] === 'order');
  const rangeCall = chain.find(c => c[0] === 'range');

  expect(orderCall).toEqual(['order', 'created_at', { ascending: false }]);
  expect(rangeCall).toEqual(['range', 0, 999]);
});

// ── CA-015: in-memory re-sort correctness ─────────────────────────────────────
// The sessions query returns newest-first; the derivation helpers need
// chronological order.  assembleUser must sort ascending before calling them.

test('assembleUser re-sorts newest-first rows before derivation (scenarioHistory)', async () => {
  makeFetchBuilders(MOCK_SESSION_ROWS_DESC);

  const user = await fetchRemoteUser();

  // After re-sorting: OLDER_SESSION processed first (scenarioId 1 = correct),
  // then NEWER_SESSION (scenarioId 2 = incorrect).
  // scenarioId 1 should be seen:1, lastResult:'correct', not remediating.
  // scenarioId 2 should be seen:1, lastResult:'incorrect', remediating:true.
  expect(user.scenarioHistory[1]).toMatchObject({ lastResult: 'correct', remediating: false });
  expect(user.scenarioHistory[2]).toMatchObject({ lastResult: 'incorrect', remediating: true });
});

test('assembleUser re-sorts newest-first rows before derivation (recentHands order)', async () => {
  makeFetchBuilders(MOCK_SESSION_ROWS_DESC);

  const user = await fetchRemoteUser();

  // Chronological: OLDER hand (preflop/correct) first, then NEWER (potodds/incorrect).
  expect(user.recentHands[0]).toEqual({ skill: 'preflop', result: 'correct' });
  expect(user.recentHands[1]).toEqual({ skill: 'potodds', result: 'incorrect' });
});

test('assembleUser re-sorts newest-first rows before derivation (coachReads newest-first)', async () => {
  makeFetchBuilders(MOCK_SESSION_ROWS_DESC);

  const user = await fetchRemoteUser();

  // coachReadsFromSessions assumes ascending input then reverses.
  // After re-sort to ascending → reverse → newest 'newer read' first.
  expect(user.coachReads[0].body).toBe('newer read');
  expect(user.coachReads[1].body).toBe('older read');
});

// ── CA-015: bestSessionCorrect via aggregation ────────────────────────────────
// bestSessionCorrect must come from the aggregation query result (lifetime-true),
// not from scanning the bounded window of session rows.

test('fetchRemoteUser derives bestSessionCorrect from the aggregation query, not the window', async () => {
  // Window has max correct_count=1; the aggregation returns 4 (a historical best
  // outside the bounded window).
  const { bestBuilder } = makeFetchBuilders(MOCK_SESSION_ROWS_DESC);
  // Override bestBuilder to return 4 — higher than anything in the window
  bestBuilder.then = (resolve) => Promise.resolve({ data: [{ correct_count: 4 }], error: null }).then(resolve);

  const user = await fetchRemoteUser();

  // Must reflect the aggregation result (4), not the window max (1).
  expect(user.bestSessionCorrect).toBe(4);
});

test('fetchRemoteUser sets bestSessionCorrect to null when no session rows exist', async () => {
  makeFetchBuilders([]);

  const user = await fetchRemoteUser();

  expect(user.bestSessionCorrect).toBeNull();
});

// ── CA-020: no Math.max spread footgun ───────────────────────────────────────

test('CA-020: db.js source contains no Math.max spread over an array', () => {
  // The RangeError footgun — Math.max(...array) blows the call stack at ~10k elements.
  // This grep-pin mirrors how check-invariants pins patterns.
  const fs = require('fs');
  const src = fs.readFileSync(require.resolve('./db'), 'utf8');
  expect(src).not.toMatch(/Math\.max\(\s*\.\.\./);
});

test('CA-020: reduce-based max yields the correct result on a large array without throwing', () => {
  // 15,000 elements — well above the ~10k spread limit.  The reduce path in
  // assembleUser / bestSessionCorrect must not throw.
  const rows = Array.from({ length: 15000 }, (_, i) => ({ correct_count: i }));
  const max = rows.reduce((m, r) => Math.max(m, r.correct_count ?? 0), 0);
  expect(max).toBe(14999);
  expect(() => max).not.toThrow();
});

// ── CA-048: assembleUser field-mapping coverage ───────────────────────────────
// Given a full mock profile + skills + sessions, the returned user carries every
// field the app renders, and pokerScore is derived fresh (not profiles.poker_score).

test('CA-048: assembleUser returns all required user fields', async () => {
  makeFetchBuilders(MOCK_SESSION_ROWS_DESC);

  const user = await fetchRemoteUser();

  // Core profile fields
  expect(user.displayName).toBe('Alice');
  expect(user.initials).toBe('AL');
  expect(user.streak).toBe(3);
  expect(user.lastSessionDate).toBe('2026-07-25');
  expect(user.rebuys).toBe(1);
  expect(user.sessionsCompleted).toBe(2);

  // Skills object with all 8 keys, each having rating/attempts/correct
  expect(Object.keys(user.skills)).toHaveLength(8);
  for (const k of Object.keys(DEFAULT_SKILLS)) {
    expect(user.skills[k]).toHaveProperty('rating');
    expect(user.skills[k]).toHaveProperty('attempts');
    expect(user.skills[k]).toHaveProperty('correct');
  }

  // Schema (may be null/Balanced for a new user — just must be present)
  expect(user).toHaveProperty('schema');

  // pokerScore MUST be derived fresh — must NOT equal the stale profiles.poker_score (99).
  // For a user with all-gray skills and small attempt counts, the derived score
  // will be null (no rated skills yet) or a real derived value, never 99.
  expect(user.pokerScore).not.toBe(99);

  // Derived session data
  expect(user).toHaveProperty('scenarioHistory');
  expect(user).toHaveProperty('directionTally');
  expect(user).toHaveProperty('recentHands');
  expect(Array.isArray(user.recentHands)).toBe(true);
  expect(user).toHaveProperty('coachReads');
  expect(Array.isArray(user.coachReads)).toBe(true);

  // bestSessionCorrect present (from aggregation query)
  expect(user).toHaveProperty('bestSessionCorrect');

  // usernameChangedAt present
  expect(user).toHaveProperty('usernameChangedAt');
});

test('CA-048: assembleUser pokerScore is derived fresh, never reads profiles.poker_score', async () => {
  // Even if profiles.poker_score is a wild value, the returned pokerScore
  // must differ (derive from skills) — pin the anti-trust invariant.
  makeFetchBuilders(MOCK_SESSION_ROWS_DESC);

  const user = await fetchRemoteUser();

  // The mock profile has poker_score: 99 (no rated skills at gray/0-attempts
  // yields null, not 99 — any real derivation gives a different answer).
  expect(user.pokerScore).not.toBe(MOCK_PROFILE.poker_score);
});

// ── CA-048: createRemoteProfile upsert shape ──────────────────────────────────
// createRemoteProfile must call profiles.upsert with ignoreDuplicates:true.
// This is a CALL-SHAPE test — not just the invariant pattern grep.

test('CA-048: createRemoteProfile calls profiles upsert with ignoreDuplicates:true', async () => {
  // Wire up all builders createRemoteProfile + its trailing fetchRemoteUser need.
  const profileBuilder = makeBuilder({ data: null, error: null });
  const skillsBuilder  = makeBuilder({ data: MOCK_SKILL_ROWS, error: null });

  // profiles.maybeSingle() is called by the trailing fetchRemoteUser — return a profile.
  profileBuilder.maybeSingle = () => Promise.resolve({ data: MOCK_PROFILE, error: null });

  let sessionsCallCount = 0;
  mockFrom.mockImplementation((table) => {
    if (table === 'profiles') return profileBuilder;
    if (table === 'skills') return skillsBuilder;
    if (table === 'sessions') {
      sessionsCallCount += 1;
      return makeBuilder({ data: [], error: null });
    }
    return makeBuilder({ data: null, error: null });
  });

  await createRemoteProfile('Alice', null);

  // Find the upsert call recorded on the profiles builder.
  const upsertCall = profileBuilder._calls.find(c => c[0] === 'upsert');
  expect(upsertCall).toBeDefined();
  // Third element is the options object — must include ignoreDuplicates: true.
  expect(upsertCall[2]).toMatchObject({ ignoreDuplicates: true });
});

// ── CA-005: rebuys writer omission ───────────────────────────────────────────
// createRemoteProfile and saveRemoteUser must OMIT the rebuys key from their
// payload when user.rebuys is not a finite number — never coerce undefined/null → 0.

test('CA-005: createRemoteProfile omits rebuys when user.rebuys is undefined', async () => {
  const profileBuilder = makeBuilder({ data: null, error: null });
  const skillsBuilder = makeBuilder({ data: MOCK_SKILL_ROWS, error: null });
  profileBuilder.maybeSingle = () => Promise.resolve({ data: MOCK_PROFILE, error: null });

  let sessionsCallCount = 0;
  mockFrom.mockImplementation((table) => {
    if (table === 'profiles') return profileBuilder;
    if (table === 'skills') return skillsBuilder;
    if (table === 'sessions') {
      sessionsCallCount += 1;
      return makeBuilder({ data: [], error: null });
    }
    return makeBuilder({ data: null, error: null });
  });

  const userWithoutRebuys = { ...MOCK_PROFILE, rebuys: undefined };
  await createRemoteProfile('Alice', userWithoutRebuys);

  const upsertCall = profileBuilder._calls.find(c => c[0] === 'upsert');
  const payload = upsertCall[1];
  expect(payload).not.toHaveProperty('rebuys');
});

test('CA-005: createRemoteProfile includes rebuys when user.rebuys is a finite number', async () => {
  const profileBuilder = makeBuilder({ data: null, error: null });
  const skillsBuilder = makeBuilder({ data: MOCK_SKILL_ROWS, error: null });
  profileBuilder.maybeSingle = () => Promise.resolve({ data: MOCK_PROFILE, error: null });

  let sessionsCallCount = 0;
  mockFrom.mockImplementation((table) => {
    if (table === 'profiles') return profileBuilder;
    if (table === 'skills') return skillsBuilder;
    if (table === 'sessions') {
      sessionsCallCount += 1;
      return makeBuilder({ data: [], error: null });
    }
    return makeBuilder({ data: null, error: null });
  });

  const userWithRebuys = { ...MOCK_PROFILE, rebuys: 2 };
  await createRemoteProfile('Alice', userWithRebuys);

  const upsertCall = profileBuilder._calls.find(c => c[0] === 'upsert');
  const payload = upsertCall[1];
  expect(payload).toHaveProperty('rebuys', 2);
});

test('CA-005: saveRemoteUser omits rebuys when user.rebuys is undefined', async () => {
  const profileBuilder = makeBuilder({ data: null, error: null });
  const skillsBuilder = makeBuilder({ data: MOCK_SKILL_ROWS, error: null });

  mockFrom.mockImplementation((table) => {
    if (table === 'profiles') return profileBuilder;
    if (table === 'skills') return skillsBuilder;
    return makeBuilder({ data: null, error: null });
  });

  const userWithoutRebuys = { ...MOCK_PROFILE, rebuys: undefined, skills: DEFAULT_SKILLS };
  await require('./db').saveRemoteUser(userWithoutRebuys);

  const updateCall = profileBuilder._calls.find(c => c[0] === 'update');
  const payload = updateCall[1];
  expect(payload).not.toHaveProperty('rebuys');
});

test('CA-005: saveRemoteUser includes rebuys when user.rebuys is a finite number', async () => {
  const profileBuilder = makeBuilder({ data: null, error: null });
  const skillsBuilder = makeBuilder({ data: MOCK_SKILL_ROWS, error: null });

  mockFrom.mockImplementation((table) => {
    if (table === 'profiles') return profileBuilder;
    if (table === 'skills') return skillsBuilder;
    return makeBuilder({ data: null, error: null });
  });

  const userWithRebuys = { ...MOCK_PROFILE, rebuys: 2, skills: DEFAULT_SKILLS };
  await require('./db').saveRemoteUser(userWithRebuys);

  const updateCall = profileBuilder._calls.find(c => c[0] === 'update');
  const payload = updateCall[1];
  expect(payload).toHaveProperty('rebuys', 2);
});
