import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, hasSupabase } from '../utils/supabase';
import { fetchRemoteUser, createRemoteProfile, updateDisplayName } from '../utils/db';
import { loadUser, saveUser, clearUser, setCacheOwner, cacheOwner } from '../utils/persistence';
import { createUser, RENAME_COOLDOWN_MS } from '../utils/session';
import { identify, resetAnalytics } from '../utils/analytics';
import { setSentryUser, clearSentryUser } from '../utils/sentry';
import { emitProfileCreated, emitProfileLoadFailed, emitSignedIn, emitStaleSessionCleared } from '../utils/events';

// ─── useAuthSession (MOD-002, Wave 3) ──────────────────────────────────────
// Who the player is: the auth listener, the profile that follows from it, and
// the three mutations that change identity (create, rename, leave).
//
// Lifted out of App.jsx as a pure move. Three pieces of this exist because of
// specific live incidents and must not be "simplified" without reading why:
//
//   1. The setTimeout(0) deferral. supabase-js holds its internal auth lock
//      while onAuthStateChange callbacks run, and fetchRemoteUser() needs that
//      same lock to attach its access token. Awaiting inline deadlocks when the
//      event fires mid-token-refresh — the "stuck on Shuffling up…" bug.
//   2. The invalid_session branch. Without it a revoked session walls the
//      player into UsernameEntry with no way forward (founder hit this live,
//      July 6).
//   3. The error/noprofile split. A network blip must NOT read as "no profile
//      yet" — that lands an existing player on the create-profile screen, and
//      submitting it starts their account over.
//
// `guestRef` is a parameter, not state owned here. A guest has no session, so a
// stray no-session event (INITIAL_SESSION, a tab-focus re-emit) would otherwise
// stomp them back to SignIn mid-session. It cannot be derived from `authPhase`:
// the guest handlers write it synchronously, while a state read inside this
// closure would lag by a render — which is exactly the window the bug lives in.

