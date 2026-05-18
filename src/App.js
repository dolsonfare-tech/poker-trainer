import { useState, useCallback } from 'react';
import './App.css';

// ─── API Key ───────────────────────────────────────────────────────────────
const CLAUDE_API_KEY = 'YOUR_API_KEY_HERE';

// ─── Scenario Data ─────────────────────────────────────────────────────────
const SCENARIOS = [
  {
    id: 1,
    tag: 'Preflop Hand Selection',
    skill: 'preflop',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      label: 'Aggressive Regular',
      notes: 'Opens wide, 3-bets frequently, applies pressure on all streets',
    },
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
    body: "6-player cash game, $1/$2 blinds. You're in the Big Blind with J♥8♥. The Cutoff is an aggressive regular who opens wide and applies pressure on all streets. He raises to $6. Everyone else folds to you.",
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
    villain: {
      type: 'calling-station',
      label: 'Calling Station',
      notes: 'Calls too wide preflop and postflop, rarely folds to aggression, does not bluff',
    },
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
    body: "You're on the Button in a 6-max game. Everyone folds to you. You hold A♠7♦. The Small Blind is a calling station who plays too many hands and rarely folds. The Big Blind is a solid regular.",
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
    villain: {
      type: 'passive',
      label: 'Passive Regular',
      notes: 'Bets for value only, rarely bluffs, folds to large raises when holding marginal hands',
    },
    positions: [
      { label: 'You',     action: 'Checked',  state: 'hero'   },
      { label: 'Villain', action: 'Bets $15', state: 'active' },
      { label: 'P3',      action: 'Folded',   state: 'folded' },
      { label: 'P4',      action: 'Folded',   state: 'folded' },
      { label: 'P5',      action: 'Folded',   state: 'folded' },
      { label: 'P6',      action: 'Folded',   state: 'folded' },
    ],
    hand: [{ r: 'K', s: '♣', c: 'black' }, { r: 'Q', s: '♦', c: 'red' }],
    board: ['A♠', 'J♥', '3♦'],
    pot: '$40',
    toCall: '$15',
    body: "Heads-up on the flop: A♠ J♥ 3♦. Pot is $40. You hold K♣Q♦ — a gutshot straight draw with two overcards. You checked. The villain is a passive regular who bets when he has it — this bet likely means a strong hand.",
    question: "You're getting 3.6:1 pot odds with 10 outs. What's your play?",
    options: [
      { label: 'Fold',               icon: '🃏', cls: 'fold',  val: 'fold'  },
      { label: 'Call $15',           icon: '📞', cls: 'call',  val: 'call'  },
      { label: 'Check-Raise to $45', icon: '⚡', cls: 'raise', val: 'raise' },
    ],
    correct: 'call',
    grading: {
      fold:  { g: 'incorrect', title: 'Folding Equity Left Behind',   emoji: '❌' },
      call:  { g: 'correct',   title: 'Solid Pot Odds Decision',      emoji: '✅' },
      raise: { g: 'partial',   title: 'Bold Bluff vs Wrong Villain',  emoji: '⚠️' },
    },
  },

  // ── Opponent Modeling Scenarios ──────────────────────────────────────────

  {
    id: 4,
    tag: 'Opponent Modeling',
    skill: 'opponent',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'nit',
      label: 'Tight Nit',
      notes: 'Only plays premium hands, folds to any aggression without top pair or better, almost never bluffs',
    },
    positions: [
      { label: 'UTG (Nit)', action: 'Raises $6', state: 'active' },
      { label: 'HJ',        action: 'Folds',     state: 'folded' },
      { label: 'CO',        action: 'Folds',     state: 'folded' },
      { label: 'BTN (You)', action: '???',        state: 'hero'   },
      { label: 'SB',        action: 'Folds',     state: 'folded' },
      { label: 'BB',        action: 'Folds',     state: 'folded' },
    ],
    hand: [{ r: 'J', s: '♦', c: 'red' }, { r: 'J', s: '♣', c: 'black' }],
    board: null,
    pot: '$9',
    toCall: '$4 more',
    body: "UTG raises to $6. This player is a well-known nit — he has been sitting for 3 hours and this is only his second raise. He plays exclusively premium hands from early position. You're on the Button with J♦J♣.",
    question: 'The nit raises UTG. What do you do with pocket Jacks?',
    options: [
      { label: 'Fold',         icon: '🃏', cls: 'fold',  val: 'fold'  },
      { label: 'Call $4 more', icon: '📞', cls: 'call',  val: 'call'  },
      { label: '3-Bet to $20', icon: '⚡', cls: 'raise', val: 'raise' },
    ],
    correct: 'call',
    grading: {
      fold:  { g: 'incorrect', title: 'Too Much Equity to Fold',    emoji: '❌' },
      call:  { g: 'correct',   title: 'Smart Play vs a Nit',        emoji: '✅' },
      raise: { g: 'partial',   title: '3-Bet Sets Up a Tough Spot', emoji: '⚠️' },
    },
  },
  {
    id: 5,
    tag: 'Opponent Modeling',
    skill: 'opponent',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      label: 'Calling Station',
      notes: 'Calls down with any pair or draw, never folds to aggression, does not respond to bluffs',
    },
    positions: [
      { label: 'UTG',      action: 'Folds',     state: 'folded' },
      { label: 'HJ',       action: 'Folds',     state: 'folded' },
      { label: 'CO (You)', action: '???',        state: 'hero'   },
      { label: 'BTN',      action: 'Folds',     state: 'folded' },
      { label: 'SB',       action: 'Folds',     state: 'folded' },
      { label: 'BB (CS)',  action: 'Called $6', state: 'active' },
    ],
    hand: [{ r: 'A', s: '♥', c: 'red' }, { r: 'K', s: '♥', c: 'red' }],
    board: ['A♣', '7♦', '2♠'],
    pot: '$15',
    toCall: null,
    body: "You raised to $6 preflop with A♥K♥. The Big Blind — a calling station who never folds — called. Flop comes A♣ 7♦ 2♠. You flopped top pair top kicker. The BB checks to you.",
    question: 'You have top pair top kicker vs a calling station. What do you do?',
    options: [
      { label: 'Check Behind',   icon: '🃏', cls: 'fold',  val: 'fold'  },
      { label: 'Bet $8 (small)', icon: '📞', cls: 'call',  val: 'call'  },
      { label: 'Bet $15 (pot)',  icon: '⚡', cls: 'raise', val: 'raise' },
    ],
    correct: 'raise',
    grading: {
      fold:  { g: 'incorrect', title: 'Never Slow Play a Station',   emoji: '❌' },
      call:  { g: 'partial',   title: 'Bet More — They Always Call', emoji: '⚠️' },
      raise: { g: 'correct',   title: 'Max Value vs a Station',      emoji: '✅' },
    },
  },
  {
    id: 6,
    tag: 'Opponent Modeling',
    skill: 'opponent',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'maniac',
      label: 'Maniac',
      notes: 'Raises and re-raises constantly, bluffs at very high frequency, hard to put on a hand',
    },
    positions: [
      { label: 'UTG',          action: 'Folds',     state: 'folded' },
      { label: 'HJ (You)',     action: 'Raised $6', state: 'hero'   },
      { label: 'CO',           action: 'Folds',     state: 'folded' },
      { label: 'BTN (Maniac)', action: '3-Bet $20', state: 'active' },
      { label: 'SB',           action: 'Folds',     state: 'folded' },
      { label: 'BB',           action: 'Folds',     state: 'folded' },
    ],
    hand: [{ r: 'Q', s: '♠', c: 'black' }, { r: 'Q', s: '♥', c: 'red' }],
    board: null,
    pot: '$27',
    toCall: '$14 more',
    body: "You raised to $6 from the HJ with Q♠Q♥. The Button — a maniac who 3-bets over 30% of the time — raises to $20. He's been caught bluffing three times this session alone.",
    question: 'A maniac 3-bets you. What do you do with pocket Queens?',
    options: [
      { label: 'Fold',          icon: '🃏', cls: 'fold',  val: 'fold'  },
      { label: 'Call $14 more', icon: '📞', cls: 'call',  val: 'call'  },
      { label: '4-Bet to $55',  icon: '⚡', cls: 'raise', val: 'raise' },
    ],
    correct: 'raise',
    grading: {
      fold:  { g: 'incorrect', title: 'Never Fold QQ to a Maniac',    emoji: '❌' },
      call:  { g: 'partial',   title: 'Calling Lets Him Bluff Again', emoji: '⚠️' },
      raise: { g: 'correct',   title: '4-Bet and Extract Value',      emoji: '✅' },
    },
  },
  {
    id: 7,
    tag: 'Opponent Modeling',
    skill: 'opponent',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'nit',
      label: 'Tight Nit',
      notes: 'Only continues postflop with strong made hands, folds to large bets on scary boards, never bluffs',
    },
    positions: [
      { label: 'UTG',       action: 'Folds',     state: 'folded' },
      { label: 'HJ',        action: 'Folds',     state: 'folded' },
      { label: 'CO (You)',  action: 'Raised $6', state: 'hero'   },
      { label: 'BTN (Nit)', action: 'Called $6', state: 'active' },
      { label: 'SB',        action: 'Folds',     state: 'folded' },
      { label: 'BB',        action: 'Folds',     state: 'folded' },
    ],
    hand: [{ r: '9', s: '♠', c: 'black' }, { r: '8', s: '♠', c: 'black' }],
    board: ['K♠', '7♠', '2♥'],
    pot: '$15',
    toCall: null,
    body: "You raised CO with 9♠8♠ and the Nit called on the Button. Flop: K♠ 7♠ 2♥. You missed but picked up a flush draw. You're first to act. The nit only continues with strong hands — a King or better.",
    question: 'You have a flush draw on a King-high board vs a nit. What do you do?',
    options: [
      { label: 'Check',         icon: '🃏', cls: 'fold',  val: 'fold'  },
      { label: 'Bet $8',        icon: '📞', cls: 'call',  val: 'call'  },
      { label: 'Bet $15 (pot)', icon: '⚡', cls: 'raise', val: 'raise' },
    ],
    correct: 'raise',
    grading: {
      fold:  { g: 'incorrect', title: 'Give Up Too Early',            emoji: '❌' },
      call:  { g: 'partial',   title: 'Small Bet, Small Fold Equity', emoji: '⚠️' },
      raise: { g: 'correct',   title: 'Nits Fold to Pressure',        emoji: '✅' },
    },
  },
  {
    id: 8,
    tag: 'Opponent Modeling',
    skill: 'opponent',
    difficulty: 'advanced',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      label: 'Calling Station',
      notes: 'Will call any bet size with any pair, draw, or gut shot — bluffing is completely ineffective',
    },
    positions: [
      { label: 'UTG',       action: 'Folds',     state: 'folded' },
      { label: 'HJ',        action: 'Folds',     state: 'folded' },
      { label: 'CO',        action: 'Folds',     state: 'folded' },
      { label: 'BTN (You)', action: 'Raised $6', state: 'hero'   },
      { label: 'SB',        action: 'Folds',     state: 'folded' },
      { label: 'BB (CS)',   action: 'Called $6', state: 'active' },
    ],
    hand: [{ r: '7', s: '♣', c: 'black' }, { r: '6', s: '♣', c: 'black' }],
    board: ['K♥', 'Q♦', '5♠'],
    pot: '$15',
    toCall: null,
    body: "You raised BTN with 7♣6♣. The calling station in the BB called. Flop: K♥ Q♦ 5♠. You completely missed — no pair, no draw. The calling station checks to you.",
    question: 'You have nothing vs a calling station who never folds. What do you do?',
    options: [
      { label: 'Check Behind',  icon: '🃏', cls: 'fold',  val: 'fold'  },
      { label: 'Bet $8',        icon: '📞', cls: 'call',  val: 'call'  },
      { label: 'Bet $15 (pot)', icon: '⚡', cls: 'raise', val: 'raise' },
    ],
    correct: 'fold',
    grading: {
      fold:  { g: 'correct',   title: 'Never Bluff a Station', emoji: '✅' },
      call:  { g: 'incorrect', title: 'Burning Money',         emoji: '❌' },
      raise: { g: 'incorrect', title: 'Expensive Lesson',      emoji: '❌' },
    },
  },
];

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
  const [skillResults, setSkillResults]  = useState({});
  const [decided, setDecided]            = useState(false);
  const [feedback, setFeedback]          = useState(null);
  const [showSummary, setShowSummary]    = useState(false);
  const [coachRead, setCoachRead]        = useState('');
  const [coachLoading, setCoachLoading]  = useState(false);

  const scenario = SCENARIOS[currentIndex];

  const fetchCoachRead = async (results, lastIndex) => {
    setCoachLoading(true);

    const decisionsPlayed = SCENARIOS.slice(0, lastIndex + 1).map(s => ({
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
          model: 'claude-sonnet-4-20250514',
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
          model: 'claude-sonnet-4-20250514',
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
    if (next >= SCENARIOS.length) {
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
        <div className="logo">Poker<em>IQ</em></div>
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
          <ProgressDots total={SCENARIOS.length} current={currentIndex} />

          <div className="scenario-card">
            <div className="card-meta">
              <div className="skill-tag">{scenario.tag}</div>
              <div className="scenario-counter">{currentIndex + 1} / {SCENARIOS.length}</div>
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
                  {currentIndex < SCENARIOS.length - 1 ? 'Next Scenario →' : 'See My Results →'}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}