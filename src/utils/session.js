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
import { saveUser } from './persistence';
import { fetchCoachRead } from './claude';

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

// ── submitSession (MOD-002, Wave 3) ────────────────────────────────────────
// The end-of-session pipeline, lifted verbatim out of App.jsx's
// handleFetchCoachRead: fetch the Coach's Read, fold the results into the user
// record, and persist locally plus remotely.
//
// It is extracted for two reasons beyond shrinking App.jsx. First, this is the
// ONE place a session's outcome becomes durable, which makes it the seam Wave 4
// needs: the trust-boundary work (CA-001/006/012) has to move streak, rebuys
// and poker_score to server-computed columns, and it needs a single choke point
// to do that in. Second, the ordering here is load-bearing and was previously
// only assertable by driving the whole app.
//
// Ordering that must not drift:
//   * a guest NEVER calls the coach endpoint (it requires a signed-in user —
//     the read is the sign-in carrot, and the summary says so honestly), but
//     their results still persist locally so the account migration picks them up
//   * a failed or rate-limited read must STILL persist the session. Losing a
//     player's hands because the coach was down would be the worse bug, so the
//     catch path applies results with a null read rather than bailing
//   * the local save happens for everyone; the remote writes are fire-and-
//     forget so a slow network cannot block the summary from rendering
//
// React state stays with the caller: this returns what changed and performs
// only persistence, so it can be tested without rendering anything.
//
// `remote` is INJECTED rather than imported. db.js imports createUser and
// DEFAULT_SKILLS from this module, so importing db.js back would close a
// session -> db -> userStorage-barrel -> session cycle. Injection breaks it,
// and its absence doubles as the localStorage-only signal — one condition
// instead of a `hasSupabase` flag that could disagree with reality.
export async function submitSession({ user, hands, sessionHistory, difficulty, isGuest, remote }) {
  const persist = (updated, coachText) => {
    saveUser(updated);                       // localStorage cache always
    if (remote && !isGuest) {
      remote.saveRemoteUser(updated).catch(err => console.error('Profile save failed', err));
      remote.recordSession({
        difficulty,
        hands,
        correctCount: hands.filter(h => h.result === 'correct').length,
        coachRead: coachText,
      }).catch(err => console.error('Session log failed', err));
    }
    return updated;
  };

  if (isGuest) {
    const updated = user ? persist(applySessionResults(user, hands, null), null) : null;
    return { user: updated, coachText: '', limited: false };
  }

  try {
    const coachText = await fetchCoachRead(sessionHistory);
    const updated = user ? persist(applySessionResults(user, hands, coachText), coachText) : null;
    return { user: updated, coachText, limited: false };
  } catch (err) {
    const updated = user ? persist(applySessionResults(user, hands, null), null) : null;
    return { user: updated, coachText: '', limited: err?.code === 'daily_limit' };
  }
}

// ── buildSessionDelta (MOD-002, Wave 3) ────────────────────────────────────
// The before/after snapshot the summary animates from: IQ delta, previous
// streak/sessions/score/skills, and the three streak-mechanics moments (M1–M3).
//
// Pure derivation from (user, sessionHistory, skillResults) — extracted from
// useSessionRun because the component-budget invariant fired and this was the
// largest thing in that hook with no React in it. It also means the M1/M2/M3
// moments can be asserted directly instead of by driving a whole session.
export function buildSessionDelta({ user, sessionHistory, skillResults }) {
  // Count every hand played — matches SessionSummary, not the per-skill deduped
  // skillResults.
  const correct   = sessionHistory.filter(h => h.result === 'correct').length;
  const incorrect = sessionHistory.filter(h => h.result === 'incorrect').length;
  const today = toLocalDateString(new Date());
  // One streak recompute feeds every streak-mechanics surface (M1–M3): the
  // secured line, the Rebuy-used note, and the broken-streak moment.
  const streakResult = user && user.lastSessionDate !== today ? calcStreak(user) : null;
  const prevStreak = user?.streak ?? 0;
  return {
    counts: { correct, incorrect },
    iqDelta: correct * 2 - incorrect,
    prevStreak,
    prevSessions: user?.sessionsCompleted ?? 0,
    prevPokerScore: user?.pokerScore ?? null,
    prevSkills: user ? { ...user.skills } : {},
    // Pre-session recent-hands buffer for the recency-weighted IQ before→after
    // (F3) — the summary folds this session's hands on top, matching apply.
    prevRecentHands: user?.recentHands ?? [],
    skillResults: { ...skillResults },
    // First session of the day = the moment the streak day is earned; later
    // sessions the same day show nothing (already secured).
    streakSecured: streakResult ? streakResult.streak : null,
    // A Rebuy silently covered a missed day — streak intact (M1).
    rebuyUsed: streakResult ? streakResult.rebuyUsed : false,
    // A real streak (>1) reset to 1 → the broken-streak moment (M2), never a
    // bare drop; activeDaysLast30 is the consistency record.
    streakBroken: !!streakResult && streakResult.streak === 1 && prevStreak > 1,
    activeDaysLast30: user?.activeDaysLast30 ?? null,
    // null until a best exists (legacy local users / first session) so a first
    // result is never hailed as a "personal best"
    prevBest: user?.bestSessionCorrect ?? null,
  };
}
