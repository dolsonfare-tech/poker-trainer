import { buildTicker } from '../../utils/ticker';

// ─── Situation ticker (felt) ──────────────────────────────────────────────
// Street-by-street action summary. Derivation logic (incl. the R2/R4/R6
// inference rules that used to live in buildActionTrail) is in utils/ticker.js.

export default function SituationTicker({ scenario }) {
  const { stakes, rows } = buildTicker(scenario);
  if (rows.length === 0) return null;
  return (
    <div className="st-ticker">
      <span className="st-row st-stakes">{stakes}</span>
      {rows.map((row) => (
        <span key={row.street} className="st-row">
          <span className="st-street">{row.street}</span>
          {row.segments.map((seg, i) => (
            <span key={i}>
              {i > 0 && <span className="st-sep"> · </span>}
              <span className={seg.you ? 'st-you' : undefined}>{seg.text}</span>
            </span>
          ))}
        </span>
      ))}
      {/* Session-level read (July 19, 2026 comprehension audit C1): tableContext
          was graded on but never rendered — ~20 scenarios turned on reads the
          player couldn't see. If a scenario has a table file, it shows here. */}
      {scenario.tableContext && (
        <span className="st-row st-tablefile">
          <span className="st-street st-read-label">READ</span>
          <span>{scenario.tableContext}</span>
        </span>
      )}
    </div>
  );
}
