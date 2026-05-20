import { useState, useCallback } from 'react';
import './App.css';
import SCENARIOS from './data/scenarios';
import { fetchCoachRead } from './utils/claude';
import SkillTracker from './components/SkillTracker';
import ScenarioCard from './components/ScenarioCard';
import FeedbackPanel from './components/FeedbackPanel';
import SessionSummary from './components/SessionSummary';
import VillainGuide from './components/VillainGuide';
import DifficultySelector from './components/DifficultySelector';

function getFilteredScenarios(difficulty) {
  const filtered = SCENARIOS.filter(s => s.difficulty === difficulty);
  return [...filtered].sort(() => Math.random() - 0.5);
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

export default function App() {
  const [showVillainGuide, setShowVillainGuide] = useState(false);
  const [screen, setScreen]                     = useState('difficulty');
  const [difficulty, setDifficulty]             = useState('beginner');
  const [shuffledScenarios, setShuffledScenarios] = useState([]);
  const [currentIndex, setCurrentIndex]         = useState(0);
  const [skillResults, setSkillResults]         = useState({});
  const [decided, setDecided]                   = useState(false);
  const [feedback, setFeedback]                 = useState(null);
  const [showSummary, setShowSummary]           = useState(false);
  const [coachRead, setCoachRead]               = useState('');
  const [coachLoading, setCoachLoading]         = useState(false);

  const scenario = shuffledScenarios[currentIndex];

  const handleDifficultySelect = (selected) => {
    setDifficulty(selected);
    setShuffledScenarios(getFilteredScenarios(selected));
    setScreen('session');
  };

  const handleFetchCoachRead = async (results, lastIndex) => {
    setCoachLoading(true);
    try {
      const text = await fetchCoachRead(shuffledScenarios, results, lastIndex);
      setCoachRead(text);
    } catch {
      setCoachRead('');
    }
    setCoachLoading(false);
  };

  const handleDecision = useCallback((choice) => {
    if (decided) return;
    setDecided(true);
    const gr = scenario.grading[choice];
    setSkillResults(prev => ({ ...prev, [scenario.skill]: gr.g }));
    const feedbackText = scenario.feedback[gr.g];
    setFeedback({ grade: { ...gr, skill: scenario.tag }, loading: false, text: feedbackText });
  }, [decided, scenario]);

  const handleNext = () => {
    const next = currentIndex + 1;
    if (next >= shuffledScenarios.length) {
      setShowSummary(true);
      handleFetchCoachRead(skillResults, currentIndex);
    } else {
      setCurrentIndex(next);
      setDecided(false);
      setFeedback(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleRestart = () => {
    setScreen('difficulty');
    setCurrentIndex(0);
    setSkillResults({});
    setDecided(false);
    setFeedback(null);
    setShowSummary(false);
    setCoachRead('');
    setCoachLoading(false);
    setShuffledScenarios([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app">
      <div className="header" style={{ position: 'relative' }}>
        <div className="logo">Check<em>Raise</em></div>
        <div className="tagline">AI-Powered Skill Training</div>
        <button
          onClick={() => setShowVillainGuide(true)}
          style={{
            position: 'absolute',
            top: '36px',
            right: '0',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            color: 'rgba(242,237,227,0.5)',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontFamily: "'Courier New', Courier, monospace",
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          i
        </button>
      </div>

      {showVillainGuide && <VillainGuide onClose={() => setShowVillainGuide(false)} />}

      {screen === 'difficulty' ? (
        <DifficultySelector onSelect={handleDifficultySelect} />
      ) : (
        <>
          <SkillTracker skillResults={skillResults} />

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
              <ScenarioCard
                scenario={scenario}
                currentIndex={currentIndex}
                total={shuffledScenarios.length}
              />
              <div className="actions">
                {scenario.options.map((opt) => (
                  <button
                    key={opt.val}
                    className={`act-btn ${opt.cls}`}
                    onClick={() => handleDecision(opt.val)}
                    disabled={decided}
                  >
                    <div className="act-icon">{opt.icon}</div>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
              {feedback && (
                <>
                  <FeedbackPanel
                    grade={feedback.grade}
                    loading={feedback.loading}
                    feedbackText={feedback.text}
                    correctAnswer={scenario.correct}
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
        </>
      )}
    </div>
  );
}