import { useState, useCallback, useEffect, useRef } from 'react';
import './App.css';
import SCENARIOS from './data/scenarios';
import { fetchCoachRead } from './utils/claude';
import { loadUser, saveUser, clearUser, setCacheOwner, cacheOwner, createUser, applySessionResults, calcStreak, toLocalDateString, RENAME_COOLDOWN_MS, loadLastDifficulty, saveLastDifficulty } from './utils/userStorage';
import { buildSession, applyHandsToHistory } from './utils/spacedrep';
import { supabase, hasSupabase } from './utils/supabase';
import { fetchRemoteUser, createRemoteProfile, saveRemoteUser, recordSession, updateDisplayName } from './utils/db';
import { track, identify, resetAnalytics } from './utils/analytics';
import { setSentryUser, clearSentryUser } from './utils/sentry';
import ScenarioCard, { USE_SINGLE_CANVAS } from './components/ScenarioCard';
import FeedbackPanel from './components/FeedbackPanel';
import SessionSummary from './components/SessionSummary';
import VillainGuide from './components/VillainGuide';
import DifficultySelector from './components/DifficultySelector';
import Dashboard from './components/Dashboard';
import TableReads from './components/TableReads';
import UsernameEntry from './components/UsernameEntry';
import SignIn from './components/SignIn';

// ─── Constants ────────────────────────────────────────────────────────────
const SESSION_LENGTH = 5;
const TIMER_SECONDS = 60; // HARDCODED — pull from user settings in Phase 2
// Guest gate (founder decision July 8): one full free session, no account —
// then a free sign-in to continue. Guest progress migrates on first sign-in
// via the same untagged-cache path pre-Supabase testers use. Client-side
// gate only: the sole paid surface (coach read) is already server-gated.
const GUEST_FREE_SESSIONS = 1;
const GUEST_NAME = 'Guest';

// ─── Utility ──────────────────────────────────────────────────────────────
// Deal via the session builder (utils/spacedrep.js): unseen scenarios first,
// two slots weighted toward the player's weakest skills, at most one
// resurfaced miss. `pendingHands` covers session chaining — when "Deal Next
// Session" fires before the coach-read persist has landed, the just-played
// hands are merged in so they can't be re-dealt immediately. When the
// persist HAS landed they're already in user.scenarioHistory (lastSeenAt ===
// the current session count), so the merge is skipped to keep the cooldown
// clock exact.
function dealScenarios(difficulty, user, pendingHands = []) {
  const pool = SCENARIOS.filter(s => s.difficulty === difficulty);
  const played = user?.sessionsCompleted ?? 0;
  const priorHistory = user?.scenarioHistory ?? {};
  const today = toLocalDateString(new Date());
  const alreadyApplied = pendingHands.length > 0 &&
    pendingHands.every(h => priorHistory[h.scenarioId]?.lastSeenAt === played);
  const merge = pendingHands.length > 0 && !alreadyApplied;
  const sessionsCompleted = merge ? played + 1 : played;
  // Merge with today's date so a just-played same-day miss is stamped for the
  // R2 day floor and can't resurface in the very next chained deal.
  const history = merge
    ? applyHandsToHistory(priorHistory, pendingHands, sessionsCompleted, today)
    : priorHistory;
  return buildSession(pool, {
    history,
    skills: user?.skills ?? {},
    sessionsCompleted,
    length: SESSION_LENGTH,
    currentDate: today,
  });
}

