// Table Reads — data contract + full screen flow. The mode is content-driven,
// so the data assertions double as a jest-side mirror of audit-observations.mjs
// (the audit is the authoring gate; this keeps CI honest if someone skips it).
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TableReads, { dealObservations } from './TableReads';
import OBSERVATIONS, { ARCHETYPE_LABELS } from '../data/observations';
import { loadTableReadsStats } from '../utils/persistence';
jest.mock('../utils/supabase', () => ({ supabase: null, hasSupabase: false }));

const BEGINNER_IDS = OBSERVATIONS.filter((o) => o.difficulty === 'beginner').map((o) => o.id);
const INTER_IDS = OBSERVATIONS.filter((o) => o.difficulty === 'intermediate').map((o) => o.id);
const ALL_IDS = OBSERVATIONS.map((o) => o.id);

beforeEach(() => {
  localStorage.clear();
  // Instant replays: the component checks prefers-reduced-motion at render
  window.matchMedia = jest.fn().mockReturnValue({ matches: true });
});

test('every observation is playable: valid archetypes, 3 covered distractors', () => {
  for (const ob of OBSERVATIONS) {
    expect(ARCHETYPE_LABELS[ob.answer]).toBeTruthy();
    expect(ob.answer).not.toBe('unknown');
    expect(ob.distractors).toHaveLength(3);
    for (const d of ob.distractors) {
      expect(ARCHETYPE_LABELS[d]).toBeTruthy();
      expect(d).not.toBe(ob.answer);
      expect(ob.whyNot[d]).toBeTruthy();
    }
    if (ob.difficulty === 'beginner') expect(ob.showdown).toBeTruthy();
  }
});

test('early sessions deal beginner (showdown) hands first', () => {
  const deck = dealObservations(OBSERVATIONS, 0);
  expect(deck).toHaveLength(5);
  // All beginner hands lead the deck before any intermediate appears
  deck.slice(0, BEGINNER_IDS.length).forEach((o) => expect(o.difficulty).toBe('beginner'));
});

test('beginner-first threshold is 4 lifetime attempts, not more', () => {
  // Mark every beginner seen+correct (tier 2 — the LOWEST dealing preference).
  // Below the threshold the difficulty group still forces beginners to lead;
  // at/above it the single mixed pool lets never-seen intermediates win.
  const seedStats = (attempts) => ({
    attempts, correct: 0, seenIds: [...BEGINNER_IDS], correctIds: [...BEGINNER_IDS], lastDeck: [],
  });

  const below = dealObservations(OBSERVATIONS, seedStats(3));
  below.slice(0, BEGINNER_IDS.length).forEach((o) => expect(o.difficulty).toBe('beginner'));

  const at = dealObservations(OBSERVATIONS, seedStats(4));
  // Mixed policy + tier ordering: never-seen intermediates fill the whole deck
  at.forEach((o) => expect(o.difficulty).toBe('intermediate'));
});

test('never re-deals a hand from the immediately previous session', () => {
  const prev = ALL_IDS.slice(0, 5);
  const deck = dealObservations(OBSERVATIONS, {
    attempts: 20, correct: 0, seenIds: [], correctIds: [], lastDeck: prev,
  });
  expect(deck).toHaveLength(5);
  deck.forEach((o) => expect(prev).not.toContain(o.id));
});

test('preference tiers: never-seen before seen-not-correct before seen-correct', () => {
  const fresh = INTER_IDS[0];        // tier 0 — never seen
  const seenMiss = INTER_IDS[1];     // tier 1 — seen but never correct
  const seenRight = INTER_IDS.slice(2); // tier 2 — seen and correct
  const seen = [seenMiss, ...seenRight, ...BEGINNER_IDS];
  const correct = [...seenRight, ...BEGINNER_IDS];

  const deck = dealObservations(OBSERVATIONS, {
    attempts: 20, correct: 0, seenIds: seen, correctIds: correct, lastDeck: [],
  });
  expect(deck[0].id).toBe(fresh);
  expect(deck[1].id).toBe(seenMiss);
});

