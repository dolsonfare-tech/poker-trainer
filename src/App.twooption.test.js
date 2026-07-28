// Regression test for 2-option scenarios. sc_172 (July 2026, founder-requested)
// is the pool's first all-in spot — fold/call only, no third action exists —
// and the first scenario ever authored with fewer than 3 options. This guards
// the decision panel, feedback overlay, and summary against any hidden
// 3-option assumption creeping in later.
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Pin local (pre-Supabase) mode, same as App.integration.test.js.
jest.mock('./utils/supabase', () => ({ supabase: null, hasSupabase: false }));

// Shrink the pool to just the 2-option scenario so the session must serve it.
jest.mock('./data/scenarios', () => {
  const actual = jest.requireActual('./data/scenarios');
  return {
    __esModule: true,
    ...actual, // keep named exports (VILLAIN_LABELS, CONTRAST_PAIRS) intact
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

  // The scenario library is fetched on the first deal (CA-014, Wave 4), so the
  // session screen renders a microtask after this click rather than
  // synchronously. useSessionRun sets screen='session' only AFTER the deck
  // resolves, so waiting for the action row is waiting for the real thing —
  // there is no intermediate empty-session state to catch.
  await waitFor(() => expect(container.querySelector('.act-btn')).toBeInTheDocument());

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

  // Let the coach-read fetch settle so the chained deal sees persisted state.
  // Phase A removed the summary's coach-read display, so the settle point is
  // no longer a DOM text — wait on the localStorage write submitSession makes
  // instead (same underlying async work, no longer surfaced to the player).
  await waitFor(() => {
    const stored = JSON.parse(localStorage.getItem('cr_user'));
    expect(stored?.sessionsCompleted).toBe(1);
  });

  // One-tap chaining re-deals at the same difficulty. With a pool of one
  // already-played scenario this also proves the least-recently-seen
  // fallback: the builder must serve it again rather than deal nothing.
  fireEvent.click(screen.getByText(/Deal Next Session/));
  // Chaining re-enters startSession, so it is async for the same reason.
  await waitFor(() => expect(container.querySelectorAll('.act-btn')).toHaveLength(2));
  expect(screen.getByText('Call $90 more')).toBeInTheDocument();
});