function ProgressDots({ total, current }) {
  return (
    <div className="progress">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`pdot ${i < current ? 'done' : i === current ? 'current' : ''}`} />
      ))}
    </div>
  );
}

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
  const [difficulty, setDifficulty]               = useState('beginner');
  const [shuffledScenarios, setShuffledScenarios] = useState([]);
  const [currentIndex, setCurrentIndex]           = useState(0);
  const [skillResults, setSkillResults]           = useState({});
  const [decided, setDecided]                     = useState(false);
  const [feedback, setFeedback]                   = useState(null);
  const [showSummary, setShowSummary]             = useState(false);
  const [coachRead, setCoachRead]                 = useState('');
  const [coachLoading, setCoachLoading]           = useState(false);
  const [coachLimited, setCoachLimited]           = useState(false);
  const [timedOut, setTimedOut]                   = useState(false);
  const [combo, setCombo]                         = useState(0);
  const [correctCount, setCorrectCount]           = useState(0);
  const [sessionHistory, setSessionHistory]       = useState([]);
  const [sessionDelta, setSessionDelta]           = useState(null);
  const sessionUserRef                            = useRef(null);
  // Synchronous decided guard — state/effect updates can lag in throttled
  // background tabs, so this ref is the authoritative "already answered" flag
  const decidedRef                                = useRef(false);
  // Stamp when the current scenario was presented, so a decision can record
  // decisionMs (F2: fast + wrong ≈ a confident miss — the resurface ladder and
  // the coach payload lean on it).
  const shownAtRef                                = useRef(null);

  const scenario = shuffledScenarios[currentIndex];

  // Re-stamp on entering the session and on every new hand.
  useEffect(() => {
    if (screen === 'session') shownAtRef.current = Date.now();
  }, [currentIndex, screen]);

  // ── Auth lifecycle (Supabase mode only) ──────────────────────────────────
  // Tracks which user's profile is already loaded so later auth events
  // (hourly TOKEN_REFRESHED, tab-focus re-emits) don't refetch — or worse,
  // knock a ready user back to 'noprofile' on one flaky request.
  const loadedUidRef = useRef(null);
  // Guests have no session, so a stray no-session auth event must not stomp
  // their in-progress state back to the SignIn screen (ref: the listener's
  // closure can't see authPhase)
  const guestRef = useRef(false);
  const isGuest = authPhase === 'guest';

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
  }, []);

  // History holds exactly one entry per hand slot — a duplicate append for the
  // same hand (e.g. a double-fired timeout) is dropped, protecting the summary
  // display, IQ delta, and stored accuracy in one place.
  const appendHistory = useCallback((idx, entry) => {
    setSessionHistory(prev => (prev.length > idx ? prev : [...prev, entry]));
  }, []);

  // Countdown lives inside TimerRing (ScenarioCard) — this only handles expiry
  const handleTimeout = useCallback(() => {
    if (!scenario || decided || decidedRef.current) return;
    decidedRef.current = true;
    setTimedOut(true);
    setDecided(true);
    setSkillResults(prev => ({ ...prev, [scenario.skill]: 'incorrect' }));
    // A timeout froze on the decision — slow-wrong, the opposite of a confident
    // miss — so decisionMs is null, never counted as a fast error.
    appendHistory(currentIndex, { scenario, choiceVal: null, result: 'incorrect', decisionMs: null });
    track('decision_made', { scenario_id: scenario.id, skill: scenario.skill, result: 'incorrect', timed_out: true, replay: !!scenario.replay });
    setCombo(0);
    const correctGrading = scenario.grading[scenario.correct];
    setFeedback({ grade: { ...correctGrading, skill: scenario.tag }, loading: false, text: scenario.feedback.correct, choice: null });
    // Canvas layout: feedback overlays the table at the top; legacy: it appears below
    setTimeout(() => window.scrollTo({ top: USE_SINGLE_CANVAS ? 0 : document.body.scrollHeight, behavior: 'smooth' }), 50);
  }, [scenario, decided, currentIndex, appendHistory]);

  const handleStartSession = () => {
    if (isGuest && (user?.sessionsCompleted ?? 0) >= GUEST_FREE_SESSIONS) {
      handleGuestSignIn('dashboard'); // gate: the free session is used
      return;
    }
    setScreen('difficulty');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Guest flow ────────────────────────────────────────────────────────────
  // "Try a free session" from SignIn: play as an untagged local profile —
  // the exact shape first sign-in already migrates (pre-Supabase tester path).
  const handleGuestPlay = () => {
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
  };

  // Guest → SignIn (gate hit, or they chose to sign in). Progress stays in
  // the untagged cache and migrates on account creation.
  const handleGuestSignIn = (from) => {
    track('guest_gate_signin', { from });
    guestRef.current = false;
    setScreen('dashboard');
    setAuthPhase('signedout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Shared by the difficulty screen and summary chaining — resets every piece
  // of per-session state so a chained session can't inherit the last one's.
  const startSession = (selected, { chained = false } = {}) => {
    decidedRef.current = false;
    setDifficulty(selected);
    saveLastDifficulty(selected);
    const pending = chained
      ? sessionHistory.map(h => ({ scenarioId: h.scenario.id, result: h.result, decisionMs: h.decisionMs ?? null }))
      : [];
    setShuffledScenarios(dealScenarios(selected, user, pending));
    setCurrentIndex(0);
    setSkillResults({});
    setDecided(false);
    setFeedback(null);
    setShowSummary(false);
    setCoachRead('');
    setCoachLimited(false);
    setTimedOut(false);
    setCombo(0);
    setCorrectCount(0);
    setSessionHistory([]);
    setSessionDelta(null);
    setScreen('session');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    track('session_started', { difficulty: selected, chained, guest: isGuest });
  };

  const handleDifficultySelect = (selected) => startSession(selected);

  // One-tap "Deal Next Session" from the summary — same difficulty, no
  // dashboard/difficulty-screen round trip between sessions.
  const handlePlayAgain = () => startSession(difficulty, { chained: true });

  // Table Reads — signed-in users only (guests have one gated session; a
  // second free mode would blur that gate). Mode-local scoring, see TableReads.
  const handleOpenTableReads = () => {
    setScreen('tablereads'); // TableReads tracks table_reads_started on mount
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFetchCoachRead = async () => {
    const prevUser = sessionUserRef.current;
    // Every hand played counts toward accuracy — not the per-skill deduped
    // results. decisionMs rides along (additive, no schema change): it derives
    // the confident-miss flag for the R1 ladder and the coach payload (F2).
    const hands = sessionHistory.map(h => ({
      scenarioId: h.scenario.id, skill: h.scenario.skill,
      result: h.result, choiceVal: h.choiceVal, decisionMs: h.decisionMs ?? null,
    }));
    const persist = (updated, coachText) => {
      setUser(updated);
      saveUser(updated); // localStorage cache always
      if (hasSupabase && !isGuest) {
        saveRemoteUser(updated).catch(err => console.error('Profile save failed', err));
        recordSession({
          difficulty,
          hands,
          correctCount: hands.filter(h => h.result === 'correct').length,
          coachRead: coachText,
        }).catch(err => console.error('Session log failed', err));
      }
    };
    // Guests get no coach read (the endpoint requires a signed-in user — it's
    // the sign-in carrot, and the summary says so honestly). Results still
    // persist locally so they migrate into the account later.
    if (isGuest) {
      if (prevUser) persist(applySessionResults(prevUser, hands, null), null);
      return;
    }
    setCoachLoading(true);
    try {
      const text = await fetchCoachRead(sessionHistory);
      setCoachRead(text);
      if (prevUser) persist(applySessionResults(prevUser, hands, text), text);
    } catch (err) {
      if (err?.code === 'daily_limit') setCoachLimited(true);
      setCoachRead('');
      if (prevUser) persist(applySessionResults(prevUser, hands, null), null);
    }
    setCoachLoading(false);
  };

  const handleDecision = useCallback((choice) => {
    if (decided || decidedRef.current) return;
    decidedRef.current = true;
    setDecided(true);
    setTimedOut(false);
    const gr = scenario.grading[choice];
    const decisionMs = shownAtRef.current ? Date.now() - shownAtRef.current : null;
    setSkillResults(prev => ({ ...prev, [scenario.skill]: gr.g }));
    appendHistory(currentIndex, { scenario, choiceVal: choice, result: gr.g, decisionMs });
    track('decision_made', { scenario_id: scenario.id, skill: scenario.skill, result: gr.g, timed_out: false, replay: !!scenario.replay });
    if (gr.g === 'correct') {
      setCombo(prev => prev + 1);
      setCorrectCount(prev => prev + 1);
    } else {
      setCombo(0);
    }
    const feedbackText = scenario.feedback[gr.g];
    setFeedback({ grade: { ...gr, skill: scenario.tag }, loading: false, text: feedbackText, choice });
    setTimeout(() => window.scrollTo({ top: USE_SINGLE_CANVAS ? 0 : document.body.scrollHeight, behavior: 'smooth' }), 50);
  }, [decided, scenario, currentIndex, appendHistory]);

  const handleNext = () => {
    const next = currentIndex + 1;
    if (next >= shuffledScenarios.length) {
      // Count every hand played — matches SessionSummary, not the per-skill deduped skillResults
      const correct   = sessionHistory.filter(h => h.result === 'correct').length;
      const incorrect = sessionHistory.filter(h => h.result === 'incorrect').length;
      sessionUserRef.current = user;
      const today = toLocalDateString(new Date());
      // One streak recompute feeds every streak-mechanics surface (M1–M3):
      // the secured line, the Rebuy-used note, and the broken-streak moment.
      const streakResult = user && user.lastSessionDate !== today ? calcStreak(user) : null;
      const prevStreak = user?.streak ?? 0;
      setSessionDelta({
        iqDelta: correct * 2 - incorrect,
        prevStreak,
        prevSessions: user?.sessionsCompleted ?? 0,
        prevPokerScore: user?.pokerScore ?? null,
        prevSkills: user ? { ...user.skills } : {},
        skillResults: { ...skillResults },
        // First session of the day = the moment the streak day is earned;
        // later sessions the same day show nothing (already secured).
        streakSecured: streakResult ? streakResult.streak : null,
        // A Rebuy silently covered a missed day — streak intact (M1).
        rebuyUsed: streakResult ? streakResult.rebuyUsed : false,
        // A real streak (>1) reset to 1 → the broken-streak moment (M2), never
        // a bare drop; activeDaysLast30 is the consistency record.
        streakBroken: !!streakResult && streakResult.streak === 1 && prevStreak > 1,
        activeDaysLast30: user?.activeDaysLast30 ?? null,
        // null until a best exists (legacy local users / first session) so a
        // first result is never hailed as a "personal best"
        prevBest: user?.bestSessionCorrect ?? null,
      });
      setShowSummary(true);
      track('session_completed', { difficulty, correct, incorrect, total: sessionHistory.length, guest: isGuest });
      handleFetchCoachRead();
    } else {
      decidedRef.current = false;
      setCurrentIndex(next);
      setDecided(false);
      setFeedback(null);
      setTimedOut(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleRestart = () => {
    decidedRef.current = false;
    setScreen('dashboard');
    setCurrentIndex(0);
    setSkillResults({});
    setDecided(false);
    setFeedback(null);
    setShowSummary(false);
    setCoachRead('');
    setCoachLimited(false);
    setCoachLoading(false);
    setShuffledScenarios([]);
    setTimedOut(false);
    setCombo(0);
    setCorrectCount(0);
    setSessionHistory([]);
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
    // Untagged cache = guest progress or a pre-Supabase tester's history.
    // A used-up guest sees the carry-over note instead of the guest CTA; a
    // tester (real name) sees neither — signing in migrates their history.
    const local = cacheOwner() ? null : loadUser();
    const guestUsed = local?.displayName === GUEST_NAME
      && (local?.sessionsCompleted ?? 0) >= GUEST_FREE_SESSIONS;
    const canGuest = !guestUsed && (!local || local.displayName === GUEST_NAME);
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
        <button className="info-btn" onClick={() => setGuide({})}>i</button>
      </div>

      {guide && <VillainGuide onClose={() => setGuide(null)} focus={guide.focus} />}

      {screen === 'dashboard' && (
        <Dashboard
          onStartSession={handleStartSession}
          user={user}
          sessionDelta={sessionDelta}
          onSignOut={handleSignOut}
          onRename={handleRename}
          guest={isGuest}
          guestGated={isGuest && (user?.sessionsCompleted ?? 0) >= GUEST_FREE_SESSIONS}
          onGuestSignIn={handleGuestSignIn}
          onTableReads={!isGuest ? handleOpenTableReads : undefined}
        />
      )}

      {screen === 'tablereads' && (
        <TableReads onBack={() => setScreen('dashboard')} />
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
              <ProgressDots total={shuffledScenarios.length} current={currentIndex} />
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
                nextLabel={currentIndex < shuffledScenarios.length - 1 ? 'Next Scenario →' : 'See My Results →'}
                onVillainInfo={(label) => {
                  track('villain_guide_opened', { from: 'table', scenario_id: scenario.id });
                  setGuide({ focus: label });
                }}
              />
              {!USE_SINGLE_CANVAS && feedback && (
                <>
                  <FeedbackPanel
                    grade={feedback.grade}
                    loading={feedback.loading}
                    feedbackText={feedback.text}
                    correctAnswer={scenario.options.find(o => o.val === scenario.correct)?.label ?? scenario.correct}
                    timedOut={timedOut}
                    scenarioId={scenario.id}
                    choice={feedback.choice}
                  />
                  {!feedback.loading && (
                    <button className="next-btn" onClick={handleNext}>
                      {currentIndex < shuffledScenarios.length - 1 ? 'Next Scenario →' : 'See My Results →'}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}