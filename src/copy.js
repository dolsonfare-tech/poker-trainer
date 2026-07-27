// ── Shared UI copy ────────────────────────────────────────────────────────────
// Strings whose wording must move together across surfaces. Single-sourcing
// them means a rewording touches this file, not a grep across components.

/**
 * M2 broken-streak "consistency record" line (CA-032). Same underlying fact
 * (days played in the last 30) rendered with each surface's established
 * framing — Dashboard leads with "New run", SessionSummary trails with
 * "One session starts the next run." Previously two hand-maintained copies
 * that would silently diverge on any rewording.
 */
export function activeDaysLine(n, { surface }) {
  if (n == null) {
    return surface === 'dashboard'
      ? 'New run — every session rebuilds the streak.'
      : "You keep showing up — that's what builds the read. One session starts the next run.";
  }
  return surface === 'dashboard'
    ? `New run — you've played ${n} of the last 30 days.`
    : `You've played ${n} of the last 30 days. One session starts the next run.`;
}
