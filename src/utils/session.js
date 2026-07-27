// Session application: what a finished session does to the user record.
//
// MOD-001 (Wave 3): split out of userStorage.js. Wave 3's `submitSession`
// (the coach-read fetch + persist pipeline currently inline in App.jsx) lands
// here next — this module is the server-callable seam Wave 4's trust-boundary
// work needs.
import { applyHandToSkill, SKILL_NAMES } from '../data/constants';
import { applyHandsToHistory } from './spacedrep';
import { toLocalDateString } from './dates';
import { calcStreak } from './streak';
import { addHandsToDirectionTally, deriveSchema, EMPTY_DIRECTION_TALLY } from './schema';
import { appendRecentHands, derivePokerScore } from './iq';
import { COACH_READS_CAP } from './coachRead';

export const RENAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export const DEFAULT_SKILLS = {
  preflop:    { rating: 'gray', attempts: 0, correct: 0 },
  position:   { rating: 'gray', attempts: 0, correct: 0 },
  aggression: { rating: 'gray', attempts: 0, correct: 0 },
  betsize:    { rating: 'gray', attempts: 0, correct: 0 },
  bluffing:   { rating: 'gray', attempts: 0, correct: 0 },
  potodds:    { rating: 'gray', attempts: 0, correct: 0 },
  reads:      { rating: 'gray', attempts: 0, correct: 0 },
  opponent:   { rating: 'gray', attempts: 0, correct: 0 },
};

export function createUser(username) {
  return {
    displayName: username,
    initials: username.slice(0, 2).toUpperCase(),
    streak: 0,
    lastSessionDate: null,
    rebuys: 0,
    sessionsCompleted: 0,
    skills: Object.fromEntries(
      Object.entries(DEFAULT_SKILLS).map(([k, v]) => [k, { ...v }])
    ),
    schema: null,
    coachNote: null,
    coachReads: [],
    pokerScore: null,
    scenarioHistory: {},
    recentHands: [],
    directionTally: { ...EMPTY_DIRECTION_TALLY },
    leaderboard: null,
  };
}

// ── Apply session ─────────────────────────────────────────────────────────────
// `hands` is one entry per hand played: [{ scenarioId, skill, result }] —
// every hand counts toward that skill's accuracy, including duplicates
// within a session.
export function applySessionResults(user, hands, coachRead) {
  const skills = Object.fromEntries(
    Object.entries(user.skills).map(([k, d]) => [k, { ...d }])
  );
  for (const { skill, result } of hands) {
    if (skills[skill]) skills[skill] = applyHandToSkill(skills[skill], result);
  }

  const { streak, lastSessionDate, rebuys } = calcStreak(user);
  const sessionsCompleted = user.sessionsCompleted + 1;
  // Direction-of-error tally (schema v2) — lifetime, folded from every hand's
  // scenarioId + choiceVal + result. In Supabase mode db.js also rebuilds it
  // fresh from the session log on load (self-healing, same pattern as
  // recentHands/scenarioHistory); this in-memory update keeps the current
  // device accurate between loads. Fed to deriveSchema alongside the skills.
  const directionTally = addHandsToDirectionTally(user.directionTally, hands);
  const schema     = deriveSchema(skills, sessionsCompleted, directionTally);
  // Recency-weighted Poker IQ (F3): fold this session's hands into the rolling
  // buffer BEFORE deriving the score so the number reflects current form. The
  // buffer is trimmed to the cap inside appendRecentHands.
  const recentHands = appendRecentHands(user.recentHands, hands);
  const pokerScore = derivePokerScore(skills, recentHands);
  // Per-scenario history drives the session builder (no repeats, comeback
  // hands, the R1/R2 graduation ladder). In Supabase mode this is also rebuilt
  // from `sessions` rows on every profile load — this in-memory update keeps
  // the current device accurate between loads. Today's date feeds the R2
  // calendar-day floor so chained same-day sessions can't mass a miss.
  const scenarioHistory = applyHandsToHistory(
    user.scenarioHistory ?? {}, hands, sessionsCompleted, toLocalDateString(new Date())
  );
  // Personal best (most correct in one session). In Supabase mode this is
  // also derived from sessions.correct_count on load, so it self-heals; for
  // legacy local users the field starts null and begins tracking now.
  const sessionCorrect = hands.filter(h => h.result === 'correct').length;
  const bestSessionCorrect = Math.max(user.bestSessionCorrect ?? 0, sessionCorrect);

  const weakest = Object.entries(skills)
    .filter(([, d]) => d.rating === 'red' && d.attempts > 0)
    .map(([k]) => SKILL_NAMES[k])[0] ?? null;

  const coachNote = coachRead
    ? { body: coachRead, focus: weakest }
    : user.coachNote;

  // Coach's Notebook history (newest first, capped). Only a real read this
  // session prepends; the raw string is stored verbatim (parsed at render).
  const coachReads = coachRead
    ? [{ date: toLocalDateString(new Date()), body: coachRead }, ...(user.coachReads ?? [])].slice(0, COACH_READS_CAP)
    : (user.coachReads ?? []);

  return { ...user, skills, streak, lastSessionDate, rebuys, sessionsCompleted, schema, pokerScore, coachNote, coachReads, scenarioHistory, recentHands, directionTally, bestSessionCorrect };
}
