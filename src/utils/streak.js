// Streak mechanics: run length, Rebuys, milestone proximity.
//
// MOD-001 (Wave 3): split out of userStorage.js. Depends only on dates.js —
// the cycle-break TARGET_ARCHITECTURE required before this could move (CA-058).
import { toLocalDateString } from './dates';

// ── Streak mechanics (M1–M3, July 2026 — docs/research/RESEARCH_LEARNING_SCIENCE.md Piece 3) ─
// Streak Rebuys (M1): a poker-named streak freeze — the genre's most validated
// retention mechanic (Duolingo's freeze: −21% churn for at-risk users). Earned,
// never purchased (informational, not controlling — M4/overjustification). Earn
// one at each 7-day milestone, hold at most REBUY_CAP; a missed day silently
// consumes one and the streak survives. Purchasable extras are a future Pro
// perk, not launch scope.
export const REBUY_CAP = 2;
const STREAK_MILESTONE_INTERVAL = 7;

// Milestone proximity (M3, goal-gradient): effort accelerates as a goal nears,
// so the streak line states how far the next milestone is when it's within
// reach. Pure copy. Shared here so the summary and dashboard can't drift.
export const STREAK_MILESTONES_LIST = [7, 30, 100];
// Exported: the summary's "Day N secured — a full week" line reads from this
// same map, so milestone wording can't drift between surfaces.
export const MILESTONE_NAMES = { 7: 'a full week', 30: 'a full month', 100: 'a hundred days' };
const PROXIMITY_WINDOW = 3;

export function milestoneProximity(streak) {
  if (!streak || streak < 1) return null;
  for (const m of STREAK_MILESTONES_LIST) {
    if (streak < m && m - streak <= PROXIMITY_WINDOW) {
      return { remaining: m - streak, name: MILESTONE_NAMES[m] };
    }
  }
  return null;
}

// Whole calendar days between two YYYY-MM-DD strings (UTC math on the parsed
// components dodges DST — these are pure dates, not instants).
function daysBetween(fromStr, toStr) {
  const [fy, fm, fd] = fromStr.split('-').map(Number);
  const [ty, tm, td] = toStr.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

// Grant a Rebuy when this streak lands on a 7-day milestone (once — the streak
// steps by exactly 1 per active day, so each multiple of 7 is hit once). Capped.
const grantMilestoneRebuy = (streak, rebuys) =>
  streak > 0 && streak % STREAK_MILESTONE_INTERVAL === 0
    ? Math.min(REBUY_CAP, rebuys + 1)
    : rebuys;

// Recompute the streak (and Rebuy balance) for the first session of a new day.
// Returns { streak, lastSessionDate, rebuys, rebuyUsed } — rebuyUsed flags the
// transient "a missed day was covered" moment for the summary/dashboard copy.
export function calcStreak(user) {
  const today = toLocalDateString(new Date());
  const rebuys = user.rebuys ?? 0;
  if (user.lastSessionDate === today) {
    return { streak: user.streak, lastSessionDate: today, rebuys, rebuyUsed: false };
  }
  // First-ever session (or no prior date): a fresh streak of 1.
  if (!user.lastSessionDate) {
    return { streak: 1, lastSessionDate: today, rebuys, rebuyUsed: false };
  }
  const gap = daysBetween(user.lastSessionDate, today);
  if (gap <= 1) {
    // Consecutive day (gap 1) advances; gap ≤ 0 shouldn't happen but is treated
    // as "already today" defensively.
    const streak = gap === 1 ? user.streak + 1 : user.streak;
    return { streak, lastSessionDate: today, rebuys: grantMilestoneRebuy(streak, rebuys), rebuyUsed: false };
  }
  // A gap of ≥2 means one or more missed days. Rebuys cover them one-for-one;
  // if the balance covers every missed day, the streak survives and advances.
  const missedDays = gap - 1;
  if (missedDays <= rebuys) {
    const streak = user.streak + 1;
    const afterConsume = rebuys - missedDays;
    return { streak, lastSessionDate: today, rebuys: grantMilestoneRebuy(streak, afterConsume), rebuyUsed: true };
  }
  // Streak truly breaks — fresh run, Rebuy balance resets with it (Rebuys
  // belong to the streak they protect; the broken-streak moment lives in the UI).
  return { streak: 1, lastSessionDate: today, rebuys: 0, rebuyUsed: false };
}

// Returns true iff playing today would CONTINUE the stored streak — i.e. the
// streak is still "alive" and should display at face value. False when the
// stored streak is already dead (lapsed beyond Rebuy coverage) or zero.
// Used by Dashboard to suppress the stale "on the line" banner (CA-039) and
// to show an honest streak count in the stats chip.
// `now` defaults to new Date() and is injectable for tests.
export function streakAlive(user, now = new Date()) {
  if (!user.streak || !user.lastSessionDate) return false;
  const rebuys = user.rebuys ?? 0;
  const todayStr = toLocalDateString(now);
  const gap = daysBetween(user.lastSessionDate, todayStr);
  if (gap <= 1) return true;                   // today or yesterday — alive
  const missedDays = gap - 1;
  return missedDays <= rebuys;                 // Rebuy-covered gap → still alive
}
