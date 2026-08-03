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

// v3 (2026-08-02): the card joins the two fields into ONE paragraph. The read is
// two sentences of a coach talking, so a "Watch for" label between them cuts a
// single thought in half. Evidence bullets never appeared here and still do not
// (founder call, 2026-07-29 spec); the full legacy read lives in Past Reads.
test('a structured read renders as one joined paragraph, not a labelled split', () => {
  render(<LastSessionRead coachNote={note} coachReads={history(1)} />);
  // Both fields are period-ized in the join: this fixture is v2-shaped (no
  // terminal punctuation — the old split layout never needed it), and every
  // real player's CURRENT read is v2-shaped until their next one fires. A
  // plain space-join renders those as run-ons on the card's front line.
  expect(document.querySelector('.db-profile-read-headline')).toHaveTextContent(
    'You over-fold to river bets. Believe passive raisers on scary boards.',
  );
  // The label and its row are gone from the card — the join IS the render.
  expect(screen.queryByText('Watch for')).not.toBeInTheDocument();
  expect(document.querySelector('.db-profile-read-wf-label')).toBeNull();
  expect(document.querySelector('.db-profile-read-watchfor')).toBeNull();

  expect(screen.queryByText('Folded top pair to the nit')).not.toBeInTheDocument();
  expect(document.querySelector('.db-profile-read-evidence')).toBeNull();
  expect(document.querySelector('.db-profile-read-focus')).toBeNull();
});

// A read stored before v3 has three fields; it joins the same way, because the
// card never rendered its evidence either. Derived state re-reads the whole
// append-only log on every profile load, so this is a live path, not a museum.
test('a legacy three-field read joins the same way — no migration', () => {
  render(<LastSessionRead coachNote={note} coachReads={history(1)} />);
  const card = document.querySelector('.db-profile-read-headline');
  expect(card).toHaveTextContent(/You over-fold to river bets\. Believe passive raisers/);
  expect(card).not.toHaveTextContent(/Folded top pair/);
});

test('a structured read with no watchFor renders the headline alone, unpadded', () => {
  render(
    <LastSessionRead
      coachNote={{ body: structured('Clean stretch, keep watching pot odds'), focus: null }}
      coachReads={history(1)}
    />,
  );
  // Period-ized like every joined part — a lone field is still a sentence on
  // the card — and nothing else: no join artifact, no trailing space.
  expect(document.querySelector('.db-profile-read-headline'))
    .toHaveTextContent(/^Clean stretch, keep watching pot odds\.$/);
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
  expect(document.querySelector('.db-profile-read-headline'))
    .toHaveTextContent(/You over-fold to river bets/);
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
  expect(document.querySelector('.db-profile-read-headline'))
    .toHaveTextContent(/You over-fold to river bets/);
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
