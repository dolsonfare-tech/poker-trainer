// useGuest (MOD-002, Wave 3).
//
// The guest rules were previously reachable only through App.guest.test.js,
// which walks a whole five-hand session to assert them. That test stays — it is
// the end-to-end guard — but it can only cover the ONE path a cold visitor
// takes. The branches that matter most are the ones it cannot reach: an
// owner-tagged cache (another account's warm copy must never be adopted as
// guest progress), a pre-Supabase tester's real-name cache, and a signed-in
// user whose session count is past the guest limit but who is not a guest.
//
// Driven with renderHook against the real persistence module, so the
// localStorage shapes asserted here are the same ones sign-in migrates.
import { renderHook, act } from '@testing-library/react';

jest.mock('../utils/analytics', () => ({ track: jest.fn() }));

import { useGuest, GUEST_NAME, GUEST_FREE_SESSIONS } from './useGuest';
import { loadUser, saveUser, setCacheOwner } from '../utils/persistence';
import { createUser } from '../utils/session';
import { track } from '../utils/analytics';

// `guestRef` is owned by the composition root (App), not by the hook — it is
// the channel useAuthSession's listener reads. Tests supply their own, which is
// also the cheapest way to assert the synchronous writes.
const setup = (over = {}) => {
  const setUser = jest.fn();
  const setAuthPhase = jest.fn();
  const setScreen = jest.fn();
  const guestRef = over.guestRef ?? { current: false };
  const props = {
    authPhase: 'signedout', user: null,
    setUser, setAuthPhase, setScreen, ...over, guestRef,
  };
  const view = renderHook((p) => useGuest(p), { initialProps: props });
  return { ...view, setUser, setAuthPhase, setScreen, guestRef };
};

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  window.scrollTo = jest.fn();
});

// ── handleGuestPlay ────────────────────────────────────────────────────────
describe('handleGuestPlay', () => {
  test('creates an UNTAGGED guest profile — the shape first sign-in migrates', () => {
    const { result, setUser, setAuthPhase, setScreen, guestRef } = setup();

    act(() => { result.current.handleGuestPlay(); });

    const stored = loadUser();
    expect(stored.displayName).toBe(GUEST_NAME);
    expect(stored.sessionsCompleted).toBe(0);
    // Untagged is the whole point: an owner tag would make sign-in treat this
    // as another account's warm cache and drop the guest's progress.
    expect(localStorage.getItem('cr_user_owner')).toBeNull();

    expect(setUser).toHaveBeenCalledWith(stored);
    expect(setAuthPhase).toHaveBeenCalledWith('guest');
    expect(setScreen).toHaveBeenCalledWith('difficulty'); // level pick, not dashboard
    expect(guestRef.current).toBe(true);
    expect(track).toHaveBeenCalledWith('guest_play_clicked');
  });

  test('resumes an existing untagged cache instead of overwriting its progress', () => {
    const partway = { ...createUser(GUEST_NAME), sessionsCompleted: 0, pokerScore: 812 };
    saveUser(partway);

    const { result, setUser } = setup();
    act(() => { result.current.handleGuestPlay(); });

    expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ pokerScore: 812 }));
    expect(loadUser().pokerScore).toBe(812);
  });

  test('does NOT adopt an owner-tagged cache — a signed-out account is not a guest', () => {
    saveUser({ ...createUser('RealPlayer'), pokerScore: 1400 });
    setCacheOwner('uid-abc');

    const { result, setUser } = setup();
    act(() => { result.current.handleGuestPlay(); });

    // A fresh Guest is minted; the tagged profile's stats are not handed over.
    const handed = setUser.mock.calls[0][0];
    expect(handed.displayName).toBe(GUEST_NAME);
    expect(handed.pokerScore).toBeNull();
    // …the tagged cache is replaced by the new guest…
    expect(loadUser().displayName).toBe(GUEST_NAME);
    // …AND the stale owner tag goes with the profile it described. This is the
    // regression pin for the stranded-progress bug (ROADMAP item 10, fixed
    // 2026-07-27): a surviving tag makes sign-in read this guest's progress as
    // another account's warm cache and DROP it instead of migrating it.
    expect(localStorage.getItem('cr_user_owner')).toBeNull();
  });
});

// ── handleGuestSignIn ──────────────────────────────────────────────────────
describe('handleGuestSignIn', () => {
  test('drops the guest flag and routes to SignIn, tagging where the gate fired', () => {
    const guestRef = { current: true }; // mid-guest-session
    const { result, setAuthPhase, setScreen } = setup({ authPhase: 'guest', guestRef });

    act(() => { result.current.handleGuestSignIn('summary'); });

    expect(guestRef.current).toBe(false);
    expect(setScreen).toHaveBeenCalledWith('dashboard');
    expect(setAuthPhase).toHaveBeenCalledWith('signedout');
    expect(track).toHaveBeenCalledWith('guest_gate_signin', { from: 'summary' });
  });

  test('leaves the cache intact — it is the migration payload for sign-in', () => {
    saveUser({ ...createUser(GUEST_NAME), sessionsCompleted: GUEST_FREE_SESSIONS });

    const { result } = setup({ authPhase: 'guest' });
    act(() => { result.current.handleGuestSignIn('dashboard'); });

    expect(loadUser().sessionsCompleted).toBe(GUEST_FREE_SESSIONS);
    expect(localStorage.getItem('cr_user_owner')).toBeNull();
  });
});

// ── guestGated ─────────────────────────────────────────────────────────────
describe('guestGated', () => {
  test('opens at zero sessions and closes once the free session is spent', () => {
    const fresh = setup({ authPhase: 'guest', user: { sessionsCompleted: 0 } });
    expect(fresh.result.current.guestGated).toBe(false);

    const spent = setup({
      authPhase: 'guest', user: { sessionsCompleted: GUEST_FREE_SESSIONS },
    });
    expect(spent.result.current.guestGated).toBe(true);
  });

  test('never gates a signed-in player, however many sessions they have', () => {
    const { result } = setup({ authPhase: 'ready', user: { sessionsCompleted: 99 } });
    expect(result.current.isGuest).toBe(false);
    expect(result.current.guestGated).toBe(false);
  });

  test('treats a missing session count as zero rather than gating on undefined', () => {
    const { result } = setup({ authPhase: 'guest', user: {} });
    expect(result.current.guestGated).toBe(false);
  });
});

// ── guestOffer ─────────────────────────────────────────────────────────────
describe('guestOffer', () => {
  test('cold visitor is offered the free session', () => {
    const { result } = setup();
    expect(result.current.guestOffer()).toEqual({ guestUsed: false, canGuest: true });
  });

  test('used-up guest gets the carry-over note, not the CTA', () => {
    saveUser({ ...createUser(GUEST_NAME), sessionsCompleted: GUEST_FREE_SESSIONS });
    const { result } = setup();
    expect(result.current.guestOffer()).toEqual({ guestUsed: true, canGuest: false });
  });

  test('pre-Supabase tester (real name, untagged) gets neither — sign-in migrates them', () => {
    saveUser({ ...createUser('Tester'), sessionsCompleted: 12 });
    const { result } = setup();
    expect(result.current.guestOffer()).toEqual({ guestUsed: false, canGuest: false });
  });

  test('an owner-tagged cache is invisible here — it is not migration data', () => {
    saveUser({ ...createUser('RealPlayer'), sessionsCompleted: 12 });
    setCacheOwner('uid-abc');
    const { result } = setup();
    expect(result.current.guestOffer()).toEqual({ guestUsed: false, canGuest: true });
  });
});
