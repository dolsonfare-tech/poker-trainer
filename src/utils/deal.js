// Dealing one session's worth of scenarios.
//
// MOD-002 (Wave 3): pure, no React — it was living inside useSessionRun.js
// only because it started life in App.jsx. Moving it out is what the
// component-budget invariant was for: the rule fired at 263/160 lines, and the
// honest fix is to relocate what does not belong rather than raise the number.
import { buildSession, applyHandsToHistory } from './spacedrep';
import { toLocalDateString } from './dates';

// Hands per session. Validated instinct, not a data-driven number — ROADMAP
// item 6 holds the decision rule for revisiting it.
const SESSION_LENGTH = 5;

// ASYNC as of CA-014 (Wave 4): the 438 KB scenario library is fetched here, on
// the first deal, instead of at cold start. Every visitor previously parsed all
// 172 scenarios just to reach the sign-in screen.
//
// The await is safe because useSessionRun.startSession sets screen='session'
// only AFTER this resolves — there is no window where the session screen renders
// without a deck. webpackChunkName keeps the chunk identifiable in the build
// output so the size gate can point at it.
export async function dealScenarios(difficulty, user, pendingHands = []) {
  const { default: SCENARIOS, CONTRAST_PAIRS } =
    await import(/* webpackChunkName: "scenarios" */ '../data/scenarios');
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
    // Passed explicitly now that spacedrep.js no longer imports scenarios.js —
    // it is on the login path (db.js, claude.js, session.js all import it), so
    // a static import there would have pinned the library into the main bundle
    // no matter what this function does. Pinned by a test in deal.test.js:
    // dropping this argument would silently disable contrast pairing.
    contrastPairs: CONTRAST_PAIRS,
  });
}
