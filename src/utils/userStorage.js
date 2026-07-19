import { deriveRating, applyHandToSkill, RESULT_CREDIT, PLAYER_SCHEMAS, SKILL_NAMES } from '../data/constants';
import { applyHandsToHistory } from './spacedrep';

const USER_KEY = 'cr_user';

// Editable usernames: one change per week. In Supabase mode the DB trigger
// (username_change_limit) is the enforcement; this constant drives the client
// UI and the localStorage-only fallback.
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

// One-time migration: pre-accuracy users have no `correct` count. Seed it
// from their old ladder rating so their history isn't wiped, then let real
// results take over from here.
const RATING_SEED = { green: 0.8, yellow: 0.6, red: 0.3, gray: 0.5 };

function migrateUser(user) {
  if (!user?.skills) return user;
  let changed = false;
  const skills = Object.fromEntries(
    Object.entries(user.skills).map(([k, d]) => {
      if (typeof d.correct === 'number') return [k, d];
      changed = true;
      const correct = Math.round(d.attempts * (RATING_SEED[d.rating] ?? 0.5) * 2) / 2;
      return [k, { ...d, correct, rating: deriveRating(correct, d.attempts) }];
    })
  );
  const migrated = changed ? { ...user, skills } : user;
  // Self-heal a stale bucket-based pokerScore (pre-July 18, 2026): the score is
  // trusted on load, so a cached local user would keep the old inflated number
  // until their next session. Re-derive it under the continuous-accuracy formula
  // whenever any skill is rated. Cheap and idempotent. Pass any cached
  // recentHands so the healed value uses the same recency basis the last session
  // saved (legacy users have no stream → lifetime fallback, identical to before).
  const healed = derivePokerScore(migrated.skills, migrated.recentHands);
  if (healed !== null && healed !== migrated.pokerScore) {
    return { ...migrated, pokerScore: healed };
  }
  return migrated;
}

export function loadUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? migrateUser(JSON.parse(raw)) : null;
  } catch { return null; }
}

export function saveUser(user) {
  try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch {}
}

// ── Cache ownership (Supabase mode) ──────────────────────────────────────────
// The localStorage user doubles as (a) a pre-Supabase tester's real history,
// eligible for migration on first sign-in, and (b) a warm cache of a signed-in
// account's profile. Only (a) may ever seed a new profile: migrating (b) copies
// one account's stats into another (two-accounts-one-phone bug, July 2026).
// The owner tag marks the cache as (b); sign-out clears both keys.
const OWNER_KEY = 'cr_user_owner';

/** Mark the cached profile as belonging to a signed-in auth user. */
export function setCacheOwner(uid) {
  try { localStorage.setItem(OWNER_KEY, uid); } catch {}
}

/** The auth uid the cache belongs to, or null for pre-Supabase local data. */
export function cacheOwner() {
  try { return localStorage.getItem(OWNER_KEY); } catch { return null; }
}

/** Drop the cached profile + owner tag (sign-out: cache follows the account). */
export function clearUser() {
  try {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(OWNER_KEY);
  } catch {}
}

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
    pokerScore: null,
    scenarioHistory: {},
    recentHands: [],
    leaderboard: null,
  };
}

// ── Difficulty memory ─────────────────────────────────────────────────────────
// Device preference, not profile data — an intermediate player shouldn't
// re-answer the level question every session. Deliberately survives sign-out.
const LAST_DIFFICULTY_KEY = 'cr_last_difficulty';

export function loadLastDifficulty() {
  try { return localStorage.getItem(LAST_DIFFICULTY_KEY); } catch { return null; }
}

export function saveLastDifficulty(difficulty) {
  try { localStorage.setItem(LAST_DIFFICULTY_KEY, difficulty); } catch {}
}

// ── Table Reads stats ─────────────────────────────────────────────────────────
// Mode-local lifetime tally (founder decision July 18: no writes to the
// 8-skill ratings — observation accuracy ≠ decision accuracy, and keeping the
// mode self-contained keeps a future Pro gate clean). Device-local like the
// difficulty memory; acceptable for beta.
const TABLE_READS_KEY = 'cr_table_reads_stats';

export function loadTableReadsStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(TABLE_READS_KEY));
    return { attempts: raw?.attempts ?? 0, correct: raw?.correct ?? 0 };
  } catch { return { attempts: 0, correct: 0 }; }
}

export function saveTableReadsStats(stats) {
  try { localStorage.setItem(TABLE_READS_KEY, JSON.stringify(stats)); } catch {}
}

