import { deriveRating, applyHandToSkill, PLAYER_SCHEMAS, SKILL_NAMES } from '../data/constants';

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
  return changed ? { ...user, skills } : user;
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
    sessionsCompleted: 0,
    skills: Object.fromEntries(
      Object.entries(DEFAULT_SKILLS).map(([k, v]) => [k, { ...v }])
    ),
    schema: null,
    coachNote: null,
    pokerScore: null,
    leaderboard: null,
  };
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

function derivePokerScore(skills) {
  const SCORE = { green: 100, yellow: 65, red: 30 };
  const rated = Object.values(skills).filter(d => d.attempts >= 5 && d.rating !== 'gray');
  if (rated.length === 0) return null;
  return Math.round(rated.reduce((sum, d) => sum + (SCORE[d.rating] ?? 0), 0) / rated.length);
}

// ── Streak ────────────────────────────────────────────────────────────────────
// Local time, not UTC — a day rolls over at the player's midnight.
export function toLocalDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function calcStreak(user) {
  const today = toLocalDateString(new Date());
  if (user.lastSessionDate === today) return { streak: user.streak, lastSessionDate: today };
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalDateString(yesterday);
  const newStreak = user.lastSessionDate === yesterdayStr ? user.streak + 1 : 1;
  return { streak: newStreak, lastSessionDate: today };
}

// ── Apply session ─────────────────────────────────────────────────────────────
// `hands` is one entry per hand played: [{ skill, result }] — every hand
// counts toward that skill's accuracy, including duplicates within a session.
export function applySessionResults(user, hands, coachRead) {
  const skills = Object.fromEntries(
    Object.entries(user.skills).map(([k, d]) => [k, { ...d }])
  );
  for (const { skill, result } of hands) {
    if (skills[skill]) skills[skill] = applyHandToSkill(skills[skill], result);
  }

  const { streak, lastSessionDate } = calcStreak(user);
  const sessionsCompleted = user.sessionsCompleted + 1;
  const schema     = deriveSchema(skills, sessionsCompleted);
  const pokerScore = derivePokerScore(skills);

  const weakest = Object.entries(skills)
    .filter(([, d]) => d.rating === 'red' && d.attempts > 0)
    .map(([k]) => SKILL_NAMES[k])[0] ?? null;

  const coachNote = coachRead
    ? { body: coachRead, focus: weakest }
    : user.coachNote;

  return { ...user, skills, streak, lastSessionDate, sessionsCompleted, schema, pokerScore, coachNote };
}
