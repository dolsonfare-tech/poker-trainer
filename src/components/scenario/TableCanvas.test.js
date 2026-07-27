// MOD-004 (Wave 2): TableCanvas extracted from ScenarioCard.jsx.
//
// RENDERING only. The seat and villain-bubble geometry moved to
// tableGeometry.js (and tableGeometry.test.js) on July 27 2026 when the
// component-budget invariant fired — jsdom reports every box as 0x0, so
// placement can only be checked as arithmetic, not through a render.
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import TableCanvas from './TableCanvas';

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
