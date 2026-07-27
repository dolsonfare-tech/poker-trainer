// The FILE line (comprehension audit C1, July 19, 2026): a scenario's
// tableContext must render at decision time — bodies only show in review,
// and ~20 scenarios grade on session reads the player otherwise never sees.
//
// Moved from components/SituationTicker.test.js in Wave 2 (MOD-004); the
// villainSummary half of the old file now lives in utils/ticker.test.js.
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import SituationTicker from './SituationTicker';

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

test("the hero's own action is marked so it reads apart from the villains'", () => {
  render(<SituationTicker scenario={base} />);
  expect(document.querySelector('.st-you')).toHaveTextContent('you call');
});

test('an empty ticker renders nothing rather than an empty strip', () => {
  const { container } = render(<SituationTicker scenario={{ actionHistory: [] }} />);
  expect(container).toBeEmptyDOMElement();
});

// ── Wave 2 shim pin ─────────────────────────────────────────────────────────
// ScenarioCard.jsx keeps a re-export for one release so any stale direct
// importer of the old path stays green. Delete both when the shim goes.
test('the old ScenarioCard path still re-exports SituationTicker (one-release shim)', () => {
  const { SituationTicker: Shimmed } = require('../ScenarioCard');
  expect(Shimmed).toBe(SituationTicker);
});
