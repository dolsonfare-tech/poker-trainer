// Summary "earned moments" + honest-IQ display logic, exercised directly —
// a perfect session can't be forced through the real UI without knowing
// every scenario's answer, so the display contract is pinned here.
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import SessionSummary from './SessionSummary';
import SCENARIOS from '../data/scenarios';
import { RECENT_WINDOW } from '../utils/iq';
import { DEFAULT_SKILLS } from '../utils/session';
jest.mock('../utils/supabase', () => ({ supabase: null, hasSupabase: false }));

const pool = SCENARIOS.slice(0, 5);
const hist = (results) => pool.map((s, i) => ({
  scenario: s,
  choiceVal: results[i] === 'correct' ? s.correct : null,
  result: results[i],
}));

const baseProps = {
  difficulty: 'beginner',
  userSkills: DEFAULT_SKILLS,
  onPlayAgain: () => {},
  onRestart: () => {},
};

test('perfect session: gold flourish shown, personal-best line suppressed', () => {
  render(<SessionSummary {...baseProps}
    sessionHistory={hist(['correct', 'correct', 'correct', 'correct', 'correct'])}
    prevBest={3} streakSecured={7}
  />);
  expect(screen.getByText(/Perfect Session/)).toBeInTheDocument();
  expect(screen.queryByText(/personal best/)).not.toBeInTheDocument();
  // Milestone folds into the streak-secured line
  expect(screen.getByText(/Day 7 secured — a full week/)).toBeInTheDocument();
});

test('beating the previous best shows the personal-best line', () => {
  render(<SessionSummary {...baseProps}
    sessionHistory={hist(['correct', 'correct', 'correct', 'correct', 'incorrect'])}
    prevBest={3} streakSecured={null}
  />);
  expect(screen.getByText(/New personal best/)).toBeInTheDocument();
  expect(screen.queryByText(/Perfect Session/)).not.toBeInTheDocument();
  expect(screen.queryByText(/secured/)).not.toBeInTheDocument();
});

test('no best line without a prior best (first session is never a "best")', () => {
  render(<SessionSummary {...baseProps}
    sessionHistory={hist(['correct', 'correct', 'correct', 'correct', 'incorrect'])}
    prevBest={null} streakSecured={1}
  />);
  expect(screen.queryByText(/New personal best/)).not.toBeInTheDocument();
  expect(screen.getByText(/Day 1 secured/)).toBeInTheDocument();
});

test('Poker IQ shows the real before→after, never an invented delta', () => {
  // potodds rated red at 1/5 = 20% accuracy, untouched by these hands → 20 → 20
  const rated = {
    ...DEFAULT_SKILLS,
    potodds: { rating: 'red', attempts: 5, correct: 1 },
  };
  const nonPotodds = pool.every(s => s.skill !== 'potodds');
  expect(nonPotodds).toBe(true); // guard: the fixture must not move the score
  render(<SessionSummary {...baseProps} userSkills={rated}
    sessionHistory={hist(['correct', 'correct', 'incorrect', 'correct', 'incorrect'])}
  />);
  expect(screen.getByText('20 → 20')).toBeInTheDocument();
});

test('Poker IQ moves on misses even when no rating bucket flips (the 0/5 bug)', () => {
  // The reported bug: a losing session read as "69 → 69" because the score only
  // moved when a skill crossed a rating boundary. With continuous accuracy, a
  // miss on a rated skill moves the number even while the bucket holds.
  // potodds at 10/14 = 71% (yellow). One incorrect potodds hand → 10/15 = 67%,
  // still yellow, but the IQ line must read 71 → 67, not a flat number.
  const potodds = SCENARIOS.filter(s => s.skill === 'potodds');
  const target = potodds[0];
  // Guard: the fixture must be a single rated skill and the played hand must be
  // on it, or the before/after math below wouldn't isolate the move.
  expect(target).toBeTruthy();
  const skills = { ...DEFAULT_SKILLS, potodds: { rating: 'yellow', attempts: 14, correct: 10 } };
  const history = [{ scenario: target, choiceVal: null, result: 'incorrect' }];
  render(<SessionSummary {...baseProps} userSkills={skills} sessionHistory={history} />);
  expect(screen.getByText('71 → 67')).toBeInTheDocument();
});

