// ─── Street indicator bar ─────────────────────────────────────────────────

const STREET_NAMES = ['Preflop', 'Flop', 'Turn', 'River'];

export default function StreetBar({ boardLength }) {
  const current = boardLength === 0 ? 0 : boardLength === 3 ? 1 : boardLength === 4 ? 2 : 3;
  return (
    <div className="street-bar">
      {STREET_NAMES.map((name, i) => (
        <div key={name} className="street-item">
          {i > 0 && <span className="street-sep" />}
          <span className={`street-pip${i < current ? ' street-past' : i === current ? ' street-current' : ''}`}>
            {name}
          </span>
        </div>
      ))}
    </div>
  );
}
