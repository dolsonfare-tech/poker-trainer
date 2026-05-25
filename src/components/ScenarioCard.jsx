import PlayingCard from './PlayingCard';

// ─── Hand name derivation ──────────────────────────────────────────────────

const RANK_NAMES = {
  'A': 'Ace', 'K': 'King', 'Q': 'Queen', 'J': 'Jack',
  'T': 'Ten', '9': 'Nine', '8': 'Eight', '7': 'Seven',
  '6': 'Six', '5': 'Five', '4': 'Four', '3': 'Three', '2': 'Two',
};

function getHandName(hand) {
  const [c1, c2] = hand;
  const r1 = c1.r; const r2 = c2.r;
  const suited = c1.s === c2.s;
  if (r1 === r2) return `Pocket ${RANK_NAMES[r1]}s`;
  return `${RANK_NAMES[r1]}-${RANK_NAMES[r2]} ${suited ? 'Suited' : 'Offsuit'}`;
}

const POSITION_INFO = {
  'UTG': 'Under the Gun · First to act',
  'HJ':  'Hijack · Middle position',
  'CO':  'Cutoff · Strong position',
  'BTN': 'Button · Best position',
  'SB':  'Small Blind · Out of position',
  'BB':  'Big Blind · Closes preflop action',
};

// ─── Street indicator ──────────────────────────────────────────────────────

function getStreet(board) {
  if (!board || board.length === 0) return 'Preflop';
  if (board.length === 3) return 'Flop';
  if (board.length === 4) return 'Turn';
  return 'River';
}

// ─── Timer Ring ────────────────────────────────────────────────────────────

function TimerRing({ seconds, totalSeconds }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - seconds / totalSeconds);
  const color = seconds <= 10 ? 'var(--red)' : seconds <= 30 ? 'var(--yellow)' : 'var(--green)';
  return (
    <div style={{ position: 'relative', width: '42px', height: '42px', flexShrink: 0 }}>
      <svg width="42" height="42" viewBox="0 0 42 42" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="21" cy="21" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle cx="21" cy="21" r={radius} fill="none" stroke={color} strokeWidth="3"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease', filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Courier New', Courier, monospace", fontSize: '10px', fontWeight: '700',
        color, transition: 'color 0.5s ease',
      }}>{seconds}</div>
    </div>
  );
}

// ─── Blank card placeholder ────────────────────────────────────────────────

function BlankCard({ small }) {
  return (
    <div className={`playing-card blank-card ${small ? 'sm' : ''}`}>
      <span className="c-rank" style={{ opacity: 0.18, fontSize: small ? '0.7rem' : '0.9rem' }}>—</span>
    </div>
  );
}

// ─── Table Visual (dark felt section) ─────────────────────────────────────

function TableVisual({ scenario }) {
  const isRed = (str) => str.includes('♥') || str.includes('♦');
  const boardCount = scenario.board ? scenario.board.length : 0;
  const blankCount = scenario.board ? Math.max(0, 5 - boardCount) : 0;

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
              <PlayingCard key={i} rank={card.slice(0, -1)} suit={card.slice(-1)}
                color={isRed(card) ? 'red' : 'black'} small animDelay={`${i * 0.12}s`} />
            ))}
            {Array.from({ length: blankCount }, (_, i) => (
              <BlankCard key={`blank-${i}`} small />
            ))}
          </div>
        </>
      )}
      <div className="pot-info" style={{ fontSize: '0.85rem', letterSpacing: '0.08em', marginTop: '14px' }}>
        Pot: <span>{scenario.pot}</span>
        {scenario.toCall && <> &nbsp;·&nbsp; To call: <span>{scenario.toCall}</span></>}
      </div>
      <div className="hand-label">Your Hand · <span>{getHandName(scenario.hand)}</span></div>
      <div className="cards-row">
        {scenario.hand.map((card, i) => (
          <PlayingCard key={i} rank={card.r} suit={card.s} color={card.c}
            animDelay={`${(boardCount * 0.12) + (i * 0.12)}s`} />
        ))}
      </div>
    </div>
  );
}

// ─── Session Progress ──────────────────────────────────────────────────────

function SessionProgress({ currentIndex, total, correctCount }) {
  return (
    <div className="session-progress">
      <span>Hand <strong>{currentIndex + 1}</strong> / {total}</span>
      <span className="progress-divider">·</span>
      <span><strong className="correct-count">{correctCount}</strong> correct</span>
    </div>
  );
}

