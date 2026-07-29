// Session application: what a finished session does to the user record,
// including the Coach's Notebook history.
//
// MOD-001 (Wave 3): split out of userStorage.test.js alongside the source.
import { applySessionResults, createUser, shouldFetchRead, META_READ_MIN_SESSIONS, META_READ_EVERY } from './session';
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

test('applySessionResults records the session in the recent-form window', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-07-28T12:00:00'));
  const user = { ...createUser('N'), recentSessions: [] };
  const hands = [
    { scenarioId: 'sc_001', skill: 'potodds', result: 'correct', choiceVal: 'call' },
    { scenarioId: 'sc_002', skill: 'bluffing', result: 'incorrect', choiceVal: 'fold' },
  ];
  const out = applySessionResults(user, hands, null);
  expect(out.recentSessions).toHaveLength(1);
  expect(out.recentSessions[0]).toMatchObject({ date: '2026-07-28', correct: 1, total: 2 });
  jest.useRealTimers();
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

// ── submitSession (MOD-002, Wave 3) ─────────────────────────────────────────
// The end-of-session pipeline, lifted out of App.jsx. Its ordering rules were
// previously only assertable by driving the whole app, which is why they were
// never asserted at all. Each one below protects a decision that would be
// silently expensive to lose.
jest.mock('./claude', () => ({ fetchCoachRead: jest.fn() }));
jest.mock('./persistence', () => ({ saveUser: jest.fn() }));

const { fetchCoachRead } = require('./claude');
const { saveUser } = require('./persistence');
const { submitSession } = require('./session');

const hands = [
  { scenarioId: 'sc_001', skill: 'preflop', result: 'correct', choiceVal: 'fold', decisionMs: 900 },
  { scenarioId: 'sc_002', skill: 'potodds', result: 'incorrect', choiceVal: 'call', decisionMs: 400 },
];
const remoteStub = () => ({
  saveRemoteUser: jest.fn().mockResolvedValue(undefined),
  recordSession: jest.fn().mockResolvedValue(undefined),
});

beforeEach(() => { jest.clearAllMocks(); });

test('a guest never calls the coach endpoint, but their session still persists', async () => {
  const remote = remoteStub();
  const res = await submitSession({
    user: createUser('Guest'), hands, difficulty: 'beginner',
    isGuest: true, remote,
  });
  expect(fetchCoachRead).not.toHaveBeenCalled();
  expect(saveUser).toHaveBeenCalledTimes(1);          // local cache still written
  expect(remote.saveRemoteUser).not.toHaveBeenCalled();
  expect(remote.recordSession).not.toHaveBeenCalled();
  expect(res.user.sessionsCompleted).toBe(1);
  expect(res.coachText).toBe('');
});

test('a signed-in session fetches the read and writes it through', async () => {
  fetchCoachRead.mockResolvedValue('You over-fold rivers.');
  const remote = remoteStub();
  const res = await submitSession({
    user: { ...createUser('Reader'), sessionsCompleted: 12, sessionsSinceRead: 5 }, hands, difficulty: 'intermediate',
    isGuest: false, remote,
  });
  expect(res.coachText).toBe('You over-fold rivers.');
  expect(res.user.coachNote.body).toBe('You over-fold rivers.');
  expect(saveUser).toHaveBeenCalledTimes(1);
  expect(remote.saveRemoteUser).toHaveBeenCalledTimes(1);
  // coachRead is null ON PURPOSE: the row is inserted BEFORE the read exists,
  // and the server stamps the read onto it (see the window-ordering tests).
  expect(remote.recordSession).toHaveBeenCalledWith(
    expect.objectContaining({ difficulty: 'intermediate', correctCount: 1, coachRead: null }));
});

// ── Window ordering (July 29, 2026) ─────────────────────────────────────────
// The server builds the read's window from the sessions table, so the row for
// the session that TRIGGERED the read must be committed before the fetch — or
// every read permanently excludes the session the player just finished, while
// the dashboard stamps it "as of today". Calling recordSession first is not
// enough: fire-and-forget still loses the race to the server's query. The
// insert must have RESOLVED.
test('the trend read is fetched only after the triggering session row is in the log', async () => {
  let rowInserted = false;
  let fetchSawInsert = null;
  const remote = {
    saveRemoteUser: jest.fn().mockResolvedValue(undefined),
    recordSession: jest.fn(() => new Promise(r => setTimeout(() => { rowInserted = true; r(); }, 0))),
  };
  fetchCoachRead.mockImplementation(() => {
    fetchSawInsert = rowInserted;
    return Promise.resolve('a read over ten sessions');
  });
  const res = await submitSession({
    user: { ...createUser('Ordered'), sessionsCompleted: 12, sessionsSinceRead: 5 }, hands, difficulty: 'beginner',
    isGuest: false, remote,
  });
  expect(fetchCoachRead).toHaveBeenCalledTimes(1);
  expect(fetchSawInsert).toBe(true);
  expect(remote.recordSession).toHaveBeenCalledTimes(1); // inserted once, never re-sent after the read
  expect(res.coachText).toBe('a read over ten sessions');
});

test('the cadence counts the session that just finished — the first read lands as session 6 ends', async () => {
  fetchCoachRead.mockResolvedValue('first read');
  const res = await submitSession({
    user: { ...createUser('Sixth'), sessionsCompleted: 5, sessionsSinceRead: 5 }, hands, difficulty: 'beginner',
    isGuest: false, remote: remoteStub(),
  });
  expect(fetchCoachRead).toHaveBeenCalledTimes(1);
  expect(res.user.sessionsCompleted).toBe(6);
  expect(res.user.sessionsSinceRead).toBe(0);
});

// If the row insert fails there is nothing for the server to stamp the read
// onto, so the log could never rebuild it: the local profile would show a read
// the remote rebuild denies ever happened — the dual-owner divergence again.
// Skip the read; the counter keeps climbing and the next session retries.
test('a failed row insert skips the read rather than minting one the log cannot rebuild', async () => {
  fetchCoachRead.mockResolvedValue('orphan read');
  const remote = {
    saveRemoteUser: jest.fn().mockResolvedValue(undefined),
    recordSession: jest.fn().mockRejectedValue(new Error('insert failed')),
  };
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const res = await submitSession({
    user: { ...createUser('Dropped'), sessionsCompleted: 12, sessionsSinceRead: 5 }, hands, difficulty: 'beginner',
    isGuest: false, remote,
  });
  expect(fetchCoachRead).not.toHaveBeenCalled();
  expect(res.coachText).toBe('');
  expect(res.user.sessionsSinceRead).toBe(6);          // climbs, so the next session retries
  expect(saveUser).toHaveBeenCalledTimes(1);           // the session itself still persists locally
  console.error.mockRestore();
});

test('a whitespace-only fetched read attaches nothing and does not reset the counter', async () => {
  fetchCoachRead.mockResolvedValue('   ');
  const res = await submitSession({
    user: { ...createUser('Blank'), sessionsCompleted: 12, sessionsSinceRead: 5 }, hands, difficulty: 'beginner',
    isGuest: false, remote: remoteStub(),
  });
  expect(res.user.sessionsSinceRead).toBe(6);          // no read landed, by BOTH owners' definition
  expect(res.user.coachReads).toEqual([]);
});

test('a FAILED coach read still persists the session — losing the hands is the worse bug', async () => {
  fetchCoachRead.mockRejectedValue(new Error('network'));
  const remote = remoteStub();
  const res = await submitSession({
    // Eligible for a read (the cadence landed on this branch made the old
    // brand-new-user fixture skip the fetch entirely, so this test was
    // silently no longer covering its own title).
    user: { ...createUser('Unlucky'), sessionsCompleted: 12, sessionsSinceRead: 5 }, hands, difficulty: 'beginner',
    isGuest: false, remote,
  });
  expect(res.user.sessionsCompleted).toBe(13);        // the session counted
  expect(res.coachText).toBe('');
  expect(res.limited).toBe(false);
  expect(saveUser).toHaveBeenCalledTimes(1);
  expect(remote.recordSession).toHaveBeenCalledTimes(1);
});

test('the daily cap is reported as limited, not as a generic failure', async () => {
  const err = new Error('cap'); err.code = 'daily_limit';
  fetchCoachRead.mockRejectedValue(err);
  const res = await submitSession({
    user: { ...createUser('Capped'), sessionsCompleted: 12, sessionsSinceRead: 5 }, hands, difficulty: 'beginner',
    isGuest: false, remote: remoteStub(),
  });
  expect(res.limited).toBe(true);
  expect(res.user.sessionsCompleted).toBe(13);        // 12 prior + this one — the session still counted
});

test('no remote object means localStorage-only — no remote writes attempted', async () => {
  fetchCoachRead.mockResolvedValue('read');
  await submitSession({
    user: createUser('Local'), hands, difficulty: 'beginner',
    isGuest: false, remote: null,
  });
  expect(saveUser).toHaveBeenCalledTimes(1);          // local still written
});

test('a rejected remote write does not reject the caller — the summary must render', async () => {
  fetchCoachRead.mockResolvedValue('read');
  const remote = {
    saveRemoteUser: jest.fn().mockRejectedValue(new Error('500')),
    recordSession: jest.fn().mockRejectedValue(new Error('500')),
  };
  jest.spyOn(console, 'error').mockImplementation(() => {});
  // coachText is '' here, not 'read': the failed insert means the read is
  // skipped (see the failed-row-insert test above), but the caller still
  // resolves and the summary still renders.
  await expect(submitSession({
    user: { ...createUser('Offline'), sessionsCompleted: 12, sessionsSinceRead: 5 }, hands, difficulty: 'beginner',
    isGuest: false, remote,
  })).resolves.toMatchObject({ coachText: '' });
  console.error.mockRestore();
});

test('applySessionResults resets the read counter when a read was stored', () => {
  const user = { ...createUser('N'), sessionsSinceRead: 4 };
  const hands = [{ scenarioId: 'sc_001', skill: 'potodds', result: 'correct', choiceVal: 'call' }];
  expect(applySessionResults(user, hands, 'a real read').sessionsSinceRead).toBe(0);
});

test('applySessionResults advances the read counter when no read was stored', () => {
  const user = { ...createUser('N'), sessionsSinceRead: 4 };
  const hands = [{ scenarioId: 'sc_001', skill: 'potodds', result: 'correct', choiceVal: 'call' }];
  expect(applySessionResults(user, hands, null).sessionsSinceRead).toBe(5);
});

test('a legacy cached profile with no counter starts from its session count', () => {
  const user = { ...createUser('N'), sessionsCompleted: 7 };
  delete user.sessionsSinceRead;
  const hands = [{ scenarioId: 'sc_001', skill: 'potodds', result: 'correct', choiceVal: 'call' }];
  // 7 prior sessions + this one, none of which stored a read
  expect(applySessionResults(user, hands, null).sessionsSinceRead).toBe(8);
});

// ── shouldFetchRead (Phase B, Task 2) ───────────────────────────────────────
const u = (over) => ({ ...createUser('N'), ...over });

test('no read before the minimum session count, however long the gap', () => {
  expect(shouldFetchRead(u({ sessionsCompleted: 5, sessionsSinceRead: 5 }))).toBe(false);
});

test('the first read fires at the minimum session count', () => {
  expect(shouldFetchRead(u({ sessionsCompleted: META_READ_MIN_SESSIONS, sessionsSinceRead: 6 }))).toBe(true);
});

test('no read again until the interval has passed', () => {
  expect(shouldFetchRead(u({ sessionsCompleted: 9, sessionsSinceRead: 4 }))).toBe(false);
  expect(shouldFetchRead(u({ sessionsCompleted: 9, sessionsSinceRead: META_READ_EVERY }))).toBe(true);
});

// The self-healing case: a failed call leaves the row with no read, so the
// counter keeps climbing and the NEXT session retries — rather than the player
// waiting another full interval.
test('after a failed read the counter keeps climbing and the next session retries', () => {
  expect(shouldFetchRead(u({ sessionsCompleted: 12, sessionsSinceRead: 7 }))).toBe(true);
});

test('guests never trigger a read', () => {
  expect(shouldFetchRead(null)).toBe(false);
  expect(shouldFetchRead(undefined)).toBe(false);
});

test('submitSession skips the API entirely when no read is due', async () => {
  fetchCoachRead.mockClear();
  const user = { ...createUser('N'), sessionsCompleted: 7, sessionsSinceRead: 2 };
  const hands = [{ scenarioId: 'sc_001', skill: 'potodds', result: 'correct', choiceVal: 'call' }];
  const res = await submitSession({ user, hands, difficulty: 'beginner', isGuest: false, remote: null });
  expect(fetchCoachRead).not.toHaveBeenCalled();
  expect(res.coachText).toBe('');
  expect(res.user.sessionsSinceRead).toBe(3);
});

test('submitSession calls the API when a read IS due', async () => {
  fetchCoachRead.mockClear();
  fetchCoachRead.mockResolvedValueOnce('the meta read');
  const user = { ...createUser('N'), sessionsCompleted: 12, sessionsSinceRead: 5 };
  const hands = [{ scenarioId: 'sc_001', skill: 'potodds', result: 'correct', choiceVal: 'call' }];
  const res = await submitSession({ user, hands, difficulty: 'beginner', isGuest: false, remote: null });
  expect(fetchCoachRead).toHaveBeenCalledTimes(1);
  expect(res.coachText).toBe('the meta read');
  expect(res.user.sessionsSinceRead).toBe(0);
});
