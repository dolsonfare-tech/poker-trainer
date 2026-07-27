// MOD-003 (Wave 2): BetaFeedback extracted from Dashboard.jsx.
// The failure path is the one that matters: a rejected insert must never read
// as "sent" — the founders would silently lose the report.
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../../utils/supabase', () => ({ supabase: {}, hasSupabase: true }));
jest.mock('../../utils/db', () => ({ submitFeedback: jest.fn() }));
jest.mock('../../utils/analytics', () => ({ track: jest.fn() }));

import BetaFeedback from './BetaFeedback';
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
