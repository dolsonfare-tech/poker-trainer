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

// ── Streak status line (M1–M3) ───────────────────────────────────────────
const dash = (props) => render(
  <Dashboard onStartSession={() => {}} onSignOut={() => {}} onRename={() => {}} {...props} />
);

test('milestone proximity shows under the stats row when within reach (M3)', () => {
  dash({ user: { ...createUser('Climber'), streak: 5, sessionsCompleted: 5 } });
  expect(screen.getByText(/5 day streak · 2 more to a full week ★/)).toBeInTheDocument();
});

test('a used Rebuy states it plainly after the session (M1)', () => {
  dash({
    user: { ...createUser('Saver'), streak: 11, rebuys: 0, sessionsCompleted: 11 },
    sessionDelta: { rebuyUsed: true, streakBroken: false, prevStreak: 10 },
  });
  expect(screen.getByText(/Rebuy used — streak intact/)).toBeInTheDocument();
});

test('held Rebuys surface as a protection note in steady state (M1)', () => {
  dash({ user: { ...createUser('Holder'), streak: 9, rebuys: 2, sessionsCompleted: 9 } });
  expect(screen.getByText(/2 Rebuys held/)).toBeInTheDocument();
});

test('a broken streak shows the consistency record, never a bare reset (M2)', () => {
  dash({
    user: { ...createUser('Resetter'), streak: 1, rebuys: 0, sessionsCompleted: 20, activeDaysLast30: 26 },
    sessionDelta: { streakBroken: true, rebuyUsed: false, prevStreak: 20, activeDaysLast30: 26 },
  });
  expect(screen.getByText(/played 26 of the last 30 days/)).toBeInTheDocument();
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
