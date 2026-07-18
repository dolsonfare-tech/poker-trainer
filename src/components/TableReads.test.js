// Table Reads — data contract + full screen flow. The mode is content-driven,
// so the data assertions double as a jest-side mirror of audit-observations.mjs
// (the audit is the authoring gate; this keeps CI honest if someone skips it).
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TableReads, { dealObservations } from './TableReads';
import OBSERVATIONS, { ARCHETYPE_LABELS } from '../data/observations';

jest.mock('../utils/supabase', () => ({ supabase: null, hasSupabase: false }));

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
  const beginners = OBSERVATIONS.filter((o) => o.difficulty === 'beginner').length;
  // All beginner hands lead the deck before any intermediate appears
  deck.slice(0, beginners).forEach((o) => expect(o.difficulty).toBe('beginner'));
});

test('full session: pick through 5 hands, summary shows score and lifetime tally', () => {
  render(<TableReads onBack={() => {}} />);

  for (let i = 0; i < 5; i++) {
    expect(screen.getByText(`Hand ${i + 1} of 5`)).toBeInTheDocument();
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

test('lifetime stats persist across sessions in localStorage', () => {
  const { unmount } = render(<TableReads onBack={() => {}} />);
  act(() => { fireEvent.click(document.querySelectorAll('.tr-chip')[0]); });
  unmount();
  const saved = JSON.parse(localStorage.getItem('cr_table_reads_stats'));
  expect(saved.attempts).toBe(1);
});
