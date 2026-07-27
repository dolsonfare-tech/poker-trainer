// ─── Session Progress ──────────────────────────────────────────────────────

export default function SessionProgress({ currentIndex, total, correctCount }) {
  return (
    <div className="session-progress">
      <span>Hand <strong>{currentIndex + 1}</strong> / {total}</span>
      <span className="progress-divider">·</span>
      {/* Scores say "correct" (founder, July 8) — the honest-labeling rule
          ("Recommended Play", never "Correct Play") applies to per-hand
          grading claims, not to the running tally. */}
      <span><strong className="correct-count">{correctCount}</strong> correct</span>
    </div>
  );
}