test('full session: pick through 5 hands, summary shows score, tally, and scoring note', () => {
  render(<TableReads onBack={() => {}} />);

  for (let i = 0; i < 5; i++) {
    expect(screen.getByText(`Hand ${i + 1} of 5`)).toBeInTheDocument();
    // Question is up front (rendered before the chips)
    expect(screen.getByText('Who is Seat 3?')).toBeInTheDocument();
    // Chips render the display labels, 4 of them
    const chips = document.querySelectorAll('.tr-chip');
    expect(chips).toHaveLength(4);
    act(() => { fireEvent.click(chips[0]); });
    // Feedback always teaches: the tell is present, and the correct answer is named
    expect(document.querySelector('.tr-tell')).toBeInTheDocument();
    act(() => { fireEvent.click(screen.getByText(i < 4 ? 'Next Hand →' : 'See My Reads →')); });
  }

  expect(screen.getByText(/players identified/)).toBeInTheDocument();
  expect(screen.getByText(/All time: \d+ of 5 reads/)).toBeInTheDocument();
  expect(screen.getByText(/scored separately/)).toBeInTheDocument();
});

test('question renders up front, before the reveal finishes and before any chips', () => {
  // Non-reduced-motion: the reveal is mid-flight at render, so chips are absent
  window.matchMedia = jest.fn().mockReturnValue({ matches: false });
  render(<TableReads onBack={() => {}} />);
  expect(screen.getByText('Who is Seat 3?')).toBeInTheDocument();
  expect(document.querySelectorAll('.tr-chip')).toHaveLength(0);
  expect(document.querySelector('.tr-skip-hint')).toBeInTheDocument();
});

test('wrong pick shows the specific whyNot for that confusion', () => {
  render(<TableReads onBack={() => {}} />);
  // Deterministically find the current observation via the rendered chips
  const chipLabels = [...document.querySelectorAll('.tr-chip')].map((c) => c.textContent);
  const ob = OBSERVATIONS.find((o) =>
    chipLabels.includes(ARCHETYPE_LABELS[o.answer]) &&
    o.distractors.every((d) => chipLabels.includes(ARCHETYPE_LABELS[d]))
  );
  const wrongKey = ob.distractors[0];
  act(() => { fireEvent.click(screen.getByText(ARCHETYPE_LABELS[wrongKey])); });
  expect(document.querySelector('.tr-whynot')).toHaveTextContent(ob.whyNot[wrongKey].slice(0, 40));
  expect(document.querySelector('.tr-verdict')).toHaveTextContent(ARCHETYPE_LABELS[ob.answer]);
});

test('guide link appears on feedback when onOpenGuide is passed, and fires with the correct label', () => {
  const onOpenGuide = jest.fn();
  render(<TableReads onBack={() => {}} onOpenGuide={onOpenGuide} />);
  // No guide link while answering (closed-book)
  expect(document.querySelector('.tr-guide-link')).not.toBeInTheDocument();
  act(() => { fireEvent.click(document.querySelectorAll('.tr-chip')[0]); });
  // Dealing shuffles within preference tiers, so don't guess which observation
  // was dealt (a chip-set lookup is ambiguous when one observation's answer is
  // another's distractor). Read the label off the link itself, then verify it
  // is a real archetype that the verdict names as the answer.
  const link = document.querySelector('.tr-guide-link');
  expect(link).toBeInTheDocument();
  const label = link.textContent.replace(/^About the /, '').replace(/\s*→\s*$/, '');
  expect(Object.values(ARCHETYPE_LABELS)).toContain(label);
  expect(document.querySelector('.tr-verdict').textContent).toContain(label);
  act(() => { fireEvent.click(link); });
  expect(onOpenGuide).toHaveBeenCalledWith(label);
});

