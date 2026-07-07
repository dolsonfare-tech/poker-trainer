// Regression test for 2-option scenarios. sc_172 (July 2026, founder-requested)
// is the pool's first all-in spot — fold/call only, no third action exists —
// and the first scenario ever authored with fewer than 3 options. This guards
// the decision panel, feedback overlay, and summary against any hidden
// 3-option assumption creeping in later.
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

// Pin local (pre-Supabase) mode, same as App.integration.test.js.
jest.mock('./utils/supabase', () => ({ supabase: null, hasSupabase: false }));

// Shrink the pool to just the 2-option scenario so the session must serve it.
jest.mock('./data/scenarios', () => {
  const actual = jest.requireActual('./data/scenarios');
  return {
    __esModule: true,
    default: actual.default.filter((s) => s.id === 'sc_172'),
  };
});

import App from './App';

test('a 2-option (all-in) scenario plays through to the summary', async () => {
  localStorage.clear();
  const { container } = render(<App />);

  fireEvent.change(screen.getByPlaceholderText('Choose a username'), {
    target: { value: 'Tester' },
  });
  fireEvent.click(screen.getByText(/Let's Play/));
  fireEvent.click(screen.getByText(/Deal Me In/));
  fireEvent.click(screen.getByText('Intermediate'));
  fireEvent.click(screen.getByText(/Start Session/));

  // Exactly two action buttons render, with the authored labels
  const btns = container.querySelectorAll('.act-btn');
  expect(btns).toHaveLength(2);
  // Labels render split at the parenthesis: main label + sub line
  expect(screen.getByText('Fold')).toBeInTheDocument();
  expect(screen.getByText('Call $90 more')).toBeInTheDocument();
  expect(screen.getByText('all-in')).toBeInTheDocument();

  // Decide (the call is the graded-correct line) → feedback overlay renders
  fireEvent.click(btns[1]);
  expect(container.querySelector('.sc2-overlay')).toBeInTheDocument();

  // One-scenario pool → straight to results; summary must render
  fireEvent.click(await screen.findByText(/See My Results/));
  expect(await screen.findByText('Session Complete')).toBeInTheDocument();
});
