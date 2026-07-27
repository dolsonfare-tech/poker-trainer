// MOD-004 (Wave 2): TableCanvas extracted from ScenarioCard.jsx, absorbing
// BlankCard and the seatPercent geometry.
//
// seatPercent is exported so the geometry can be checked as arithmetic rather
// than through a jsdom layout that reports every box as 0×0. The guarantee it
// carries: hero always rotates to the bottom of the felt, and no seat is ever
// placed outside the table.
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import TableCanvas, { seatPercent } from './TableCanvas';

const fs = require('fs');
const path = require('path');

const SEATS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

const scenario = (over = {}) => ({
  id: 'sc_test',
  pot: '$14',
  board: ['A♠', '7♦', '2♣'],
  hand: [{ r: 'K', s: '♥', c: 'red' }, { r: 'Q', s: '♥', c: 'red' }],
  villain: { label: 'Tight Nit' },
  positions: SEATS.map((label) => ({
    label,
    action: 'Folds',
    state: label === 'BB' ? 'hero' : label === 'CO' ? 'active' : 'folded',
  })),
  ...over,
});

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

// ── Rendering ──────────────────────────────────────────────────────────────

test('the hero seat is not drawn twice — the hero renders in the hero block only', () => {
  render(<TableCanvas scenario={scenario()} />);
  const seatLabels = [...document.querySelectorAll('.sc2-seat')].map(e => e.textContent);
  expect(seatLabels).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB']);
  expect(document.querySelector('.sc2-you-chip')).toHaveTextContent('BB · YOU');
});

test('the villain seat is marked and the folded seats are dimmed', () => {
  render(<TableCanvas scenario={scenario()} />);
  expect(document.querySelector('.sc2-seat.vill')).toHaveTextContent('CO');
  expect(document.querySelectorAll('.sc2-seat.folded')).toHaveLength(4);
});

test('the board is padded to five slots so the felt never reflows street to street', () => {
  render(<TableCanvas scenario={scenario()} />);
  expect(document.querySelectorAll('.sc2-board .blank-card')).toHaveLength(2);
  render(<TableCanvas scenario={scenario({ board: null })} />);
  expect(document.querySelectorAll('.sc2-board .blank-card').length).toBeGreaterThanOrEqual(5);
});

test('the pot and the spoken hand name render on the felt', () => {
  render(<TableCanvas scenario={scenario()} />);
  expect(screen.getByText('$14')).toBeInTheDocument();
  expect(screen.getByText('KING-QUEEN SUITED')).toBeInTheDocument();
});

test('the villain bubble is inert without an onVillainInfo handler', () => {
  render(<TableCanvas scenario={scenario()} />);
  const bubble = document.querySelector('.sc2-bubble');
  expect(bubble).not.toHaveClass('sc2-bubble-tappable');
  expect(bubble).not.toHaveAttribute('role', 'button');
});

test('with a handler the bubble becomes a button that reports the villain label', () => {
  const onVillainInfo = jest.fn();
  render(<TableCanvas scenario={scenario()} onVillainInfo={onVillainInfo} />);
  const bubble = document.querySelector('.sc2-bubble');
  expect(bubble).toHaveClass('sc2-bubble-tappable');
  fireEvent.click(bubble);
  expect(onVillainInfo).toHaveBeenCalledWith('Tight Nit');
});

test('the bubble tail stays anchored within the bubble it points from', () => {
  render(<TableCanvas scenario={scenario()} />);
  const tail = parseFloat(document.querySelector('.sc2-bub-tail').style.left);
  expect(tail).toBeGreaterThanOrEqual(12);
  expect(tail).toBeLessThanOrEqual(88);
});

test('a hand with no active villain drops the bubble instead of crashing', () => {
  const noVillain = scenario({
    positions: SEATS.map(label => ({ label, action: 'Folds', state: label === 'BB' ? 'hero' : 'folded' })),
  });
  render(<TableCanvas scenario={noVillain} />);
  expect(document.querySelector('.sc2-bubble')).toBeNull();
  expect(document.querySelector('.sc2-table')).not.toBeNull();
});