test('Poker IQ before→after uses the recency basis when recentHands is provided', () => {
  // potodds lifetime is red (4/20 = 20%), but the recent buffer is all wins, so
  // the recency-weighted IQ reads 100 — proving the display ignores the lifetime
  // 20 (F3). One incorrect potodds hand this session dilutes only the window: the
  // last RECENT_WINDOW becomes (WINDOW-1) wins + 1 loss.
  const potodds = SCENARIOS.filter(s => s.skill === 'potodds');
  const target = potodds[0];
  expect(target).toBeTruthy();
  const skills = { ...DEFAULT_SKILLS, potodds: { rating: 'red', attempts: 20, correct: 4 } };
  const recentHands = Array.from({ length: RECENT_WINDOW + 4 }, () => ({ skill: 'potodds', result: 'correct' }));
  const history = [{ scenario: target, choiceVal: null, result: 'incorrect' }];
  const after = Math.round(((RECENT_WINDOW - 1) / RECENT_WINDOW) * 100);
  render(<SessionSummary {...baseProps} userSkills={skills} recentHands={recentHands} sessionHistory={history} />);
  expect(screen.getByText(`100 → ${after}`)).toBeInTheDocument();
});

test('Poker IQ reads as locked while nothing is rated', () => {
  render(<SessionSummary {...baseProps}
    sessionHistory={hist(['correct', 'incorrect', 'correct', 'incorrect', 'correct'])}
  />);
  expect(screen.getByText(/Unlocks as skills get rated/)).toBeInTheDocument();
});

test('review cards carry the skill chip, with the rating-move arrow when it moved', () => {
  // Two potodds hands push the skill from gray (3 attempts) to rated-red —
  // the missed one's review card must show "Pot Odds ↓"
  const potodds = SCENARIOS.filter(s => s.skill === 'potodds').slice(0, 2);
  const history = [
    { scenario: potodds[0], choiceVal: null, result: 'incorrect' },
    { scenario: potodds[1], choiceVal: potodds[1].correct, result: 'correct' },
  ];
  const skills = { ...DEFAULT_SKILLS, potodds: { rating: 'gray', attempts: 3, correct: 1 } };
  render(<SessionSummary {...baseProps} userSkills={skills} sessionHistory={history} />);

  expect(screen.getByText('Hands to Review (1)')).toBeInTheDocument();
  const chip = document.querySelector('.ss-hr-skill');
  expect(chip).toHaveTextContent('Pot Odds');
  expect(chip.querySelector('.ss-hr-skill-move')).toHaveTextContent('↓');
  // The old per-skill rows and slide-over are gone — one place hands live
  expect(document.querySelector('.ss-impact-row-tappable')).toBeNull();
  expect(document.querySelector('.ss-slideover')).toBeNull();
});

// ── Streak mechanics (M1–M3) ─────────────────────────────────────────────
test('milestone proximity tails the secured line when within reach (M3)', () => {
  render(<SessionSummary {...baseProps}
    sessionHistory={hist(['correct', 'incorrect', 'correct', 'incorrect', 'correct'])}
    streakSecured={5}
  />);
  expect(screen.getByText(/Day 5 secured/)).toBeInTheDocument();
  expect(screen.getByText(/2 more to a full week/)).toBeInTheDocument();
});

test('no proximity tail when the milestone is out of reach', () => {
  render(<SessionSummary {...baseProps}
    sessionHistory={hist(['correct', 'incorrect', 'correct', 'incorrect', 'correct'])}
    streakSecured={3}
  />);
  expect(screen.getByText(/Day 3 secured/)).toBeInTheDocument();
  expect(screen.queryByText(/more to/)).not.toBeInTheDocument();
});

test('a used Rebuy shows the streak-intact note (M1)', () => {
  render(<SessionSummary {...baseProps}
    sessionHistory={hist(['correct', 'incorrect', 'correct', 'incorrect', 'correct'])}
    streakSecured={11} rebuyUsed
  />);
  expect(screen.getByText(/Rebuy used — streak intact/)).toBeInTheDocument();
});

