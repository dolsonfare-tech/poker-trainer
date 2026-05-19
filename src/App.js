import { useState, useCallback } from 'react';
import './App.css';
import SCENARIOS from './data/scenarios';
// ─── API Key ───────────────────────────────────────────────────────────────
const CLAUDE_API_KEY = process.env.REACT_APP_CLAUDE_API_KEY;

// ─── Skill Labels ──────────────────────────────────────────────────────────
const SKILL_LABELS = {
  preflop:    'Preflop',
  position:   'Position',
  aggression: 'Aggression',
  betsize:    'Bet Size',
  bluffing:   'Bluffing',
  potodds:    'Pot Odds',
  reads:      'Reads',
  opponent:   'Opponent',
};

const FALLBACKS = {
  fold: {
    correct:   'Folding here preserves your stack for better spots. Discipline to fold when you are behind is a hallmark of winning players.',
    partial:   'While folding can be right, here you had enough equity to continue. Trust the math and your position.',
    incorrect: 'This fold is too tight. You are surrendering real equity — learn to recognize when the pot odds justify a call.',
  },
  call: {
    correct:   'Calling here is textbook. You have the right price and a clear plan for the hand going forward.',
    partial:   'A call works, but you may be leaving value on the table. Consider your range balance and future streets.',
    incorrect: 'Calling here is a mistake — you are behind and the pot odds do not justify it. Look for a better spot.',
  },
  raise: {
    correct:   'Aggressive play is correct here. You have fold equity, a range advantage, and a clear story to tell.',
    partial:   'The raise has some merit but carries real risk. Make sure you have a balanced raising range before committing.',
    incorrect: 'This raise is ill-timed. You are out of position with insufficient equity — pick better spots to apply pressure.',
  },
};

// ─── Sub-components ────────────────────────────────────────────────────────

function PlayingCard({ rank, suit, color, small }) {
  return (
    <div className={`playing-card ${color} ${small ? 'sm' : ''}`}>
      <span className="c-rank">{rank}</span>
      <span className="c-suit">{suit}</span>
    </div>
  );
}

function TableVisual({ scenario }) {
  const isRed = (str) => str.includes('♥') || str.includes('♦');
  return (
    <div className="table-wrap">
      <div className="positions-grid">
        {scenario.positions.map((p, i) => (
          <div key={i} className={`pos ${p.state}`}>
            <div className="pos-name">{p.label}</div>
            <div className="pos-action">{p.action}</div>
          </div>
        ))}
      </div>
      {scenario.board && (
        <>
          <div className="board-label">Board</div>
          <div className="board-row">
            {scenario.board.map((card, i) => (
              <PlayingCard key={i} rank={card.slice(0,-1)} suit={card.slice(-1)} color={isRed(card) ? 'red' : 'black'} small />
            ))}
          </div>
        </>
      )}
      <div className="cards-row">
        {scenario.hand.map((card, i) => (
          <PlayingCard key={i} rank={card.r} suit={card.s} color={card.c} />
        ))}
      </div>
      <div className="pot-info">
        Pot: <span>{scenario.pot}</span>
        {scenario.toCall && <> &nbsp;·&nbsp; To call: <span>{scenario.toCall}</span></>}
      </div>
    </div>
  );
}