test('guide link is absent when onOpenGuide prop is not passed (backward compatible)', () => {
  render(<TableReads onBack={() => {}} />);
  act(() => { fireEvent.click(document.querySelectorAll('.tr-chip')[0]); });
  expect(document.querySelector('.tr-tell')).toBeInTheDocument(); // feedback is showing
  expect(document.querySelector('.tr-guide-link')).not.toBeInTheDocument();
});

test('lifetime stats persist across sessions in localStorage', () => {
  const { unmount } = render(<TableReads onBack={() => {}} />);
  act(() => { fireEvent.click(document.querySelectorAll('.tr-chip')[0]); });
  unmount();
  const saved = JSON.parse(localStorage.getItem('cr_table_reads_stats'));
  expect(saved.attempts).toBe(1);
  // Dealing-memory fields now persist too
  expect(Array.isArray(saved.seenIds)).toBe(true);
  expect(saved.seenIds).toHaveLength(1);
  expect(Array.isArray(saved.lastDeck)).toBe(true);
});

test('legacy stats object (no new fields) loads with safe defaults', () => {
  localStorage.setItem('cr_table_reads_stats', JSON.stringify({ attempts: 7, correct: 4 }));
  const stats = loadTableReadsStats();
  expect(stats).toEqual({ attempts: 7, correct: 4, seenIds: [], correctIds: [], lastDeck: [] });
  // And it deals a valid session without throwing
  expect(dealObservations(OBSERVATIONS, stats)).toHaveLength(5);
});

// ── Re-deal (CA-049, Wave 4) ──────────────────────────────────────────────
// `handleAgain` was the last uncovered block in this file. It resets six pieces
// of state at once; a missed reset is the classic chained-session bug — the
// second read starting on hand 3, or scored against the first deck's results.
test('“Read Another Table” fully resets the run, not just the deck', () => {
  render(<TableReads onBack={() => {}} />);

  const playThrough = () => {
    for (let i = 0; i < 5; i++) {
      act(() => { fireEvent.click(document.querySelectorAll('.tr-chip')[0]); });
      act(() => { fireEvent.click(screen.getByText(i < 4 ? 'Next Hand →' : 'See My Reads →')); });
    }
  };

  playThrough();
  expect(screen.getByText(/All time: \d+ of 5 reads/)).toBeInTheDocument();

  act(() => { fireEvent.click(screen.getByText('Read Another Table →')); });

  // Back to hand 1 with a live board and no carried-over pick.
  expect(screen.getByText('Hand 1 of 5')).toBeInTheDocument();
  expect(document.querySelectorAll('.tr-chip')).toHaveLength(4);
  expect(document.querySelector('.tr-tell')).not.toBeInTheDocument();

  // …and the second run scores out of 5 again rather than accumulating to 10.
  playThrough();
  expect(screen.getByText(/All time: \d+ of 10 reads/)).toBeInTheDocument();
  expect(screen.getByText(/players identified/).textContent).toMatch(/\d+ \/ 5/);
});

test('tapping the replay skips straight to the full hand', () => {
  // Non-reduced-motion: the replay reveals row by row, so a player who does not
  // want to wait can tap to see everything at once.
  window.matchMedia = jest.fn().mockReturnValue({ matches: false });
  render(<TableReads onBack={() => {}} />);

  const before = document.querySelectorAll('.tr-row').length;
  expect(document.querySelector('.tr-skip-hint')).toBeInTheDocument();

  act(() => { fireEvent.click(document.querySelector('.tr-replay')); });

  const after = document.querySelectorAll('.tr-row').length;
  expect(after).toBeGreaterThan(before);
  expect(document.querySelector('.tr-skip-hint')).not.toBeInTheDocument();
  // Chips only appear once the hand is fully revealed (closed-book while it plays).
  expect(document.querySelectorAll('.tr-chip')).toHaveLength(4);
});
