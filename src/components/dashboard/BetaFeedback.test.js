// MOD-003 (Wave 2): BetaFeedback extracted from Dashboard.jsx.
// The failure path is the one that matters: a rejected insert must never read
// as "sent" — the founders would silently lose the report.
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../../utils/supabase', () => ({ supabase: {}, hasSupabase: true }));
jest.mock('../../utils/db', () => ({ submitFeedback: jest.fn() }));
jest.mock('../../utils/analytics', () => ({ track: jest.fn() }));

import BetaFeedback, { FEEDBACK_CATEGORIES } from './BetaFeedback';
import { submitFeedback } from '../../utils/db';
import { track } from '../../utils/analytics';

beforeEach(() => { jest.clearAllMocks(); });

const open = () => fireEvent.click(screen.getByText(/Something broken, boring, or brilliant/));

test('the form is collapsed until the one-liner is tapped', () => {
  render(<BetaFeedback />);
  expect(document.querySelector('.db-beta-form')).toBeNull();
  open();
  expect(document.querySelector('.db-beta-form')).not.toBeNull();
  expect(track).toHaveBeenCalledWith('feedback_opened');
});

test('send stays disabled until both a category and text exist', () => {
  render(<BetaFeedback />);
  open();
  const send = screen.getByText('Send feedback');
  expect(send).toBeDisabled();
  fireEvent.click(screen.getByText('Gameplay'));
  expect(send).toBeDisabled();
  fireEvent.change(document.querySelector('.db-beta-text'), { target: { value: 'the timer skips' } });
  expect(send).toBeEnabled();
});

test('a successful send thanks the player and reports the category', async () => {
  submitFeedback.mockResolvedValue(undefined);
  render(<BetaFeedback />);
  open();
  fireEvent.click(screen.getByText('Scenarios'));
  fireEvent.change(document.querySelector('.db-beta-text'), { target: { value: '  sc_004 grading  ' } });
  fireEvent.click(screen.getByText('Send feedback'));

  await waitFor(() => expect(screen.getByText(/Dealt to the founders/)).toBeInTheDocument());
  expect(submitFeedback).toHaveBeenCalledWith('scenarios', 'sc_004 grading');
  expect(track).toHaveBeenCalledWith('feedback_submitted', { category: 'scenarios', length: 14 });
});

test('a failed insert surfaces the error and never claims it was sent', async () => {
  submitFeedback.mockRejectedValue(new Error('offline'));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  render(<BetaFeedback />);
  open();
  fireEvent.click(screen.getByText('Technical'));
  fireEvent.change(document.querySelector('.db-beta-text'), { target: { value: 'blank screen' } });
  fireEvent.click(screen.getByText('Send feedback'));

  await waitFor(() => expect(screen.getByText(/Couldn't send/)).toBeInTheDocument());
  expect(screen.queryByText(/Dealt to the founders/)).not.toBeInTheDocument();
  expect(track).toHaveBeenCalledWith('feedback_submit_failed');
  console.error.mockRestore();
});

// ── Schema contract (CA-049, Wave 4) ──────────────────────────────────────
// The same failure this file's header warns about, one level lower: a rejected
// insert that reads as "sent". `category` and `body` are both CHECK-constrained
// columns, so the UI can produce a value the database refuses — and the founder
// silently loses the report. Parsed from schema.sql rather than restated, so
// the two cannot drift apart.
describe('schema contract', () => {
  const fs = require('fs');
  const path = require('path');
  const schema = fs.readFileSync(
    path.join(__dirname, '../../../supabase/schema.sql'), 'utf8');

  test('every category button sends a value the database accepts', () => {
    const m = schema.match(/category\s+text\s+not null\s+check\s*\(\s*category\s+in\s*\(([^)]*)\)/i);
    expect(m).not.toBeNull();
    const allowed = m[1].match(/'([^']+)'/g).map(s => s.replace(/'/g, ''));
    expect(allowed.length).toBeGreaterThan(0);

    const offered = FEEDBACK_CATEGORIES.map(([key]) => key);
    for (const key of offered) expect(allowed).toContain(key);
    // …and no accepted category is unreachable from the UI.
    for (const key of allowed) expect(offered).toContain(key);
  });

  test('the textarea cannot exceed the body length the database allows', () => {
    const m = schema.match(/char_length\(body\)\s+between\s+(\d+)\s+and\s+(\d+)/i);
    expect(m).not.toBeNull();
    const [, min, max] = m.map(Number);

    render(<BetaFeedback />);
    open();
    const box = screen.getByPlaceholderText(/What happened/);
    expect(Number(box.getAttribute('maxLength'))).toBeLessThanOrEqual(max);
    // The lower bound is enforced by the send button's empty-text guard.
    expect(min).toBe(1);
    expect(screen.getByText('Send feedback')).toBeDisabled();
  });
});
