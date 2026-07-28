// Dealing one session's worth of scenarios.
//
// MOD-002 (Wave 3): pure, no React — it was living inside useSessionRun.js
// only because it started life in App.jsx. Moving it out is what the
// component-budget invariant was for: the rule fired at 263/160 lines, and the
// honest fix is to relocate what does not belong rather than raise the number.
import SCENARIOS from '../data/scenarios';
import { buildSession, applyHandsToHistory } from './spacedrep';
import { toLocalDateString } from './dates';

// Hands per session. Validated instinct, not a data-driven number — ROADMAP
// item 6 holds the decision rule for revisiting it.
const SESSION_LENGTH = 5;

export function dealScenarios(difficulty, user, pendingHands = []) {
  const pool = SCENARIOS.filter(s => s.difficulty === difficulty);
  const played = user?.sessionsCompleted ?? 0;
  const priorHistory = user?.scenarioHistory ?? {};
  const today = toLocalDateString(new Date());
  const alreadyApplied = pendingHands.length > 0 &&
    pendingHands.every(h => priorHistory[h.scenarioId]?.lastSeenAt === played);
  const merge = pendingHands.length > 0 && !alreadyApplied;
  const sessionsCompleted = merge ? played + 1 : played;
  // Merge with today's date so a just-played same-day miss is stamped for the
  // R2 day floor and can't resurface in the very next chained deal.
  const history = merge
    ? applyHandsToHistory(priorHistory, pendingHands, sessionsCompleted, today)
    : priorHistory;
  return buildSession(pool, {
    history,
    skills: user?.skills ?? {},
    sessionsCompleted,
    length: SESSION_LENGTH,
    currentDate: today,
  });
}
