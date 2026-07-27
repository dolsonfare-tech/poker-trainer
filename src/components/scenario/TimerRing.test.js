// MOD-004 (Wave 2): TimerRing extracted from ScenarioCard.jsx.
// The `fired` guard is the load-bearing bit: in a throttled background tab,
// interval callbacks already queued can still run after clearInterval, so the
// timeout must fire exactly once or the session double-advances.
import '@testing-library/jest-dom';
import { render, screen, act } from '@testing-library/react';
import TimerRing from './TimerRing';

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

const tick = (s) => act(() => { jest.advanceTimersByTime(s * 1000); });

test('the ring starts at the full allowance', () => {
  render(<TimerRing totalSeconds={60} paused={false} onTimeout={() => {}} />);
  expect(screen.getByText('60')).toBeInTheDocument();
});

test('it counts down one second at a time', () => {
  render(<TimerRing totalSeconds={60} paused={false} onTimeout={() => {}} />);
  tick(3);
  expect(screen.getByText('57')).toBeInTheDocument();
});

test('paused freezes the countdown entirely', () => {
  render(<TimerRing totalSeconds={60} paused onTimeout={() => {}} />);
  tick(10);
  expect(screen.getByText('60')).toBeInTheDocument();
});

test('expiry fires onTimeout exactly once and floors the display at 0', () => {
  const onTimeout = jest.fn();
  render(<TimerRing totalSeconds={3} paused={false} onTimeout={onTimeout} />);
  tick(3);
  expect(onTimeout).toHaveBeenCalledTimes(1);
  expect(screen.getByText('0')).toBeInTheDocument();

  // Extra queued ticks (throttled background tab) must not re-fire it
  tick(10);
  expect(onTimeout).toHaveBeenCalledTimes(1);
});

test('the ring never goes negative', () => {
  render(<TimerRing totalSeconds={2} paused={false} onTimeout={() => {}} />);
  tick(30);
  expect(screen.getByText('0')).toBeInTheDocument();
});

test('the stroke escalates green → yellow → red as the clock runs down', () => {
  render(<TimerRing totalSeconds={40} paused={false} onTimeout={() => {}} />);
  const arc = () => document.querySelectorAll('circle')[1];
  expect(arc().getAttribute('stroke')).toBe('var(--green)');
  tick(10);                                            // 30 left
  expect(arc().getAttribute('stroke')).toBe('var(--yellow)');
  tick(20);                                            // 10 left
  expect(arc().getAttribute('stroke')).toBe('var(--red)');
});

test('unmounting clears the interval so a stale timer cannot fire', () => {
  const onTimeout = jest.fn();
  const { unmount } = render(<TimerRing totalSeconds={2} paused={false} onTimeout={onTimeout} />);
  unmount();
  act(() => { jest.advanceTimersByTime(10000); });
  expect(onTimeout).not.toHaveBeenCalled();
});
