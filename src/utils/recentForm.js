// ─── Recent form ───────────────────────────────────────────────────────────
// The dashboard's recent-sessions buffer. It used to also feed a deterministic
// "recent form" strip (Phase A, July 2026); that strip was removed 2026-07-29
// (C″ restructure — see deriveRecentForm's git history for the read it fed).
// This module now owns only the buffer itself: appending a session, newest
// first, capped so it never grows without bound.

// The most sessions the buffer ever retains.
export const RECENT_SESSIONS_CAP = 12;

// Newest first, same ordering as coachReads. Cap drops the oldest.
export function appendRecentSession(recentSessions, session) {
  const prior = Array.isArray(recentSessions) ? recentSessions : [];
  return [session, ...prior].slice(0, RECENT_SESSIONS_CAP);
}
