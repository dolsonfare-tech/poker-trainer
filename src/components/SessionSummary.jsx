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

function XPSummary({ sessionXP, streakBonus, totalXP, streak }) {
  return (
    <div style={{
      background: 'rgba(200,168,75,0.07)',
      border: '1px solid rgba(200,168,75,0.18)',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '20px',
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: '0.52rem',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: 'rgba(200,168,75,0.6)',
        marginBottom: '12px',
      }}>
        Session Earnings
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--gold)' }}>+{sessionXP}</div>
          <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.5rem', letterSpacing: '0.1em', color: 'rgba(242,237,227,0.4)', textTransform: 'uppercase' }}>decisions</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--gold)' }}>+25</div>
          <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.5rem', letterSpacing: '0.1em', color: 'rgba(242,237,227,0.4)', textTransform: 'uppercase' }}>session bonus</div>
        </div>
        {streakBonus > 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--yellow)' }}>+{streakBonus}</div>
            <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.5rem', letterSpacing: '0.1em', color: 'rgba(242,237,227,0.4)', textTransform: 'uppercase' }}>🔥 streak bonus</div>
          </div>
        )}
      </div>
      <div style={{
        marginTop: '14px',
        paddingTop: '14px',
        borderTop: '1px solid rgba(200,168,75,0.12)',
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: '0.6rem',
        letterSpacing: '0.1em',
        color: 'rgba(242,237,227,0.5)',
      }}>
        Total: <span style={{ color: 'var(--gold)', fontWeight: '700' }}>{totalXP.toLocaleString()} XP</span>
        {streak > 0 && <span style={{ marginLeft: '10px' }}>🔥 {streak}-day streak</span>}
      </div>
    </div>
  );
}

export default function SessionSummary({ skillResults, coachRead, coachLoading, onRestart, xpData }) {
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

      {xpData && (
        <XPSummary
          sessionXP={xpData.sessionXP}
          streakBonus={xpData.streakBonus}
          totalXP={xpData.xp}
          streak={xpData.streak}
        />
      )}

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