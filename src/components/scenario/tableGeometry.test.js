// Pure geometry for the gameplay table: seat placement and villain-bubble
// placement. Split out alongside tableGeometry.js when the component-budget
// invariant fired on TableCanvas.jsx (rule 21).
//
// All of this is arithmetic, which is the point: jsdom reports every box as
// 0x0, so a rendered test cannot check placement at all. These run the real
// numbers across every seat and every hero rotation.
import { seatPercent, bubblePlacement, SEAT_RING, BOARD_SPAN } from './tableGeometry';

const fs = require('fs');
const path = require('path');

// ── Geometry ───────────────────────────────────────────────────────────────

test('every seat lands inside the felt for every hero position', () => {
  for (let heroIdx = 0; heroIdx < 6; heroIdx++) {
    for (let i = 0; i < 6; i++) {
      const { x, y } = seatPercent(i, heroIdx);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  }
});

test('the hero seat is always rotated to the bottom of the table', () => {
  // Asserted as an invariant, not a fixed coordinate: the hero is horizontally
  // centred and is the LOWEST of the six seats. Pinning the literal y would
  // just re-encode the seat ring, so tuning the ring would "fail" this test
  // for no behavioural reason (it did, when the ring moved on July 27 2026).
  for (let heroIdx = 0; heroIdx < 6; heroIdx++) {
    const hero = seatPercent(heroIdx, heroIdx);
    expect(hero.x).toBeCloseTo(50, 5);
    const others = [0, 1, 2, 3, 4, 5].filter(i => i !== heroIdx).map(i => seatPercent(i, heroIdx).y);
    expect(hero.y).toBeGreaterThan(Math.max(...others));
  }
});

test('seats stay distinct — no two players stack on the same spot', () => {
  const seen = new Set(Array.from({ length: 6 }, (_, i) => {
    const { x, y } = seatPercent(i, 3);
    return `${x.toFixed(3)},${y.toFixed(3)}`;
  }));
  expect(seen.size).toBe(6);
});

test('an out-of-range hero index falls back to the default rotation instead of NaN', () => {
  const { x, y } = seatPercent(0, 99);
  expect(Number.isFinite(x)).toBe(true);
  expect(Number.isFinite(y)).toBe(true);
});

// ── Seats must sit INSIDE the felt oval, not on its rim ─────────────────────
// Founder, July 27 2026: "the opposing player position at the top center
// shouldn't hover over the border of the table, it should be in the table like
// the other ones" — and correctly noted it predated the audit. It did, on both
// breakpoints: the seat ring traced the desktop felt's own edge, so the outer
// half of every seat hung off it (worst corner 1.28 desktop / 1.41 mobile).
//
// The felt is an ELLIPSE, so a bounding-box comparison is not good enough — a
// box can sit inside the bbox while its corners are outside the curve. That
// exact mistake is why the hero-card overlap shipped past an e2e guard. This
// test does real ellipse math, and derives the felt from App.css so that
// changing an inset re-checks seat containment automatically instead of
// silently invalidating the numbers.
describe('seat containment (true ellipse, both breakpoints)', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'App.css'), 'utf8');

  // `inset: T R B L` in % of the table box -> the felt's ellipse.
  const feltEllipses = [...css.matchAll(/\.sc2-felt\s*\{[^}]*?inset:\s*([^;]+);/g)].map((m) => {
    const [t, r, b, l] = m[1].trim().split(/\s+/).map(v => parseFloat(v));
    const left = l, right = 100 - r, top = t, bottom = 100 - b;
    return { cx: (left + right) / 2, cy: (top + bottom) / 2,
             rx: (right - left) / 2, ry: (bottom - top) / 2 };
  });

  const seatPx = css.match(/\.sc2-seat\s*\{[^}]*?width:\s*(\d+)px;\s*height:\s*(\d+)px/);
  const SEAT_W = Number(seatPx[1]), SEAT_H = Number(seatPx[2]);

  // Each felt is paired with the table box of ITS OWN breakpoint, as measured
  // by the e2e suite. Crossing them (desktop felt vs mobile seat ratios) is a
  // combination that cannot occur, and checking it produces a false failure.
  // App.css source order: the base rule is desktop, the @media override mobile.
  const BREAKPOINTS = [
    { name: 'desktop', felt: feltEllipses[0], table: { w: 720, h: 400 } },
    { name: 'mobile',  felt: feltEllipses[1], table: { w: 328, h: 315 } },
  ];

  test('App.css yields two felt ellipses and a seat size', () => {
    expect(feltEllipses).toHaveLength(2);   // desktop base + mobile override
    expect(SEAT_W).toBeGreaterThan(0);
    expect(SEAT_H).toBeGreaterThan(0);
  });

  for (const { name, felt, table } of BREAKPOINTS) {
    test(`every seat sits fully inside the felt at ${name} size`, () => {
      const halfW = (SEAT_W / 2) / table.w * 100;
      const halfH = (SEAT_H / 2) / table.h * 100;
      const norm = (x, y) =>
        ((x - felt.cx) ** 2) / (felt.rx ** 2) + ((y - felt.cy) ** 2) / (felt.ry ** 2);
      let worst = 0;
      for (let hero = 0; hero < 6; hero++) {
        for (let i = 0; i < 6; i++) {
          const { x, y } = seatPercent(i, hero);
          for (const sx of [-halfW, halfW]) {
            for (const sy of [-halfH, halfH]) {
              worst = Math.max(worst, norm(x + sx, y + sy));
            }
          }
        }
      }
      // 1.0 is exactly on the curve; require a real margin so sub-pixel
      // rounding can never decide the result (the taptargets lesson).
      expect(worst).toBeLessThan(0.98);
    });
  }
});

