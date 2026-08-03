import { parseCoachRead } from '../../utils/coachRead';
import CoachNotebook from './CoachNotebook';

// ─── Coach's Read ──────────────────────────────────────────────────────────
// The read belongs to the player profile (founder decision) — a full-width
// strip beneath the schema/ledger columns. v3: two sentences joined into one
// short paragraph — the observation, then why it costs and what to do about it.
// The date lives in the notebook (Past Reads); so do the evidence bullets of
// reads written before v3 dropped them. Legacy prose reads clamp to ~2 lines
// (C″, 2026-07-29).
//
// Phase B: the read is no longer the latest session's alone — it's a trend
// read over a trailing window of sessions, refreshed every five sessions
// rather than every one. The notebook below it is the archive of previous
// reads, not "everything but today."
//
// The notebook must not vanish just because the LATEST refresh produced no
// read (cap / failed call) — with no strip above it, the notebook becomes
// the only surface for the history, latest read included.
// `coachLimited`: the server's 5-a-day coach cap swallowed this session's
// refresh. Before July 29 2026 that produced nothing at all — the card sat
// unchanged with no explanation, which reads as a broken feature rather than a
// constraint. Naming the limit turns a silent defect into an honest one.
export default function LastSessionRead({ coachNote, coachReads, guest, coachLimited }) {
  const readsCount = coachReads?.length ?? 0;
  const showNotebook = !guest && readsCount >= (coachNote ? 2 : 1);
  if (!coachNote && !showNotebook && !coachLimited) return null;
  const parsed = coachNote ? parseCoachRead(coachNote.body) : null;

  return (
    <div className="db-profile-read">
      {coachNote && (
        <>
          <div className="db-profile-read-label">Coach's Read</div>
          {parsed?.structured ? (
            // v3 (August 2, 2026): the two fields are sentence one and sentence
            // two of ONE paragraph, so they are joined here rather than laid out
            // as a headline over a labelled "Watch for" row. The split layout was
            // right when watchFor was a separate prescription; it now cuts a
            // two-sentence thought in half and puts a form label in the middle
            // of it. Old three-field reads join here too (the card never showed
            // their evidence), but their fields predate the terminal-punctuation
            // rule — the split layout never needed periods — so each part is
            // period-ized before the join or every pre-v3 read renders as a
            // run-on until its owner's next read fires, up to five sessions away.
            <div className="db-profile-read-headline">
              {[parsed.structured.headline, parsed.structured.watchFor]
                .filter(Boolean)
                .map((s) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`))
                .join(' ')}
            </div>
          ) : (
            <p className="db-profile-read-prose">{parsed?.legacy}</p>
          )}
        </>
      )}
      {coachLimited && (
        <div className="db-profile-read-capped">
          {'♠\uFE0E'} Coach is out for the day — back tomorrow.
        </div>
      )}
      {showNotebook && (
        <CoachNotebook reads={coachReads} includeLatest={!coachNote} />
      )}
    </div>
  );
}
