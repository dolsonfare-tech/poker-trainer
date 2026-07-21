// The FILE line (comprehension audit C1, July 19, 2026): a scenario's
// tableContext must render at decision time — bodies only show in review,
// and ~20 scenarios grade on session reads the player otherwise never sees.
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { SituationTicker } from './ScenarioCard';

const base = {
  actionHistory: [
    { street: 'PRE', segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
  ],
};

test('a scenario with a tableContext renders the READ line in the ticker', () => {
  render(<SituationTicker scenario={{
    ...base,
    tableContext: 'Folded top pair to a check-raise twice tonight.',
  }} />);
  expect(screen.getByText('READ')).toBeInTheDocument();
  expect(screen.getByText(/Folded top pair to a check-raise twice tonight/)).toBeInTheDocument();
});

test('no tableContext, no READ line', () => {
  render(<SituationTicker scenario={{ ...base, tableContext: null }} />);
  expect(screen.queryByText('READ')).not.toBeInTheDocument();
});

test('the stakes row carries the effective stack when the scenario states one', () => {
  render(<SituationTicker scenario={{ ...base, effectiveStacks: 200, tableContext: null }} />);
  expect(screen.getByText(/\$200 EFFECTIVE/)).toBeInTheDocument();
});

// ── villainSummary street-order relation (July 20, 2026 fix) ────────────────
// The bubble's "acts after/before you" line was computed from POSTFLOP order
// only, so every preflop scenario where the blinds are involved stated the
// opposite of the visible action (hero BB vs a CO open: "acts after you,
// every street" while the CO had already acted). Preflop order = seat index
// order; postflop order = POSTFLOP_ORDER. These pins keep the two apart.
import { villainSummary } from '../utils/ticker';

const seats = (heroPos, villainPos) => {
  const order = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  return order.map((label) => ({
    label,
    state: label === heroPos ? 'hero' : label === villainPos ? 'active' : 'folded',
  }));
};

test('preflop, hero BB vs CO open: villain acted BEFORE hero (blinds close preflop)', () => {
  const v = villainSummary({ board: null, positions: seats('BB', 'CO'), villain: { label: 'Tight Nit' } });
  expect(v.isPostflop).toBe(false);
  expect(v.actsAfter).toBe(false);      // current (pre) street: CO acts first
  expect(v.actsAfterPost).toBe(true);   // but postflop the CO acts after the BB
});

test('postflop, hero BB vs CO: villain acts after hero on every remaining street', () => {
  const v = villainSummary({ board: ['A♠', '7♦', '2♣'], positions: seats('BB', 'CO'), villain: { label: 'Tight Nit' } });
  expect(v.isPostflop).toBe(true);
  expect(v.actsAfter).toBe(true);
});

test('hero CO vs BTN: relation is the same pre and post (no street split needed)', () => {
  const v = villainSummary({ board: null, positions: seats('CO', 'BTN'), villain: { label: 'Maniac' } });
  expect(v.actsAfter).toBe(true);
  expect(v.actsAfterPost).toBe(true);
});
