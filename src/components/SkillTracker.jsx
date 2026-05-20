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

export default function SkillTracker({ skillResults }) {
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