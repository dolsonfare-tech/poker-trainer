import { useState } from 'react';
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

function personalizeBody(scenario) {
  if (!scenario.body) return null;
  const heroPos    = scenario.positions?.find(p => p.state === 'hero');
  const villainPos = scenario.positions?.find(p => p.state === 'active');
  const heroBase    = heroPos?.label?.split(' ')[0];
  const villainBase = villainPos?.label?.split(' ')[0];
  let text = scenario.body;
  if (villainBase) text = text.replace(new RegExp(`\\b${villainBase}\\b`, 'g'), 'Villain');
  if (heroBase) {
    text = text.replace(new RegExp(`\\b${heroBase} has\\b`, 'g'), 'You have');
    text = text.replace(new RegExp(`\\b${heroBase}\\b`, 'g'), 'You');
  }
  return text;
}

function HandReview({ entry }) {
  const { scenario, choiceVal, result } = entry;
  const userOption    = scenario.options.find(o => o.val === choiceVal);
  const correctOption = scenario.options.find(o => o.val === scenario.correct);
  const handStr       = scenario.hand.map(c => c.r + c.s).join(' ');
  const boardStr      = scenario.board.join(' ');
  const showCorrect = choiceVal !== scenario.correct;

  return (
    <div className="ss-hand-review">
      <div className="ss-hr-cards">
        <span className="ss-hr-hand">{handStr}</span>
        {boardStr && <><span className="ss-hr-divider">·</span><span className="ss-hr-board">{boardStr}</span></>}
      </div>
      <div className="ss-hr-context">
        {scenario.body && (
          <span className="ss-hr-situation">{personalizeBody(scenario)}</span>
        )}
        {scenario.pot && (
          <span className="ss-hr-pot">
            <span className="ss-hr-ctx-label">Pot: </span>
            {scenario.pot}
            {scenario.toCall && <> · To call: {scenario.toCall}</>}
          </span>
        )}
      </div>
      <div className="ss-hr-plays">
        <div className="ss-hr-play">
          <span className="ss-hr-play-label">You played</span>
          <span className="ss-hr-play-name" style={{ color: RESULT_COLOR[result] }}>
            {choiceVal ? (userOption?.label ?? choiceVal) : 'Time ran out'}
          </span>
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
    </div>
  );
}

export default function SessionSummary({ skillResults, sessionHistory = [], coachRead, coachLoading, difficulty, userSkills = {}, onRestart }) {
  const [activeSkill, setActiveSkill] = useState(null);

  const testedSkills = Object.entries(skillResults);

  // Use sessionHistory for accurate totals — skillResults dedupes by skill key
  const correctCount   = sessionHistory.filter(h => h.result === 'correct').length;
  const incorrectCount = sessionHistory.filter(h => h.result === 'incorrect').length;
  const totalHands     = sessionHistory.length;
  const iqDelta  = correctCount * 2 - incorrectCount;
  const iqDir    = iqDelta > 0 ? 'up' : iqDelta < 0 ? 'down' : 'flat';

  const handsForSkill = (skillKey) =>
    sessionHistory.filter(h => h.scenario.skill === skillKey && h.result !== 'correct');

  const activeHands = activeSkill ? handsForSkill(activeSkill) : [];

  const missedHands = sessionHistory.filter(h => h.result !== 'correct');

  return (
    <div className="summary-card">
      <div className="summary-title">Session Complete</div>
      {difficulty && (
        <div className="ss-difficulty-chip">{DIFFICULTY_LABELS[difficulty]}</div>
      )}

      <div className="ss-score-line">
        <span className="ss-score-correct">{correctCount}</span>
        <span className="ss-score-sep"> / </span>
        <span className="ss-score-total">{totalHands}</span>
        <span className="ss-score-label"> correct</span>
      </div>

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

        {testedSkills
          .map(([key, result]) => {
            const before = userSkills[key]?.rating ?? 'gray';
            const after  = nextRating(before, result);
            const baseForCompare = before === 'gray' ? 'red' : before;
            const changed  = before !== after;
            const wentUp   = changed && RATING_ORDER.indexOf(after) > RATING_ORDER.indexOf(baseForCompare);
            return { key, changed, wentUp };
          })
          .filter(({ changed }) => changed)
          .map(({ key, wentUp }) => {
            const tappable = !wentUp;
            return (
              <div
                key={key}
                className={`ss-impact-row${tappable ? ' ss-impact-row-tappable' : ''}`}
                onClick={tappable ? () => setActiveSkill(key) : undefined}
              >
                <span className="ss-impact-name">{SKILL_NAMES[key]}</span>
                <div className="ss-impact-right">
                  <span className="ss-rating-change" style={{ color: wentUp ? '#56c878' : '#e25555' }}>
                    {wentUp ? '↑' : '↓'}
                  </span>
                  {tappable && <span className="ss-impact-chevron">›</span>}
                </div>
              </div>
            );
          })}
      </div>

      {missedHands.length > 0 && (
        <div className="ss-missed-section">
          <div className="summary-sub" style={{ marginBottom: '12px' }}>
            Hands to Review ({missedHands.length})
          </div>
          <div className="ss-missed-list">
            {missedHands.map((entry, i) => <HandReview key={i} entry={entry} />)}
          </div>
        </div>
      )}

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
