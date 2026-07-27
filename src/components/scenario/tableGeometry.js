// Pure table geometry for the gameplay canvas — no JSX, no React.
//
// Split out of TableCanvas.jsx on July 27 2026 when the component-budget
// invariant (rule 21) fired at 175/160 lines. Its message says extract rather
// than raise the number, and this was the natural seam: everything here is
// arithmetic over the table box, which is exactly what makes it cheap to test
// exhaustively instead of through a jsdom layout that reports every box as 0x0.

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
// (50,45) r(38,33) is the containing ring whose TOP seat sits highest — 12%
// rather than 6% before. That matters because the villain bubble hangs below
// the top seat and must still clear the board; see bubblePlacement below.
export const SEAT_RING = { cx: 50, cy: 45, rx: 38, ry: 33 };

// The board/pot block, as a fraction of the table box. Measured on desktop,
// where the bubble lives (it is display:none under 700px).
export const BOARD_SPAN = { left: 32.6, right: 67.4, top: 33.6 };
const BUBBLE_HALF = 13;          // bubble half-width, % of table width

/**
 * Where the villain bubble goes, given its seat anchor.
 *
 * Extracted and made pure on July 27 2026 after the seat-ring change broke it.
 * The old code branched on `anchor.y >= 15`, a literal tuned to the OLD ring
 * where the top seat sat at y=6. The new ring puts it at exactly 12–15, so the
 * top seat started matching a rule meant for side seats and the bubble was
 * flung to the far rail with its tail clamped — the founder reported the
 * villain read as having "disappeared" on desktop. Magic numbers that encode
 * another module's geometry break silently when that geometry moves, so the
 * top test is now derived from SEAT_RING itself.
 *
 * Placement rule: always centre the bubble on its seat, so the tail points at
 * the villain. Side seats then clear the board horizontally (the ring is inset
 * far enough), and the top seat clears it VERTICALLY instead, using a shorter
 * drop so it sits in the band between seat and board.
 */
export function bubblePlacement(anchor) {
  const isTopSeat = anchor.y <= SEAT_RING.cy - SEAT_RING.ry + 0.5;
  // Centre on the seat; only pull back if the bubble would leave the table.
  const bx = Math.min(100 - BUBBLE_HALF - 2, Math.max(BUBBLE_HALF + 2, anchor.x));
  // Tail stays pointed at the seat even when the clamp shifts the bubble.
  const tail = Math.min(88, Math.max(12, ((anchor.x - (bx - BUBBLE_HALF)) / (BUBBLE_HALF * 2)) * 100));
  // The top seat's bubble hangs into the band above the board, which is only
  // ~70px tall on desktop — roughly the bubble's own height. A short drop
  // keeps it clear of the board; the few px it overlaps the seat read as the
  // tail connecting to it.
  const dropPx = isTopSeat ? 12 : 24;
  return { bx, tail, dropPx, isTopSeat };
}

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
