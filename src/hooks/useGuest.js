import { useRef, useCallback } from 'react';
import { loadUser, saveUser, cacheOwner } from '../utils/persistence';
import { createUser } from '../utils/session';
import { track } from '../utils/analytics';

// ─── useGuest (MOD-002, Wave 3) ────────────────────────────────────────────
// The unauthenticated free session and the gate that ends it.
//
// Guest gate (founder decision July 8): one full free session, no account —
// then a free sign-in to continue. Guest progress migrates on first sign-in via
// the same untagged-cache path pre-Supabase testers use. Client-side gate only:
// the sole paid surface (coach read) is already server-gated.
//
// Lifted out of App.jsx as a pure move — same state, same handlers, same
// scroll side effects. The caller keeps `authPhase`, `user` and `screen`; this
// hook reads them and reports what the guest rules say about them.
//
// `guestRef` is returned rather than kept private because useAuthSession's
// onAuthStateChange closure has to read it: a stray no-session auth event
// (INITIAL_SESSION, a tab-focus re-emit) must NOT stomp a guest mid-session
// back to SignIn, and that callback cannot see `authPhase` through its own
// closure. The ref is the cross-hook channel; that is why useGuest lands first.

export const GUEST_FREE_SESSIONS = 1;
export const GUEST_NAME = 'Guest';

export function useGuest({ authPhase, setAuthPhase, user, setUser, setScreen }) {
  const guestRef = useRef(false);
  const isGuest = authPhase === 'guest';

  // The gate itself: a guest who has spent the free session. Drives both the
  // Dashboard's gated state and the "Deal Me In" interception.
  const guestGated = isGuest && (user?.sessionsCompleted ?? 0) >= GUEST_FREE_SESSIONS;

  // "Try a free session" from SignIn: play as an untagged local profile — the
  // exact shape first sign-in already migrates (pre-Supabase tester path).
  const handleGuestPlay = useCallback(() => {
    track('guest_play_clicked');
    const existing = cacheOwner() ? null : loadUser();
    const guest = existing ?? createUser(GUEST_NAME);
    if (!existing) saveUser(guest);
    guestRef.current = true;
    setUser(guest);
    setAuthPhase('guest');
    // Straight toward the cards (founder decision July 8): level pick, then deal
    setScreen('difficulty');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setUser, setAuthPhase, setScreen]);

  // Guest → SignIn (gate hit, or they chose to sign in). Progress stays in the
  // untagged cache and migrates on account creation.
  const handleGuestSignIn = useCallback((from) => {
    track('guest_gate_signin', { from });
    guestRef.current = false;
    setScreen('dashboard');
    setAuthPhase('signedout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setAuthPhase, setScreen]);

  // What the SignIn screen should offer. A function, not a computed value: it
  // reads localStorage, and the signed-out branch is the only caller — hoisting
  // it into the hook body would read the cache on every App render instead.
  //
  // Untagged cache = guest progress or a pre-Supabase tester's history. A
  // used-up guest sees the carry-over note instead of the guest CTA; a tester
  // (real name) sees neither — signing in migrates their history.
  const guestOffer = useCallback(() => {
    const local = cacheOwner() ? null : loadUser();
    const guestUsed = local?.displayName === GUEST_NAME
      && (local?.sessionsCompleted ?? 0) >= GUEST_FREE_SESSIONS;
    const canGuest = !guestUsed && (!local || local.displayName === GUEST_NAME);
    return { guestUsed, canGuest };
  }, []);

  return { isGuest, guestGated, guestRef, handleGuestPlay, handleGuestSignIn, guestOffer };
}
