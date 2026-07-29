import { useState, useRef, lazy, Suspense } from 'react';
import './App.css';
import { loadUser, cacheOwner, loadLastDifficulty } from './utils/persistence';
import { useAuthSession } from './hooks/useAuthSession';
import { useSessionRun, TIMER_SECONDS } from './hooks/useSessionRun';
import { useGuest, GUEST_NAME } from './hooks/useGuest';
import { hasSupabase } from './utils/supabase';
import ScenarioCard from './components/ScenarioCard';
import SessionSummary from './components/SessionSummary';
import DifficultySelector from './components/DifficultySelector';
import Dashboard from './components/Dashboard';
import UsernameEntry from './components/UsernameEntry';
import SignIn from './components/SignIn';
import { emitSchemaGuideOpened, emitVillainGuideOpened } from './utils/events';

// ─── Lazy routes (CA-022, Wave 4) ──────────────────────────────────────────
// Split by how many visitors actually reach them, not by file size.
//
// TableReads is the big one: the component is 9 KB but it owns observations.js
// (39 KB), and it is an opt-in mode most visitors never open — a Pro surface
// that is merely free during beta.
//
// VillainGuide is a modal behind a deliberate tap. A brief blank frame before it
// opens costs nothing; shipping it to everyone who never taps ⓘ does.
//
// SessionSummary is deliberately NOT lazy. Every player who finishes a session
// needs it, and it renders at the results reveal — trading a stutter at that
// moment for ~4 KB gzip is a bad deal. Size alone would have said to split it.
const TableReads   = lazy(() => import(/* webpackChunkName: "tablereads" */ './components/TableReads'));
const VillainGuide = lazy(() => import(/* webpackChunkName: "villainguide" */ './components/VillainGuide'));

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
  const [screen, setScreen]                       = useState('dashboard');

  // ── The one piece of state App still owns outright ───────────────────────
  // `guestRef` is the channel between the two hooks below, and neither can own
  // it without a cycle: useGuest needs `authPhase` from useAuthSession, and
  // useAuthSession's listener needs the ref from useGuest. A composition root
  // holding a channel its children share is the honest shape for that.
  //
  // Written synchronously by the guest handlers, read inside the auth
  // listener's closure. It cannot collapse into `authPhase === 'guest'`: a
  // state read in that closure lags by a render, and a stray no-session event
  // landing in that window stomps a guest mid-session back to SignIn.
  const guestRef = useRef(false);

  // ── Identity (MOD-002, Wave 3) ───────────────────────────────────────────
  // The auth listener, the profile it loads, and the mutations that change who
  // the player is. The setTimeout(0) deadlock workaround and the
  // invalid_session recovery live in there — see the hook's header.
  const {
    user, setUser, authPhase, setAuthPhase,
    handleCreateUser, handleRename, signOut, handleSwitchAccount,
  } = useAuthSession({ guestRef });

  // ── Guest flow (MOD-002, Wave 3) ─────────────────────────────────────────
  // The free unauthenticated session, its gate, and what SignIn should offer.
  const {
    isGuest, guestGated,
    handleGuestPlay, handleGuestSignIn, guestOffer,
  } = useGuest({ authPhase, setAuthPhase, user, setUser, setScreen, guestRef });

  // ── Session run (MOD-002, Wave 3) ────────────────────────────────────────
  // The deal, the per-hand loop, the end-of-session delta and the submitSession
  // hand-off now live in hooks/useSessionRun.js. App keeps identity (`user`)
  // and routing (`screen`); the hook reads both and reports what changed.
  const {
    scenario, shuffledScenarios, currentIndex, difficulty,
    decided, feedback, timedOut, combo, correctCount,
    showSummary, sessionDelta, sessionHistory, skillResults,
    handleDifficultySelect, handlePlayAgain,
    handleDecision, handleTimeout, handleNext, handleRestart,
  } = useSessionRun({ user, setUser, isGuest, screen, setScreen });

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

  // Sign-out is composed here, not inside useAuthSession: the auth hook is
  // constructed before useSessionRun, so it cannot depend on handleRestart.
  // No confirm dialog — the account menu (Dashboard topbar) is the deliberate
  // second tap, and the native window.confirm read as cheap.
  const handleSignOut = async () => {
    // The `hasSupabase` guard belongs HERE, not only inside signOut(): in
    // localStorage-only mode the original returned before resetting the
    // session, so dropping it would make a dead button start resetting state.
    if (!hasSupabase) return;
    await signOut();
    handleRestart();
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
    // The screen class exists so the header can align its left edge with the
    // card below it. Each screen constrains its content differently, so a
    // header pinned to .app's padding edge lines up with nothing (measured at
    // 1400px: logo at 140, summary card at 220 — founder report, July 28).
    <div className={`app app-${screen}`}>
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

      {guide && (
        <Suspense fallback={null}>
          <VillainGuide onClose={() => setGuide(null)} focus={guide.focus} initialTab={guide.tab} skills={user?.skills} />
        </Suspense>
      )}

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
            emitSchemaGuideOpened(name);
            setGuide({ focus: name, tab: 'schemas' });
          }}
        />
      )}

      {screen === 'tablereads' && (
        <Suspense fallback={<div className="tr-screen"><div className="tr-context">Shuffling up…</div></div>}>
          <TableReads
            onBack={() => setScreen('dashboard')}
            onOpenGuide={(label) => {
              emitVillainGuideOpened({ from: 'tablereads' });
              setGuide({ focus: label });
            }}
          />
        </Suspense>
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
                  emitVillainGuideOpened({ from: 'table', scenarioId: scenario.id });
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