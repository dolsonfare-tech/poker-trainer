import { parseCoachRead } from '../../utils/coachRead';
import CoachNotebook from './CoachNotebook';

// ─── Coach's Read ──────────────────────────────────────────────────────────
// The read belongs to the player profile (founder decision) — a full-width
// strip beneath the schema/ledger columns. Compact: headline and watch-for
// (diagnosis and prescription); evidence bullets and the date live in the
// notebook (Past Reads). Legacy prose reads clamp to ~2 lines (C″, 2026-07-29).
//
// Phase B: the read is no longer the latest session's alone — it's a trend
// read over a trailing window of sessions, refreshed every five sessions
// rather than every one. The notebook below it is the archive of previous
// reads, not "everything but today."
//
// The notebook must not vanish just because the LATEST refresh produced no
// read (cap / failed call) — with no strip above it, the notebook becomes
// the only surface for the history, latest read included.
export default function LastSessionRead({ coachNote, coachReads, guest }) {
  const readsCount = coachReads?.length ?? 0;
  const showNotebook = !guest && readsCount >= (coachNote ? 2 : 1);
  if (!coachNote && !showNotebook) return null;
  const parsed = coachNote ? parseCoachRead(coachNote.body) : null;

  return (
    <div className="db-profile-read">
      {coachNote && (
        <>
          <div className="db-profile-read-label">Coach's Read</div>
          {parsed?.structured ? (
            <>
              <div className="db-profile-read-headline">{parsed.structured.headline}</div>
              {parsed.structured.watchFor && (
                <div className="db-profile-read-watchfor">
                  <span className="db-profile-read-wf-label">Watch for</span>
                  <span className="db-profile-read-wf-text">{parsed.structured.watchFor}</span>
                </div>
              )}
            </>
          ) : (
            <p className="db-profile-read-prose">{parsed?.legacy}</p>
          )}
        </>
      )}
      {showNotebook && (
        <CoachNotebook reads={coachReads} includeLatest={!coachNote} />
      )}
    </div>
  );
}
