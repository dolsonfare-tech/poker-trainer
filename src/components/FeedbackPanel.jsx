export default function FeedbackPanel({ grade, loading, feedbackText, correctAnswer, timedOut }) {
  const subLabel = {
    correct:   'Correct Play',
    partial:   'Acceptable — Not Optimal',
    incorrect: 'Mistake',
  };

  return (
    <div className="feedback">
      <div className="ai-label">⚡ AI Analysis</div>
      <div className="fb-header">
        <div className={`grade-circle ${timedOut ? 'incorrect' : grade.g}`}>
          {timedOut ? '⏱️' : grade.emoji}
        </div>
        <div>
          <div className="grade-title">
            {timedOut ? "Time's Up" : grade.title}
          </div>
          <div className={`grade-sub ${timedOut ? 'incorrect' : grade.g}`}>
            {timedOut ? 'Too slow — treated as incorrect' : subLabel[grade.g]}
          </div>
        </div>
      </div>
      <div className={`skill-pill ${timedOut ? 'incorrect' : grade.g}`}>
        ● {grade.skill}
      </div>
      {(timedOut || grade.g === 'incorrect' || grade.g === 'partial') && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'rgba(39,174,96,0.08)', border: '1px solid rgba(39,174,96,0.2)',
          borderRadius: '8px', padding: '8px 12px', marginBottom: '12px',
          fontFamily: "'Courier New', Courier, monospace", fontSize: '0.72rem',
          letterSpacing: '0.08em',
        }}>
          <span style={{ color: 'var(--green)' }}>✅</span>
          <span style={{ color: 'rgba(242,237,227,0.5)', textTransform: 'uppercase', fontSize: '0.6rem', letterSpacing: '0.15em' }}>Correct play:</span>
          <span style={{ color: 'var(--green)', fontWeight: '600', textTransform: 'capitalize' }}>{correctAnswer}</span>
        </div>
      )}
      <div className="fb-text">
        {loading
          ? <div className="thinking">Analyzing your decision…</div>
          : timedOut
          ? <span style={{ color: 'rgba(242,237,227,0.6)', fontStyle: 'italic' }}>
              {feedbackText}
            </span>
          : feedbackText
        }
      </div>
    </div>
  );
}