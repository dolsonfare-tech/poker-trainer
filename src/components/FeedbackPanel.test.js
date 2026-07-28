// FeedbackPanel + DisagreeBox (CA-049, Wave 4).
//
// The disagree box is the primary content-bug capture mechanism: it is how a
// wrong grading gets reported at all. Before this file, FeedbackPanel had NO
// test of any kind — the audit's exact words were that "a regression in the
// disagree submission (wrong `reason` key) would not be caught by jest."
//
// So the centrepiece here is not the rendering, it is the two cross-boundary
// contracts at the bottom. A component test that mocks db.js proves the chip
// calls the function; it cannot prove the value the function sends is one the
// database will accept. Those assertions read supabase/schema.sql directly.
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

let mockHasSupabase = true;
jest.mock('../utils/supabase', () => ({
  get hasSupabase() { return mockHasSupabase; },
}));
jest.mock('../utils/db', () => ({ submitScenarioFeedback: jest.fn() }));
jest.mock('../utils/analytics', () => ({ track: jest.fn() }));

import FeedbackPanel, { DISAGREE_REASONS } from './FeedbackPanel';
import { submitScenarioFeedback } from '../utils/db';
import { track } from '../utils/analytics';

const GRADE = { g: 'incorrect', emoji: '❌', title: 'Mistake', skill: 'Pot Odds' };

const renderPanel = (over = {}) => render(
  <FeedbackPanel
    grade={GRADE}
    loading={false}
    feedbackText="Calling here prices you in against a range that has you dominated."
    correctAnswer="Fold"
    timedOut={false}
    scenarioId="sc_042"
    choice="call"
    {...over}
  />
);

beforeEach(() => {
  jest.clearAllMocks();
  mockHasSupabase = true;
  submitScenarioFeedback.mockResolvedValue(undefined);
});

// ── Rendering ──────────────────────────────────────────────────────────────
describe('grade rendering', () => {
  test('never says "Correct" — honest labelling (DECISIONS.md)', () => {
    renderPanel({ grade: { ...GRADE, g: 'correct', title: 'Nice' } });
    expect(screen.getByText('Recommended Play')).toBeInTheDocument();
    expect(screen.queryByText(/^Correct$/)).not.toBeInTheDocument();
  });

  test('partial reads as acceptable-not-optimal, not as a failure', () => {
    renderPanel({ grade: { ...GRADE, g: 'partial' } });
    expect(screen.getByText('Acceptable — Not Optimal')).toBeInTheDocument();
  });

  test('a timeout is scored as a miss and reframes the explanation', () => {
    renderPanel({ timedOut: true });
    expect(screen.getByText("Time's Up")).toBeInTheDocument();
    expect(screen.getByText(/scored as a miss/)).toBeInTheDocument();
    // The fb text is written for the player who took the recommended line; a
    // timed-out player chose nothing, so it must be reframed rather than shown
    // as if it described their decision.
    expect(screen.getByText(/The thinking behind the recommended play/)).toBeInTheDocument();
  });

  test('the recommended-play banner appears when the player did NOT find it', () => {
    renderPanel({ grade: { ...GRADE, g: 'incorrect' } });
    expect(screen.getByText('Fold')).toBeInTheDocument();
  });

  test('…and is withheld when they did — no redundant coaching', () => {
    renderPanel({ grade: { ...GRADE, g: 'correct' } });
    expect(screen.queryByText('Recommended Play:')).not.toBeInTheDocument();
  });

  test('while loading, no analysis and no disagree box is offered', () => {
    renderPanel({ loading: true });
    expect(screen.getByText('Analyzing your decision…')).toBeInTheDocument();
    expect(screen.queryByText(/Disagree\?/)).not.toBeInTheDocument();
  });

  test('no disagree box without a scenarioId — a flag with no hand is unusable', () => {
    renderPanel({ scenarioId: undefined });
    expect(screen.queryByText(/Disagree\?/)).not.toBeInTheDocument();
  });
});

