import { useState } from 'react';
import DUMMY_USER from '../data/dummyUser';
import { SKILL_NAMES } from '../data/constants';

const DIFFICULTY_LABELS = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  expert:       'Expert',
};

const RATING_ORDER = ['red', 'yellow', 'green'];


const RESULT_COLOR = { correct: '#56c878', partial: '#e89028', incorrect: '#e25555' };

function nextRating(current, result) {
  const base = current === 'gray' ? 'red' : current;
  const i = RATING_ORDER.indexOf(base);
  if (result === 'correct')   return RATING_ORDER[Math.min(i + 1, 2)];
  if (result === 'incorrect') return RATING_ORDER[Math.max(i - 1, 0)];
  return current; // partial: no change
}

function HandReview({ entry }) {
  const { scenario, choiceVal, result } = entry;
  const userOption    = scenario.options.find(o => o.val === choiceVal);
  const correctOption = scenario.options.find(o => o.val === scenario.correct);
  const gradeInfo     = choiceVal ? scenario.grading[choiceVal] : null;
  const feedbackText  = scenario.feedback[result];
  const handStr       = scenario.hand.map(c => c.r + c.s).join(' ');
  const boardStr      = scenario.board.join(' ');
  const showCorrect   = choiceVal !== scenario.correct;

  return (
    <div className="ss-hand-review">
      <div className="ss-hr-cards">
        <span className="ss-hr-hand">{handStr}</span>
        <span className="ss-hr-divider">·</span>
        <span className="ss-hr-board">{boardStr}</span>
      </div>
      <div className="ss-hr-body">{scenario.body}</div>
      <div className="ss-hr-plays">
        <div className="ss-hr-play">
          <span className="ss-hr-play-label">You played</span>
          <span className="ss-hr-play-name" style={{ color: RESULT_COLOR[result] }}>
            {choiceVal ? (userOption?.label ?? choiceVal) : 'Time ran out'}
          </span>
          {gradeInfo?.title && (
            <span className="ss-hr-play-title">{gradeInfo.title}</span>
          )}
        </div>
        {showCorrect && (
          <div className="ss-hr-play">
            <span className="ss-hr-play-label">Correct</span>
            <span className="ss-hr-play-name" style={{ color: '#56c878' }}>
              {correctOption?.label ?? scenario.correct}
            </span>
          </div>
        )}
      </div>
      {feedbackText && (
        <div className="ss-hr-feedback">{feedbackText}</div>
      )}
    </div>
  );
}

export default function SessionSummary({ skillResults, sessionHistory = [], coachRead, coachLoading, difficulty, onRestart }) {
  const [activeSkill, setActiveSkill] = useState(null);

  const testedSkills = Object.entries(skillResults);

  const correctCount   = Object.values(skillResults).filter(r => r === 'correct').length;
  const incorrectCount = Object.values(skillResults).filter(r => r === 'incorrect').length;
  const iqDelta  = correctCount * 2 - incorrectCount;
  const iqBefore = DUMMY_USER.pokerScore;
  const iqAfter  = iqBefore + iqDelta;
  const iqDir    = iqDelta > 0 ? 'up' : iqDelta < 0 ? 'down' : 'flat';

  const handsForSkill = (skillKey) =>
    sessionHistory.filter(h => h.scenario.skill === skillKey);

  const activeHands = activeSkill ? handsForSkill(activeSkill) : [];

  return (
    <div className="summary-card">
      <div className="summary-title">Session Complete</div>
      {difficulty && (
        <div className="ss-difficulty-chip">{DIFFICULTY_LABELS[difficulty]}</div>
      )}

      <div className="ss-coach-read">
        <div className="ss-coach-label">🧠 Coach's Read</div>
        {coachLoading ? (
          <div className="thinking">Reading your session...</div>
        ) : (
          <div className="ss-coach-text">{coachRead || 'No pattern identified yet.'}</div>
        )}
      </div>

      <div className="summary-sub" style={{ marginBottom: '12px' }}>Session Impact</div>
      <div className="ss-impact-list">

        <div className="ss-impact-row ss-impact-row-iq">
          <span className="ss-impact-name">Poker IQ</span>
          <div className="ss-impact-right">
            <span className="ss-iq-delta" data-dir={iqDir}>
              {iqDelta > 0 ? `+${iqDelta}` : iqDelta < 0 ? `${iqDelta}` : '—'}
            </span>
          </div>
        </div>

        {testedSkills.map(([key, result]) => {
          const before = DUMMY_USER.skills[key]?.rating ?? 'gray';
          const after  = nextRating(before, result);
          const baseForCompare = before === 'gray' ? 'red' : before;
          const changed  = before !== after;
          const wentUp   = changed && RATING_ORDER.indexOf(after) > RATING_ORDER.indexOf(baseForCompare);
          const tappable = changed;

          return (
            <div
              key={key}
              className={`ss-impact-row${tappable ? ' ss-impact-row-tappable' : ''}`}
              onClick={tappable ? () => setActiveSkill(key) : undefined}
            >
              <span className="ss-impact-name">{SKILL_NAMES[key]}</span>
              <div className="ss-impact-right">
                {changed && (
                  <span className="ss-rating-change" style={{ color: wentUp ? '#56c878' : '#e25555' }}>
                    {wentUp ? '↑' : '↓'}
                  </span>
                )}
                {tappable && <span className="ss-impact-chevron">›</span>}
              </div>
            </div>
          );
        })}
      </div>

      <button className="restart-btn" onClick={onRestart}>Train Again</button>

      {/* Slide-over */}
      {activeSkill && (
        <div className="ss-overlay" onClick={() => setActiveSkill(null)}>
          <div className="ss-slideover" onClick={e => e.stopPropagation()}>
            <div className="ss-slideover-handle" />
            <div className="ss-slideover-header">
              <span className="ss-slideover-title">{SKILL_NAMES[activeSkill]}</span>
              <button className="ss-slideover-close" onClick={() => setActiveSkill(null)}>✕</button>
            </div>
            <div className="ss-slideover-body">
              {activeHands.length > 0
                ? activeHands.map((entry, i) => <HandReview key={i} entry={entry} />)
                : <div className="ss-hr-empty">No hand data available.</div>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
