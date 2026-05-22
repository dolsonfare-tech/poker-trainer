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
    <div style={{ animation: 'fadeUp 0.5s ease' }}>
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

      <div style={{ display: 'grid', gap: '12px', marginBottom: '32px' }}>
        {DIFFICULTIES.map((d) => {
          const isSelected = selected === d.key;
          return (
            <button
              key={d.key}
              onClick={() => setSelected(d.key)}
              style={{
                background: isSelected ? 'rgba(200,168,75,0.12)' : 'rgba(255,255,255,0.03)',
                border: isSelected ? '1px solid rgba(200,168,75,0.45)' : '1px solid rgba(255,255,255,0.07)',
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
                <div style={{ fontSize: '1.4rem', lineHeight: '1', marginTop: '2px', flexShrink: 0 }}>
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
        onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(200,168,75,0.32), rgba(200,168,75,0.16))'}
        onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(200,168,75,0.22), rgba(200,168,75,0.1))'}
      >
        Start Session →
      </button>
    </div>
  );
}