// localStorage I/O and the on-load migration.
//
// MOD-001 (Wave 3): split out of userStorage.js. This is the ONLY module that
// touches localStorage for the user record; everything else is pure.
import { deriveRating } from '../data/constants';
import { derivePokerScore } from './iq';

const USER_KEY = 'cr_user';

// Editable usernames: one change per week. In Supabase mode the DB trigger
// (username_change_limit) is the enforcement; this constant drives the client
// UI and the localStorage-only fallback.

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
  // Backward-compatible: legacy objects (attempts/correct only) load fine; the
  // dealing-memory fields (correctIds, lastDeck) default to empty arrays.
  try {
    const raw = JSON.parse(localStorage.getItem(TABLE_READS_KEY));
    return {
      attempts: raw?.attempts ?? 0,
      correct: raw?.correct ?? 0,
      seenIds: Array.isArray(raw?.seenIds) ? raw.seenIds : [],
      correctIds: Array.isArray(raw?.correctIds) ? raw.correctIds : [],
      lastDeck: Array.isArray(raw?.lastDeck) ? raw.lastDeck : [],
    };
  } catch { return { attempts: 0, correct: 0, seenIds: [], correctIds: [], lastDeck: [] }; }
}

export function saveTableReadsStats(stats) {
  try { localStorage.setItem(TABLE_READS_KEY, JSON.stringify(stats)); } catch {}
}
