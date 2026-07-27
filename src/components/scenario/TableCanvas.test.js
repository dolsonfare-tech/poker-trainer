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
  for (let heroIdx = 0; heroIdx < 6; heroIdx++) {
    const hero = seatPercent(heroIdx, heroIdx);
    expect(hero.x).toBeCloseTo(50, 5);   // horizontally centred
    expect(hero.y).toBeCloseTo(88, 5);   // and at the near rail
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
