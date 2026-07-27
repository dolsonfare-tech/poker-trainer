// MOD-003 (Wave 2): SchemaPanel extracted from Dashboard.jsx to bring the
// residual under its 250-line budget. CA-042 rides on the countdown clamp.
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import SchemaPanel from './SchemaPanel';
import { SCHEMA_UNLOCK_SESSIONS } from '../../utils/userStorage';

const schema = { name: 'The Calling Station', quote: 'You pay to find out.' };

test('a locked profile counts down the sessions still needed', () => {
  render(<SchemaPanel schema={null} sessionsCompleted={SCHEMA_UNLOCK_SESSIONS - 2} />);
  expect(document.querySelector('.db-schema-locked-text')).toHaveTextContent('Play 2 more sessions to unlock your player profile');
});

test('one session left is singular', () => {
  render(<SchemaPanel schema={null} sessionsCompleted={SCHEMA_UNLOCK_SESSIONS - 1} />);
  expect(document.querySelector('.db-schema-locked-text')).toHaveTextContent('Play 1 more session to unlock');
});

test('CA-042: past the threshold the countdown clamps at zero, never negative', () => {
  render(<SchemaPanel schema={null} sessionsCompleted={SCHEMA_UNLOCK_SESSIONS + 7} />);
  const text = document.querySelector('.db-schema-locked-text');
  expect(text).not.toHaveTextContent(/-\d/);
  expect(text).toHaveTextContent('Play a session to refresh your profile');
});

test('the locked state never borrows the villain word "archetype"', () => {
  render(<SchemaPanel schema={null} sessionsCompleted={0} />);
  expect(document.querySelector('.db-schema-locked')).not.toHaveTextContent(/archetype/i);
});

test('an unlocked profile shows the read and its quote', () => {
  render(<SchemaPanel schema={schema} sessionsCompleted={12} />);
  expect(screen.getByText('The Calling Station')).toBeInTheDocument();
  expect(screen.getByText('You pay to find out.')).toBeInTheDocument();
  expect(document.querySelector('.db-schema-locked')).toBeNull();
});

test('under ten sessions the read is labelled early — it sharpens as you play', () => {
  render(<SchemaPanel schema={schema} sessionsCompleted={9} />);
  expect(screen.getByText(/Early read/)).toBeInTheDocument();
});

test('at ten sessions the early-read caveat drops away', () => {
  render(<SchemaPanel schema={schema} sessionsCompleted={10} />);
  expect(screen.queryByText(/Early read/)).not.toBeInTheDocument();
});

test('the guide link only renders when a handler is wired, and passes the schema name', () => {
  render(<SchemaPanel schema={schema} sessionsCompleted={12} />);
  expect(screen.queryByText(/About this read/)).not.toBeInTheDocument();

  const onSchemaInfo = jest.fn();
  render(<SchemaPanel schema={schema} sessionsCompleted={12} onSchemaInfo={onSchemaInfo} />);
  fireEvent.click(screen.getByText(/About this read/));
  expect(onSchemaInfo).toHaveBeenCalledWith('The Calling Station');
});
