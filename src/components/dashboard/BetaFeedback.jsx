import { useState } from 'react';
import { track } from '../../utils/analytics';
import { hasSupabase } from '../../utils/supabase';
import { submitFeedback } from '../../utils/db';

// ─── Beta feedback ─────────────────────────────────────────────────────────
// Quiet one-liner at the dashboard bottom that expands into a category +
// text form. Inserts into the Supabase `feedback` table (insert-only RLS);
// in localStorage-only mode (dev/jest, no backend) it still renders and
// "sends" so the UI stays testable — nothing persists there by design.
// Exported for the schema contract in BetaFeedback.test.js: these keys are a
// CHECK-constrained column, so a category added here without the matching
// migration is a rejected insert the UI still reports as sent.
export const FEEDBACK_CATEGORIES = [
  ['gameplay', 'Gameplay'],
  ['scenarios', 'Scenarios'],
  ['technical', 'Technical'],
  ['idea', 'Idea'],
];

export default function BetaFeedback() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(null);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');

  const submit = async () => {
    if (!category || !text.trim() || status === 'sending') return;
    setStatus('sending');
    setError('');
    try {
      if (hasSupabase) await submitFeedback(category, text.trim());
      track('feedback_submitted', { category, length: text.trim().length });
      setStatus('sent');
    } catch (err) {
      console.error('Feedback failed', err);
      track('feedback_submit_failed');
      setError("Couldn't send — check your connection and try again.");
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="db-beta">
        <div className="db-beta-thanks">🃏 Dealt to the founders — thank you.</div>
      </div>
    );
  }

  return (
    <div className="db-beta">
      {!open ? (
        <button className="db-beta-toggle" onClick={() => { setOpen(true); track('feedback_opened'); }}>
          <span className="db-beta-chip">Beta</span>
          Something broken, boring, or brilliant? Tell us →
        </button>
      ) : (
        <div className="db-beta-form">
          <div className="db-beta-head">
            <span className="db-beta-chip">Beta</span>
            Feedback on gameplay, scenarios, technical issues, or ideas
          </div>
          <div className="db-beta-cats">
            {FEEDBACK_CATEGORIES.map(([key, label]) => (
              <button
                key={key}
                className={`db-beta-cat ${category === key ? 'db-beta-cat-active' : ''}`}
                onClick={() => setCategory(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            className="db-beta-text"
            rows={3}
            maxLength={2000}
            placeholder="What happened — or what should exist?"
            value={text}
            onChange={e => setText(e.target.value)}
          />
          {error && <div className="db-beta-error">{error}</div>}
          <div className="db-beta-actions">
            <button className="db-beta-cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button
              className="db-beta-send"
              disabled={!category || !text.trim() || status === 'sending'}
              onClick={submit}
            >
              {status === 'sending' ? 'Sending…' : 'Send feedback'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
