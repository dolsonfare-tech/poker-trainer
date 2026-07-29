import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import RecentForm from './RecentForm';

const form = (over = {}) => ({
  windowSize: 6, correct: 19, total: 30,
  prev: { correct: 16, total: 30 }, moved: null, queueDepth: 0, ...over,
});

test('renders nothing at all before any session is played', () => {
  const { container } = render(<RecentForm form={form({ windowSize: 0, total: 0, prev: null })} />);
  expect(container).toBeEmptyDOMElement();
});

test('reports the window score and the direction against the previous window', () => {
  render(<RecentForm form={form()} />);
  expect(screen.getByText(/19/)).toBeInTheDocument();
  expect(screen.getByText(/\/30/)).toBeInTheDocument();
  expect(screen.getByText(/Last 6 sessions · was 16/)).toBeInTheDocument();
  expect(document.querySelector('.db-form-delta')).toHaveAttribute('data-dir', 'up');
});

test('a losing window points the delta down', () => {
  render(<RecentForm form={form({ correct: 12, prev: { correct: 20, total: 30 } })} />);
  expect(document.querySelector('.db-form-delta')).toHaveAttribute('data-dir', 'down');
});

test('labels a short window by its REAL size, and offers no comparison it cannot make', () => {
  render(<RecentForm form={form({ windowSize: 3, correct: 8, total: 15, prev: null })} />);
  expect(screen.getByText(/Last 3 sessions/)).toBeInTheDocument();
  expect(screen.queryByText(/was /)).not.toBeInTheDocument();
  expect(document.querySelector('.db-form-delta')).toBeNull();
});

// The gate's whole point: silence, not a hedge.
test('omits the skill cell entirely when nothing cleared the attempts bar', () => {
  render(<RecentForm form={form({ moved: null })} />);
  expect(document.querySelector('.db-form-moved')).toBeNull();
});

test('names the mover when one cleared the bar, and says which way it moved', () => {
  render(<RecentForm form={form({ moved: { skill: 'bluffing', dir: 'down' } })} />);
  expect(document.querySelector('.db-form-moved')).toHaveAttribute('data-dir', 'down');
  expect(screen.getByText(/Bluffing/)).toBeInTheDocument();
  expect(screen.getByText(/Slipping lately/)).toBeInTheDocument();
});

test('an improving skill is reported as such, not only slips', () => {
  render(<RecentForm form={form({ moved: { skill: 'potodds', dir: 'up' } })} />);
  expect(screen.getByText(/Sharper lately/)).toBeInTheDocument();
});

test('shows the resurface queue only when something is waiting', () => {
  const { rerender } = render(<RecentForm form={form({ queueDepth: 0 })} />);
  expect(document.querySelector('.db-form-queue')).toBeNull();
  rerender(<RecentForm form={form({ queueDepth: 4 })} />);
  expect(document.querySelector('.db-form-queue')).toBeInTheDocument();
  expect(screen.getByText(/Hands to resurface/)).toBeInTheDocument();
});

test('one waiting hand is singular', () => {
  render(<RecentForm form={form({ queueDepth: 1 })} />);
  expect(screen.getByText(/Hand to resurface/)).toBeInTheDocument();
  expect(screen.queryByText(/Hands to resurface/)).not.toBeInTheDocument();
});

// Dividers are structural, not decorative: they only make sense BETWEEN cells,
// so a run with no optional cells must not render a leading or trailing rule.
test('dividers appear only between cells that actually rendered', () => {
  const { rerender } = render(<RecentForm form={form()} />);
  expect(document.querySelectorAll('.db-form-divider')).toHaveLength(0);
  rerender(<RecentForm form={form({ moved: { skill: 'bluffing', dir: 'down' }, queueDepth: 3 })} />);
  expect(document.querySelectorAll('.db-form-divider')).toHaveLength(2);
});
