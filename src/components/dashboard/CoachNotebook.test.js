// MOD-003 (Wave 2): CoachNotebook extracted from Dashboard.jsx.
// Two rules ride on the includeLatest flag: the newest read is normally shown
// by the strip above (so the list must exclude it), but when the latest session
// produced no read the notebook is the only surface for the history.
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('../../utils/analytics', () => ({ track: jest.fn() }));

import CoachNotebook from './CoachNotebook';
import { track } from '../../utils/analytics';

const structured = (headline, evidence = [], watchFor = '') =>
  ({ body: JSON.stringify({ headline, evidence, watchFor }) });

const reads = [
  { date: '2026-07-19', ...structured('Newest read headline') },
  { date: '2026-07-18', ...structured('Older read one', ['Chased a dead draw'], 'Price your draws') },
  { date: '2026-07-17', ...structured('Older read two') },
];

beforeEach(() => { jest.clearAllMocks(); });

test('a single read renders nothing — the strip above already shows it', () => {
  const { container } = render(<CoachNotebook reads={[reads[0]]} />);
  expect(container).toBeEmptyDOMElement();
});

test('no reads at all renders nothing', () => {
  const { container } = render(<CoachNotebook reads={[]} />);
  expect(container).toBeEmptyDOMElement();
});

test('the toggle counts prior reads, excluding the newest', () => {
  render(<CoachNotebook reads={reads} />);
  expect(screen.getByText(/Past reads · 2/)).toBeInTheDocument();
});

test('includeLatest counts every read — no strip means no duplication risk', () => {
  render(<CoachNotebook reads={reads} includeLatest />);
  expect(screen.getByText(/Past reads · 3/)).toBeInTheDocument();
});

test('expanding lists the prior reads by date and fires the open event once', () => {
  render(<CoachNotebook reads={reads} />);
  fireEvent.click(screen.getByText(/Past reads · 2/));
  const list = document.querySelector('.db-notebook-list');
  expect(list).toHaveTextContent('Jul 18');
  expect(list).toHaveTextContent('Older read one');
  expect(list).not.toHaveTextContent('Newest read headline');
  expect(track).toHaveBeenCalledWith('coach_notebook_opened', { reads: 2 });

  // Collapsing does not re-fire the event
  fireEvent.click(screen.getByText(/Past reads · 2/));
  expect(track).toHaveBeenCalledTimes(1);
});

// The notebook is an ARCHIVE: reads written before v3 keep their evidence
// bullets and their "Watch for" label, because old reads are never rewritten.
test('tapping a legacy structured row reveals its evidence and labelled watch-for', () => {
  render(<CoachNotebook reads={reads} />);
  fireEvent.click(screen.getByText(/Past reads · 2/));
  expect(screen.queryByText('Chased a dead draw')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Older read one'));
  expect(screen.getByText('Chased a dead draw')).toBeInTheDocument();
  expect(screen.getByText('Price your draws')).toBeInTheDocument();
  expect(screen.getByText('Watch for')).toBeInTheDocument();
});

// A v3 read has no evidence: the row is sentence one, the detail is sentence
// two, and together they read as the paragraph the card shows. The label would
// sit in the middle of a sentence pair, so it is dropped for these reads only.
test('a v3 two-field row expands into sentence two, unlabelled', () => {
  const v3 = {
    date: '2026-08-01',
    body: JSON.stringify({
      headline: "You've been snap calling tight players a lot lately.",
      watchFor: 'A Tight Nit rarely bluffs, so make sure yours is strong.',
    }),
  };
  render(<CoachNotebook reads={[reads[0], v3]} />);
  fireEvent.click(screen.getByText(/Past reads · 1/));
  fireEvent.click(screen.getByText(/snap calling tight players/));

  expect(screen.getByText(/A Tight Nit rarely bluffs/)).toBeInTheDocument();
  expect(screen.queryByText('Watch for')).not.toBeInTheDocument();
  expect(document.querySelector('.db-profile-read-evidence')).toBeNull();
  // Row + detail are the whole read, each sentence exactly once.
  expect(document.querySelector('.db-notebook-item'))
    .toHaveTextContent(/snap calling tight players a lot lately\.\s*A Tight Nit rarely bluffs/);
});

test('a legacy prose row un-clamps in place and grows no duplicate detail block', () => {
  const prose = 'You keep folding rivers to tight players — that leaks value over many hands.';
  render(<CoachNotebook reads={[reads[0], { date: '2026-07-18', body: prose }]} />);
  fireEvent.click(screen.getByText(/Past reads · 1/));
  const headline = document.querySelector('.db-notebook-list .db-notebook-headline');
  expect(headline).toHaveClass('db-notebook-clamp');
  fireEvent.click(headline);
  expect(headline).not.toHaveClass('db-notebook-clamp');
  expect(document.querySelector('.db-notebook-detail')).toBeNull();
  expect(screen.getAllByText(new RegExp('You keep folding rivers'))).toHaveLength(1);
});
