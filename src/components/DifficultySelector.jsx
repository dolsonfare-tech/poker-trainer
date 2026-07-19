import { useState } from 'react';

const DIFFICULTIES = [
  {
    key: 'beginner',
    label: 'Beginner',
    sublabel: 'Learning the game',
    desc: 'Starting hands, clear prices, honest opponents',
    icon: '🂡',
    disabled: false,
  },
  {
    key: 'intermediate',
    label: 'Intermediate',
    sublabel: 'Solid foundation',
    desc: 'Line-reading, sizing tells, tougher prices',
    icon: '♠',
    disabled: false,
  },
  {
    key: 'expert',
    label: 'Expert',
    sublabel: 'Coming soon',
    desc: 'Deep stacks, multi-street plans, villains who adjust',
    icon: '⚡',
    disabled: true,
  },
];

export default function DifficultySelector({ onSelect, initialDifficulty }) {
  // Preselect the level from last session (device memory) — regulars
  // shouldn't re-answer this every time. Guards against a stored value that
  // is stale or disabled (e.g. 'expert' before it ships).
  const [selected, setSelected] = useState(() =>
    DIFFICULTIES.some(d => d.key === initialDifficulty && !d.disabled)
      ? initialDifficulty
      : 'beginner'
  );

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
            className={`ds-card ${selected === d.key ? 'selected' : ''} ${d.disabled ? 'disabled' : ''}`}
            onClick={() => !d.disabled && setSelected(d.key)}
            disabled={d.disabled}
          >
            {d.disabled
              ? <div className="ds-card-coming-badge">Coming Soon</div>
              : selected === d.key && <div className="ds-card-selected-badge">Selected</div>
            }
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
