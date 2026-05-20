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

export default function SessionSummary({ skillResults, coachRead, coachLoading, onRestart }) {
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