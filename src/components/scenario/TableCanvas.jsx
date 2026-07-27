import PlayingCard from '../PlayingCard';
import { villainSummary, relationLine } from '../../utils/ticker';
import getHandName from '../../utils/handName';

// ═══ Single-canvas table (sc2) ═════════════════════════════════════════════
// The felt itself: seats, villain bubble, pot, board, hero cards.
//
// ⚠ The `.sc2-table` width law — `.sc2-table` needs its explicit width:100% in
// App.css. `.sc2-stage` is a single-cell grid, and a grid item with
// `margin:0 auto` whose children are all absolutely positioned collapses to
// 0px wide without one; the table then renders as a vertical line while every
// functional test stays green. Screenshot the canvas after touching that CSS.

// ─── Blank card placeholder ────────────────────────────────────────────────

function BlankCard({ small }) {
  return (
    <div className={`playing-card blank-card ${small ? 'sm' : ''}`}>
      <span className="c-rank" style={{ opacity: 0.18, fontSize: small ? '0.7rem' : '0.9rem' }}>—</span>
    </div>
  );
}

// Seat angles per seat index [UTG..BB]; hero is rotated to the bottom.
const SEAT_BASE_ANGLES = [180, 240, 300, 0, 60, 120];

// ─── Seat ring (founder report, July 27 2026) ──────────────────────────────
// Seat CENTRES sit on this ellipse, expressed as % of the .sc2-table box.
//
// It used to be (50, 47) r(44, 41), which traced the DESKTOP felt's own edge
// (that felt is inset 7%/6%/13%/6% -> centre (50,47) r(44,40)). Placing seat
// centres on the felt's edge guarantees the outer half of every seat hangs off
// it, and measurement confirmed it: all five visible seats were outside the
// felt ellipse on desktop (worst corner 1.23-1.28) and on mobile (up to 1.41),
// with the top-centre seat the most obvious. Reported as "the opposing player
// position at the top center shouldn't hover over the border of the table" —
// and noted as pre-existing, which it was, on both breakpoints.
//
// The ring must clear the rim on BOTH felts, which are different shapes:
//   desktop  inset 7% 6% 13% 6%  -> centre (50,47) r(44,40), seat half 2.4/4.3%
//   mobile   inset 4% 3% 14% 3%  -> centre (50,45) r(47,41), seat half 5.2/5.4%
// Solving the worst of all 4 seat-box corners x 6 seats x 6 hero rotations
// against both felts, (50,46) r(38,31) is the LARGEST ring that fits — seats
// stay as close to the rail as they can without crossing it. Worst corner
// 0.912 desktop / 0.942 mobile. Pinned by seatPercent's containment test.
const SEAT_RING = { cx: 50, cy: 46, rx: 38, ry: 31 };

export function seatPercent(i, heroIdx) {
  const heroBase = SEAT_BASE_ANGLES[heroIdx] ?? 120;
  const offset = (180 - heroBase + 360) % 360;
  const angleDeg = ((SEAT_BASE_ANGLES[i] + offset) % 360 + 360) % 360;
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: SEAT_RING.cx + SEAT_RING.rx * Math.cos(rad),
    y: SEAT_RING.cy + SEAT_RING.ry * Math.sin(rad),
  };
}

export default function TableCanvas({ scenario, onVillainInfo }) {
  const positions = scenario.positions;
  const heroIdx = positions.findIndex(p => p.state === 'hero');
  const villainIdx = positions.findIndex(p => p.state === 'active');
  const v = villainSummary(scenario);
  const isRed = (str) => str.includes('♥') || str.includes('♦');
  const boardCount = scenario.board ? scenario.board.length : 0;
  const blankCount = Math.max(0, 5 - boardCount);
  const heroPos = positions[heroIdx]?.label?.split(' ')[0] ?? 'YOU';
  const anchor = villainIdx !== -1 ? seatPercent(villainIdx, heroIdx) : null;

  return (
    <div className="sc2-table">
      <div className="sc2-felt" />

      {positions.map((p, i) => {
        if (i === heroIdx) return null;
        const { x, y } = seatPercent(i, heroIdx);
        const cls = p.state === 'active' ? ' vill' : p.state === 'folded' ? ' folded' : '';
        return (
          <div key={i} className={`sc2-seat${cls}`} style={{ left: `${x}%`, top: `${y}%` }}>
            {p.label.split(' ')[0]}
          </div>
        );
      })}

      {v && anchor && (() => {
        // Keep the bubble clear of the center cards: top seats hang it
        // straight down; mid/low seats push it to the outer rail side.
        const HALF = 13; // bubble half-width, % of table width
        let bx = anchor.x;
        if (anchor.y >= 15) bx = anchor.x < 50 ? Math.min(bx, 21) : Math.max(bx, 79);
        bx = Math.min(87 - HALF / 2, Math.max(13 + HALF / 2, bx));
        // Tail keeps pointing at the seat even when the bubble shifts
        const tail = Math.min(88, Math.max(12, ((anchor.x - (bx - HALF)) / (HALF * 2)) * 100));
        return (
          <div
            className={`sc2-bubble${onVillainInfo ? ' sc2-bubble-tappable' : ''}`}
            style={{ left: `${bx}%`, top: `calc(${anchor.y}% + 24px)` }}
            onClick={onVillainInfo ? () => onVillainInfo(v.label) : undefined}
            role={onVillainInfo ? 'button' : undefined}
            title={onVillainInfo ? `About the ${v.label}` : undefined}
          >
            <span className="sc2-bub-tail" style={{ left: `${tail}%` }} />
            <div className="sc2-bub-head">
              <span className="sc2-monogram">{v.monogram}</span>
              <span className="sc2-bub-name">{v.label}</span>
              {onVillainInfo && <span className="sc2-bub-info">ⓘ</span>}
            </div>
            <div className="sc2-bub-pos">{relationLine(v)}</div>
          </div>
        );
      })()}

      <div className="sc2-center">
        <div className="sc2-pot">
          <span className="sc2-pot-label">POT</span>
          <span className="sc2-pot-amt">{scenario.pot}</span>
        </div>
        <div className="sc2-board">
          {scenario.board && scenario.board.map((card, i) => (
            <PlayingCard key={i} rank={card.slice(0, -1)} suit={card.slice(-1)}
              color={isRed(card) ? 'red' : 'black'} animDelay={`${i * 0.12}s`} />
          ))}
          {Array.from({ length: blankCount }, (_, i) => (
            <BlankCard key={`blank-${i}`} />
          ))}
        </div>
      </div>

      <div className="sc2-hero">
        <div className="sc2-hero-cards">
          {scenario.hand.map((c, i) => (
            <PlayingCard key={i} rank={c.r} suit={c.s} color={c.c} animDelay={`${i * 0.1}s`} />
          ))}
        </div>
        <div className="sc2-hand-name">{getHandName(scenario.hand).toUpperCase()}</div>
        <span className="sc2-you-chip">
          {heroPos.toUpperCase() === 'YOU' ? 'YOU' : `${heroPos} · YOU`}
        </span>
      </div>
    </div>
  );
}