test('a broken streak renders the consistency record, not a bare reset (M2)', () => {
  render(<SessionSummary {...baseProps}
    sessionHistory={hist(['correct', 'incorrect', 'correct', 'incorrect', 'correct'])}
    streakSecured={1} streakBroken activeDaysLast30={26}
  />);
  expect(screen.getByText(/played 26 of the last 30 days/)).toBeInTheDocument();
  expect(screen.getByText(/start a new run/i)).toBeInTheDocument();
  // The broken moment replaces the bare "Day 1 secured" line
  expect(screen.queryByText(/Day 1 secured/)).not.toBeInTheDocument();
});

test('broken streak falls back to copy-only when the record is unavailable', () => {
  render(<SessionSummary {...baseProps}
    sessionHistory={hist(['correct', 'incorrect', 'correct', 'incorrect', 'correct'])}
    streakSecured={1} streakBroken activeDaysLast30={null}
  />);
  expect(screen.getByText(/keep showing up/i)).toBeInTheDocument();
  expect(screen.queryByText(/of the last 30 days/)).not.toBeInTheDocument();
});

// ── The summary is AI-free (Phase A, July 2026) ────────────────────────────
// The read moved to the dashboard because a spinner sitting between the player
// and the next hand reads as a gate even though it never blocked. If a coach
// block ever returns here, that friction returns with it and nothing else in
// the suite would notice — this is the guard.
test('the summary renders no coach block and no loading state', () => {
  render(<SessionSummary {...baseProps} />);
  expect(document.querySelector('.ss-coach-read')).toBeNull();
  expect(document.querySelector('.ss-coach-structured')).toBeNull();
  expect(document.querySelector('.thinking')).toBeNull();
  expect(screen.queryByText(/Coach's Read/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Reading your session/i)).not.toBeInTheDocument();
});

test('the chaining CTA is present and needs no waiting', () => {
  render(<SessionSummary {...baseProps} />);
  const cta = screen.getByRole('button', { name: /Deal Next Session/i });
  expect(cta).toBeInTheDocument();
  expect(cta).toBeEnabled();
});

test('guest summary: sign-in gate instead of chaining (Phase A: no coach teaser)', () => {
  // The old teaser copy ("Your Coach's Read... comes with a free account")
  // lived inside the now-deleted ss-coach-read block. It advertised a read
  // that no longer renders here, so it went with the block — the gate itself
  // (CTA swapped in for the chaining button) is the part still under test.
  const onGuestSignIn = jest.fn();
  render(<SessionSummary {...baseProps} guest onGuestSignIn={onGuestSignIn}
    sessionHistory={hist(['correct', 'incorrect', 'correct', 'incorrect', 'correct'])}
  />);
  expect(screen.queryByText(/Deal Next Session/)).not.toBeInTheDocument();
  screen.getByText(/Sign In Free to Keep Playing/).click();
  expect(onGuestSignIn).toHaveBeenCalledWith('summary');
});

// ── CA-030: no inline DIFFICULTY_LABELS map in SessionSummary.jsx ─────────────
test('CA-030: SessionSummary.jsx does not define an inline difficulty label map', () => {
  const fs = require('fs');
  const src = fs.readFileSync(
    require.resolve('./SessionSummary'),
    'utf8'
  );
  // The inline `beginner:` entry inside a local DIFFICULTY_LABELS object must be gone
  expect(src).not.toMatch(/beginner:\s*['"]Beginner['"]/);
});

// ── CA-031: GUEST_GATE_CTA single-source pin ──────────────────────────────────
test('CA-031: SessionSummary.jsx does not hard-code the guest CTA string', () => {
  const fs = require('fs');
  const src = fs.readFileSync(
    require.resolve('./SessionSummary'),
    'utf8'
  );
  expect(src).not.toMatch(/'Sign In Free to Keep Playing'/);
  expect(src).not.toMatch(/"Sign In Free to Keep Playing"/);
});