// ─── Decision Panel (cream section) ───────────────────────────────────────

function DecisionPanel({ scenario, options, onDecision, decided, actionSublabels }) {
  const street = getStreet(scenario.board);
  const heroPos = scenario.positions.find(p => p.state === 'hero')?.label?.split(' ')[0];
  const villainPos = scenario.positions.find(p => p.state === 'active')?.label?.split(' ')[0];

  return (
    <div className="decision-panel">

      {/* Street + pot header */}
      <div className="dp-header">
        <span className="dp-street">Decision · {street}</span>
        <span className="dp-pot">Pot <strong>{scenario.pot}</strong></span>
      </div>

      {/* Question */}
      <p className="dp-question">{scenario.question}</p>

{/* You Hold */}
      <div className="dp-you-hold">
        <div className="dp-you-hold-cards">
          {scenario.hand.map((card, i) => (
            <div key={i} className={`dp-mini-card ${card.c}`}>
              <span className="dp-mc-rank">{card.r}</span>
              <span className="dp-mc-suit">{card.s}</span>
            </div>
          ))}
        </div>
        <div className="dp-you-hold-info">
          <div className="dp-you-hold-label">You Hold</div>
          {/* HARDCODED hand name — replace with scenario.handDescription in Phase 2 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="dp-you-hold-name">{getHandName(scenario.hand)}</div>
            {POSITION_INFO[heroPos] && (
              <div className="dp-position-info">{POSITION_INFO[heroPos]}</div>
            )}
          </div>
        </div>
      </div>

      {/* Villain Read */}
      <div className="dp-villain-read">
        <div className="dp-vr-header">
          <span className="dp-vr-icon">⚑</span>
          <span className="dp-vr-label">Villain Read</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="dp-vr-name">{scenario.villain.label}</div>
          {POSITION_INFO[villainPos] && (
            <div className="dp-position-info">{POSITION_INFO[villainPos]}</div>
          )}
        </div>
        {scenario.villain.notes && (
          <div className="dp-vr-notes">{scenario.villain.notes}</div>
        )}
      </div>

      {/* Action buttons */}
      <div className="dp-actions">
        {options.map((opt) => (
          <button
            key={opt.val}
            className={`act-btn ${opt.cls}`}
            onClick={() => onDecision(opt.val)}
            disabled={decided}
          >
            <div className="act-icon">{opt.icon}</div>
            <div className="act-btn-content">
              <div className="act-btn-label">
                {opt.label.includes('(') ? opt.label.slice(0, opt.label.indexOf('(')).trim() : opt.label}
              </div>
              {opt.label.includes('(') && (
                <div className="act-btn-sublabel" style={{ color: '#1a1a1a' }}>
                  {opt.label.slice(opt.label.indexOf('(') + 1, opt.label.lastIndexOf(')'))}
                </div>
              )}
              {!opt.label.includes('(') && actionSublabels[opt.cls] && opt.val === opt.cls &&
                ['Fold', 'Call', 'Raise'].some(w => opt.label.toLowerCase().startsWith(w.toLowerCase())) && (
                <div className="act-btn-sublabel">{actionSublabels[opt.cls]}</div>
              )}
            </div>
          </button>
        ))}
      </div>

    </div>
  );
}

// ─── Scenario Card ─────────────────────────────────────────────────────────

export default function ScenarioCard({
  scenario, currentIndex, total,
  timerSeconds, totalSeconds, correctCount,
  options, onDecision, decided, actionSublabels,
}) {
  return (
    <div className="scenario-card">
      {/* Dark header: skill tag + timer + progress */}
      <div className="card-meta">
        <div className="skill-tag">{scenario.tag}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <TimerRing seconds={timerSeconds} totalSeconds={totalSeconds} />
          <SessionProgress currentIndex={currentIndex} total={total} correctCount={correctCount} />
        </div>
      </div>

      {/* Dark felt: table + board + hand */}
      <TableVisual scenario={scenario} key={currentIndex} />

      {/* Cream decision section */}
      <DecisionPanel
        scenario={scenario}
        options={options}
        onDecision={onDecision}
        decided={decided}
        actionSublabels={actionSublabels}
      />
    </div>
  );
}