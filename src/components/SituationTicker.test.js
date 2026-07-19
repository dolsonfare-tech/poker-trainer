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

test('a scenario with a tableContext renders the FILE line in the ticker', () => {
  render(<SituationTicker scenario={{
    ...base,
    tableContext: 'His file: folded top pair to a check-raise twice tonight.',
  }} />);
  expect(screen.getByText('FILE')).toBeInTheDocument();
  expect(screen.getByText(/folded top pair to a check-raise twice tonight/)).toBeInTheDocument();
});

test('no tableContext, no FILE line', () => {
  render(<SituationTicker scenario={{ ...base, tableContext: null }} />);
  expect(screen.queryByText('FILE')).not.toBeInTheDocument();
});