// ── Schema derivation ──────────────────────────────────────────────────────────
// Definitions live in constants.js (PLAYER_SCHEMAS) — shared with the
// reference guide so the two can't drift. Index is display-only, from order.
const SCHEMAS = PLAYER_SCHEMAS.map((s, i) => ({ ...s, index: String(i + 1).padStart(2, '0') }));

// Returned when there's enough data but no single leak dominates. Positive
// framing, not a "we couldn't tell" — a genuinely balanced player and a
// random-testing player both correctly land here rather than being forced
// into whichever schema the formula happens to favor.
export const BALANCED_SCHEMA = {
  name: 'The Balanced Player',
  quote: 'No single leak dominates your game',
  index: '—',
  total: '06',
  affected: [],
  balanced: true,
};

// Minimum normalized severity for a schema to count as your leak: its measured
// primary skills must average ABOVE yellow-level — i.e., at least one
// contributing skill genuinely red. Raised 1.0 → 1.25 July 2026 after
// simulation (npm run simulate:schemas) showed the yellow-level bar handed
// leaky players the WRONG schema 15% of the time and balanced players a false
// one 39% of the time at 10 sessions; the red requirement cuts those to 5%/27%.
// Cost: yellow-only mild leaks read as Balanced (still visible in the skill
// ledger as "Work On"). Revisit against real distributions at v2 calibration.
const SCHEMA_MIN_SEVERITY = 1.25;

export function deriveSchema(skills, sessionsCompleted) {
  if (sessionsCompleted < 5) return null;  // locked: not enough data to diagnose

  let best = null;
  let bestScore = 0;
  let tied = false;

  for (const s of SCHEMAS) {
    let raw = 0;
    let measured = 0;
    for (const sk of s.primary) {
      const d = skills[sk];
      if (!d || d.attempts < 3) continue;
      measured++;
      if (d.rating === 'red')    raw += 2;
      if (d.rating === 'yellow') raw += 1;
    }
    if (measured === 0) continue;
    // #1 Normalize by skills actually measured so multi-skill schemas (Conflict
    // Avoider, The Gambler) aren't mechanically favored over single-skill ones.
    const score = raw / measured;
    if (score > bestScore + 1e-9) { bestScore = score; best = s; tied = false; }
    else if (best && Math.abs(score - bestScore) < 1e-9) { tied = true; }
  }

  // #2 No dominant, unambiguous leak → Balanced (kills the array-order tiebreak
  // that always crowned index 01). Requires a clear winner above the severity bar.
  if (!best || bestScore < SCHEMA_MIN_SEVERITY || tied) return BALANCED_SCHEMA;

  const affected = best.primary
    .filter(sk => skills[sk] && (skills[sk].rating === 'red' || skills[sk].rating === 'yellow'))
    .map(sk => ({ skill: SKILL_NAMES[sk], level: skills[sk].rating }));

  return { name: best.name, quote: best.quote, index: best.index, total: '06', affected };
}

// Poker IQ — RECENCY-WEIGHTED as of July 18, 2026 (PERSONA_PLAYTEST_FINDINGS.md
// F3). The July-18-morning fix made this continuous true accuracy (a running
// correct/attempts per rated skill), which killed the 0/5 → "69 → 69" bug but is
// still structurally backward-looking: the persona harness's Improver climbs
// 45% → 85% accuracy across 40 sessions while his LIFETIME IQ reads 68→64→65→69,
// dropping through his fastest improvement and ending where it began. So the IQ
// DISPLAY now scores each rated skill off its most recent hands instead of its
// whole record. IMPORTANT: only the IQ display is recency-weighted — the skill
// ratings/buckets (deriveRating) and schema diagnosis (deriveSchema) stay
// lifetime-based on purpose; the ledger and schema deliberately measure the
// whole record, and only the headline number should chase current form.
//
// Per rated skill: if it has at least MIN_RECENT_HANDS samples in the stream,
// score = accuracy over its last RECENT_WINDOW hands; otherwise fall back to
// lifetime correct/attempts (a rarely-dealt skill must not oscillate on a
// handful of hands). MIN_RECENT_HANDS is the ACTIVATION floor (how many samples
// before we trust the recent window); RECENT_WINDOW is the SCORING depth. They
// are independent. Called with recentHands missing/empty → behaves EXACTLY like
// the lifetime formula, so legacy users degrade gracefully until their window
// fills.
//
// Tuned via `npm run playtest:personas -- --trials=10`: the window is PER SKILL
// and the dealer serves each skill only ~0.6 hands/session, so even a small hand
// count spans many sessions. Swept 5/6/8/20: WINDOW=20 leaves the Improver's end
// IQ at 72 (barely above the lifetime 69, F3's whole complaint); 5 swings the
// leak personas wildly (per-trial 60-84). 6 and 8 both clear every bar
// (Improver 83 vs 79, bar >=78); 8 wins on FEEL — steady-state volatility drops
// from ~2.1 to ~1.4 mean |dIQ|/session with max single-session jump 8 -> 6, a
// meaningful smoothness gain for a small responsiveness cost. The 8-sample
// activation gate keeps the window from oscillating before enough data exists.
export const RECENT_WINDOW = 8;
const MIN_RECENT_HANDS = 8;
// Rolling recent-hands buffer cap (newest last), ~40 sessions deep — far more
// than RECENT_WINDOW needs, so every rated skill's window can fill.
export const RECENT_HANDS_CAP = 200;

