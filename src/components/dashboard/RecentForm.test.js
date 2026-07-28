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
  expect(screen.getByText(/19 of 30/)).toBeInTheDocument();
  expect(screen.getByText(/up from 16/)).toBeInTheDocument();
});

test('labels a short window by its REAL size, never padded to six', () => {
  render(<RecentForm form={form({ windowSize: 3, correct: 8, total: 15, prev: null })} />);
  expect(screen.getByText(/Last 3 sessions/)).toBeInTheDocument();
  expect(screen.queryByText(/up from|down from/)).not.toBeInTheDocument();
});

// The gate's whole point: silence, not a hedge.
test('omits the skill line entirely when nothing cleared the attempts bar', () => {
  render(<RecentForm form={form({ moved: null })} />);
  expect(document.querySelector('.db-form-moved')).toBeNull();
});

test('names the mover when one cleared the bar', () => {
  render(<RecentForm form={form({ moved: { skill: 'bluffing', dir: 'down' } })} />);
  expect(document.querySelector('.db-form-moved')).toBeInTheDocument();
  expect(screen.getByText(/Bluffing/)).toBeInTheDocument();
});

test('shows the resurface queue only when something is waiting', () => {
  const { rerender } = render(<RecentForm form={form({ queueDepth: 0 })} />);
  expect(document.querySelector('.db-form-queue')).toBeNull();
  rerender(<RecentForm form={form({ queueDepth: 4 })} />);
  expect(screen.getByText(/4 hands waiting to resurface/)).toBeInTheDocument();
});

test('one waiting hand is singular', () => {
  render(<RecentForm form={form({ queueDepth: 1 })} />);
  expect(screen.getByText(/1 hand waiting to resurface/)).toBeInTheDocument();
});
