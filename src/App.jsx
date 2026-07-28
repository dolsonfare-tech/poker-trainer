import { useState, useEffect, useRef } from 'react';
import './App.css';
import { loadUser, saveUser, clearUser, setCacheOwner, cacheOwner, createUser, RENAME_COOLDOWN_MS, loadLastDifficulty } from './utils/userStorage';
import { useSessionRun, TIMER_SECONDS } from './hooks/useSessionRun';
import { useGuest, GUEST_NAME } from './hooks/useGuest';
import { supabase, hasSupabase } from './utils/supabase';
import { fetchRemoteUser, createRemoteProfile, updateDisplayName } from './utils/db';
import { track, identify, resetAnalytics } from './utils/analytics';
import { setSentryUser, clearSentryUser } from './utils/sentry';
import ScenarioCard from './components/ScenarioCard';
import SessionSummary from './components/SessionSummary';
import VillainGuide from './components/VillainGuide';
import DifficultySelector from './components/DifficultySelector';
import Dashboard from './components/Dashboard';
import TableReads from './components/TableReads';
import UsernameEntry from './components/UsernameEntry';
import SignIn from './components/SignIn';

// ─── Utility ──────────────────────────────────────────────────────────────
// Deal via the session builder (utils/spacedrep.js): unseen scenarios first,
// two slots weighted toward the player's weakest skills, at most one
// resurfaced miss. `pendingHands` covers session chaining — when "Deal Next
// Session" fires before the coach-read persist has landed, the just-played
// hands are merged in so they can't be re-dealt immediately. When the
// persist HAS landed they're already in user.scenarioHistory (lastSeenAt ===
// the current session count), so the merge is skipped to keep the cooldown
// clock exact.
// ─── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  // null = closed; {} = open on default tab; { focus } = open scrolled to
  // that villain archetype (tapping the villain read on the table)
  const [guide, setGuide]                         = useState(null);
  const [user, setUser]                           = useState(() => (hasSupabase ? null : loadUser()));
  // 'local' (no Supabase keys — pre-Phase-2 behavior) | 'loading' | 'signedout'
  // | 'guest' (playing the free unauthenticated session) | 'noprofile'
  // (signed in, first visit) | 'error' (profile fetch failed — NOT the same
  // as noprofile; see the auth listener's catch) | 'ready'
  const [authPhase, setAuthPhase]                 = useState(hasSupabase ? 'loading' : 'local');
  const [screen, setScreen]                       = useState('dashboard');

  // ── Auth lifecycle (Supabase mode only) ──────────────────────────────────
  // Tracks which user's profile is already loaded so later auth events
  // (hourly TOKEN_REFRESHED, tab-focus re-emits) don't refetch — or worse,
  // knock a ready user back to 'noprofile' on one flaky request.
  const loadedUidRef = useRef(null);

  // ── Guest flow (MOD-002, Wave 3) ─────────────────────────────────────────
  // The free unauthenticated session, its gate, and what SignIn should offer.
  // `guestRef` is read by the auth listener below: a stray no-session event
  // must not stomp a guest mid-session back to SignIn, and that callback's
  // closure can't see `authPhase`.
  const {
    isGuest, guestGated, guestRef,
    handleGuestPlay, handleGuestSignIn, guestOffer,
  } = useGuest({ authPhase, setAuthPhase, user, setUser, setScreen });

  // ── Session run (MOD-002, Wave 3) ────────────────────────────────────────
  // The deal, the per-hand loop, the end-of-session delta and the submitSession
  // hand-off now live in hooks/useSessionRun.js. App keeps identity (`user`)
  // and routing (`screen`); the hook reads both and reports what changed.
  const {
    scenario, shuffledScenarios, currentIndex, difficulty,
    decided, feedback, timedOut, combo, correctCount,
    showSummary, sessionDelta, sessionHistory, skillResults,
    coachRead, coachLoading, coachLimited,
    handleDifficultySelect, handlePlayAgain,
    handleDecision, handleTimeout, handleNext, handleRestart,
  } = useSessionRun({ user, setUser, isGuest, screen, setScreen });

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
      if (event === 'SIGNED_IN') track('signed_in');
      const uid = session.user.id;
      if (loadedUidRef.current === uid) return;
      // Deferred past the callback: supabase-js holds its internal auth lock
      // while onAuthStateChange callbacks run, and fetchRemoteUser() needs
      // that same lock to attach its access token. Awaiting it inline can
      // deadlock when the event fires mid-token-refresh (returning to the
      // site with an expired token), leaving the app stuck on "Shuffling
      // up…" until a reload. Supabase docs: never await auth/db calls
      // inside this callback.
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
            // Stale/revoked session: clear it and land on SignIn — otherwise
            // the player is walled into UsernameEntry with a dead session
            // (founder hit this live, July 6). Local scope: the server
            // already rejects the session, nothing to revoke there.
            track('stale_session_cleared');
            await supabase.auth.signOut({ scope: 'local' });
            if (active) setAuthPhase('signedout');
            return;
          }
          // Generic failure (network blip, Supabase 5xx) must NOT read as
          // "no profile yet": that lands an existing player on the create-
          // profile screen, and submitting it would start their account
          // over. Surface the failure and let them retry instead.
          track('profile_load_failed', { message: err?.message });
          if (active) setAuthPhase('error');
        }
      }, 0);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
    // `guestRef` is the object returned by useRef inside useGuest — a stable
    // identity for the component's whole life, so listing it keeps this a
    // mount-once listener. It became a required dep when the ref moved into a
    // hook: exhaustive-deps can no longer see the useRef call, and CI=true
    // promotes that warning to a build failure (red deploy, July 27 2026).
  }, [guestRef]);

  // History holds exactly one entry per hand slot — a duplicate append for the
  // same hand (e.g. a double-fired timeout) is dropped, protecting the summary
  // display, IQ delta, and stored accuracy in one place.

  const handleStartSession = () => {
    if (guestGated) {
      handleGuestSignIn('dashboard'); // gate: the free session is used
      return;
    }
    setScreen('difficulty');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Table Reads — signed-in users only (guests have one gated session; a
  // second free mode would blur that gate). Mode-local scoring, see TableReads.
  const handleOpenTableReads = () => {
    setScreen('tablereads'); // TableReads tracks table_reads_started on mount
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };




  const handleCreateUser = async (username) => {
    if (hasSupabase) {
      // First sign-in: create the profile, migrating any pre-Supabase
      // localStorage history so existing testers keep their progress.
      // An owner-tagged cache is another signed-in account's warm copy,
      // NOT migration data — a fresh account starts fresh.
      const local = cacheOwner() ? null : loadUser();
      const created = await createRemoteProfile(username, local);
      setUser(created);
      saveUser(created);
      // Owner-tag from the uid already in hand (set when the auth listener
      // routed here) — an extra getUser() round-trip can fail after the
      // profile was created, leaving the cache untagged and the player
      // looking at a spurious "couldn't save" error.
      if (loadedUidRef.current) setCacheOwner(loadedUidRef.current);
      setAuthPhase('ready');
      track('profile_created');
    } else {
      const newUser = createUser(username);
      setUser(newUser);
      saveUser(newUser);
    }
  };

  // Editable usernames (once per week). Supabase mode: the DB trigger is the
  // enforcement; local mode mirrors the same cooldown client-side. Initials
  // derive from the new name, matching first-time creation.
  const handleRename = async (username) => {
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
  };

  // No confirm dialog: the account menu (Dashboard topbar) is the deliberate
  // second tap, and the native window.confirm read as cheap.
  const handleSignOut = async () => {
    if (!hasSupabase) return;
    await supabase.auth.signOut();
    resetAnalytics(); // next visitor on this device gets a fresh identity
    clearSentryUser();
    handleRestart();
  };

  // Escape hatch on UsernameEntry — without it a wrong or broken auth state
  // walls the player in (no back to SignIn, no forward past profile create)
  const handleSwitchAccount = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    resetAnalytics();
    clearSentryUser();
  };

  if (authPhase === 'loading') {
    return (
      <div className="ue-screen">
        <div className="ue-card">
          <div className="ue-logo">Check<em>Raise</em></div>
          <div className="ue-subtitle" style={{ textAlign: 'center' }}>Shuffling up…</div>
        </div>
      </div>
    );
  }
  if (authPhase === 'error') {
    return (
      <div className="ue-screen">
        <div className="ue-card">
          <div className="ue-logo">Check<em>Raise</em></div>
          <div className="ue-title">Couldn't reach your profile</div>
          <div className="ue-subtitle" style={{ textAlign: 'center' }}>
            Your progress is safe — this is a connection hiccup, not a lost account.
          </div>
          <button className="ue-submit-btn" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (authPhase === 'signedout') {
    const { guestUsed, canGuest } = guestOffer();
    return <SignIn onGuestPlay={canGuest ? handleGuestPlay : undefined} guestUsed={guestUsed} />;
  }
  if (authPhase === 'noprofile' || !user) {
    const localName = cacheOwner() ? undefined : loadUser()?.displayName;
    return (
      <UsernameEntry
        onSubmit={handleCreateUser}
        defaultName={localName === GUEST_NAME ? undefined : localName}
        onSwitchAccount={hasSupabase ? handleSwitchAccount : undefined}
      />
    );
  }

  return (
    <div className="app">
      <div className="header">
        <div
          className="logo"
          style={{ cursor: screen !== 'dashboard' ? 'pointer' : 'default' }}
          onClick={() => screen !== 'dashboard' && handleRestart()}
        >
          Check<em>Raise</em>
        </div>
        <div className="tagline">Find the leak in your game</div>
        <button className="info-btn" aria-label="Open the guide" onClick={() => setGuide({})}>i</button>
      </div>

      {guide && <VillainGuide onClose={() => setGuide(null)} focus={guide.focus} initialTab={guide.tab} skills={user?.skills} />}

      {screen === 'dashboard' && (
        <Dashboard
          onStartSession={handleStartSession}
          user={user}
          sessionDelta={sessionDelta}
          onSignOut={handleSignOut}
          onRename={handleRename}
          guest={isGuest}
          guestGated={guestGated}
          onGuestSignIn={handleGuestSignIn}
          onTableReads={!isGuest ? handleOpenTableReads : undefined}
          onSchemaInfo={(name) => {
            track('schema_guide_opened', { schema: name });
            setGuide({ focus: name, tab: 'schemas' });
          }}
        />
      )}

      {screen === 'tablereads' && (
        <TableReads
          onBack={() => setScreen('dashboard')}
          onOpenGuide={(label) => {
            track('villain_guide_opened', { from: 'tablereads' });
            setGuide({ focus: label });
          }}
        />
      )}

      {screen === 'difficulty' && (
        <DifficultySelector onSelect={handleDifficultySelect} initialDifficulty={loadLastDifficulty()} />
      )}

      {screen === 'session' && (
        <div className="session-container">
          {showSummary ? (
            <SessionSummary
              skillResults={skillResults}
              sessionHistory={sessionHistory}
              coachRead={coachRead}
              coachLoading={coachLoading}
              coachLimited={coachLimited}
              difficulty={difficulty}
              userSkills={sessionDelta?.prevSkills ?? user.skills}
              recentHands={sessionDelta?.prevRecentHands ?? user.recentHands}
              streakSecured={sessionDelta?.streakSecured ?? null}
              rebuyUsed={sessionDelta?.rebuyUsed ?? false}
              streakBroken={sessionDelta?.streakBroken ?? false}
              activeDaysLast30={sessionDelta?.activeDaysLast30 ?? null}
              prevBest={sessionDelta?.prevBest ?? null}
              guest={isGuest}
              onGuestSignIn={handleGuestSignIn}
              onPlayAgain={handlePlayAgain}
              onRestart={handleRestart}
            />
          ) : (
            <>
              <ScenarioCard
                scenario={scenario}
                currentIndex={currentIndex}
                total={shuffledScenarios.length}
                totalSeconds={TIMER_SECONDS}
                correctCount={correctCount}
                combo={combo}
                options={scenario.options}
                onDecision={handleDecision}
                decided={decided}
                showTimer={difficulty !== 'beginner'}
                onTimeout={handleTimeout}
                feedback={feedback}
                timedOut={timedOut}
                onNext={handleNext}
                nextLabel={currentIndex < shuffledScenarios.length - 1 ? 'Next Hand →' : 'See My Results →'}
                onVillainInfo={(label) => {
                  track('villain_guide_opened', { from: 'table', scenario_id: scenario.id });
                  setGuide({ focus: label });
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}