// Same gate as the lifetime formula (rated = 5+ attempts, not gray); null when
// nothing is rated. `correct` can be fractional (partial credit = 0.5); the
// windowed path applies the same RESULT_CREDIT weighting per hand.
export function derivePokerScore(skills, recentHands = []) {
  const rated = Object.entries(skills).filter(([, d]) => d.attempts >= 5 && d.rating !== 'gray');
  if (rated.length === 0) return null;
  const stream = Array.isArray(recentHands) ? recentHands : [];
  const skillScore = (key, d) => {
    // MIN_RECENT_HANDS gates on how many samples the skill HAS (anti-oscillation);
    // RECENT_WINDOW is the scoring depth once activated. These are independent —
    // slicing before the count check would couple them and silently disable
    // windowing whenever WINDOW < MIN.
    const all = stream.filter(h => h.skill === key);
    if (all.length >= MIN_RECENT_HANDS) {
      const recent = all.slice(-RECENT_WINDOW);
      const credit = recent.reduce((s, h) => s + (RESULT_CREDIT[h.result] ?? 0), 0);
      return (credit / recent.length) * 100;
    }
    return (d.correct / d.attempts) * 100;  // lifetime fallback
  };
  return Math.round(rated.reduce((sum, [key, d]) => sum + skillScore(key, d), 0) / rated.length);
}

// Append this session's hands to the rolling recent-hands buffer and trim to the
// cap (newest last). Stored on the user object (JSON, so it persists in the
// localStorage cache automatically); in Supabase mode db.js rebuilds it fresh
// from the session log, same self-healing pattern as scenarioHistory.
export function appendRecentHands(recentHands, hands) {
  const next = [...(recentHands ?? []), ...hands.map(h => ({ skill: h.skill, result: h.result }))];
  return next.length > RECENT_HANDS_CAP ? next.slice(next.length - RECENT_HANDS_CAP) : next;
}

// ── Coach's Read parsing ────────────────────────────────────────────────────
// The Coach's Read is a structured JSON string on the wire and in the DB
// (headline/evidence/watchFor via output_config json_schema, July 18, 2026).
// This turns that string into a render shape: { structured } for a JSON read,
// { legacy } for prose (every pre-restructure read in the DB, plus the server's
// graceful-degradation fallback when the model's JSON fails to validate).
// Returns null for empty/missing input.
export function parseCoachRead(raw) {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === 'object' && !Array.isArray(p) && typeof p.headline === 'string') {
      return {
        structured: {
          headline: p.headline,
          evidence: Array.isArray(p.evidence) ? p.evidence : [],
          watchFor: typeof p.watchFor === 'string' ? p.watchFor : '',
        },
      };
    }
  } catch { /* not JSON — prose */ }
  return { legacy: raw };
}

// ── Streak ────────────────────────────────────────────────────────────────────
// Local time, not UTC — a day rolls over at the player's midnight.
export function toLocalDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Streak mechanics (M1–M3, July 2026 — RESEARCH_LEARNING_SCIENCE.md Piece 3) ─
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
const MILESTONE_NAMES = { 7: 'a full week', 30: 'a full month', 100: 'a hundred days' };
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
  const schema     = deriveSchema(skills, sessionsCompleted);
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

  return { ...user, skills, streak, lastSessionDate, rebuys, sessionsCompleted, schema, pokerScore, coachNote, scenarioHistory, recentHands, bestSessionCorrect };
}
