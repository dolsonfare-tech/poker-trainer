import { useState, useEffect, useRef, useCallback } from 'react';
import { dealScenarios } from '../utils/deal';
import { saveLastDifficulty } from '../utils/persistence';
import { submitSession, buildSessionDelta } from '../utils/session';
import { hasSupabase } from '../utils/supabase';
import { saveRemoteUser, recordSession } from '../utils/db';
import { emitDecisionMade, emitSessionCompleted, emitSessionStarted } from '../utils/events';

// ─── useSessionRun (MOD-002, Wave 3) ───────────────────────────────────────
// Everything about ONE run of hands: the deal, the per-hand decision loop, the
// end-of-session delta, and the hand-off to submitSession.
//
// Lifted out of App.jsx as a pure move — same state, same order, same handlers.
// It was the largest single thing App.jsx did (15 state values, three refs) and
// none of it was reachable by a test without rendering the whole app, which is
// why almost none of it was tested.
//
// The caller keeps ownership of `user` and `screen`: this hook reads them and
// reports what changed rather than owning identity or routing. That boundary is
// what lets useAuthSession stay independent of it.

const TIMER_SECONDS = 60; // HARDCODED — pull from user settings in Phase 2

export { TIMER_SECONDS };

export function useSessionRun({ user, setUser, isGuest, screen, setScreen }) {
  const [difficulty, setDifficulty]               = useState('beginner');
  const [shuffledScenarios, setShuffledScenarios] = useState([]);
  const [currentIndex, setCurrentIndex]           = useState(0);
  const [skillResults, setSkillResults]           = useState({});
  const [decided, setDecided]                     = useState(false);
  const [feedback, setFeedback]                   = useState(null);
  const [showSummary, setShowSummary]             = useState(false);
  const [coachRead, setCoachRead]                 = useState('');
  const [coachLoading, setCoachLoading]           = useState(false);
  const [coachLimited, setCoachLimited]           = useState(false);
  const [timedOut, setTimedOut]                   = useState(false);
  const [combo, setCombo]                         = useState(0);
  const [correctCount, setCorrectCount]           = useState(0);
  const [sessionHistory, setSessionHistory]       = useState([]);
  const [sessionDelta, setSessionDelta]           = useState(null);
  const sessionUserRef                            = useRef(null);
  // Synchronous decided guard — state/effect updates can lag in throttled
  // background tabs, so this ref is the authoritative "already answered" flag
  const decidedRef                                = useRef(false);
  // Stamp when the current scenario was presented, so a decision can record
  // decisionMs (F2: fast + wrong = a confident miss).
  const shownAtRef                                = useRef(null);

  const scenario = shuffledScenarios[currentIndex];

  // Re-stamp on entering the session and on every new hand.
  useEffect(() => {
    if (screen === 'session') shownAtRef.current = Date.now();
  }, [currentIndex, screen]);

  const appendHistory = useCallback((idx, entry) => {
    setSessionHistory(prev => (prev.length > idx ? prev : [...prev, entry]));
  }, []);

  // Countdown lives inside TimerRing (ScenarioCard) — this only handles expiry
  const handleTimeout = useCallback(() => {
    if (!scenario || decided || decidedRef.current) return;
    decidedRef.current = true;
    setTimedOut(true);
    setDecided(true);
    setSkillResults(prev => ({ ...prev, [scenario.skill]: 'incorrect' }));
    // A timeout froze on the decision — slow-wrong, the opposite of a confident
    // miss — so decisionMs is null, never counted as a fast error.
    appendHistory(currentIndex, { scenario, choiceVal: null, result: 'incorrect', decisionMs: null });
    emitDecisionMade({ scenarioId: scenario.id, skill: scenario.skill, result: 'incorrect', timedOut: true, replay: !!scenario.replay });
    setCombo(0);
    const correctGrading = scenario.grading[scenario.correct];
    setFeedback({ grade: { ...correctGrading, skill: scenario.tag }, loading: false, text: scenario.feedback.correct, choice: null });
    // Feedback overlays the table at the top of the canvas — scroll to it
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }, [scenario, decided, currentIndex, appendHistory]);

  const startSession = (selected, { chained = false } = {}) => {
    decidedRef.current = false;
    setDifficulty(selected);
    saveLastDifficulty(selected);
    const pending = chained
      ? sessionHistory.map(h => ({ scenarioId: h.scenario.id, result: h.result, decisionMs: h.decisionMs ?? null }))
      : [];
    setShuffledScenarios(dealScenarios(selected, user, pending));
    setCurrentIndex(0);
    setSkillResults({});
    setDecided(false);
    setFeedback(null);
    setShowSummary(false);
    setCoachRead('');
    setCoachLimited(false);
    setTimedOut(false);
    setCombo(0);
    setCorrectCount(0);
    setSessionHistory([]);
    setSessionDelta(null);
    setScreen('session');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    emitSessionStarted({ difficulty: selected, chained, guest: isGuest });
  };

  const handleDifficultySelect = (selected) => startSession(selected);

  // One-tap "Deal Next Session" from the summary — same difficulty, no
  // dashboard/difficulty-screen round trip between sessions.
  const handlePlayAgain = () => startSession(difficulty, { chained: true });

  // The pipeline itself lives in utils/session.js (MOD-002) — this keeps only
  // the React state around it. `remote` is injected there rather than imported,
  // which breaks a session -> db -> userStorage cycle and doubles as the
  // localStorage-only signal.
  const handleFetchCoachRead = async () => {
    const prevUser = sessionUserRef.current;
    // Every hand played counts toward accuracy — not the per-skill deduped
    // results. decisionMs rides along (additive, no schema change): it derives
    // the confident-miss flag for the R1 ladder and the coach payload (F2).
    const hands = sessionHistory.map(h => ({
      scenarioId: h.scenario.id, skill: h.scenario.skill,
      result: h.result, choiceVal: h.choiceVal, decisionMs: h.decisionMs ?? null,
    }));
    if (!isGuest) setCoachLoading(true);
    const { user: updated, coachText, limited } = await submitSession({
      user: prevUser, hands, sessionHistory, difficulty, isGuest,
      remote: hasSupabase ? { saveRemoteUser, recordSession } : null,
    });
    if (updated) setUser(updated);
    setCoachRead(coachText);
    if (limited) setCoachLimited(true);
    if (!isGuest) setCoachLoading(false);
  };

  const handleDecision = useCallback((choice) => {
    if (decided || decidedRef.current) return;
    decidedRef.current = true;
    setDecided(true);
    setTimedOut(false);
    const gr = scenario.grading[choice];
    const decisionMs = shownAtRef.current ? Date.now() - shownAtRef.current : null;
    setSkillResults(prev => ({ ...prev, [scenario.skill]: gr.g }));
    appendHistory(currentIndex, { scenario, choiceVal: choice, result: gr.g, decisionMs });
    // decision_ms powers the per-scenario comprehension heatmap (July 19, 2026
    // audit): p50 decision time + timeout rate per scenario = the ranked list
    // of spots where players can't parse the situation fast enough.
    emitDecisionMade({ scenarioId: scenario.id, skill: scenario.skill, result: gr.g, timedOut: false, replay: !!scenario.replay, decisionMs });
    if (gr.g === 'correct') {
      setCombo(prev => prev + 1);
      setCorrectCount(prev => prev + 1);
    } else {
      setCombo(0);
    }
    const feedbackText = scenario.feedback[gr.g];
    setFeedback({ grade: { ...gr, skill: scenario.tag }, loading: false, text: feedbackText, choice });
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }, [decided, scenario, currentIndex, appendHistory]);

  const handleNext = () => {
    const next = currentIndex + 1;
    if (next >= shuffledScenarios.length) {
      // Count every hand played — matches SessionSummary, not the per-skill deduped skillResults
      const delta = buildSessionDelta({ user, sessionHistory, skillResults });
      sessionUserRef.current = user;
      setSessionDelta(delta);
      const { correct, incorrect } = delta.counts;
      setShowSummary(true);
      emitSessionCompleted({ difficulty, correct, incorrect, total: sessionHistory.length, guest: isGuest });
      handleFetchCoachRead();
    } else {
      decidedRef.current = false;
      setCurrentIndex(next);
      setDecided(false);
      setFeedback(null);
      setTimedOut(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleRestart = () => {
    decidedRef.current = false;
    setScreen('dashboard');
    setCurrentIndex(0);
    setSkillResults({});
    setDecided(false);
    setFeedback(null);
    setShowSummary(false);
    setCoachRead('');
    setCoachLimited(false);
    setCoachLoading(false);
    setShuffledScenarios([]);
    setTimedOut(false);
    setCombo(0);
    setCorrectCount(0);
    setSessionHistory([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return {
    // state the render tree reads
    scenario, shuffledScenarios, currentIndex, difficulty,
    decided, feedback, timedOut, combo, correctCount,
    showSummary, sessionDelta, sessionHistory, skillResults,
    coachRead, coachLoading, coachLimited,
    // actions
    startSession, handleDifficultySelect, handlePlayAgain,
    handleDecision, handleTimeout, handleNext, handleRestart,
  };
}