// ── Villain bubble placement ────────────────────────────────────────────────
// Founder, July 27 2026: "the villain read has disappeared from the desktop
// version" (critical), and "the villain description ... on the left or the
// right side come very close to overlapping with the main cards".
//
// Cause of the first: the placement branched on the literal `anchor.y >= 15`,
// tuned to the OLD seat ring where the top seat sat at y=6. The new ring puts
// it at 12, so the top seat began matching a rule written for side seats and
// its bubble was flung to the opposite rail with the tail clamped — the read
// no longer appeared anywhere near the villain. A literal encoding another
// module's geometry breaks silently when that geometry moves, so the top test
// is now derived from SEAT_RING and these pin the behaviour.
describe('villain bubble placement', () => {
  const HALF = 13;
  const anchors = () => {
    const seen = new Map();
    for (let hero = 0; hero < 6; hero++) {
      for (let i = 0; i < 6; i++) {
        if (i === hero) continue;
        const a = seatPercent(i, hero);
        seen.set(`${a.x.toFixed(2)},${a.y.toFixed(2)}`, a);
      }
    }
    return [...seen.values()];
  };

  test('the top-centre seat hangs its bubble below itself, never flung to a rail', () => {
    const top = anchors().find(a => Math.abs(a.x - 50) < 0.01);
    expect(top).toBeDefined();
    const { bx, isTopSeat } = bubblePlacement(top);
    expect(isTopSeat).toBe(true);
    // The regression put this at 79% while the seat is at 50%.
    expect(bx).toBeCloseTo(top.x, 5);
  });

  test('every bubble stays centred on its own seat, so the tail can reach it', () => {
    for (const a of anchors()) {
      const { bx, tail } = bubblePlacement(a);
      // The tail is a % across the bubble; converting back must land on the seat.
      const tailX = (bx - HALF) + (tail / 100) * (HALF * 2);
      expect(tailX).toBeCloseTo(a.x, 1);
    }
  });

  test('side bubbles clear the board horizontally', () => {
    for (const a of anchors()) {
      const { bx, isTopSeat } = bubblePlacement(a);
      if (isTopSeat) continue;              // clears vertically instead
      const left = bx - HALF, right = bx + HALF;
      const clears = right <= BOARD_SPAN.left || left >= BOARD_SPAN.right;
      expect({ anchor: a.x, left, right, clears }).toMatchObject({ clears: true });
    }
  });

  test('the top bubble clears the board vertically on desktop', () => {
    const top = anchors().find(a => Math.abs(a.x - 50) < 0.01);
    const { dropPx } = bubblePlacement(top);
    const TABLE_H = 400, BUBBLE_H = 71;     // measured desktop values
    const topPx = (top.y / 100) * TABLE_H + dropPx;
    const boardTopPx = (BOARD_SPAN.top / 100) * TABLE_H;
    expect(topPx + BUBBLE_H).toBeLessThanOrEqual(boardTopPx);
  });

  test('no bubble runs off the table', () => {
    for (const a of anchors()) {
      const { bx } = bubblePlacement(a);
      expect(bx - HALF).toBeGreaterThanOrEqual(0);
      expect(bx + HALF).toBeLessThanOrEqual(100);
    }
  });

  test('the top-seat test is derived from the ring, not a literal', () => {
    const ringTop = SEAT_RING.cy - SEAT_RING.ry;
    expect(bubblePlacement({ x: 50, y: ringTop }).isTopSeat).toBe(true);
    expect(bubblePlacement({ x: 50, y: ringTop + 5 }).isTopSeat).toBe(false);
  });
});
