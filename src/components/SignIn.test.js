// SignIn guest-first hierarchy (July 2026): a fresh visitor (onGuestPlay set)
// leads with the guest CTA and hides the sign-in stack behind a quiet reveal;
// a used-up guest (no onGuestPlay) sees the sign-in form immediately.
//
// CA-003: auth redirects use REACT_APP_SITE_URL when configured (July 2026).
import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Must be prefixed with 'mock' so jest.mock() hoisting allows the reference.
let mockSignInWithOtp = jest.fn().mockResolvedValue({ error: null });
let mockSignInWithOAuth = jest.fn().mockResolvedValue({ error: null });

jest.mock('../utils/supabase', () => ({
  __esModule: true,
  hasSupabase: true,
  supabase: {
    auth: {
      get signInWithOtp() { return mockSignInWithOtp; },
      get signInWithOAuth() { return mockSignInWithOAuth; },
    },
  },
}));

import SignIn from './SignIn';

beforeEach(() => {
  mockSignInWithOtp = jest.fn().mockResolvedValue({ error: null });
  mockSignInWithOAuth = jest.fn().mockResolvedValue({ error: null });
});

afterEach(() => {
  delete process.env.REACT_APP_SITE_URL;
});

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

// CA-003: emailRedirectTo uses REACT_APP_SITE_URL when configured.
// SITE_URL is a module-scope const (CRA inlines env at build time), so the
// env var must be set BEFORE the module evaluates — re-require it fresh.
test('magic-link uses REACT_APP_SITE_URL when set', async () => {
  process.env.REACT_APP_SITE_URL = 'https://checkraise.ai';
  let FreshSignIn;
  jest.isolateModules(() => {
    // Hand the isolated registry the SAME React instance the renderer uses —
    // a second React copy breaks the hooks dispatcher.
    jest.doMock('react', () => React);
    FreshSignIn = require('./SignIn').default;
  });
  jest.dontMock('react');
  render(<FreshSignIn />);
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
    target: { value: 'test@example.com' },
  });
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: /Email me a sign-in link/ }));
  });
  expect(mockSignInWithOtp).toHaveBeenCalledWith(
    expect.objectContaining({
      options: expect.objectContaining({ emailRedirectTo: 'https://checkraise.ai' }),
    })
  );
});

test('magic-link falls back to window.location.origin when REACT_APP_SITE_URL is not set', async () => {
  // env var absent (cleared in afterEach); window.location.origin is 'http://localhost' in jsdom
  render(<SignIn />);
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
    target: { value: 'test@example.com' },
  });
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: /Email me a sign-in link/ }));
  });
  expect(mockSignInWithOtp).toHaveBeenCalledWith(
    expect.objectContaining({
      options: expect.objectContaining({ emailRedirectTo: window.location.origin }),
    })
  );
});

// CA-003 source pin: both call sites reference the same SITE_URL constant.
// The Google OAuth path is flag-gated (REACT_APP_GOOGLE_AUTH=1) so we verify
// the implementation by reading the source rather than driving the button.
test('source pin: both redirect options reference SITE_URL, not window.location.origin directly', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(
    path.resolve(__dirname, 'SignIn.jsx'),
    'utf8'
  );
  // The constant must be declared
  expect(src).toMatch(/const SITE_URL\s*=/);
  // Neither call site should hard-code window.location.origin as the value
  // (it is only used in the fallback of the SITE_URL definition itself)
  const otpMatch = src.match(/signInWithOtp[\s\S]*?emailRedirectTo:\s*([^\n,}]+)/);
  expect(otpMatch).not.toBeNull();
  expect(otpMatch[1].trim()).toBe('SITE_URL');
  const oauthMatch = src.match(/signInWithOAuth[\s\S]*?redirectTo:\s*([^\n,}]+)/);
  expect(oauthMatch).not.toBeNull();
  expect(oauthMatch[1].trim()).toBe('SITE_URL');
});
