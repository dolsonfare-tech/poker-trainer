// useSessionRun (MOD-002, Wave 3).
//
// This is the point of the extraction. Every one of these behaviours lived in
// App.jsx and could only be reached by rendering the entire application, so
// almost none of them were tested — including the double-fire guards that exist
// specifically because throttled background tabs break assumptions about state
// updates landing in order.
//
// The hook is driven with renderHook rather than a rendered app, so the session
// loop can be stepped deterministically.
import { renderHook, act } from '@testing-library/react';

jest.mock('../utils/analytics', () => ({ track: jest.fn() }));
// Spread the REAL module and override only the network call. A bare object mock
// silently breaks transitive importers — db.js reads DEFAULT_SKILLS from this
// module at load time, so replacing it wholesale crashes the suite before a
// single test runs.
jest.mock('../utils/session', () => ({
  ...jest.requireActual('../utils/session'),
  submitSession: jest.fn(),
}));

import { useSessionRun } from './useSessionRun';
import { createUser, submitSession } from '../utils/session';
import { track } from '../utils/analytics';

const setup = (over = {}) => {
  const setUser = jest.fn();
  const setScreen = jest.fn();
  const props = {
    user: { ...createUser('Runner'), sessionsCompleted: 3 },
    setUser, isGuest: false, screen: 'session', setScreen, ...over,
  };
  const view = renderHook((p) => useSessionRun(p), { initialProps: props });
  return { ...view, setUser, setScreen };
};

// Deal a real session so the loop has scenarios to step through.
const deal = (result) => act(() => { result.current.startSession('beginner'); });

beforeEach(() => {
  jest.clearAllMocks();
  window.scrollTo = jest.fn();
  // CRA sets resetMocks: true, which wipes any implementation declared in the
  // jest.mock factory before every test — so the resolved value is set here or
  // submitSession returns undefined and the await destructure throws.
  submitSession.mockResolvedValue({ user: null, coachText: '', limited: false });
});

test('starting a session deals hands and reports it once', () => {
  const { result } = setup();
  deal(result);
  expect(result.current.shuffledScenarios.length).toBeGreaterThan(0);
  expect(result.current.currentIndex).toBe(0);
  expect(result.current.decided).toBe(false);
  expect(track).toHaveBeenCalledWith('session_started',
    expect.objectContaining({ difficulty: 'beginner', chained: false }));
});

test('a decision grades the hand, records it, and blocks a second answer', () => {
  const { result } = setup();
  deal(result);
  const scenario = result.current.scenario;
  act(() => { result.current.handleDecision(scenario.correct); });

  expect(result.current.decided).toBe(true);
  expect(result.current.correctCount).toBe(1);
  expect(result.current.combo).toBe(1);
  expect(result.current.feedback).not.toBeNull();
  expect(result.current.sessionHistory).toHaveLength(1);

  // The synchronous decidedRef guard: a second decision on the same hand is
  // dropped. Without it a throttled tab can double-count one answer, which
  // corrupts accuracy — the number every skill rating is built from.
  const wrong = scenario.options.find(o => o.val !== scenario.correct).val;
  act(() => { result.current.handleDecision(wrong); });
  expect(result.current.sessionHistory).toHaveLength(1);
  expect(result.current.correctCount).toBe(1);
});

test('a wrong answer breaks the combo but still records the hand', () => {
  const { result } = setup();
  deal(result);
  const scenario = result.current.scenario;
  const wrong = scenario.options.find(o => o.val !== scenario.correct).val;
  act(() => { result.current.handleDecision(wrong); });
  expect(result.current.combo).toBe(0);
  expect(result.current.correctCount).toBe(0);
  expect(result.current.sessionHistory).toHaveLength(1);
});

test('a timeout scores incorrect with a NULL decisionMs — never a fast error', () => {
  const { result } = setup();
  deal(result);
  act(() => { result.current.handleTimeout(); });
  expect(result.current.timedOut).toBe(true);
  expect(result.current.sessionHistory[0].result).toBe('incorrect');
  // A timeout froze on the decision — slow-wrong, the opposite of a confident
  // miss. Recording a duration would feed the F2 confident-miss ladder a lie.
  expect(result.current.sessionHistory[0].decisionMs).toBeNull();
  expect(result.current.sessionHistory[0].choiceVal).toBeNull();
});

test('a timeout after a decision is ignored — one hand, one entry', () => {
  const { result } = setup();
  deal(result);
  act(() => { result.current.handleDecision(result.current.scenario.correct); });
  act(() => { result.current.handleTimeout(); });
  expect(result.current.sessionHistory).toHaveLength(1);
  expect(result.current.sessionHistory[0].result).toBe('correct');
});

test('advancing clears per-hand state so the next hand starts clean', () => {
  const { result } = setup();
  deal(result);
  act(() => { result.current.handleDecision(result.current.scenario.correct); });
  act(() => { result.current.handleNext(); });
  expect(result.current.currentIndex).toBe(1);
  expect(result.current.decided).toBe(false);
  expect(result.current.feedback).toBeNull();
  expect(result.current.timedOut).toBe(false);
});

test('the last hand ends the session and hands off to submitSession exactly once', async () => {
  const { result } = setup();
  deal(result);
  const total = result.current.shuffledScenarios.length;
  for (let i = 0; i < total; i++) {
    act(() => { result.current.handleDecision(result.current.scenario.correct); });
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { result.current.handleNext(); });
  }
  expect(result.current.showSummary).toBe(true);
  expect(submitSession).toHaveBeenCalledTimes(1);
  expect(track).toHaveBeenCalledWith('session_completed',
    expect.objectContaining({ total, correct: total, incorrect: 0 }));
});

test('the session delta captures the BEFORE state for the summary animation', async () => {
  const user = { ...createUser('Before'), sessionsCompleted: 7, pokerScore: 61, streak: 4 };
  const { result } = setup({ user });
  deal(result);
  const total = result.current.shuffledScenarios.length;
  for (let i = 0; i < total; i++) {
    act(() => { result.current.handleDecision(result.current.scenario.correct); });
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { result.current.handleNext(); });
  }
  // Pre-session values — the summary animates FROM these, so capturing them
  // after the update would render a no-op animation.
  expect(result.current.sessionDelta.prevSessions).toBe(7);
  expect(result.current.sessionDelta.prevPokerScore).toBe(61);
  expect(result.current.sessionDelta.prevStreak).toBe(4);
});

test('restarting clears the run and returns to the dashboard', () => {
  const { result, setScreen } = setup();
  deal(result);
  act(() => { result.current.handleDecision(result.current.scenario.correct); });
  act(() => { result.current.handleRestart(); });
  expect(setScreen).toHaveBeenCalledWith('dashboard');
  expect(result.current.shuffledScenarios).toEqual([]);
  expect(result.current.sessionHistory).toEqual([]);
  expect(result.current.showSummary).toBe(false);
  expect(result.current.combo).toBe(0);
});

test('a chained session is reported as chained and resets the previous run', () => {
  const { result } = setup();
  deal(result);
  act(() => { result.current.handleDecision(result.current.scenario.correct); });
  act(() => { result.current.handlePlayAgain(); });
  expect(track).toHaveBeenCalledWith('session_started',
    expect.objectContaining({ chained: true }));
  expect(result.current.sessionHistory).toEqual([]);
  expect(result.current.currentIndex).toBe(0);
});
