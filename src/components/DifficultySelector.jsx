import { useState } from 'react';

const DIFFICULTIES = [
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

export default function DifficultySelector({ onSelect }) {
  const [selected, setSelected] = useState('beginner');

  return (
    <div className="ds-container">
      <div className="ds-header">
        <div className="ds-pre-label">Before we begin</div>
        <div className="ds-title">Choose your level</div>
        <div className="ds-subtitle">
          Scenarios are filtered to match your level. Pick honest — the coaching works better when it's calibrated to you.
        </div>
      </div>

      <div className="ds-grid">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.key}
            className={`ds-card ${selected === d.key ? 'selected' : ''}`}
            onClick={() => setSelected(d.key)}
          >
            {selected === d.key && <div className="ds-card-dot" />}
            <div className="ds-card-body">
              <div className="ds-card-icon">{d.icon}</div>
              <div>
                <div className="ds-card-header">
                  <span className="ds-card-label">{d.label}</span>
                  <span className="ds-card-sublabel">{d.sublabel}</span>
                </div>
                <div className="ds-card-desc">{d.desc}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <button className="ds-confirm-btn" onClick={() => onSelect(selected)}>
        Start Session →
      </button>
    </div>
  );
}