function SkillTracker({ skillResults }) {
  return (
    <div className="skill-bar">
      {Object.entries(SKILL_LABELS).map(([key, label]) => (
        <div key={key} className="skill-item">
          <span className="skill-label">{label}</span>
          <div className={`skill-dot ${skillResults[key] || ''}`} />
        </div>
      ))}
    </div>
  );
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

function VillainBadge({ villain }) {
  return (
    <div style={{
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: '0.55rem',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'rgba(242,237,227,0.45)',
      marginBottom: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    }}>
      <span style={{ color: '#c8a84b' }}>⚠</span> Villain: {villain.label}
    </div>
  );
}

function FeedbackPanel({ grade, loading, feedbackText }) {
  const subLabel = {
    correct:   'Correct Play',
    partial:   'Acceptable — Not Optimal',
    incorrect: 'Mistake',
  };
  return (
    <div className="feedback">
      <div className="ai-label">⚡ AI Analysis</div>
      <div className="fb-header">
        <div className={`grade-circle ${grade.g}`}>{grade.emoji}</div>
        <div>
          <div className="grade-title">{grade.title}</div>
          <div className={`grade-sub ${grade.g}`}>{subLabel[grade.g]}</div>
        </div>
      </div>
      <div className={`skill-pill ${grade.g}`}>● {grade.skill}</div>
      <div className="fb-text">
        {loading ? <div className="thinking">Analyzing your decision…</div> : feedbackText}
      </div>
    </div>
  );
}

function SessionSummary({ skillResults, coachRead, coachLoading, onRestart }) {
  const statusMap = {
    correct:   ['Strong',  'correct'],
    partial:   ['Work On', 'partial'],
    incorrect: ['Weak',    'incorrect'],
  };
  return (
    <div className="summary-card">
      <div className="summary-title">Session Complete</div>
      <div className="summary-sub">Your Skill Assessment</div>
      <div className="skills-list">
        {Object.entries(SKILL_LABELS).map(([key, label]) => {
          const result = skillResults[key];
          const [text, cls] = result ? statusMap[result] : ['Untested', 'untested'];
          return (
            <div key={key} className="skill-row">
              <span className="skill-row-name">{label}</span>
              <span className={`status-pill ${cls}`}>{text}</span>
            </div>
          );
        })}
      </div>
      <div style={{
        background: 'rgba(200,168,75,0.07)',
        border: '1px solid rgba(200,168,75,0.2)',
        borderRadius: '12px',
        padding: '18px 16px',
        marginBottom: '24px',
        textAlign: 'left',
      }}>
        <div style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: '0.55rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'rgba(200,168,75,0.7)',
          marginBottom: '10px',
        }}>
          🧠 Coach's Read
        </div>
        {coachLoading ? (
          <div className="thinking">Reading your session...</div>
        ) : (
          <div style={{
            fontSize: '0.86rem',
            lineHeight: '1.7',
            color: 'rgba(242,237,227,0.8)',
            fontStyle: 'italic',
          }}>
            {coachRead || 'No pattern identified yet.'}
          </div>
        )}
      </div>
      <button className="restart-btn" onClick={onRestart}>Train Again</button>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────

export default function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
const [shuffledScenarios, setShuffledScenarios] = useState(() => [...SCENARIOS].sort(() => Math.random() - 0.5));  const [skillResults, setSkillResults]  = useState({});
  const [decided, setDecided]            = useState(false);
  const [feedback, setFeedback]          = useState(null);
  const [showSummary, setShowSummary]    = useState(false);
  const [coachRead, setCoachRead]        = useState('');
  const [coachLoading, setCoachLoading]  = useState(false);

  const scenario = shuffledScenarios[currentIndex];

  const fetchCoachRead = async (results, lastIndex) => {
    setCoachLoading(true);
    const decisionsPlayed = shuffledScenarios.slice(0, lastIndex + 1).map(s => ({
      scenario: s.tag,
      villain: s.villain.label,
      skill: s.skill,
      result: results[s.skill] || 'unknown',
    }));
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `You are a poker coach reviewing a student's session results. Look for a pattern across their mistakes and name the underlying mental model causing them.

Session decisions:
${decisionsPlayed.map(d => `- ${d.scenario} (${d.villain}): ${d.result}`).join('\n')}

Write 2-3 sentences identifying the pattern. Rules:
- Sound like a human coach, not an AI
- No em dashes, no "not only... but also" constructions
- No generic praise or filler
- Be direct and specific about what you observe
- If they got everything right, acknowledge it briefly and name one area to keep watching
- Start with the observation, not with "you"`,
          }],
        }),
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === 'text')?.text || '';
      setCoachRead(text);
    } catch {
      setCoachRead('');
    }
    setCoachLoading(false);
  };

  const handleDecision = useCallback(async (choice) => {
    if (decided) return;
    setDecided(true);
    const gr = scenario.grading[choice];
    setSkillResults(prev => ({ ...prev, [scenario.skill]: gr.g }));
    setFeedback({ grade: { ...gr, skill: scenario.tag }, loading: true, text: '' });
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `You are a direct, knowledgeable poker coach. Give 2-3 sentences of specific, actionable feedback.

Scenario: ${scenario.body}
Hero's hand: ${scenario.hand.map(c => c.r + c.s).join('')}
Villain type: ${scenario.villain.label} — ${scenario.villain.notes}
Player chose: ${choice}
Correct play: ${scenario.correct}
Assessment: ${gr.g}
Skill being tested: ${scenario.tag}

Reference the villain type in your feedback. Explain how this specific opponent type should change the decision. Be direct. No preamble.`,
          }],
        }),
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === 'text')?.text || FALLBACKS[choice][gr.g];
      setFeedback(prev => ({ ...prev, loading: false, text }));
    } catch {
      setFeedback(prev => ({ ...prev, loading: false, text: FALLBACKS[choice][gr.g] }));
    }
  }, [decided, scenario]);

  const handleNext = () => {
    const next = currentIndex + 1;
    if (next >= shuffledScenarios.length) {
      setShowSummary(true);
      fetchCoachRead(skillResults, currentIndex);
    } else {
      setCurrentIndex(next);
      setDecided(false);
      setFeedback(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleRestart = () => {
    setShuffledScenarios([...SCENARIOS].sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
    setSkillResults({});
    setDecided(false);
    setFeedback(null);
    setShowSummary(false);
    setCoachRead('');
    setCoachLoading(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app">
      <div className="header">
        <div className="logo">Check<em>Raise</em></div>
        <div className="tagline">AI-Powered Skill Training</div>
      </div>
      <SkillTracker skillResults={skillResults} />
      {showSummary ? (
        <SessionSummary
          skillResults={skillResults}
          coachRead={coachRead}
          coachLoading={coachLoading}
          onRestart={handleRestart}
        />
      ) : (
        <>
          <ProgressDots total={shuffledScenarios.length} current={currentIndex} />
          <div className="scenario-card">
            <div className="card-meta">
              <div className="skill-tag">{scenario.tag}</div>
              <div className="scenario-counter">{currentIndex + 1} / {shuffledScenarios.length}</div>
            </div>
            <VillainBadge villain={scenario.villain} />
            <TableVisual scenario={scenario} />
            <p className="scenario-body">{scenario.body}</p>
            <p className="scenario-q">{scenario.question}</p>
          </div>
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
  );
}