import { useState, useCallback } from 'react';
import './App.css';

// ─── API Key ───────────────────────────────────────────────────────────────
// Replace with your real key from console.anthropic.com
// Important: move this to a backend before sharing the app publicly
const CLAUDE_API_KEY = 'YOUR_API_KEY_HERE';

// ─── Scenario Data ─────────────────────────────────────────────────────────
const SCENARIOS = [
  {
    id: 1,
    tag: 'Preflop Hand Selection',
    skill: 'preflop',
    difficulty: 'beginner',
    weight: 1.0,
    positions: [
      { label: 'UTG',      action: 'Folds',     state: 'folded' },
      { label: 'HJ',       action: 'Folds',     state: 'folded' },
      { label: 'CO',       action: 'Raises $6', state: 'active' },
      { label: 'BTN',      action: 'Folds',     state: 'folded' },
      { label: 'SB',       action: 'Folds',     state: 'folded' },
      { label: 'BB (You)', action: '???',        state: 'hero'   },
    ],
    hand: [{ r: 'J', s: '♥', c: 'red' }, { r: '8', s: '♥', c: 'red' }],
    board: null,
    pot: '$9',
    toCall: '$4 more',
    body: "6-player cash game, $1/$2 blinds. You're in the Big Blind with J♥8♥. The Cutoff — a tight-aggressive regular — opens to $6. Everyone else folds to you.",
    question: 'What do you do?',
    options: [
      { label: 'Fold',         icon: '🃏', cls: 'fold',  val: 'fold'  },
      { label: 'Call $4 more', icon: '📞', cls: 'call',  val: 'call'  },
      { label: '3-Bet to $20', icon: '⚡', cls: 'raise', val: 'raise' },
    ],
    correct: 'call',
    grading: {
      fold:  { g: 'incorrect', title: 'Too Tight Here',        emoji: '❌' },
      call:  { g: 'correct',   title: 'Well Played',           emoji: '✅' },
      raise: { g: 'partial',   title: 'Aggressive, But Risky', emoji: '⚠️' },
    },
  },
  {
    id: 2,
    tag: 'Position Awareness',
    skill: 'position',
    difficulty: 'beginner',
    weight: 1.0,
    positions: [
      { label: 'UTG',       action: 'Folds',  state: 'folded' },
      { label: 'HJ',        action: 'Folds',  state: 'folded' },
      { label: 'CO',        action: 'Folds',  state: 'folded' },
      { label: 'BTN (You)', action: '???',    state: 'hero'   },
      { label: 'SB',        action: 'Active', state: 'active' },
      { label: 'BB',        action: 'Active', state: 'active' },
    ],
    hand: [{ r: 'A', s: '♠', c: 'black' }, { r: '7', s: '♦', c: 'red' }],
    board: null,
    pot: '$3',
    toCall: null,
    body: "You're on the Button in a 6-max game. Everyone folds to you. You hold A♠7♦. The Small Blind is a loose-passive player who calls too much. The Big Blind is a solid regular.",
    question: 'What do you do from the Button?',
    options: [
      { label: 'Fold',        icon: '🃏', cls: 'fold',  val: 'fold'  },
      { label: 'Limp ($2)',   icon: '📞', cls: 'call',  val: 'call'  },
      { label: 'Raise to $5', icon: '⚡', cls: 'raise', val: 'raise' },
    ],
    correct: 'raise',
    grading: {
      fold:  { g: 'incorrect', title: 'Way Too Tight',         emoji: '❌' },
      call:  { g: 'partial',   title: 'Limping Gives Up Edge', emoji: '⚠️' },
      raise: { g: 'correct',   title: 'Perfect Button Play',   emoji: '✅' },
    },
  },
  {
    id: 3,
    tag: 'Aggression & Bluffing',
    skill: 'aggression',
    difficulty: 'intermediate',
    weight: 1.0,
    positions: [
      { label: 'You',    action: 'Checked',  state: 'hero'   },
      { label: 'Villain',action: 'Bets $15', state: 'active' },
      { label: 'P3',     action: 'Folded',   state: 'folded' },
      { label: 'P4',     action: 'Folded',   state: 'folded' },
      { label: 'P5',     action: 'Folded',   state: 'folded' },
      { label: 'P6',     action: 'Folded',   state: 'folded' },
    ],
    hand: [{ r: 'K', s: '♣', c: 'black' }, { r: 'Q', s: '♦', c: 'red' }],
    board: ['A♠', 'J♥', '3♦'],
    pot: '$40',
    toCall: '$15',
    body: 'Heads-up on the flop: A♠ J♥ 3♦. Pot is $40. You hold K♣Q♦ — a gutshot straight draw with two overcards. You checked, villain bets $15.',
    question: "You're getting 3.6:1 pot odds with 10 outs. What's your play?",
    options: [
      { label: 'Fold',               icon: '🃏', cls: 'fold',  val: 'fold'  },
      { label: 'Call $15',           icon: '📞', cls: 'call',  val: 'call'  },
      { label: 'Check-Raise to $45', icon: '⚡', cls: 'raise', val: 'raise' },
    ],
    correct: 'call',
    grading: {
      fold:  { g: 'incorrect', title: 'Folding Equity Left Behind', emoji: '❌' },
      call:  { g: 'correct',   title: 'Solid Pot Odds Decision',    emoji: '✅' },
      raise: { g: 'partial',   title: 'Bold, But Risky Bluff',      emoji: '⚠️' },
    },
  },
];

