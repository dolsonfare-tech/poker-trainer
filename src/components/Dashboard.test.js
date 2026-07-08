// Dashboard account menu (replaces the window.confirm sign-out) and the
// guest-gated CTA — both need a Supabase-mode dashboard, mocked here.
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('../utils/supabase', () => ({ supabase: {}, hasSupabase: true }));
jest.mock('../utils/db', () => ({ submitFeedback: jest.fn() }));

import Dashboard from './Dashboard';
import { createUser } from '../utils/userStorage';

const user = { ...createUser('RiverRat'), sessionsCompleted: 3 };

test('sign-out lives behind the account menu, not a confirm dialog', () => {
  const onSignOut = jest.fn();
  render(<Dashboard user={user} onStartSession={() => {}} onSignOut={onSignOut} onRename={() => {}} />);

  // No menu until the account pill is tapped
  expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
  fireEvent.click(screen.getByTitle('Account'));
  fireEvent.click(screen.getByText('Sign out'));
  expect(onSignOut).toHaveBeenCalled();
});

test('gated guest sees the sign-in CTA instead of Deal Me In', () => {
  const onGuestSignIn = jest.fn();
  const guest = { ...createUser('Guest'), sessionsCompleted: 1 };
  render(<Dashboard user={guest} guest guestGated onGuestSignIn={onGuestSignIn}
    onStartSession={() => {}} onSignOut={() => {}} onRename={() => {}} />);

  expect(screen.queryByText(/Deal Me In/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Edit username')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText(/Sign In Free to Keep Playing/));
  expect(onGuestSignIn).toHaveBeenCalledWith('dashboard');
});
