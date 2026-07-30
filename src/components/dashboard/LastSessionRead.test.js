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

test('a structured read renders the headline and watch-for — evidence stays in the notebook', () => {
  render(<LastSessionRead coachNote={note} coachReads={history(1)} />);
  expect(screen.getByText('You over-fold to river bets')).toBeInTheDocument();
  expect(screen.getByText(/Believe passive raisers/)).toBeInTheDocument();
  // Evidence bullets read as stat-dumps on the card (founder call, 2026-07-29
  // spec). The full read, bullets included, still lives in Past Reads.
  expect(screen.queryByText('Folded top pair to the nit')).not.toBeInTheDocument();
  expect(document.querySelector('.db-profile-read-evidence')).toBeNull();
  expect(document.querySelector('.db-profile-read-focus')).toBeNull();
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

// C″ (2026-07-29): the label carries no scope claim at all — which also means
// it can never overclaim scope for a stored legacy per-session read.
test("the label is exactly Coach's Read — no scope claim", () => {
  render(<LastSessionRead coachNote={{ body: note.body, focus: 'bluffing' }} coachReads={[]} guest={false} />);
  expect(screen.queryByText(/Last Session's Read/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/last 10 sessions/i)).not.toBeInTheDocument();
  expect(document.querySelector('.db-profile-read-label')).toHaveTextContent(/^Coach's Read$/);
});

// DELIBERATE REVERSAL of the 2026-07-29 "date the read" pin: the founder cut
// the date from the card in the C″ spec (Decisions §2). Staleness is now
// visible only through the dated entries in Past Reads. If stale-read
// confusion shows up in feedback channels, this is the decision to revisit.
test('the card label carries no date — dates live in Past Reads', () => {
  render(
    <LastSessionRead
      coachNote={{ body: note.body, focus: 'bluffing' }}
      coachReads={[{ date: '2026-07-24', body: note.body }]}
      guest={false}
    />,
  );
  expect(screen.queryByText(/as of/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Jul 24/)).not.toBeInTheDocument();
});

// ── Daily read cap (founder queue item 6, July 29 2026) ────────────────────
// The 5-a-day cap used to swallow a read in silence: submitSession caught the
// 429, returned limited:true, and nothing rendered it. The player saw an
// unchanged card and no reason for it — a silent product defect rather than a
// stated constraint.

test('a capped refresh says so, above an unchanged read', () => {
  render(<LastSessionRead coachNote={note} coachReads={history(1)} coachLimited />);
  expect(screen.getByText(/Coach is out for the day/)).toBeInTheDocument();
  // The previous read is still the player's best information — the notice
  // explains why it did not change, it does not replace it.
  expect(screen.getByText('You over-fold to river bets')).toBeInTheDocument();
});

test('a capped refresh with nothing to show still renders the notice', () => {
  const { container } = render(<LastSessionRead coachNote={null} coachReads={[]} coachLimited />);
  expect(container).not.toBeEmptyDOMElement();
  expect(screen.getByText(/Coach is out for the day/)).toBeInTheDocument();
});

test('an uncapped session shows no notice', () => {
  render(<LastSessionRead coachNote={note} coachReads={history(1)} />);
  expect(screen.queryByText(/Coach is out for the day/)).not.toBeInTheDocument();
});
