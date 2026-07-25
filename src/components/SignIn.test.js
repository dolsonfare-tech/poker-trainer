// SignIn guest-first hierarchy (July 2026): a fresh visitor (onGuestPlay set)
// leads with the guest CTA and hides the sign-in stack behind a quiet reveal;
// a used-up guest (no onGuestPlay) sees the sign-in form immediately.
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('../utils/supabase', () => ({
  __esModule: true,
  hasSupabase: true,
  supabase: {
    auth: {
      signInWithOtp: async () => ({ error: null }),
      signInWithOAuth: async () => ({ error: null }),
    },
  },
}));

import SignIn from './SignIn';

test('with onGuestPlay, sign-in is hidden until the reveal link is clicked', () => {
  render(<SignIn onGuestPlay={() => {}} />);

  // Guest CTA is the primary action; the sign-in form is not mounted yet
  expect(screen.getByText(/Play a Free Session/)).toBeInTheDocument();
  expect(screen.queryByPlaceholderText('you@example.com')).not.toBeInTheDocument();

  // Reveal the sign-in stack
  fireEvent.click(screen.getByText(/Already have an account\? Sign in/));

  // Form appears, reveal link disappears, guest button remains
  expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  expect(screen.queryByText(/Already have an account\? Sign in/)).not.toBeInTheDocument();
  expect(screen.getByText(/Play a Free Session/)).toBeInTheDocument();
});

test('without onGuestPlay, the sign-in form renders immediately and no reveal link exists', () => {
  render(<SignIn />);

  expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  expect(screen.queryByText(/Already have an account\? Sign in/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Play a Free Session/)).not.toBeInTheDocument();
});
