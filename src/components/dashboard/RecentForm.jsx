import { SKILL_NAMES } from '../../data/constants';

// ─── Recent form ───────────────────────────────────────────────────────────
// The deterministic half of the dashboard's feedback (Phase A, July 2026):
// updates after EVERY session, costs nothing, and can never be slow or wrong.
// The AI read below it speaks over a longer window and refreshes rarely.
//
// Line 2 is conditional by design. Six sessions is ~30 hands across 8 skills,
// so most of the time no skill has earned the right to be named — and this
// strip stays silent rather than hedging (see deriveRecentForm).
//
// Line 3 is a count of real work outstanding, not a points balance: rewards
// that read as informational support intrinsic motivation, rewards that read as
// currency undermine it (M4).

export default function RecentForm({ form }) {
  if (!form || form.total === 0) return null;
  const { windowSize, correct, total, prev, moved, queueDepth } = form;

  const direction = prev && prev.total > 0
    ? (correct > prev.correct ? 'up' : correct < prev.correct ? 'down' : 'flat')
    : null;

  return (
    <div className="db-form">
      <div className="db-form-label">Last {windowSize} session{windowSize === 1 ? '' : 's'}</div>

      <div className="db-form-score">
        <span className="db-form-count">{correct} of {total}</span>
        {direction && (
          <span className="db-form-dir" data-dir={direction}>
            {direction === 'flat'
              ? `level with ${prev.correct}`
              : `${direction === 'up' ? 'up' : 'down'} from ${prev.correct}`}
          </span>
        )}
      </div>

      {moved && (
        <div className="db-form-moved" data-dir={moved.dir}>
          <span className="db-form-moved-skill">{SKILL_NAMES[moved.skill] ?? moved.skill}</span>
          <span className="db-form-moved-word">
            {moved.dir === 'up' ? 'is sharper lately' : 'is slipping lately'}
          </span>
        </div>
      )}

      {queueDepth > 0 && (
        <div className="db-form-queue">
          {queueDepth} hand{queueDepth === 1 ? '' : 's'} waiting to resurface
        </div>
      )}
    </div>
  );
}