export function useAuthSession({ guestRef }) {
  const [user, setUser] = useState(() => (hasSupabase ? null : loadUser()));
  // 'local' (no Supabase keys — pre-Phase-2 behavior) | 'loading' | 'signedout'
  // | 'guest' (playing the free unauthenticated session) | 'noprofile'
  // (signed in, first visit) | 'error' (profile fetch failed — NOT the same
  // as noprofile; see the listener's catch) | 'ready'
  const [authPhase, setAuthPhase] = useState(hasSupabase ? 'loading' : 'local');

  // Tracks which user's profile is already loaded so later auth events
  // (hourly TOKEN_REFRESHED, tab-focus re-emits) don't refetch — or worse,
  // knock a ready user back to 'noprofile' on one flaky request.
  const loadedUidRef = useRef(null);

  useEffect(() => {
    if (!hasSupabase) return;
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (!session) {
        if (guestRef.current) return; // mid-guest-session: nothing to change
        loadedUidRef.current = null;
        // Explicit sign-out: the cached profile belongs to the account that
        // just left — drop it so it can't seed the NEXT account's profile
        // (two-accounts-one-phone stats leak, July 2026). Only OWNER-TAGGED
        // caches clear: an untagged cache is a pre-Supabase tester's real
        // history awaiting migration, and it must survive both a no-session
        // INITIAL_SESSION and a "Not you?" sign-out from UsernameEntry
        // (wrong-account escape hatch — the right account migrates it next).
        if (event === 'SIGNED_OUT' && cacheOwner()) clearUser();
        setUser(null);
        setAuthPhase('signedout');
        return;
      }
      identify(session.user.id);
      setSentryUser(session.user.id);
      if (event === 'SIGNED_IN') emitSignedIn();
      const uid = session.user.id;
      if (loadedUidRef.current === uid) return;
      // Deferred past the callback — see note 1 in the header. Supabase docs:
      // never await auth/db calls inside this callback.
      setTimeout(async () => {
        if (!active) return;
        try {
          const remote = await fetchRemoteUser();
          if (!active) return;
          loadedUidRef.current = uid;
          if (remote) {
            setUser(remote);
            saveUser(remote);   // localStorage stays a warm cache…
            setCacheOwner(uid); // …owned by this account, never migration data
            setAuthPhase('ready');
          } else {
            setAuthPhase('noprofile'); // first visit: pick a name (+ migrate local history)
          }
        } catch (err) {
          console.error('Failed to load profile', err);
          if (err?.code === 'invalid_session') {
            // Stale/revoked session — see note 2. Local scope: the server
            // already rejects the session, nothing to revoke there.
            emitStaleSessionCleared();
            await supabase.auth.signOut({ scope: 'local' });
            if (active) setAuthPhase('signedout');
            return;
          }
          // See note 3: a generic failure is 'error', never 'noprofile'.
          emitProfileLoadFailed(err?.message);
          if (active) setAuthPhase('error');
        }
      }, 0);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
    // `guestRef` is listed, not suppressed. It is a useRef object with a stable
    // identity for the component's whole life, so this stays a mount-once
    // listener — but exhaustive-deps can only PROVE a ref is stable when it can
    // see the useRef() call in the same scope. Across a hook boundary it can't,
    // and CI=true turns that warning into a red deploy (July 27, 2026).
  }, [guestRef]);

  const handleCreateUser = useCallback(async (username) => {
    if (hasSupabase) {
      // First sign-in: create the profile, migrating any pre-Supabase
      // localStorage history so existing testers keep their progress.
      // An owner-tagged cache is another signed-in account's warm copy,
      // NOT migration data — a fresh account starts fresh.
      const local = cacheOwner() ? null : loadUser();
      const created = await createRemoteProfile(username, local);
      setUser(created);
      saveUser(created);
      // Owner-tag from the uid already in hand (set when the listener routed
      // here) — an extra getUser() round-trip can fail after the profile was
      // created, leaving the cache untagged and the player looking at a
      // spurious "couldn't save" error.
      if (loadedUidRef.current) setCacheOwner(loadedUidRef.current);
      setAuthPhase('ready');
      emitProfileCreated();
    } else {
      const newUser = createUser(username);
      setUser(newUser);
      saveUser(newUser);
    }
  }, []);

  // Editable usernames (once per week). Supabase mode: the DB trigger is the
  // enforcement; local mode mirrors the same cooldown client-side. Initials
  // derive from the new name, matching first-time creation.
  const handleRename = useCallback(async (username) => {
    let changedAt;
    if (hasSupabase) {
      const row = await updateDisplayName(username);
      changedAt = row?.username_changed_at ?? new Date().toISOString();
    } else {
      const last = user.usernameChangedAt;
      if (last && Date.now() - new Date(last).getTime() < RENAME_COOLDOWN_MS) {
        const err = new Error('Username was changed within the last week');
        err.code = 'rate_limited';
        throw err;
      }
      changedAt = new Date().toISOString();
    }
    const updated = {
      ...user,
      displayName: username,
      initials: username.slice(0, 2).toUpperCase(),
      usernameChangedAt: changedAt,
    };
    setUser(updated);
    saveUser(updated);
  }, [user]);

  // The caller chains its own session reset onto this — the session hook is
  // constructed after this one, so it can't be a dependency here.
  const signOut = useCallback(async () => {
    if (!hasSupabase) return;
    await supabase.auth.signOut();
    resetAnalytics(); // next visitor on this device gets a fresh identity
    clearSentryUser();
  }, []);

  // Escape hatch on UsernameEntry — without it a wrong or broken auth state
  // walls the player in (no back to SignIn, no forward past profile create)
  const handleSwitchAccount = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' });
    resetAnalytics();
    clearSentryUser();
  }, []);

  return {
    user, setUser, authPhase, setAuthPhase, loadedUidRef,
    handleCreateUser, handleRename, signOut, handleSwitchAccount,
  };
}
