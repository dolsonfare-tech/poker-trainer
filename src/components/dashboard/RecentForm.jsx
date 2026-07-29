import { SKILL_NAMES } from '../../data/constants';

// ─── Recent form ───────────────────────────────────────────────────────────
// The deterministic half of the dashboard's feedback (Phase A, July 2026):
// updates after EVERY session, costs nothing, and can never be slow or wrong.
// It closes the Player Profile card — the schema and ledger above it are the
// lifetime read, this is what moved lately.
//
// Laid out as num-over-label cells with hairline dividers, the same register as
// the dashboard's stat row (.db-stat-*), so it reads as part of the card rather
// than a paragraph bolted onto it (founder call, July 28: the earlier stacked
// prose version read as numbers shoved into the corner).
//
// The moved-skill cell is conditional BY DESIGN. Six sessions is ~30 hands
// across 8 skills, so most of the time no skill has cleared MIN_RATED_ATTEMPTS
// and the cell is simply absent — silence, never a hedge (see deriveRecentForm).
// The queue cell counts real work outstanding, not points: rewards that read as
// informational support intrinsic motivation, rewards that read as currency
// undermine it (M4).

const ARROW = { up: '▲', down: '▼', flat: '—' };

export default function RecentForm({ form }) {
  if (!form || form.total === 0) return null;
  const { windowSize, correct, total, prev, moved, queueDepth } = form;

  const comparable = prev && prev.total > 0;
  const dir = comparable
    ? (correct > prev.correct ? 'up' : correct < prev.correct ? 'down' : 'flat')
    : null;

  return (
    <div className="db-form">
      <div className="db-form-row">
        <div className="db-form-cell">
          <span className="db-form-num">
            {correct}<span className="db-form-den">/{total}</span>
            {dir && <span className="db-form-delta" data-dir={dir}>{ARROW[dir]}</span>}
          </span>
          <span className="db-form-cell-label">
            Last {windowSize} session{windowSize === 1 ? '' : 's'}
            {comparable && ` · was ${prev.correct}`}
          </span>
        </div>

        {moved && (
          <>
            <div className="db-form-divider" />
            <div className="db-form-cell db-form-moved" data-dir={moved.dir}>
              <span className="db-form-num db-form-num-word">
                {SKILL_NAMES[moved.skill] ?? moved.skill}
              </span>
              <span className="db-form-cell-label">
                {moved.dir === 'up' ? 'Sharper lately' : 'Slipping lately'}
              </span>
            </div>
          </>
        )}

        {queueDepth > 0 && (
          <>
            <div className="db-form-divider" />
            <div className="db-form-cell db-form-queue">
              <span className="db-form-num">{queueDepth}</span>
              <span className="db-form-cell-label">
                Hand{queueDepth === 1 ? '' : 's'} to resurface
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
