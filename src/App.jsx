import { useState, useCallback, useEffect, useRef } from 'react';
import './App.css';
import SCENARIOS from './data/scenarios';
import { fetchCoachRead } from './utils/claude';
import ScenarioCard from './components/ScenarioCard';
import FeedbackPanel from './components/FeedbackPanel';
import SessionSummary from './components/SessionSummary';
import VillainGuide from './components/VillainGuide';
import DifficultySelector from './components/DifficultySelector';
import Dashboard from './components/Dashboard';

// ─── Constants ────────────────────────────────────────────────────────────
const SESSION_LENGTH = 5;
const TIMER_SECONDS = 60; // HARDCODED — pull from user settings in Phase 2

// ─── Streak helpers (localStorage) ────────────────────────────────────────
function loadStats() {
  try {
    const raw = localStorage.getItem('cr_stats');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { streak: 0, lastSessionDate: null };
}

function saveStats(stats) {
  try { localStorage.setItem('cr_stats', JSON.stringify(stats)); } catch {}
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function calcStreak(stats) {
  const today = todayString();
  const last = stats.lastSessionDate;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  let newStreak = stats.streak;
  if (last === today) {
    // already played today — don't increment
  } else if (last === yesterdayStr) {
    newStreak = stats.streak + 1;
  } else {
    newStreak = 1;
  }

  return { streak: newStreak, lastSessionDate: today };
}

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

// ─── Action sublabels ──────────────────────────────────────────────────────
const ACTION_SUBLABELS = {
  fold:  'Give up the hand',
  call:  'Match the bet',
  raise: 'Apply pressure',
};

// ─── Utility ──────────────────────────────────────────────────────────────
function getFilteredScenarios(difficulty) {
  const filtered = SCENARIOS.filter(s => s.difficulty === difficulty);
  return [...filtered].sort(() => Math.random() - 0.5).slice(0, SESSION_LENGTH);
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
  const [stats, setStats]                         = useState(() => loadStats());
  const [timerSeconds, setTimerSeconds]           = useState(TIMER_SECONDS);
  const [timedOut, setTimedOut]                   = useState(false);
  const [combo, setCombo]                         = useState(0);
  const [correctCount, setCorrectCount]           = useState(0);
  const timerRef                                  = useRef(null);
  const currentIndexRef                           = useRef(0);
  const shuffledRef                               = useRef([]);

  const scenario = shuffledScenarios[currentIndex];

  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { shuffledRef.current = shuffledScenarios; }, [shuffledScenarios]);

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const handleTimeout = useCallback(() => {
    clearTimer();
    const s = shuffledRef.current[currentIndexRef.current];
    if (!s) return;
    setTimedOut(true);
    setDecided(true);
    setSkillResults(prev => ({ ...prev, [s.skill]: 'incorrect' }));
    setCombo(0);
    const correctGrading = s.grading[s.correct];
    setFeedback({ grade: { ...correctGrading, skill: s.tag }, loading: false, text: s.feedback.correct });
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50);
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    setTimerSeconds(TIMER_SECONDS);
    setTimedOut(false);
    timerRef.current = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) { handleTimeout(); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, [handleTimeout]);

  useEffect(() => {
    if (screen === 'session' && !showSummary && shuffledScenarios.length > 0 && !decided) {
      startTimer();
    }
    return clearTimer;
  }, [currentIndex, screen, showSummary]); // eslint-disable-line

  useEffect(() => clearTimer, []);

  const handleStartSession = () => {
    setScreen('difficulty');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDifficultySelect = (selected) => {
    setDifficulty(selected);
    const scenarios = getFilteredScenarios(selected);
    setShuffledScenarios(scenarios);
    setCombo(0);
    setCorrectCount(0);
    setScreen('session');
  };

  const handleFetchCoachRead = async (results, lastIndex) => {
    setCoachLoading(true);
    try {
      const text = await fetchCoachRead(shuffledScenarios, results, lastIndex);
      setCoachRead(text);
    } catch { setCoachRead(''); }
    setCoachLoading(false);
  };

  const handleDecision = useCallback((choice) => {
    if (decided) return;
    clearTimer();
    setDecided(true);
    setTimedOut(false);
    const gr = scenario.grading[choice];
    setSkillResults(prev => ({ ...prev, [scenario.skill]: gr.g }));
    if (gr.g === 'correct') {
      setCombo(prev => prev + 1);
      setCorrectCount(prev => prev + 1);
    } else {
      setCombo(0);
    }
    const feedbackText = scenario.feedback[gr.g];
    setFeedback({ grade: { ...gr, skill: scenario.tag }, loading: false, text: feedbackText });
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50);
  }, [decided, scenario]);

  const handleNext = () => {
    const next = currentIndex + 1;
    if (next >= shuffledScenarios.length) {
      clearTimer();
      const newStats = calcStreak(stats);
      saveStats(newStats);
      setStats(newStats);
      setShowSummary(true);
      handleFetchCoachRead(skillResults, currentIndex);
    } else {
      setCurrentIndex(next);
      setDecided(false);
      setFeedback(null);
      setTimedOut(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleRestart = () => {
    clearTimer();
    setScreen('dashboard');
    setCurrentIndex(0);
    setSkillResults({});
    setDecided(false);
    setFeedback(null);
    setShowSummary(false);
    setCoachRead('');
    setCoachLoading(false);
    setShuffledScenarios([]);
    setTimerSeconds(TIMER_SECONDS);
    setTimedOut(false);
    setCombo(0);
    setCorrectCount(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app">
      <div className="header" style={{ position: 'relative' }}>
        <div
          className="logo"
          style={{ cursor: screen !== 'dashboard' ? 'pointer' : 'default' }}
          onClick={() => screen !== 'dashboard' && handleRestart()}
        >
          Check<em>Raise</em>
        </div>
        <div className="tagline">AI-Powered Skill Training</div>
        <button
          onClick={() => setShowVillainGuide(true)}
          style={{
            position: 'absolute', top: '36px', right: '0',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '50%', width: '30px', height: '30px',
            color: 'rgba(242,237,227,0.5)', cursor: 'pointer',
            fontSize: '0.75rem', fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >i</button>
      </div>

      {showVillainGuide && <VillainGuide onClose={() => setShowVillainGuide(false)} />}

      {screen === 'dashboard' && (
        <Dashboard onStartSession={handleStartSession} stats={stats} />
      )}

      {screen === 'difficulty' && (
        <DifficultySelector onSelect={handleDifficultySelect} />
      )}

      {screen === 'session' && (
        <div className="session-container">
          {showSummary ? (
            <SessionSummary
              skillResults={skillResults}
              coachRead={coachRead}
              coachLoading={coachLoading}
              difficulty={difficulty}
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
                timerSeconds={timerSeconds}
                totalSeconds={TIMER_SECONDS}
                correctCount={correctCount}
                options={scenario.options}
                onDecision={handleDecision}
                decided={decided}
                actionSublabels={ACTION_SUBLABELS}
              />
              {feedback && (
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