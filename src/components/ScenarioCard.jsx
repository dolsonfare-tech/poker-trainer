import PlayingCard from './PlayingCard';

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
              <PlayingCard key={i} rank={card.slice(0, -1)} suit={card.slice(-1)} color={isRed(card) ? 'red' : 'black'} small />
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

export default function ScenarioCard({ scenario, currentIndex, total }) {
  return (
    <div className="scenario-card">
      <div className="card-meta">
        <div className="skill-tag">{scenario.tag}</div>
        <div className="scenario-counter">{currentIndex + 1} / {total}</div>
      </div>
      <VillainBadge villain={scenario.villain} />
      <TableVisual scenario={scenario} />
      <p className="scenario-body">{scenario.body}</p>
      <p className="scenario-q">{scenario.question}</p>
    </div>
  );
}