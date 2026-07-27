import { useEffect, useState } from 'react';
import FeedbackPanel from '../FeedbackPanel';
import { villainSummary, relationLine } from '../../utils/ticker';
import { track } from '../../utils/analytics';
import TimerRing from './TimerRing';
import StreetBar from './StreetBar';
import SituationTicker from './SituationTicker';
import TableCanvas from './TableCanvas';
import SessionProgress from './SessionProgress';
import ActionButtons from './ActionButtons';

// ─── Canvas layout ─────────────────────────────────────────────────────────
// Top-level compositor for the gameplay canvas — chrome, street bar, felt,
// feedback overlay, villain strip, ticker, actions. The single-canvas layout
// is the ONLY render path; the legacy two-column felt/cream layout was deleted
// July 2026 (recoverable from git history; the dead-layout invariant blocks
// resurrection by stale revert).

export default function CanvasLayout({
  scenario, currentIndex, total,
  totalSeconds, correctCount, combo = 0,
  options, onDecision, decided,
  showTimer, onTimeout,
  feedback, timedOut, onNext, nextLabel,
  onVillainInfo,
}) {
  const v = villainSummary(scenario);
  // Peek: temporarily lift the feedback overlay so the player can re-study
  // the table (board, pot, seats) — e.g. before flagging a grading they
  // disagree with. Resets on every new hand.
  const [peek, setPeek] = useState(false);
  useEffect(() => { setPeek(false); }, [currentIndex]);
  return (
    <div className="scenario-card sc2">
      <div className="sc2-chrome">
        <div className="skill-tag">{scenario.tag}</div>
        <div className="sc2-chrome-right">
          {/* Combo pill lives in reserved chrome space — it must never shove
              the table down mid-session (old ComboRing banner did) */}
          {combo >= 2 && (
            <span className="sc2-combo">🔥 {combo} in a row</span>
          )}
          {showTimer && (
            <TimerRing key={currentIndex} totalSeconds={totalSeconds}
              paused={decided} onTimeout={onTimeout} />
          )}
          <SessionProgress currentIndex={currentIndex} total={total} correctCount={correctCount} />
        </div>
      </div>

      <StreetBar boardLength={scenario.board ? scenario.board.length : 0} />

      {/* Resurfaced miss (session builder) — label the repeat honestly; the
          comeback is the point, not a hope the player doesn't notice. A
          confident miss (fast + wrong, F2) gets its own line: the
          hypercorrection case wants the player to slow down, not just retry. */}
      {scenario.replay && (
        <div className="sc2-replay-line">
          {scenario.confidentMiss
            ? '⚡ You answered this fast last time — and missed. Take a beat.'
            : '↩ You missed this one before'}
        </div>
      )}

      <div className="sc2-stage">
        <TableCanvas scenario={scenario} key={currentIndex} onVillainInfo={onVillainInfo} />
        {feedback && (
          <>
            <div className={`sc2-overlay${peek ? ' sc2-overlay-peek' : ''}`} aria-hidden={peek}>
              <button
                className="sc2-peek-btn"
                onClick={() => { setPeek(true); track('table_peeked', { scenario_id: scenario.id }); }}
              >
                👁 Show table
              </button>
              <FeedbackPanel
                grade={feedback.grade}
                loading={feedback.loading}
                feedbackText={feedback.text}
                correctAnswer={scenario.options.find(o => o.val === scenario.correct)?.label ?? scenario.correct}
                timedOut={timedOut}
                scenarioId={scenario.id}
                choice={feedback.choice}
              />
              {!feedback.loading && (
                <button className="next-btn" onClick={onNext}>{nextLabel}</button>
              )}
            </div>
            {peek && (
              <button className="sc2-peek-return" onClick={() => setPeek(false)}>
                ← Back to analysis
              </button>
            )}
          </>
        )}
      </div>

      {v && (
        <div className="sc2-villain-mobile">
          <div className="sc2-strip-label">⚑ VILLAIN READ</div>
          <div
            className={`sc2-strip${onVillainInfo ? ' sc2-strip-tappable' : ''}`}
            onClick={onVillainInfo ? () => onVillainInfo(v.label) : undefined}
            role={onVillainInfo ? 'button' : undefined}
          >
            <span className="sc2-monogram">{v.monogram}</span>
            <span className="sc2-strip-text">
              <b>{v.label}</b>
              <span className="sc2-strip-pos">{relationLine(v)}</span>
            </span>
            {onVillainInfo && <span className="sc2-bub-info">ⓘ</span>}
          </div>
        </div>
      )}

      <div className="sc2-history">
        <div className="sc2-history-label">THE HAND SO FAR</div>
        <SituationTicker scenario={scenario} />
      </div>

      {!decided && (
        <ActionButtons options={options} onDecision={onDecision} decided={decided} />
      )}
    </div>
  );
}
