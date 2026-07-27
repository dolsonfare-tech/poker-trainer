// MOD-003 (Wave 2): StreakWarning extracted from Dashboard.jsx.
// Behaviour pinned here is CA-039 (a lapsed streak never claims to be "on the
// line") and CA-045 (no nag for an account that has never played).
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import StreakWarning from './StreakWarning';

const AFTER_6PM  = new Date('2026-07-26T20:00:00');
const BEFORE_6PM = new Date('2026-07-26T09:00:00');

const user = (over) => ({ streak: 0, rebuys: 0, lastSessionDate: null, sessionsCompleted: 0, ...over });

afterEach(() => { jest.useRealTimers(); });
const at = (when) => { jest.useFakeTimers(); jest.setSystemTime(when); };

test('before 6pm the warning stays silent even with a live streak at risk', () => {
  at(BEFORE_6PM);
  render(<StreakWarning user={user({ streak: 5, lastSessionDate: '2026-07-25', sessionsCompleted: 5 })} />);
  expect(document.querySelector('.db-streak-warning')).toBeNull();
});

test('a session already played today silences the warning', () => {
  at(AFTER_6PM);
  render(<StreakWarning user={user({ streak: 5, lastSessionDate: '2026-07-26', sessionsCompleted: 5 })} />);
  expect(document.querySelector('.db-streak-warning')).toBeNull();
});

test('CA-045: an account with zero sessions is never nagged', () => {
  at(AFTER_6PM);
  render(<StreakWarning user={user()} />);
  expect(document.querySelector('.db-streak-warning')).toBeNull();
});

test('a live streak after 6pm is named and put on the line', () => {
  at(AFTER_6PM);
  render(<StreakWarning user={user({ streak: 5, lastSessionDate: '2026-07-25', sessionsCompleted: 5 })} />);
  expect(screen.getByText(/5-day streak/)).toBeInTheDocument();
  expect(screen.getByText(/on the line/)).toBeInTheDocument();
});

test('CA-039: a lapsed streak gets the plain nudge, never "on the line"', () => {
  at(AFTER_6PM);
  render(<StreakWarning user={user({ streak: 3, rebuys: 2, lastSessionDate: '2026-01-01', sessionsCompleted: 10 })} />);
  expect(screen.getByText(/You haven't played today/)).toBeInTheDocument();
  expect(screen.queryByText(/on the line/)).not.toBeInTheDocument();
});
