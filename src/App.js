import { useState, useCallback } from 'react';
import './App.css';
import SCENARIOS from './data/scenarios';

const CLAUDE_API_KEY = process.env.REACT_APP_CLAUDE_API_KEY;

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

function getFilteredScenarios(difficulty) {
  const filtered = SCENARIOS.filter(s => s.difficulty === difficulty);
  return [...filtered].sort(() => Math.random() - 0.5);
}

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

function VillainGuide({ onClose }) {
  const [activeTab, setActiveTab] = useState('players');

  const villains = [
    {
      label: 'Tight Nit',
      desc: 'Only plays premium hands from any position. If they bet or raise, they almost always have it — never bluff them off a hand.',
    },
    {
      label: 'Calling Station',
      desc: 'Calls everything down with any pair or draw. Bluffing is useless — bet big for value and never try to make them fold.',
    },
    {
      label: 'Maniac',
      desc: "Raises and re-raises constantly with a wide range including bluffs. Let them bluff into you and trap with strong hands.",
    },
    {
      label: 'Aggressive Regular',
      desc: "Skilled and unpredictable — applies pressure with both value and bluffs. Respect their bets but don't over-fold.",
    },
    {
      label: 'Passive Player',
      desc: 'Checks and calls rather than betting or raising. When they do bet, take it seriously — it usually means a strong hand.',
    },
    {
      label: 'Loose Recreational',
      desc: 'Plays too many hands and chases draws. Bet for value liberally and avoid fancy bluffs — they call too wide to fold.',
    },
    {
      label: 'Tight Recreational',
      desc: "Plays few hands but lacks the skill to fold once they're in. Easy to read but hard to get value from when they fold pre.",
    },
    {
      label: 'Unknown',
      desc: 'No read yet — play solid fundamentals, take notes on their tendencies, and adjust once you have a sample size.',
    },
  ];

  const glossary = [
    {
      label: 'C-bet (Continuation Bet)',
      desc: 'A bet made by the player who raised before the flop, continuing to show aggression on the flop even if it missed their hand.',
    },
    {
      label: '3-bet',
      desc: 'A re-raise over someone who has already raised — the third bet in the sequence.',
    },
    {
      label: '4-bet',
      desc: 'A re-raise over a 3-bet — the fourth bet in the sequence, usually representing a very strong hand.',
    },
    {
      label: 'Open Raise',
      desc: 'The first raise preflop when no one has entered the pot yet.',
    },
    {
      label: 'Pot Odds',
      desc: 'The ratio of the current pot size to the cost of calling — used to decide if chasing a draw is mathematically profitable.',
    },
    {
      label: 'Fold Equity',
      desc: 'The added value of a bet or raise that comes from the chance your opponent will fold, giving you the pot without a showdown.',
    },
    {
      label: 'Range',
      desc: "The full set of hands a player could have in a given situation, rather than one specific hand.",
    },
    {
      label: 'Position',
      desc: 'Where you sit relative to the dealer button. BTN (Button) acts last and has the most advantage. CO (Cutoff) is one seat right of BTN. HJ (Hijack) is two seats right. UTG (Under the Gun) acts first preflop. SB (Small Blind) and BB (Big Blind) act last preflop but first postflop.',
    },
    {
      label: 'Check-raise',
      desc: 'Checking when it is your turn, then raising after your opponent bets — a deceptive move used with strong hands or as a bluff.',
    },
    {
      label: 'Value Bet',
      desc: 'A bet made with a strong hand to get called by weaker hands and win more money.',
    },
    {
      label: 'Bluff',
      desc: 'A bet or raise made with a weak hand to make your opponent fold a better hand.',
    },
    {
      label: 'Donk Bet',
      desc: 'A bet made out of position into the player who had the betting initiative — considered unusual and often signals a strong hand or a mistake.',
    },
    {
      label: 'Slow Play',
      desc: 'Playing a strong hand passively by checking or calling instead of betting, to disguise its strength and trap your opponent.',
    },
    {
      label: 'ICM',
      desc: 'Independent Chip Model — a tournament concept where chip value is not linear, so decisions near the money or final table require extra caution.',
    },
  ];

  const tabStyle = (tab) => ({
    flex: 1,
    padding: '10px',
    background: activeTab === tab ? 'rgba(200,168,75,0.12)' : 'transparent',
    border: 'none',
    borderBottom: activeTab === tab
      ? '2px solid rgba(200,168,75,0.6)'
      : '2px solid rgba(255,255,255,0.07)',
    color: activeTab === tab ? 'var(--gold)' : 'rgba(242,237,227,0.4)',
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '0.6rem',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        animation: 'fadeUp 0.25s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0e2019',
          border: '1px solid rgba(200,168,75,0.2)',
          borderRadius: '20px 20px 0 0',
          padding: '28px 20px 40px',
          width: '100%',
          maxWidth: '660px',
          maxHeight: '82vh',
          overflowY: 'auto',
        }}
      >
        {/* Handle bar */}
        <div style={{
          width: '36px',
          height: '4px',
          background: 'rgba(255,255,255,0.15)',
          borderRadius: '2px',
          margin: '0 auto 24px',
        }} />

        {/* Title row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}>
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: '1.3rem',
            fontWeight: '700',
            color: 'var(--cream)',
          }}>
            Reference Guide
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              color: 'rgba(242,237,227,0.6)',
              cursor: 'pointer',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          marginBottom: '20px',
          gap: '0',
        }}>
          <button style={tabStyle('players')} onClick={() => setActiveTab('players')}>
            Player Types
          </button>
          <button style={tabStyle('glossary')} onClick={() => setActiveTab('glossary')}>
            Glossary
          </button>
        </div>

        {/* Content */}
        <div style={{ display: 'grid', gap: '10px' }}>
          {(activeTab === 'players' ? villains : glossary).map((item, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '12px',
                padding: '14px 16px',
              }}
            >
              <div style={{
                fontFamily: 'Georgia, serif',
                fontSize: '0.9rem',
                fontWeight: '600',
                color: 'var(--gold)',
                marginBottom: '5px',
              }}>
                {item.label}
              </div>
              <div style={{
                fontSize: '0.78rem',
                lineHeight: '1.6',
                color: 'rgba(242,237,227,0.55)',
                fontFamily: "'Courier New', Courier, monospace",
              }}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DifficultySelector({ onSelect }) {
  const [selected, setSelected] = useState('beginner');

  const difficulties = [
    {
      key: 'beginner',
      label: 'Beginner',
      sublabel: 'Learning the game',
      desc: 'Preflop fundamentals, position basics, simple value decisions',
      icon: '🂡',
    },
    {
      key: 'intermediate',
      label: 'Intermediate',
      sublabel: 'Solid foundation',
      desc: 'Postflop play, pot odds, bet sizing, reading passive opponents',
      icon: '♠',
    },
    {
      key: 'advanced',
      label: 'Advanced',
      sublabel: 'Playing to win',
      desc: 'Bluff frequency, exploitative reads, tournament pressure spots',
      icon: '⚡',
    },
  ];

  return (
    <div style={{ animation: 'fadeUp 0.5s ease' }}>

      {/* Hero text */}
      <div style={{ textAlign: 'center', padding: '32px 0 36px' }}>
        <div style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: '0.58rem',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          color: 'rgba(242,237,227,0.35)',
          marginBottom: '12px',
        }}>
          Before we begin
        </div>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: '2rem',
          fontWeight: '700',
          color: 'var(--cream)',
          lineHeight: '1.15',
          marginBottom: '10px',
        }}>
          Choose your level
        </div>
        <div style={{
          fontSize: '0.85rem',
          color: 'rgba(242,237,227,0.45)',
          maxWidth: '280px',
          margin: '0 auto',
          lineHeight: '1.6',
        }}>
          Scenarios are filtered to match your level. Pick honest — the coaching works better when it's calibrated to you.
        </div>
      </div>

      {/* Level cards */}
      <div style={{ display: 'grid', gap: '12px', marginBottom: '32px' }}>
        {difficulties.map((d) => {
          const isSelected = selected === d.key;
          return (
            <button
              key={d.key}
              onClick={() => setSelected(d.key)}
              style={{
                background: isSelected
                  ? 'rgba(200,168,75,0.12)'
                  : 'rgba(255,255,255,0.03)',
                border: isSelected
                  ? '1px solid rgba(200,168,75,0.45)'
                  : '1px solid rgba(255,255,255,0.07)',
                borderRadius: '16px',
                padding: '20px 20px 18px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                width: '100%',
                position: 'relative',
                transform: isSelected ? 'translateX(4px)' : 'none',
              }}
            >
              {/* Selected indicator */}
              {isSelected && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  right: '18px',
                  transform: 'translateY(-50%)',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--gold)',
                  boxShadow: '0 0 10px rgba(200,168,75,0.7)',
                }} />
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{
                  fontSize: '1.4rem',
                  lineHeight: '1',
                  marginTop: '2px',
                  flexShrink: 0,
                }}>
                  {d.icon}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                    <span style={{
                      fontFamily: 'Georgia, serif',
                      fontSize: '1.05rem',
                      fontWeight: '700',
                      color: isSelected ? 'var(--gold)' : 'var(--cream)',
                      transition: 'color 0.2s',
                    }}>
                      {d.label}
                    </span>
                    <span style={{
                      fontFamily: "'Courier New', Courier, monospace",
                      fontSize: '0.55rem',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: isSelected ? 'rgba(200,168,75,0.6)' : 'rgba(242,237,227,0.3)',
                    }}>
                      {d.sublabel}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '0.78rem',
                    color: 'rgba(242,237,227,0.45)',
                    lineHeight: '1.5',
                    fontFamily: "'Courier New', Courier, monospace",
                  }}>
                    {d.desc}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Start button */}
      <button
        onClick={() => onSelect(selected)}
        style={{
          width: '100%',
          background: 'linear-gradient(135deg, rgba(200,168,75,0.22), rgba(200,168,75,0.1))',
          border: '1px solid rgba(200,168,75,0.45)',
          borderRadius: '14px',
          padding: '17px',
          color: 'var(--gold)',
          fontFamily: 'Georgia, serif',
          fontSize: '1rem',
          fontWeight: '600',
          cursor: 'pointer',
          letterSpacing: '0.05em',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => e.target.style.background = 'linear-gradient(135deg, rgba(200,168,75,0.32), rgba(200,168,75,0.16))'}
        onMouseLeave={e => e.target.style.background = 'linear-gradient(135deg, rgba(200,168,75,0.22), rgba(200,168,75,0.1))'}
      >
        Start Session →
      </button>
    </div>
  );
}

function SessionSummary({ skillResults, coachRead, coachLoading, difficulty, onRestart }) {
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
  const [showVillainGuide, setShowVillainGuide] = useState(false);
  const [screen, setScreen]              = useState('difficulty');
  const [difficulty, setDifficulty]      = useState('beginner');
  const [shuffledScenarios, setShuffledScenarios] = useState([]);
  const [currentIndex, setCurrentIndex]  = useState(0);
  const [skillResults, setSkillResults]  = useState({});
  const [decided, setDecided]            = useState(false);
  const [feedback, setFeedback]          = useState(null);
  const [showSummary, setShowSummary]    = useState(false);
  const [coachRead, setCoachRead]        = useState('');
  const [coachLoading, setCoachLoading]  = useState(false);

  const scenario = shuffledScenarios[currentIndex];

  const handleDifficultySelect = (selected) => {
    setDifficulty(selected);
    setShuffledScenarios(getFilteredScenarios(selected));
    setScreen('session');
  };

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
          max_tokens: 600,
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
        </>
      )}
    </div>
  );
}