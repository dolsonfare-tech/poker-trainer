import { SKILL_NAMES, SKILL_DESCRIPTIONS } from '../data/constants';

const DIFFICULTY_LABELS = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  expert:       'Expert',
};

export default function SessionSummary({ skillResults, coachRead, coachLoading, difficulty, onRestart }) {
  const statusMap = {
    correct:   ['Strong',  'correct'],
    partial:   ['Work On', 'partial'],
    incorrect: ['Weak',    'incorrect'],
  };

  return (
    <div className="summary-card">
      <div className="summary-title">Session Complete</div>
      {difficulty && (
        <div className="ss-difficulty-chip">{DIFFICULTY_LABELS[difficulty]}</div>
      )}
      <div className="summary-sub">Your Skill Assessment</div>

      {/* Color legend */}
      <div className="ss-legend">
        <span className="ss-legend-item"><span className="ss-dot ss-dot-green" />Strong (75%+)</span>
        <span className="ss-legend-item"><span className="ss-dot ss-dot-yellow" />Work On (50–74%)</span>
        <span className="ss-legend-item"><span className="ss-dot ss-dot-red" />Weak (below 50%)</span>
      </div>

      <div className="skills-list">
        {Object.entries(SKILL_NAMES).map(([key, label]) => {
          const result = skillResults[key];
          const [text, cls] = result ? statusMap[result] : ['Untested', 'untested'];
          return (
            <div key={key} className="skill-row">
              <div className="skill-row-info">
                <span className="skill-row-name">{label}</span>
                <span className="skill-row-desc">{SKILL_DESCRIPTIONS[key]}</span>
              </div>
              <span className={`status-pill ${cls}`}>{text}</span>
            </div>
          );
        })}
      </div>

      <div className="ss-coach-read">
        <div className="ss-coach-label">🧠 Coach's Read</div>
        {coachLoading ? (
          <div className="thinking">Reading your session...</div>
        ) : (
          <div className="ss-coach-text">
            {coachRead || 'No pattern identified yet.'}
          </div>
        )}
      </div>

      <button className="restart-btn" onClick={onRestart}>Train Again</button>
    </div>
  );
}
