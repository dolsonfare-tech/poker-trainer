// MOD-003 (Wave 2): UsernameEditor extracted from Dashboard.jsx.
// The local cooldown check is a UX courtesy — the Supabase trigger is the real
// enforcement. Both paths are pinned: the pre-emptive note, and the
// rate_limited error the server can still return.
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../../utils/analytics', () => ({ track: jest.fn() }));

import UsernameEditor from './UsernameEditor';
import { track } from '../../utils/analytics';

const user = (over) => ({ displayName: 'RiverRat', usernameChangedAt: null, ...over });

beforeEach(() => { jest.clearAllMocks(); });

test('a fresh account gets the editable form seeded with the current name', () => {
  render(<UsernameEditor user={user()} onRename={jest.fn()} onClose={jest.fn()} />);
  expect(screen.getByLabelText('New username')).toHaveValue('RiverRat');
});

test('inside the cooldown the form is replaced by the next-change date', () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  render(<UsernameEditor user={user({ usernameChangedAt: yesterday })} onRename={jest.fn()} onClose={jest.fn()} />);
  expect(screen.getByText(/limited to once a week/)).toBeInTheDocument();
  expect(screen.queryByLabelText('New username')).not.toBeInTheDocument();
});

test('a name shorter than 2 characters is rejected without calling onRename', () => {
  const onRename = jest.fn();
  render(<UsernameEditor user={user()} onRename={onRename} onClose={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('New username'), { target: { value: 'a' } });
  fireEvent.submit(document.querySelector('.db-rename'));
  expect(screen.getByText(/at least 2 characters/)).toBeInTheDocument();
  expect(onRename).not.toHaveBeenCalled();
});

test('an unchanged name just closes — no pointless write', async () => {
  const onRename = jest.fn();
  const onClose = jest.fn();
  render(<UsernameEditor user={user()} onRename={onRename} onClose={onClose} />);
  fireEvent.submit(document.querySelector('.db-rename'));
  expect(onRename).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

test('a successful rename trims, tracks, and closes', async () => {
  const onRename = jest.fn().mockResolvedValue(undefined);
  const onClose = jest.fn();
  render(<UsernameEditor user={user()} onRename={onRename} onClose={onClose} />);
  fireEvent.change(screen.getByLabelText('New username'), { target: { value: '  NitPicker  ' } });
  fireEvent.submit(document.querySelector('.db-rename'));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(onRename).toHaveBeenCalledWith('NitPicker');
  expect(track).toHaveBeenCalledWith('username_changed');
});

test('a server-side rate limit reports the weekly rule, not a generic failure', async () => {
  const err = new Error('nope'); err.code = 'rate_limited';
  const onRename = jest.fn().mockRejectedValue(err);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  render(<UsernameEditor user={user()} onRename={onRename} onClose={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('New username'), { target: { value: 'NitPicker' } });
  fireEvent.submit(document.querySelector('.db-rename'));

  await waitFor(() => expect(screen.getByText(/limited to once a week/)).toBeInTheDocument());
  expect(track).toHaveBeenCalledWith('username_change_failed', { reason: 'rate_limited' });
  console.error.mockRestore();
});

test('a network failure reports a retryable error', async () => {
  const onRename = jest.fn().mockRejectedValue(new Error('offline'));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  render(<UsernameEditor user={user()} onRename={onRename} onClose={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('New username'), { target: { value: 'NitPicker' } });
  fireEvent.submit(document.querySelector('.db-rename'));

  await waitFor(() => expect(screen.getByText(/Couldn't save/)).toBeInTheDocument());
  expect(track).toHaveBeenCalledWith('username_change_failed', { reason: 'error' });
  console.error.mockRestore();
});