const SKILL_LABELS = {
  preflop:    'Preflop Hand Selection',
  position:   'Position Awareness',
  aggression: 'Aggression & Bluffing',
  betsize:    'Bet Sizing',
  bluffing:   'Bluff Frequency',
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
              <PlayingCard
                key={i}
                rank={card.slice(0, -1)}
                suit={card.slice(-1)}
                color={isRed(card) ? 'red' : 'black'}
                small
              />
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
          <span className="skill-label">{label.split(' ')[0]}</span>
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
        <div
          key={i}
          className={`pdot ${i < current ? 'done' : i === current ? 'current' : ''}`}
        />
      ))}
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
        {loading ? (
          <div className="thinking">Analyzing your decision…</div>
        ) : (
          feedbackText
        )}
      </div>
    </div>
  );
}

function SessionSummary({ skillResults, onRestart }) {
  const statusMap = {
    correct:   ['Strong',   'correct'],
    partial:   ['Work On',  'partial'],
    incorrect: ['Weak',     'incorrect'],
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
      <button className="restart-btn" onClick={onRestart}>
        Train Again
      </button>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────

export default function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [skillResults, setSkillResults]  = useState({});
  const [decided, setDecided]            = useState(false);
  const [feedback, setFeedback]          = useState(null);   // { grade, loading, text }
  const [showSummary, setShowSummary]    = useState(false);

  const scenario = SCENARIOS[currentIndex];

  const handleDecision = useCallback(async (choice) => {
    if (decided) return;
    setDecided(true);

    const gr = scenario.grading[choice];

    // Update skill results
    setSkillResults(prev => ({ ...prev, [scenario.skill]: gr.g }));

    // Show feedback panel in loading state
    setFeedback({
      grade: { ...gr, skill: scenario.tag },
      loading: true,
      text: '',
    });

    // Call Claude API
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
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `You are a direct, knowledgeable poker coach. Give 2-3 sentences of specific, actionable feedback.

Scenario: ${scenario.body}
Hero's hand: ${scenario.hand.map(c => c.r + c.s).join('')}
Player chose: ${choice}
Correct play: ${scenario.correct}
Assessment: ${gr.g}
Skill being tested: ${scenario.tag}

Be direct. No preamble. Focus on the principle, not just this hand.`,
          }],
        }),
      });

      const data = await res.json();
      const text = data.content?.find(b => b.type === 'text')?.text
        || FALLBACKS[choice][gr.g];

      setFeedback(prev => ({ ...prev, loading: false, text }));
    } catch {
      setFeedback(prev => ({
        ...prev,
        loading: false,
        text: FALLBACKS[choice][gr.g],
      }));
    }
  }, [decided, scenario]);

  const handleNext = () => {
    const next = currentIndex + 1;
    if (next >= SCENARIOS.length) {
      setShowSummary(true);
    } else {
      setCurrentIndex(next);
      setDecided(false);
      setFeedback(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSkillResults({});
    setDecided(false);
    setFeedback(null);
    setShowSummary(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="logo">Poker<em>IQ</em></div>
        <div className="tagline">AI-Powered Skill Training</div>
      </div>

      {/* Skill Tracker */}
      <SkillTracker skillResults={skillResults} />

      {showSummary ? (
        <SessionSummary skillResults={skillResults} onRestart={handleRestart} />
      ) : (
        <>
          {/* Progress */}
          <ProgressDots total={SCENARIOS.length} current={currentIndex} />

          {/* Scenario Card */}
          <div className="scenario-card">
            <div className="card-meta">
              <div className="skill-tag">{scenario.tag}</div>
              <div className="scenario-counter">
                {currentIndex + 1} / {SCENARIOS.length}
              </div>
            </div>

            <TableVisual scenario={scenario} />

            <p className="scenario-body">{scenario.body}</p>
            <p className="scenario-q">{scenario.question}</p>
          </div>

          {/* Action Buttons */}
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

          {/* Feedback Panel */}
          {feedback && (
            <>
              <FeedbackPanel
                grade={feedback.grade}
                loading={feedback.loading}
                feedbackText={feedback.text}
              />
              {!feedback.loading && (
                <button className="next-btn" onClick={handleNext}>
                  {currentIndex < SCENARIOS.length - 1
                    ? 'Next Scenario →'
                    : 'See My Results →'}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}