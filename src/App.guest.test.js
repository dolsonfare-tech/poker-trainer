// Guest flow (July 2026): a cold visitor plays ONE full free session with no
// account, then hits the sign-in gate everywhere — with their progress held
// in the untagged localStorage cache that first sign-in migrates.
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Supabase mode with no session: the auth listener must land on SignIn, and
// the guest path must never touch the network.
jest.mock('./utils/supabase', () => ({
  __esModule: true,
  hasSupabase: true,
  supabase: {
    auth: {
      onAuthStateChange: (cb) => {
        setTimeout(() => cb('INITIAL_SESSION', null), 0);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null } }),
      signOut: async () => ({ error: null }),
      signInWithOtp: async () => ({ error: null }),
      signInWithOAuth: async () => ({ error: null }),
    },
  },
}));

import App from './App';

test('guest plays one free session, then every path gates to sign-in with progress kept', async () => {
  localStorage.clear();
  const { container } = render(<App />);

  // SignIn screen offers the guest path
  expect(await screen.findByText('Find the leak in your poker game')).toBeInTheDocument();
  fireEvent.click(screen.getByText(/Play a Free Session/));

  // Straight toward the cards: level pick, then deal (no username step)
  expect(await screen.findByText('Choose your level')).toBeInTheDocument();
  fireEvent.click(screen.getByText(/Start Session/));

  // The scenario library is fetched on the first deal (CA-014, Wave 4), so the
  // session screen renders a microtask after this click rather than
  // synchronously. useSessionRun sets screen='session' only AFTER the deck
  // resolves, so waiting for the action row is waiting for the real thing —
  // there is no intermediate empty-session state to catch.
  await waitFor(() => expect(container.querySelector('.act-btn')).toBeInTheDocument());

  for (let i = 0; i < 5; i++) {
    fireEvent.click(container.querySelector('.act-btn'));
    const next = await screen.findByText(i < 4 ? /Next Hand/ : /See My Results/);
    fireEvent.click(next);
  }

  // Summary: coach read replaced by the honest unlock pitch; the chain
  // button is replaced by the sign-in gate
  expect(await screen.findByText('Session Complete')).toBeInTheDocument();
  expect(screen.getByText(/comes with a free account/)).toBeInTheDocument();
  expect(screen.queryByText(/Deal Next Session/)).not.toBeInTheDocument();
  expect(screen.getByText(/Sign In Free to Keep Playing/)).toBeInTheDocument();

  // Progress lives in the untagged cache (= the migration payload shape)
  const stored = JSON.parse(localStorage.getItem('cr_user'));
  expect(stored.displayName).toBe('Guest');
  expect(stored.sessionsCompleted).toBe(1);
  expect(Object.keys(stored.scenarioHistory)).toHaveLength(5);
  expect(localStorage.getItem('cr_user_owner')).toBeNull();

  // Dashboard is also gated
  fireEvent.click(screen.getByText('Back to dashboard'));
  const gateCta = await screen.findByText(/Sign In Free to Keep Playing/);
  expect(screen.getByText(/they carry over to your account/)).toBeInTheDocument();
  expect(screen.queryByText(/Deal Me In/)).not.toBeInTheDocument();

  // Gate → SignIn, now with the carry-over note instead of the guest CTA
  fireEvent.click(gateCta);
  expect(await screen.findByText('Find the leak in your poker game')).toBeInTheDocument();
  expect(screen.getByText(/sign in and they carry over/)).toBeInTheDocument();
  expect(screen.queryByText(/Play a Free Session/)).not.toBeInTheDocument();
  // A used-up guest gets no reveal link — the sign-in form is shown immediately
  expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();

  // The cache survives the gate — it's the migration payload for sign-in
  expect(JSON.parse(localStorage.getItem('cr_user')).sessionsCompleted).toBe(1);
});