// ── The submit path ────────────────────────────────────────────────────────
describe('disagree submission', () => {
  const openBox = () => fireEvent.click(screen.getByText(/Disagree\?/));

  test('opening the box is tracked separately from submitting', () => {
    renderPanel();
    openBox();
    expect(track).toHaveBeenCalledWith('scenario_disagree_opened',
      { scenario_id: 'sc_042', result: 'incorrect' });
    expect(track).not.toHaveBeenCalledWith('scenario_disagree_submitted', expect.anything());
  });

  test('a chip sends the hand, the choice, the result and the reason', async () => {
    renderPanel();
    openBox();
    fireEvent.click(screen.getByText('The graded answer is wrong'));

    await waitFor(() => expect(submitScenarioFeedback).toHaveBeenCalledWith({
      scenarioId: 'sc_042', choice: 'call', result: 'incorrect', reason: 'grading_wrong',
    }));
    expect(await screen.findByText(/Logged — thanks/)).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith('scenario_disagree_submitted',
      { scenario_id: 'sc_042', reason: 'grading_wrong', result: 'incorrect' });
  });

  test('a timed-out hand reports result "incorrect", not the raw grade', async () => {
    renderPanel({ timedOut: true, choice: undefined });
    openBox();
    fireEvent.click(screen.getByText('Something else is off'));

    await waitFor(() => expect(submitScenarioFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'incorrect', choice: undefined })));
  });

  test('a failure surfaces, is tracked, and leaves the chips usable', async () => {
    submitScenarioFeedback.mockRejectedValue(new Error('offline'));
    renderPanel();
    openBox();
    fireEvent.click(screen.getByText('My answer deserves credit'));

    expect(await screen.findByText(/Couldn't send/)).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith('scenario_disagree_failed', { scenario_id: 'sc_042' });
    // Not swallowed into a fake "thanks" — the flag genuinely did not land.
    expect(screen.queryByText(/Logged — thanks/)).not.toBeInTheDocument();
    expect(screen.getByText('My answer deserves credit')).toBeEnabled();
  });

  test('a second chip after a successful send is ignored — one flag per hand', async () => {
    renderPanel();
    openBox();
    fireEvent.click(screen.getByText('The graded answer is wrong'));
    await screen.findByText(/Logged — thanks/);

    // The chips are gone entirely once sent, so there is nothing left to
    // double-fire; the guard in send() is the belt to this braces.
    expect(screen.queryByText('Something else is off')).not.toBeInTheDocument();
    expect(submitScenarioFeedback).toHaveBeenCalledTimes(1);
  });

  test('localStorage-only mode still records the flag locally without a network call', async () => {
    mockHasSupabase = false;
    renderPanel();
    openBox();
    fireEvent.click(screen.getByText("Explanation doesn't match"));

    expect(await screen.findByText(/Logged — thanks/)).toBeInTheDocument();
    expect(submitScenarioFeedback).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('scenario_disagree_submitted',
      expect.objectContaining({ reason: 'explanation_off' }));
  });
});

// ── Cross-boundary contracts (the reason this file exists) ─────────────────
// These are the assertions a mocked component test cannot make. `reason` and
// `result` are both CHECK-constrained columns; a value the UI can produce but
// the constraint rejects fails at INSERT time, in production, while the player
// is shown "Logged — thanks."
describe('schema contract', () => {
  const schema = fs.readFileSync(
    path.join(__dirname, '../../supabase/schema.sql'), 'utf8');

  const constraintValues = (column) => {
    const m = schema.match(
      new RegExp(`${column}\\s+text\\s+not null\\s+check\\s*\\(\\s*${column}\\s+in\\s*\\(([^)]*)\\)`, 'i'));
    if (!m) throw new Error(`no CHECK constraint found for ${column} in schema.sql`);
    return new Set(m[1].match(/'([^']+)'/g).map(s => s.replace(/'/g, '')));
  };

  test('every disagree chip sends a reason the database accepts', () => {
    const allowed = constraintValues('reason');
    const sent = DISAGREE_REASONS.map(([key]) => key);
    expect(allowed.size).toBeGreaterThan(0);
    for (const key of sent) expect([...allowed]).toContain(key);
  });

  test('every reason the database accepts has a chip — no dead constraint values', () => {
    const allowed = [...constraintValues('reason')];
    const sent = DISAGREE_REASONS.map(([key]) => key);
    // Both directions matter: an unreachable constraint value means either a
    // chip was deleted without a migration, or the migration ran for a chip
    // that was never built.
    for (const key of allowed) expect(sent).toContain(key);
  });

  test('the three grades the panel can report are all accepted results', () => {
    const allowed = [...constraintValues('result')];
    // 'incorrect' is also what a timeout reports — see the timeout test above.
    for (const g of ['correct', 'partial', 'incorrect']) expect(allowed).toContain(g);
  });
});
