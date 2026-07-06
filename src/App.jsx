import { useState, useCallback, useEffect, useRef } from 'react';
import './App.css';
import SCENARIOS from './data/scenarios';
import { fetchCoachRead } from './utils/claude';
import { loadUser, saveUser, createUser, applySessionResults } from './utils/userStorage';
import { supabase, hasSupabase } from './utils/supabase';
import { fetchRemoteUser, createRemoteProfile, saveRemoteUser, recordSession } from './utils/db';
import { track, identify, resetAnalytics } from './utils/analytics';
import ScenarioCard, { USE_SINGLE_CANVAS } from './components/ScenarioCard';
import FeedbackPanel from './components/FeedbackPanel';
import SessionSummary from './components/SessionSummary';
import VillainGuide from './components/VillainGuide';
import DifficultySelector from './components/DifficultySelector';
import Dashboard from './components/Dashboard';
import UsernameEntry from './components/UsernameEntry';
import SignIn from './components/SignIn';

// ─── Constants ────────────────────────────────────────────────────────────
const SESSION_LENGTH = 5;
const TIMER_SECONDS = 60; // HARDCODED — pull from user settings in Phase 2

// ─── Combo Ring ────────────────────────────────────────────────────────────
function ComboRing({ combo }) {
  if (combo < 2) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '7px 12px', borderRadius: '12px',
      background: 'linear-gradient(90deg, rgba(232,144,40,0.15), rgba(226,85,85,0.08))',
      border: '1px solid rgba(232,144,40,0.4)',
      marginBottom: '10px',
      animation: 'combo-appear 0.3s ease',
    }}>
      <span style={{ fontSize: combo >= 5 ? '22px' : '18px', lineHeight: 1 }}>🔥</span>
      <div style={{ lineHeight: 1.1 }}>
        <div style={{
          fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: '0.7rem',
          fontWeight: '700', color: 'var(--yellow)', letterSpacing: '0.05em',
        }}>
          ×{combo} streak
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: '0.5rem',
          letterSpacing: '0.12em', color: 'rgba(242,237,227,0.45)',
          textTransform: 'uppercase', marginTop: '2px',
        }}>
          {combo} correct in a row
        </div>
      </div>
    </div>
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────
function getFilteredScenarios(difficulty) {
  const pool = SCENARIOS.filter(s => s.difficulty === difficulty);
  // Fisher–Yates — Math.random() in sort() gives a biased shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, SESSION_LENGTH);
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
  const [showVillainGuide, setShowVillainGuide]   = useState(false);
  const [user, setUser]                           = useState(() => (hasSupabase ? null : loadUser()));
  // 'local' (no Supabase keys — pre-Phase-2 behavior) | 'loading' | 'signedout'
  // | 'noprofile' (signed in, first visit) | 'ready'
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
  const [timedOut, setTimedOut]                   = useState(false);
  const [combo, setCombo]                         = useState(0);
  const [correctCount, setCorrectCount]           = useState(0);
  const [sessionHistory, setSessionHistory]       = useState([]);
  const [sessionDelta, setSessionDelta]           = useState(null);
  const sessionUserRef                            = useRef(null);
  // Synchronous decided guard — state/effect updates can lag in throttled
  // background tabs, so this ref is the authoritative "already answered" flag
  const decidedRef                                = useRef(false);

  const scenario = shuffledScenarios[currentIndex];

  // ── Auth lifecycle (Supabase mode only) ──────────────────────────────────
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
        loadedUidRef.current = null;
        setUser(null);
        setAuthPhase('signedout');
        return;
      }
      identify(session.user.id);
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
            saveUser(remote); // localStorage stays a warm cache
            setAuthPhase('ready');
          } else {
            setAuthPhase('noprofile'); // first visit: pick a name (+ migrate local history)
          }
        } catch (err) {
          console.error('Failed to load profile', err);
          if (active) setAuthPhase('noprofile');
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
    appendHistory(currentIndex, { scenario, choiceVal: null, result: 'incorrect' });
    track('decision_made', { scenario_id: scenario.id, skill: scenario.skill, result: 'incorrect', timed_out: true });
    setCombo(0);
    const correctGrading = scenario.grading[scenario.correct];
    setFeedback({ grade: { ...correctGrading, skill: scenario.tag }, loading: false, text: scenario.feedback.correct });
    // Canvas layout: feedback overlays the table at the top; legacy: it appears below
    setTimeout(() => window.scrollTo({ top: USE_SINGLE_CANVAS ? 0 : document.body.scrollHeight, behavior: 'smooth' }), 50);
  }, [scenario, decided, currentIndex, appendHistory]);

  const handleStartSession = () => {
    setScreen('difficulty');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDifficultySelect = (selected) => {
    decidedRef.current = false;
    setDifficulty(selected);
    const scenarios = getFilteredScenarios(selected);
    setShuffledScenarios(scenarios);
    setCombo(0);
    setCorrectCount(0);
    setSessionDelta(null);
    setScreen('session');
    track('session_started', { difficulty: selected });
  };

  const handleFetchCoachRead = async (results, lastIndex) => {
    setCoachLoading(true);
    const prevUser = sessionUserRef.current;
    // Every hand played counts toward accuracy — not the per-skill deduped results
    const hands = sessionHistory.map(h => ({
      scenarioId: h.scenario.id, skill: h.scenario.skill,
      result: h.result, choiceVal: h.choiceVal,
    }));
    const persist = (updated, coachText) => {
      setUser(updated);
      saveUser(updated); // localStorage cache always
      if (hasSupabase) {
        saveRemoteUser(updated).catch(err => console.error('Profile save failed', err));
        recordSession({
          difficulty,
          hands,
          correctCount: hands.filter(h => h.result === 'correct').length,
          coachRead: coachText,
        }).catch(err => console.error('Session log failed', err));
      }
    };
    try {
      const text = await fetchCoachRead(shuffledScenarios, results, lastIndex);
      setCoachRead(text);
      if (prevUser) persist(applySessionResults(prevUser, hands, text), text);
    } catch {
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
    setSkillResults(prev => ({ ...prev, [scenario.skill]: gr.g }));
    appendHistory(currentIndex, { scenario, choiceVal: choice, result: gr.g });
    track('decision_made', { scenario_id: scenario.id, skill: scenario.skill, result: gr.g, timed_out: false });
    if (gr.g === 'correct') {
      setCombo(prev => prev + 1);
      setCorrectCount(prev => prev + 1);
    } else {
      setCombo(0);
    }
    const feedbackText = scenario.feedback[gr.g];
    setFeedback({ grade: { ...gr, skill: scenario.tag }, loading: false, text: feedbackText });
    setTimeout(() => window.scrollTo({ top: USE_SINGLE_CANVAS ? 0 : document.body.scrollHeight, behavior: 'smooth' }), 50);
  }, [decided, scenario, currentIndex, appendHistory]);

  const handleNext = () => {
    const next = currentIndex + 1;
    if (next >= shuffledScenarios.length) {
      // Count every hand played — matches SessionSummary, not the per-skill deduped skillResults
      const correct   = sessionHistory.filter(h => h.result === 'correct').length;
      const incorrect = sessionHistory.filter(h => h.result === 'incorrect').length;
      sessionUserRef.current = user;
      setSessionDelta({
        iqDelta: correct * 2 - incorrect,
        prevStreak: user?.streak ?? 0,
        prevSessions: user?.sessionsCompleted ?? 0,
        prevPokerScore: user?.pokerScore ?? null,
        prevSkills: user ? { ...user.skills } : {},
        skillResults: { ...skillResults },
      });
      setShowSummary(true);
      track('session_completed', { difficulty, correct, incorrect, total: sessionHistory.length });
      handleFetchCoachRead(skillResults, currentIndex);
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
      const created = await createRemoteProfile(username, loadUser());
      setUser(created);
      saveUser(created);
      setAuthPhase('ready');
      track('profile_created');
    } else {
      const newUser = createUser(username);
      setUser(newUser);
      saveUser(newUser);
    }
  };

  const handleSignOut = async () => {
    if (hasSupabase && window.confirm('Sign out of CheckRaise?')) {
      await supabase.auth.signOut();
      resetAnalytics(); // next visitor on this device gets a fresh identity
      handleRestart();
    }
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
  if (authPhase === 'signedout') {
    return <SignIn />;
  }
  if (authPhase === 'noprofile' || !user) {
    return <UsernameEntry onSubmit={handleCreateUser} defaultName={loadUser()?.displayName} />;
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
        <div className="tagline">AI-Powered Skill Training</div>
        <button className="info-btn" onClick={() => setShowVillainGuide(true)}>i</button>
      </div>

      {showVillainGuide && <VillainGuide onClose={() => setShowVillainGuide(false)} />}

      {screen === 'dashboard' && (
        <Dashboard onStartSession={handleStartSession} user={user} sessionDelta={sessionDelta} onSignOut={handleSignOut} />
      )}

      {screen === 'difficulty' && (
        <DifficultySelector onSelect={handleDifficultySelect} />
      )}

      {screen === 'session' && (
        <div className="session-container">
          {showSummary ? (
            <SessionSummary
              skillResults={skillResults}
              sessionHistory={sessionHistory}
              coachRead={coachRead}
              coachLoading={coachLoading}
              difficulty={difficulty}
              userSkills={sessionDelta?.prevSkills ?? user.skills}
              onRestart={handleRestart}
            />
          ) : (
            <>
              <ProgressDots total={shuffledScenarios.length} current={currentIndex} />
              <ComboRing combo={combo} />
              <ScenarioCard
                scenario={scenario}
                currentIndex={currentIndex}
                total={shuffledScenarios.length}
                totalSeconds={TIMER_SECONDS}
                correctCount={correctCount}
                options={scenario.options}
                onDecision={handleDecision}
                decided={decided}
                showTimer={difficulty !== 'beginner'}
                onTimeout={handleTimeout}
                feedback={feedback}
                timedOut={timedOut}
                onNext={handleNext}
                nextLabel={currentIndex < shuffledScenarios.length - 1 ? 'Next Scenario →' : 'See My Results →'}
              />
              {!USE_SINGLE_CANVAS && feedback && (
                <>
                  <FeedbackPanel
                    grade={feedback.grade}
                    loading={feedback.loading}
                    feedbackText={feedback.text}
                    correctAnswer={scenario.correct}
                    timedOut={timedOut}
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