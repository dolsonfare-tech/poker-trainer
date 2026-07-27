// villainSummary street-order relation (July 20, 2026 fix) + relationLine.
//
// The bubble's "acts after/before you" line was computed from POSTFLOP order
// only, so every preflop scenario where the blinds are involved stated the
// opposite of the visible action (hero BB vs a CO open: "acts after you,
// every street" while the CO had already acted). Preflop order = seat index
// order; postflop order = POSTFLOP_ORDER. These pins keep the two apart.
//
// Moved here from components/SituationTicker.test.js in Wave 2 (MOD-004):
// these exercise utils/ticker.js, not the component. relationLine joined
// ticker.js in the same wave — TableCanvas and CanvasLayout both render it,
// so it can't live in either.
import { villainSummary, relationLine } from './ticker';

const seats = (heroPos, villainPos) => {
  const order = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  return order.map((label) => ({
    label,
    state: label === heroPos ? 'hero' : label === villainPos ? 'active' : 'folded',
  }));
};

// ── villainSummary ──────────────────────────────────────────────────────────

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

test('no active villain yields no summary', () => {
  expect(villainSummary({ board: null, positions: seats('CO', 'NOBODY') })).toBeNull();
});

test('the monogram is the first letters of the label, capped at two', () => {
  const v = villainSummary({ board: null, positions: seats('CO', 'BTN'), villain: { label: 'Loose Passive Fish' } });
  expect(v.monogram).toBe('LP');
});

// ── relationLine ────────────────────────────────────────────────────────────

test('a relation that holds all hand long claims "every street"', () => {
  const v = villainSummary({ board: ['A♠', '7♦', '2♣'], positions: seats('BB', 'CO'), villain: { label: 'Tight Nit' } });
  expect(relationLine(v)).toBe('Cutoff · acts after you, every street');
});

test('a preflop relation that will flip postflop says so, and never claims "every street"', () => {
  const v = villainSummary({ board: null, positions: seats('BB', 'CO'), villain: { label: 'Tight Nit' } });
  const line = relationLine(v);
  expect(line).toBe('Cutoff · acts before you now, after you postflop');
  expect(line).not.toMatch(/every street/);
});

test('a preflop relation that survives the flop still claims "every street"', () => {
  const v = villainSummary({ board: null, positions: seats('CO', 'BTN'), villain: { label: 'Maniac' } });
  expect(relationLine(v)).toBe('Button · acts after you, every street');
});
