import { toLocalDateString, streakAlive } from '../../utils/userStorage';

// ─── Streak warning (backlog item, pulled into launch scope July 2026) ────
// After 6pm local, if today's session hasn't been played, nudge — protecting
// the streak is the whole retention loop.
export default function StreakWarning({ user }) {
  const now = new Date();
  const playedToday = user.lastSessionDate === toLocalDateString(now);
  if (playedToday || now.getHours() < 18) return null;
  if (!user.sessionsCompleted) return null;                     // CA-045: no nag for brand-new accounts
  const alive = streakAlive(user, now);
  return (
    <div className="db-streak-warning">
      {alive && user.streak > 0
        ? <>🔥 Your <b>{user.streak}-day streak</b> is on the line — play one session before midnight.</>
        : <>🃏 You haven't played today — one session keeps the reads sharp.</>}
    </div>
  );
}
