// ─── Recent form ───────────────────────────────────────────────────────────
// The deterministic half of the dashboard's feedback (Phase A, July 2026). The
// AI read speaks over a 10-session window because a skill needs ~5 attempts
// before it can be named; this strip speaks over SIX because its value is the
// comparison ("19 of 30, up from 16") and a comparison needs two windows of
// history — a 10-session strip would show no direction until session 20.
//
// The two windows differ ON PURPOSE. Do not unify them.

// Trailing-6 plus previous-6 is the most the strip ever reads.
export const RECENT_SESSIONS_CAP = 12;
export const RECENT_FORM_WINDOW = 6;

// Newest first, same ordering as coachReads. Cap drops the oldest.
export function appendRecentSession(recentSessions, session) {
  const prior = Array.isArray(recentSessions) ? recentSessions : [];
  return [session, ...prior].slice(0, RECENT_SESSIONS_CAP);
}
