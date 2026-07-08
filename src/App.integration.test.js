// Integration test: a brand-new user plays their first full session and
// must land on a rendered session summary. Guards against render crashes
// (blank screen) anywhere in the flow.
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

// Pin local (pre-Supabase) mode: this test exercises the game flow, and CRA's
// jest loads .env, which would otherwise flip the app into auth mode.
jest.mock('./utils/supabase', () => ({ supabase: null, hasSupabase: false }));

import App from './App';

test('new user completes first session and sees the summary', async () => {
  localStorage.clear();
  const { container } = render(<App />);

  // Create profile
  fireEvent.change(screen.getByPlaceholderText('Choose a username'), {
    target: { value: 'Tester' },
  });
  fireEvent.click(screen.getByText(/Let's Play/));

  // Dashboard → difficulty → session (pick intermediate so the difficulty
  // memory has something non-default to remember)
  fireEvent.click(screen.getByText(/Deal Me In/));
  fireEvent.click(screen.getByText('Intermediate'));
  fireEvent.click(screen.getByText(/Start Session/));

  // Single-canvas layout: ticker, hero cards at seat, and villain read all present
  expect(container.querySelector('.st-ticker')).toBeInTheDocument();
  expect(container.querySelector('.st-street')).toBeInTheDocument();
  expect(container.querySelector('.sc2-hero-cards')).toBeInTheDocument();
  expect(container.querySelector('.sc2-strip')).toBeInTheDocument();

  // Deciding brings up the feedback overlay over the table
  fireEvent.click(container.querySelector('.act-btn'));
  expect(container.querySelector('.sc2-overlay')).toBeInTheDocument();
  fireEvent.click(await screen.findByText(/Next Scenario/));

  // Play the remaining 4 hands — always pick the first action button
  for (let i = 1; i < 5; i++) {
    fireEvent.click(container.querySelector('.act-btn'));
    const next = await screen.findByText(i < 4 ? /Next Scenario/ : /See My Results/);
    fireEvent.click(next);
  }

  // The summary must render — a crash here is the "blank screen" bug
  expect(await screen.findByText('Session Complete')).toBeInTheDocument();
  expect(container.querySelector('.ss-score-line')).toBeInTheDocument();
  expect(screen.getByText('Session Impact')).toBeInTheDocument();

  // Let the coach-read fetch settle (no API in tests → fallback copy)
  expect(
    await screen.findByText('No pattern identified yet.')
  ).toBeInTheDocument();

  // Scenario history persisted — the session builder's no-repeat behavior
  // depends on every played hand landing here with its scenarioId
  const stored = JSON.parse(localStorage.getItem('cr_user'));
  expect(Object.keys(stored.scenarioHistory)).toHaveLength(5);
  for (const entry of Object.values(stored.scenarioHistory)) {
    expect(entry).toMatchObject({ seen: 1, lastSeenAt: 1 });
  }

  // Summary offers one-tap chaining plus the quiet dashboard exit
  expect(screen.getByText(/Deal Next Session/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Back to dashboard'));
  expect(await screen.findByText(/Deal Me In/)).toBeInTheDocument();

  // Difficulty memory: the selector preselects the last-played level
  fireEvent.click(screen.getByText(/Deal Me In/));
  const intermediateCard = screen.getByText('Intermediate').closest('.ds-card');
  expect(intermediateCard.className).toContain('selected');
});

test('username is editable from the dashboard, then locked for a week', async () => {
  localStorage.clear();
  render(<App />);

  fireEvent.change(screen.getByPlaceholderText('Choose a username'), {
    target: { value: 'Tester' },
  });
  fireEvent.click(screen.getByText(/Let's Play/));
  expect(await screen.findByText(/Deal Me In/)).toBeInTheDocument();

  // Rename via the topbar ✎
  fireEvent.click(screen.getByLabelText('Edit username'));
  fireEvent.change(screen.getByLabelText('New username'), {
    target: { value: 'RiverRat' },
  });
  fireEvent.click(screen.getByText('Save'));
  expect(await screen.findByText('RiverRat')).toBeInTheDocument();
  expect(screen.getByText('RI')).toBeInTheDocument(); // initials follow the rename

  // Second attempt inside the 7-day window hits the cooldown notice
  fireEvent.click(screen.getByLabelText('Edit username'));
  expect(screen.getByText(/limited to once a week/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('OK'));
  expect(screen.getByText('RiverRat')).toBeInTheDocument();
});
