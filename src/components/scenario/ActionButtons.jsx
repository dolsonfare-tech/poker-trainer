// ─── Action buttons ───────────────────────────────────────────────────────
// Splits each option label at its first "(" so the price detail renders as a
// sub-line rather than crowding the verb.

const CHIP_GLYPHS = { fold: '✕', call: '=', raise: '↑' };

export default function ActionButtons({ options, onDecision, decided }) {
  return (
    <div className="sc2-actions">
      {options.map((opt) => {
        const paren = opt.label.indexOf('(');
        const label = paren > -1 ? opt.label.slice(0, paren).trim() : opt.label;
        const sub = paren > -1 ? opt.label.slice(paren + 1, opt.label.lastIndexOf(')')) : null;
        return (
          <button key={opt.val} className={`act-btn sc2-btn ${opt.cls}`}
            onClick={() => onDecision(opt.val)} disabled={decided}>
            <span className={`sc2-chip ${opt.cls}`}>{CHIP_GLYPHS[opt.cls] ?? '·'}</span>
            <span className="sc2-btn-text">
              <span className="sc2-btn-label">{label}</span>
              {sub && <span className="sc2-btn-sub">{sub}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
