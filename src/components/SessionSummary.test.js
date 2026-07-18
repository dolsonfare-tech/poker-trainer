// Summary "earned moments" + honest-IQ display logic, exercised directly —
// a perfect session can't be forced through the real UI without knowing
// every scenario's answer, so the display contract is pinned here.
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import SessionSummary from './SessionSummary';
import SCENARIOS from '../data/scenarios';
import { DEFAULT_SKILLS } from '../utils/userStorage';

jest.mock('../utils/supabase', () => ({ supabase: null, hasSupabase: false }));

const pool = SCENARIOS.slice(0, 5);
const hist = (results) => pool.map((s, i) => ({
  scenario: s,
  choiceVal: results[i] === 'correct' ? s.correct : null,
  result: results[i],
}));

const baseProps = {
  coachRead: '',
  coachLoading: false,
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
  // potodds rated red (30) and untouched by these hands → 30 → 30
  const rated = {
    ...DEFAULT_SKILLS,
    potodds: { rating: 'red', attempts: 5, correct: 1 },
  };
  const nonPotodds = pool.every(s => s.skill !== 'potodds');
  expect(nonPotodds).toBe(true); // guard: the fixture must not move the score
  render(<SessionSummary {...baseProps} userSkills={rated}
    sessionHistory={hist(['correct', 'correct', 'incorrect', 'correct', 'incorrect'])}
  />);
  expect(screen.getByText('30 → 30')).toBeInTheDocument();
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

test('daily coach limit shows honest copy, not the generic fallback', () => {
  render(<SessionSummary {...baseProps} coachLimited
    sessionHistory={hist(['correct', 'incorrect', 'correct', 'incorrect', 'correct'])}
  />);
  expect(screen.getByText(/used today's 5 Coach's Reads/)).toBeInTheDocument();
  expect(screen.queryByText(/No pattern identified yet/)).not.toBeInTheDocument();
});

test('guest summary: coach teaser + sign-in gate instead of chaining', () => {
  const onGuestSignIn = jest.fn();
  render(<SessionSummary {...baseProps} guest onGuestSignIn={onGuestSignIn}
    sessionHistory={hist(['correct', 'incorrect', 'correct', 'incorrect', 'correct'])}
  />);
  expect(screen.getByText(/comes with a free account/)).toBeInTheDocument();
  expect(screen.queryByText(/Deal Next Session/)).not.toBeInTheDocument();
  screen.getByText(/Sign in free to keep playing/).click();
  expect(onGuestSignIn).toHaveBeenCalledWith('summary');
});
