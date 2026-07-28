// useAuthSession (MOD-002, Wave 3).
//
// Three behaviours here exist because of specific live incidents, and until now
// only ONE of them had a mechanical guard — invariants rule 'no-async-
// onAuthStateChange' pattern-matches the source for an inline `await`. That
// catches the shape, not the behaviour: it cannot tell whether the deferred
// work actually runs, whether a revoked session recovers, or whether a network
// blip is correctly distinguished from a first visit.
//
// These tests drive the real listener. `onAuthStateChange` is captured from the
// supabase mock so each test can fire auth events by hand, and jest fake timers
// hold the setTimeout(0) deferral so it can be asserted as a separate step
// rather than raced against.
import { renderHook, act, waitFor } from '@testing-library/react';

let mockAuthCallback = null;
const mockSignOut = jest.fn(async () => ({ error: null }));

jest.mock('../utils/supabase', () => ({
  __esModule: true,
  hasSupabase: true,
  supabase: {
    auth: {
      onAuthStateChange: (cb) => {
        mockAuthCallback = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: (...args) => mockSignOut(...args),
    },
  },
}));

jest.mock('../utils/db', () => ({
  fetchRemoteUser: jest.fn(),
  createRemoteProfile: jest.fn(),
  updateDisplayName: jest.fn(),
}));

jest.mock('../utils/analytics', () => ({
  track: jest.fn(), identify: jest.fn(), resetAnalytics: jest.fn(),
}));
jest.mock('../utils/sentry', () => ({
  setSentryUser: jest.fn(), clearSentryUser: jest.fn(),
}));

import { useAuthSession } from './useAuthSession';
import { fetchRemoteUser, createRemoteProfile } from '../utils/db';
import { track } from '../utils/analytics';
import { createUser } from '../utils/session';
import { saveUser, setCacheOwner, cacheOwner } from '../utils/persistence';

const SESSION = { user: { id: 'uid-1' } };

const setup = () => {
  const guestRef = { current: false };
  const view = renderHook(() => useAuthSession({ guestRef }));
  return { ...view, guestRef };
};

// Fire an auth event and let the deferred setTimeout(0) body run to completion.
const fireAndSettle = async (event, session) => {
  await act(async () => { mockAuthCallback(event, session); });
  await act(async () => { jest.runAllTimers(); });
};

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockAuthCallback = null;
});
afterEach(() => { jest.useRealTimers(); });

// ── The deadlock workaround ────────────────────────────────────────────────
describe('deferred profile load (the setTimeout(0) deadlock workaround)', () => {
  test('does NOT fetch during the callback — supabase holds its auth lock there', async () => {
    fetchRemoteUser.mockResolvedValue(createUser('Player'));
    const { result } = setup();

    // Synchronous part of the callback only.
    await act(async () => { mockAuthCallback('SIGNED_IN', SESSION); });
    expect(fetchRemoteUser).not.toHaveBeenCalled();
    expect(result.current.authPhase).toBe('loading');

    // …the fetch happens only once the callback has returned.
    await act(async () => { jest.runAllTimers(); });
    await waitFor(() => expect(fetchRemoteUser).toHaveBeenCalled());
  });

  test('an existing profile lands ready and warms the cache with an owner tag', async () => {
    fetchRemoteUser.mockResolvedValue({ ...createUser('Player'), pokerScore: 1200 });
    const { result } = setup();

    await fireAndSettle('SIGNED_IN', SESSION);

    await waitFor(() => expect(result.current.authPhase).toBe('ready'));
    expect(result.current.user.pokerScore).toBe(1200);
    expect(cacheOwner()).toBe('uid-1'); // tagged: NOT migration data
    expect(track).toHaveBeenCalledWith('signed_in');
  });

  test('no profile yet routes to noprofile, leaving the cache untagged for migration', async () => {
    fetchRemoteUser.mockResolvedValue(null);
    const { result } = setup();

    await fireAndSettle('SIGNED_IN', SESSION);

    await waitFor(() => expect(result.current.authPhase).toBe('noprofile'));
    expect(cacheOwner()).toBeNull();
  });

  test('re-emitted events for the same uid do not refetch', async () => {
    fetchRemoteUser.mockResolvedValue(createUser('Player'));
    const { result } = setup();

    await fireAndSettle('SIGNED_IN', SESSION);
    await waitFor(() => expect(result.current.authPhase).toBe('ready'));
    await fireAndSettle('TOKEN_REFRESHED', SESSION);

    expect(fetchRemoteUser).toHaveBeenCalledTimes(1);
  });
});

