import { useState } from 'react';
import { hasSupabase } from '../utils/supabase';
import { submitScenarioFeedback } from '../utils/db';
import { track } from '../utils/analytics';

// ─── Disagree box ───────────────────────────────────────────────────────────
// Quiet line under the analysis that expands into fixed-response chips —
// testers flag a grading in one tap instead of screenshotting it for later.
// Keys must match the check constraint on scenario_feedback in schema.sql.
// Exported so FeedbackPanel.test.js can hold these keys against the CHECK
// constraint in supabase/schema.sql. A chip added here without the matching
// migration inserts a value the DB rejects — every flag of that reason 400s in
// production while the UI still says "Logged — thanks."
export const DISAGREE_REASONS = [
  ['grading_wrong',   'The graded answer is wrong'],
  ['deserves_credit', 'My answer deserves credit'],
  ['explanation_off', "Explanation doesn't match"],
  ['other',           'Something else is off'],
];

function DisagreeBox({ scenarioId, choice, result }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error

  const send = async (reason) => {
    if (status === 'sending' || status === 'sent') return;
    setStatus('sending');
    try {
      if (hasSupabase) await submitScenarioFeedback({ scenarioId, choice, result, reason });
      track('scenario_disagree_submitted', { scenario_id: scenarioId, reason, result });
      setStatus('sent');
    } catch (err) {
      console.error('Scenario feedback failed', err);
      track('scenario_disagree_failed', { scenario_id: scenarioId });
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="fb-disagree">
        <div className="fb-disagree-thanks">Logged — thanks. We review the most-flagged hands.</div>
      </div>
    );
  }

  return (
    <div className="fb-disagree">
      {!open ? (
        <button
          className="fb-disagree-toggle"
          onClick={() => { setOpen(true); track('scenario_disagree_opened', { scenario_id: scenarioId, result }); }}
        >
          Disagree? Let us know if we have this wrong
        </button>
      ) : (
        <>
          <div className="fb-disagree-label">What's off here?</div>
          <div className="fb-disagree-chips">
            {DISAGREE_REASONS.map(([key, label]) => (
              <button
                key={key}
                className="fb-disagree-chip"
                disabled={status === 'sending'}
                onClick={() => send(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {status === 'error' && (
            <div className="fb-disagree-error">Couldn't send — check your connection and try again.</div>
          )}
        </>
      )}
    </div>
  );
}

export default function FeedbackPanel({ grade, loading, feedbackText, correctAnswer, timedOut, scenarioId, choice }) {
  const subLabel = {
    correct:   'Recommended Play',
    partial:   'Acceptable — Not Optimal',
    incorrect: 'Mistake',
  };

  return (
    <div className="feedback">
      <div className="ai-label">⚡ Hand Analysis</div>
      <div className="fb-header">
        <div className={`grade-circle ${timedOut ? 'incorrect' : grade.g}`}>
          {timedOut ? '⏱️' : grade.emoji}
        </div>
        <div>
          <div className="grade-title">
            {timedOut ? "Time's Up" : grade.title}
          </div>
          <div className={`grade-sub ${timedOut ? 'incorrect' : grade.g}`}>
            {timedOut ? 'The action passed you by — scored as a miss' : subLabel[grade.g]}
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
          fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: '0.72rem',
          letterSpacing: '0.08em',
        }}>
          <span style={{ color: 'var(--green)' }}>✅</span>
          <span style={{ color: 'rgba(242,237,227,0.5)', textTransform: 'uppercase', fontSize: '0.6rem', letterSpacing: '0.15em' }}>Recommended Play:</span>
          <span style={{ color: 'var(--green)', fontWeight: '600' }}>{correctAnswer}</span>
        </div>
      )}
      <div className="fb-text">
        {loading
          ? <div className="thinking">Analyzing your decision…</div>
          : timedOut
          ? // The fb text is written for the player who chose the recommended
            // play — a timed-out player chose nothing, so frame it as the
            // explanation of the line they never got to take.
            <span style={{ color: 'rgba(242,237,227,0.6)', fontStyle: 'italic' }}>
              <span style={{
                display: 'block', marginBottom: '6px', fontStyle: 'normal',
                textTransform: 'uppercase', fontSize: '0.62rem',
                letterSpacing: '0.12em', color: 'rgba(242,237,227,0.45)',
              }}>
                The thinking behind the recommended play
              </span>
              {feedbackText}
            </span>
          : feedbackText
        }
      </div>
      {!loading && scenarioId && (
        <DisagreeBox
          scenarioId={scenarioId}
          choice={choice}
          result={timedOut ? 'incorrect' : grade.g}
        />
      )}
    </div>
  );
}
