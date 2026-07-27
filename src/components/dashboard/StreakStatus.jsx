import { milestoneProximity, streakAlive } from '../../utils/userStorage';
import { activeDaysLine } from '../../copy';

// ─── Streak status line (M1–M3) ───────────────────────────────────────────
// One factual line under the stats row, priority-ordered. Transient
// post-session moments come first: a Rebuy silently covering a missed day
// (M1), or a broken streak paired with the consistency record so it never
// reads as a bare reset (M2). Steady state: milestone proximity when a
// milestone is within reach (M3), else the held-Rebuy protection note. Quiet
// and factual, no guilt tones (M4).
export default function StreakStatus({ user, sessionDelta }) {
  const { streak, rebuys = 0 } = user;
  if (sessionDelta?.rebuyUsed) {
    return <div className="db-streak-status db-streak-rebuy">🛟 Rebuy used — streak intact</div>;
  }
  if (sessionDelta?.streakBroken) {
    const n = sessionDelta.activeDaysLast30;
    return (
      <div className="db-streak-status db-streak-broken-line">
        {activeDaysLine(n, { surface: 'dashboard' })}
      </div>
    );
  }
  // CA-039: a dead streak must not show proximity ("2 more to a full week") —
  // the count is stale and playing today would start a fresh run at 1, not
  // continue toward the milestone.
  const prox = streakAlive(user) ? milestoneProximity(streak) : null;
  if (prox) {
    // The stats chip directly above already shows the streak count — never
    // repeat info; this line carries only the proximity.
    return (
      <div className="db-streak-status db-streak-proximity">
        {prox.remaining} more to {prox.name} ★
      </div>
    );
  }
  if (rebuys > 0) {
    return (
      <div className="db-streak-status db-streak-held">
        🛟 {rebuys} Rebuy{rebuys > 1 ? 's' : ''} held — covers a missed day
      </div>
    );
  }
  return null;
}
