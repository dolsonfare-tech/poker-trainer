// MOD-003 (Wave 2): StreakStatus extracted from Dashboard.jsx.
// The priority order is the contract: rebuy-used > streak-broken > proximity >
// held-rebuys > nothing. Each branch is pinned so a future reorder is a red test.
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import StreakStatus from './StreakStatus';

const user = (over) => ({ streak: 0, rebuys: 0, lastSessionDate: '2026-07-25', sessionsCompleted: 5, ...over });

// streakAlive measures the stored date against the real clock, so a hard-coded
// lastSessionDate makes every assertion below timezone-dependent unless the
// clock is frozen — "yesterday" in EDT is two days ago in CI's UTC. Invariants
// rule 23 pins this pairing repo-wide.
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-07-26T12:00:00'));
});
afterEach(() => { jest.useRealTimers(); });

test('M1: a used Rebuy states it plainly and outranks every other line', () => {
  render(<StreakStatus
    user={user({ streak: 11, rebuys: 3 })}
    sessionDelta={{ rebuyUsed: true, streakBroken: true, activeDaysLast30: 26 }} />);
  expect(screen.getByText(/Rebuy used — streak intact/)).toBeInTheDocument();
  expect(screen.queryByText(/of the last 30 days/)).not.toBeInTheDocument();
});

test('M2: a broken streak shows the consistency record, never a bare reset', () => {
  render(<StreakStatus
    user={user({ streak: 1 })}
    sessionDelta={{ streakBroken: true, rebuyUsed: false, activeDaysLast30: 26 }} />);
  expect(screen.getByText(/played 26 of the last 30 days/)).toBeInTheDocument();
});

test('M3: milestone proximity shows when a milestone is within reach', () => {
  render(<StreakStatus user={user({ streak: 5 })} />);
  expect(screen.getByText(/2 more to a full week ★/)).toBeInTheDocument();
});

test('CA-039: a dead streak shows no proximity — the count is stale', () => {
  render(<StreakStatus user={user({ streak: 5, lastSessionDate: '2026-01-01' })} />);
  expect(screen.queryByText(/more to/)).not.toBeInTheDocument();
});

test('held Rebuys surface as the steady-state protection note', () => {
  render(<StreakStatus user={user({ streak: 9, rebuys: 2 })} />);
  expect(screen.getByText(/2 Rebuys held/)).toBeInTheDocument();
});

test('a single held Rebuy is singular', () => {
  render(<StreakStatus user={user({ streak: 9, rebuys: 1 })} />);
  expect(screen.getByText(/1 Rebuy held/)).toBeInTheDocument();
});

test('nothing to say renders nothing at all', () => {
  const { container } = render(<StreakStatus user={user({ streak: 9, rebuys: 0 })} />);
  expect(container).toBeEmptyDOMElement();
});
