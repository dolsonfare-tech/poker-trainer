// MOD-003 (Wave 2): LastSessionRead extracted from Dashboard.jsx.
// The subtle rule: when the latest session produced NO read (daily cap or a
// failed call) there is no strip, so the notebook has to include the newest
// read or the history becomes unreachable.
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

jest.mock('../../utils/analytics', () => ({ track: jest.fn() }));

import LastSessionRead from './LastSessionRead';

const structured = (headline, evidence = [], watchFor = '') =>
  JSON.stringify({ headline, evidence, watchFor });

const note = {
  body: structured('You over-fold to river bets', ['Folded top pair to the nit', 'Passed on a value raise'], 'Believe passive raisers on scary boards'),
  focus: 'Pot Odds',
};

const history = (n) => Array.from({ length: n }, (_, i) => ({ date: `2026-07-${19 - i}`, body: structured(`Read ${i}`) }));

test('no read and no history renders nothing at all', () => {
  const { container } = render(<LastSessionRead coachNote={null} coachReads={[]} />);
  expect(container).toBeEmptyDOMElement();
});

test('a structured read renders headline, evidence rows, watch-for and focus', () => {
  render(<LastSessionRead coachNote={note} coachReads={history(1)} />);
  expect(screen.getByText('You over-fold to river bets')).toBeInTheDocument();
  expect(screen.getByText('Folded top pair to the nit')).toBeInTheDocument();
  expect(screen.getByText('Passed on a value raise')).toBeInTheDocument();
  expect(screen.getByText(/Believe passive raisers/)).toBeInTheDocument();
  expect(document.querySelector('.db-profile-read-focus-skill')).toHaveTextContent('Pot Odds');
});

test('a legacy prose read renders as prose, with no headline element', () => {
  const prose = 'You keep folding to river aggression from tight players.';
  render(<LastSessionRead coachNote={{ body: prose, focus: null }} coachReads={history(1)} />);
  expect(document.querySelector('.db-profile-read-prose')).toHaveTextContent(prose);
  expect(document.querySelector('.db-profile-read-headline')).toBeNull();
  expect(document.querySelector('.db-profile-read-focus')).toBeNull();
});

test('with a strip present the notebook needs two reads before it appears', () => {
  render(<LastSessionRead coachNote={note} coachReads={history(1)} />);
  expect(screen.queryByText(/Past reads/)).not.toBeInTheDocument();

  render(<LastSessionRead coachNote={note} coachReads={history(2)} />);
  expect(screen.getByText(/Past reads · 1/)).toBeInTheDocument();
});

test('no read this session: the notebook opens on the full history, latest included', () => {
  render(<LastSessionRead coachNote={null} coachReads={history(2)} />);
  expect(document.querySelector('.db-profile-read-label')).toBeNull();
  expect(screen.getByText(/Past reads · 2/)).toBeInTheDocument();
});

test('a single historical read still reaches the player when there is no strip', () => {
  render(<LastSessionRead coachNote={null} coachReads={history(1)} />);
  expect(screen.getByText(/Past reads · 1/)).toBeInTheDocument();
});

test('guests never see the notebook', () => {
  render(<LastSessionRead coachNote={note} coachReads={history(3)} guest />);
  expect(screen.queryByText(/Past reads/)).not.toBeInTheDocument();
  expect(screen.getByText('You over-fold to river bets')).toBeInTheDocument();
});

// The read now spans ten sessions, so "Last Session's Read" is a false label
// and "Focus this session" is a false frame (Phase B).
test('the read is labelled as a recent-form read, not a single session', () => {
  render(<LastSessionRead coachNote={{ body: note.body, focus: 'bluffing' }} coachReads={[]} guest={false} />);
  expect(screen.queryByText(/Last Session's Read/i)).not.toBeInTheDocument();
  expect(screen.getByText(/Coach's Read/i)).toBeInTheDocument();
  expect(screen.getByText(/last 10 sessions/i)).toBeInTheDocument();
});

test('the focus chip is framed as ongoing, not as this session', () => {
  render(<LastSessionRead coachNote={{ body: note.body, focus: 'bluffing' }} coachReads={[]} guest={false} />);
  expect(screen.queryByText(/Focus this session/i)).not.toBeInTheDocument();
  expect(screen.getByText(/Focus/i)).toBeInTheDocument();
});

// A read that refreshes every five sessions can be genuinely old — and if calls
// are failing it can be MUCH older than the player assumes. Date it, so stale
// is visible rather than passing for current.
test('the read is dated so staleness is visible', () => {
  render(
    <LastSessionRead
      coachNote={{ body: note.body, focus: 'bluffing' }}
      coachReads={[{ date: '2026-07-24', body: note.body }]}
      guest={false}
    />,
  );
  expect(screen.getByText(/Jul 24/)).toBeInTheDocument();
});

test('with no dated history the label carries no date rather than a wrong one', () => {
  render(<LastSessionRead coachNote={{ body: note.body, focus: 'bluffing' }} coachReads={[]} guest={false} />);
  expect(screen.queryByText(/as of/i)).not.toBeInTheDocument();
});
