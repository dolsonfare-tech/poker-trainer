import { parseCoachRead } from '../../utils/coachRead';
import CoachNotebook from './CoachNotebook';

// ─── Last Session's Read ──────────────────────────────────────────────────
// The read belongs to the player profile (founder decision) — a full-width
// strip beneath the schema/ledger columns. Compact: headline + evidence rows +
// watch-for + focus chip; legacy prose reads clamp to ~2 lines.
//
// The notebook must not vanish just because the LATEST session produced no
// read (daily cap / failed call) — with no strip above it, the notebook
// becomes the only surface for the history, latest read included.
export default function LastSessionRead({ coachNote, coachReads, guest }) {
  const readsCount = coachReads?.length ?? 0;
  const showNotebook = !guest && readsCount >= (coachNote ? 2 : 1);
  if (!coachNote && !showNotebook) return null;
  const parsed = coachNote ? parseCoachRead(coachNote.body) : null;

  return (
    <div className="db-profile-read">
      {coachNote && (
        <>
          <div className="db-profile-read-label">Last Session's Read</div>
          {parsed?.structured ? (
            <>
              <div className="db-profile-read-headline">{parsed.structured.headline}</div>
              {parsed.structured.evidence.length > 0 && (
                <ul className="db-profile-read-evidence">
                  {parsed.structured.evidence.map((e, i) => (
                    <li key={i} className="db-profile-read-evidence-row">{e}</li>
                  ))}
                </ul>
              )}
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
          {coachNote.focus && (
            <div className="db-profile-read-focus">
              <span className="db-profile-read-focus-label">Focus this session</span>
              <span className="db-profile-read-focus-skill">{coachNote.focus}</span>
            </div>
          )}
        </>
      )}
      {showNotebook && (
        <CoachNotebook reads={coachReads} includeLatest={!coachNote} />
      )}
    </div>
  );
}
