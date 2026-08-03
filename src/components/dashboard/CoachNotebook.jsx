import { useState } from 'react';
import { parseCoachRead } from '../../utils/coachRead';
import { formatShortDate } from '../../utils/dates';
import { emitCoachNotebookOpened } from '../../utils/events';

// ─── Coach's Notebook ──────────────────────────────────────────────────────
// The latest Coach's Read lives in the strip above; every prior read is kept in
// the history (user.coachReads, newest first). This is a quiet, in-place list —
// no modal. A collapsed row is date + headline; tapping expands the full read.
// Hidden when there are fewer than two reads total (the strip already shows the
// only one) and for guests (the caller gates that).

export default function CoachNotebook({ reads, includeLatest = false }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null); // index of the expanded row
  // The newest read is normally the one shown in the strip above — exclude it.
  // When there's no strip (latest session produced no read), the notebook is
  // the only surface for the history, so include everything.
  const past = includeLatest ? (reads ?? []) : (reads ?? []).slice(1);
  if (past.length < 1) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) emitCoachNotebookOpened(past.length);
  };

  return (
    <div className="db-notebook">
      <button className="db-notebook-toggle" onClick={toggle} aria-expanded={open}>
        <span className="db-notebook-arrow">{open ? '▾' : '▸'}</span>
        Past reads · {past.length}
      </button>
      {open && (
        <ul className="db-notebook-list">
          {past.map((r, i) => {
            const parsed = parseCoachRead(r.body);
            const isOpen = expanded === i;
            const headline = parsed?.structured ? parsed.structured.headline : (parsed?.legacy ?? '');
            return (
              <li key={i} className="db-notebook-item">
                <button
                  className="db-notebook-row"
                  aria-expanded={isOpen}
                  onClick={() => setExpanded(isOpen ? null : i)}
                >
                  <span className="db-notebook-date">{formatShortDate(r.date)}</span>
                  <span className={`db-notebook-headline${isOpen ? '' : ' db-notebook-clamp'}`}>
                    {headline}
                  </span>
                </button>
                {/* Legacy prose has no separate detail — its "headline" IS the
                    whole read, so expanding just un-clamps the row (a detail
                    block would duplicate the text; founder-reported July 19). */}
                {/* Two read generations render here at once, and both stay
                    correct because the notebook is an ARCHIVE — old reads are
                    never rewritten (the append-only discipline in spirit).
                    A pre-v3 read has evidence bullets and a prescription, so it
                    keeps its bullets and its "Watch for" label. A v3 read is two
                    sentences: the row above is sentence one, so the detail is
                    sentence two alone, unlabelled, and the row plus the detail
                    read as the one paragraph the card shows. Labelling it would
                    put a form field in the middle of a sentence pair. */}
                {isOpen && parsed?.structured && (
                  <div className="db-notebook-detail">
                    {parsed.structured.evidence.length > 0 && (
                      <ul className="db-profile-read-evidence">
                        {parsed.structured.evidence.map((e, j) => (
                          <li key={j} className="db-profile-read-evidence-row">{e}</li>
                        ))}
                      </ul>
                    )}
                    {parsed.structured.watchFor && (
                      <div className="db-profile-read-watchfor">
                        {parsed.structured.evidence.length > 0 && (
                          <span className="db-profile-read-wf-label">Watch for</span>
                        )}
                        <span className="db-profile-read-wf-text">{parsed.structured.watchFor}</span>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
