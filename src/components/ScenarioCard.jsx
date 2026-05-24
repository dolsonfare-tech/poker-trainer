import PlayingCard from './PlayingCard';

// ─── Timer Ring ────────────────────────────────────────────────────────────

function TimerRing({ seconds, totalSeconds }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const fraction = seconds / totalSeconds;
  const offset = circumference * (1 - fraction);
  const color = seconds <= 10
    ? 'var(--red)'
    : seconds <= 30
    ? 'var(--yellow)'
    : 'var(--green)';

  return (
    <div style={{ position: 'relative', width: '42px', height: '42px', flexShrink: 0 }}>
      <svg width="42" height="42" viewBox="0 0 42 42" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="21" cy="21" r={radius} fill="none"
          stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle cx="21" cy="21" r={radius} fill="none"
          stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease',
            filter: `drop-shadow(0 0 4px ${color})`,
          }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: '10px', fontWeight: '700', color,
        transition: 'color 0.5s ease',
      }}>
        {seconds}
      </div>
    </div>
  );
}

// ─── Villain Badge ─────────────────────────────────────────────────────────

function VillainBadge({ villain }) {
  return (
    <div style={{
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: '0.55rem', letterSpacing: '0.12em',
      textTransform: 'uppercase', color: 'rgba(242,237,227,0.45)',
      marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px',
    }}>
      <span style={{ color: '#c8a84b' }}>⚠</span> Villain: {villain.label}
    </div>
  );
}

// ─── Table Visual ──────────────────────────────────────────────────────────

function TableVisual({ scenario }) {
  const isRed = (str) => str.includes('♥') || str.includes('♦');
  const boardCount = scenario.board ? scenario.board.length : 0;

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
                animDelay={`${i * 0.08}s`}
              />
            ))}
          </div>
        </>
      )}
      <div className="cards-row">
        {scenario.hand.map((card, i) => (
          <PlayingCard
            key={i}
            rank={card.r}
            suit={card.s}
            color={card.c}
            animDelay={`${(boardCount * 0.08) + (i * 0.08)}s`}
          />
        ))}
      </div>
      <div className="pot-info">
        Pot: <span>{scenario.pot}</span>
        {scenario.toCall && <> &nbsp;·&nbsp; To call: <span>{scenario.toCall}</span></>}
      </div>
    </div>
  );
}

// ─── Scenario Card ─────────────────────────────────────────────────────────

export default function ScenarioCard({ scenario, currentIndex, total, timerSeconds, totalSeconds }) {
  return (
    <div className="scenario-card">
      <div className="card-meta">
        <div className="skill-tag">{scenario.tag}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <TimerRing seconds={timerSeconds} totalSeconds={totalSeconds} />
          <div className="scenario-counter">{currentIndex + 1} / {total}</div>
        </div>
      </div>
      <VillainBadge villain={scenario.villain} />
<TableVisual scenario={scenario} key={currentIndex} />
      <p className="scenario-body">{scenario.body}</p>
      <p className="scenario-q">{scenario.question}</p>
    </div>
  );
}