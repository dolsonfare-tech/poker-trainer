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

jest.mock('../utils/analytics', () => ({ track: jest.fn() }));

import SignIn from './SignIn';
import { track } from '../utils/analytics';

beforeEach(() => {
  mockSignInWithOtp = jest.fn().mockResolvedValue({ error: null });
  mockSignInWithOAuth = jest.fn().mockResolvedValue({ error: null });
});

afterEach(() => {
  delete process.env.REACT_APP_SITE_URL;
  delete process.env.REACT_APP_GOOGLE_AUTH;
});

test('with onGuestPlay, sign-in is hidden until the reveal link is clicked', () => {
  render(<SignIn onGuestPlay={() => {}} />);

  // Guest CTA is the primary action; the sign-in form is not mounted yet
  expect(screen.getByText(/Play a Free Session/)).toBeInTheDocument();
  expect(screen.queryByPlaceholderText('you@example.com')).not.toBeInTheDocument();

  // The account path must read as sign-in OR sign-up: the magic link creates
  // the account, so "Already have an account?" told a new visitor — the exact
  // person this screen exists to convert — that the path was not for them.
  const reveal = screen.getByText(/Sign in or create an account/);
  expect(screen.queryByText(/Already have an account/)).not.toBeInTheDocument();
  fireEvent.click(reveal);

  // Form appears, reveal link disappears, and the guest CTA goes with it.
  // This assertion was INVERTED on July 27 2026: it used to require the guest
  // button to remain. A player who tapped sign-in has already declined the
  // free session, so leaving it as the loudest button competes with the choice
  // they just made (founder report).
  expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  expect(screen.queryByText(/Sign in or create an account/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Play a Free Session/)).not.toBeInTheDocument();
  // ...and the subtitle stops advertising "no account needed" once the player
  // is on the account path.
  expect(screen.getByText(/no password needed/)).toBeInTheDocument();
});

test('without onGuestPlay, the sign-in form renders immediately and no reveal link exists', () => {
  render(<SignIn />);

  expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  expect(screen.queryByText(/Sign in or create an account/)).not.toBeInTheDocument();
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
// This stays as a source pin even though the Google button IS now driven
// directly (see the failure-branch tests below, which re-require the module
// with REACT_APP_GOOGLE_AUTH=1): the behavioural tests assert what the user
// sees on failure, while this asserts that neither call site drifts back to
// hard-coding window.location.origin — a change no rendering test would catch.
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

// ── Failure branches (CA-049, Wave 4) ─────────────────────────────────────
// Lines 40-41 and 49-56 were uncovered: every path where auth says no. This is
// the first screen a stranger sees, and a silent failure here reads as "the
// site is broken" with nothing to act on.
test('a rejected magic link surfaces the reason and is tracked', async () => {
  mockSignInWithOtp = jest.fn().mockResolvedValue({
    error: { message: 'Email rate limit exceeded' },
  });
  render(<SignIn />);
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
    target: { value: 'test@example.com' },
  });
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: /Email me a sign-in link/ }));
  });

  expect(screen.getByText('Email rate limit exceeded')).toBeInTheDocument();
  expect(track).toHaveBeenCalledWith('sign_in_link_error', { message: 'Email rate limit exceeded' });
  // The "check your inbox" confirmation must NOT appear — nothing was sent.
  expect(screen.queryByText(/check your (inbox|email)/i)).not.toBeInTheDocument();
});

test('the form re-enables after a failure so the player can retry', async () => {
  mockSignInWithOtp = jest.fn().mockResolvedValue({ error: { message: 'nope' } });
  render(<SignIn />);
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
    target: { value: 'test@example.com' },
  });
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: /Email me a sign-in link/ }));
  });
  expect(screen.getByRole('button', { name: /Email me a sign-in link/ })).toBeEnabled();
});

// The Google button is behind REACT_APP_GOOGLE_AUTH=1, evaluated at module
// scope, so the module must be re-required with the flag set (same pattern the
// SITE_URL test above uses).
const renderWithGoogle = () => {
  process.env.REACT_APP_GOOGLE_AUTH = '1';
  let Fresh;
  jest.isolateModules(() => {
    jest.doMock('react', () => React);
    Fresh = require('./SignIn').default;
  });
  jest.dontMock('react');
  return render(<Fresh />);
};

test('a provider that is not switched on yet reads as "coming soon", not as an error', async () => {
  // Supabase returns "Unsupported provider: provider is not enabled" when the
  // Google provider is off in the dashboard. Showing that raw string to a
  // player blames them for a configuration state they cannot see.
  mockSignInWithOAuth = jest.fn().mockResolvedValue({
    error: { message: 'Unsupported provider: provider is not enabled' },
  });
  renderWithGoogle();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Google/i }));
  });

  expect(screen.getByText(/Google sign-in is coming soon/)).toBeInTheDocument();
  expect(screen.queryByText(/Unsupported provider/)).not.toBeInTheDocument();
  expect(track).toHaveBeenCalledWith('google_sign_in_clicked');
});

test('a genuine Google failure shows the real reason rather than "coming soon"', async () => {
  mockSignInWithOAuth = jest.fn().mockResolvedValue({
    error: { message: 'Network request failed' },
  });
  renderWithGoogle();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Google/i }));
  });

  expect(screen.getByText('Network request failed')).toBeInTheDocument();
  expect(screen.queryByText(/coming soon/)).not.toBeInTheDocument();
});