// ── invalid_session recovery (founder walled in, July 6) ───────────────────
describe('invalid_session recovery', () => {
  test('a revoked session signs out locally and lands on SignIn, not UsernameEntry', async () => {
    const err = new Error('revoked'); err.code = 'invalid_session';
    fetchRemoteUser.mockRejectedValue(err);
    const { result } = setup();

    await fireAndSettle('SIGNED_IN', SESSION);

    await waitFor(() => expect(result.current.authPhase).toBe('signedout'));
    // Local scope only — the server already rejects this session.
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(track).toHaveBeenCalledWith('stale_session_cleared');
  });
});

// ── error vs noprofile (an existing account must never be restarted) ───────
describe('generic load failure', () => {
  test('a network blip is error, NOT noprofile — noprofile would restart the account', async () => {
    fetchRemoteUser.mockRejectedValue(new Error('network down'));
    const { result } = setup();

    await fireAndSettle('SIGNED_IN', SESSION);

    await waitFor(() => expect(result.current.authPhase).toBe('error'));
    expect(result.current.authPhase).not.toBe('noprofile');
    expect(track).toHaveBeenCalledWith('profile_load_failed', { message: 'network down' });
  });
});

// ── the migration payload (the receiving end of ROADMAP item 10) ──────────
// `handleCreateUser` decides what a brand-new account inherits, and it decides
// it from ONE signal: whether the local cache carries an owner tag. Both
// directions are load-bearing and fail in opposite ways — an untagged cache
// dropped loses a guest's or tester's real history, and a tagged cache
// migrated copies one account's stats into another (the two-accounts-one-phone
// leak, July 2026).
describe('handleCreateUser migration payload', () => {
  test('migrates an UNTAGGED cache — guest progress and tester history survive', async () => {
    saveUser({ ...createUser('Guest'), sessionsCompleted: 1, pokerScore: 700 });
    createRemoteProfile.mockResolvedValue(createUser('Real'));
    const { result } = setup();

    await act(async () => { await result.current.handleCreateUser('Real'); });

    expect(createRemoteProfile).toHaveBeenCalledWith(
      'Real', expect.objectContaining({ pokerScore: 700, sessionsCompleted: 1 }));
  });

  test('does NOT migrate an OWNER-TAGGED cache — a fresh account starts fresh', async () => {
    saveUser({ ...createUser('Other'), pokerScore: 1400 });
    setCacheOwner('uid-other');
    createRemoteProfile.mockResolvedValue(createUser('Real'));
    const { result } = setup();

    await act(async () => { await result.current.handleCreateUser('Real'); });

    expect(createRemoteProfile).toHaveBeenCalledWith('Real', null);
  });
});

// ── no-session events ──────────────────────────────────────────────────────
describe('no-session events', () => {
  test('a guest mid-session is left alone', async () => {
    const guestRef = { current: true };
    const { result } = renderHook(() => useAuthSession({ guestRef }));

    await fireAndSettle('INITIAL_SESSION', null);

    // Still the initial phase — the guest was not stomped back to SignIn.
    expect(result.current.authPhase).toBe('loading');
  });

  test('SIGNED_OUT drops an OWNER-TAGGED cache (two-accounts-one-phone leak)', async () => {
    saveUser({ ...createUser('Player'), pokerScore: 1200 });
    setCacheOwner('uid-1');
    const { result } = setup();

    await fireAndSettle('SIGNED_OUT', null);

    expect(localStorage.getItem('cr_user')).toBeNull();
    expect(cacheOwner()).toBeNull();
    expect(result.current.authPhase).toBe('signedout');
  });

  test('SIGNED_OUT KEEPS an untagged cache — it is a tester\'s history awaiting migration', async () => {
    saveUser({ ...createUser('Tester'), pokerScore: 900 });
    setup();

    await fireAndSettle('SIGNED_OUT', null);

    expect(JSON.parse(localStorage.getItem('cr_user')).pokerScore).toBe(900);
  });

  test('a no-session INITIAL_SESSION never clears the cache, tagged or not', async () => {
    saveUser({ ...createUser('Player'), pokerScore: 1200 });
    setCacheOwner('uid-1');
    setup();

    await fireAndSettle('INITIAL_SESSION', null);

    // Only SIGNED_OUT clears. This is the "Not you?" escape hatch's safety net.
    expect(localStorage.getItem('cr_user')).not.toBeNull();
  });
});
