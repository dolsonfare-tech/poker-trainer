import { deriveRating, applyHandToSkill, RESULT_CREDIT, PLAYER_SCHEMAS, SKILL_NAMES } from '../data/constants';
import { applyHandsToHistory } from './spacedrep';
import SCENARIOS from '../data/scenarios';

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
    directionTally: { ...EMPTY_DIRECTION_TALLY },
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

// ── Direction-of-error classification (schema v2, July 18, 2026) ────────────────
// The three DIRECTION schemas (Conflict Avoider / Gambler / Overaggressor) are
// diagnosed from HOW a player errs on the fold(0) < call(1) < raise(2) axis, not
// from per-skill accuracy — because those three differ by DIRECTION, not
// magnitude (a passive player and an aggressive one can post identical accuracy
// while making opposite mistakes; accuracy alone even manufactures the wrong
// label — see the v2 note in constants.js). Only mistakes carry direction; a
// correct answer and a timeout carry none.
const CLS_ORDINAL = { fold: 0, call: 1, raise: 2 };

// Classify one non-correct decision into a direction cell, or null when it
// carries no directional signal (same-cls mistake, or an unknown cls).
//   under: chose more passive than correct       → The Conflict Avoider
//   loose: chose CALL when FOLD was correct       → The Gambler
//   over:  chose RAISE when call/fold was correct → The Overaggressor
// 'loose' is carved out of the +1 (too-loose) delta BEFORE 'over': a
// call-when-fold is Gambler evidence, not Overaggressor evidence.
export function classifyDirection(chosenCls, correctCls) {
  const c = CLS_ORDINAL[chosenCls];
  const k = CLS_ORDINAL[correctCls];
  if (c == null || k == null) return null;   // unknown/missing cls — skip defensively
  if (c < k) return 'under';                 // fold-when-call, fold-when-raise, call-when-raise
  if (c === 1 && k === 0) return 'loose';    // call-when-fold
  if (c === 2 && k < 2) return 'over';       // raise-when-call, raise-when-fold
  return null;                               // c === k (same-cls mistake, e.g. wrong bet size)
}

// id → scenario, built once. Scenario ids are heterogeneous (legacy scenarios
// are NUMERIC, batch scenarios are STRINGS); key on the raw id so the hands
// payload's scenarioId (stored verbatim as s.id) matches without normalization.
const SCENARIO_BY_ID = new Map(SCENARIOS.map((s) => [s.id, s]));
const clsOfVal = (scenario, val) => scenario.options.find((o) => o.val === val)?.cls;

// The direction cell for one played hand, or null when it carries no signal:
// a correct result, a timeout (choiceVal null — the freeze signal, never
// directional), an unknown scenario id, or an unresolvable/same cls.
export function directionOfHand(hand) {
  if (!hand || hand.result === 'correct') return null;
  if (hand.choiceVal == null) return null;
  const scenario = SCENARIO_BY_ID.get(hand.scenarioId);
  if (!scenario) return null;
  return classifyDirection(clsOfVal(scenario, hand.choiceVal), clsOfVal(scenario, scenario.correct));
}

// Neutral direction baseline: the share of each cell a UNIFORM-RANDOM mistaker
// would produce on the pool. This is not flat — 'under' absorbs 3 of the 6
// ordered mispairs (fold-when-call, fold-when-raise, call-when-raise) while
// 'loose' captures only 1 (call-when-fold), so even a perfectly balanced player
// sits near under≈0.53 / over≈0.33 / loose≈0.14. Scoring raw shares against a
// flat threshold would therefore brand any uniform-mistaking player — including
// a strong one — a Conflict Avoider (an 85%-flat persona measured under≈0.63,
// ABOVE a true Gambler's loose≈0.62 — a flat threshold literally cannot separate
// them). Direction severity is instead each cell's EXCESS over its own neutral
// baseline. Computed once from every scenario's wrong options, so it
// self-maintains as content grows and stays correct per the live pool mix.
function computeDirectionBaseline() {
  const cell = { under: 0, over: 0, loose: 0 };
  for (const s of SCENARIOS) {
    const correctCls = clsOfVal(s, s.correct);
    for (const o of s.options) {
      if (o.val === s.correct) continue;
      const d = classifyDirection(o.cls, correctCls);
      if (d) cell[d] += 1;
    }
  }
  const total = cell.under + cell.over + cell.loose || 1;
  return { under: cell.under / total, over: cell.over / total, loose: cell.loose / total };
}
const DIRECTION_BASELINE = computeDirectionBaseline();

// A fresh direction tally: weighted counts per cell plus their sum (`evidence`).
export const EMPTY_DIRECTION_TALLY = { under: 0, over: 0, loose: 0, evidence: 0, hands: 0 };

// Mistake weight into the tally: an incorrect answer is full evidence, a partial
// (acceptable-but-not-optimal) is half — mirrors RESULT_CREDIT's partial=0.5
// (founder call #2). A correct answer contributes nothing (directionOfHand
// already returns null for it).
const DIRECTION_WEIGHT = { incorrect: 1.0, partial: 0.5 };

// Fold a session's hands into a direction tally (LIFETIME — the schema
// deliberately measures the whole record, like the skill ledger). Pure; returns
// a new tally. Hands with no directional signal (timeouts, correct, unknown) are
// skipped, so rows lacking choiceVal degrade gracefully.
export function addHandsToDirectionTally(tally, hands) {
  const next = {
    under: tally?.under ?? 0,
    over: tally?.over ?? 0,
    loose: tally?.loose ?? 0,
    evidence: tally?.evidence ?? 0,
    hands: tally?.hands ?? 0,
  };
  for (const hand of hands ?? []) {
    next.hands += 1;  // every played hand, correct or not — the materiality denominator
    const cell = directionOfHand(hand);
    if (!cell) continue;
    const w = DIRECTION_WEIGHT[hand.result] ?? 0;
    if (w === 0) continue;
    next[cell] += w;
    next.evidence += w;
  }
  return next;
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

// ── Schema v2 direction knobs (calibrated July 18, 2026) ────────────────────────
// A DIRECTION schema fires only when the tally holds enough evidence, one cell is
// a plurality (DIRECTION_DOMINANCE pre-filter), and that cell's EXCESS over its
// neutral baseline (see DIRECTION_BASELINE) is large. Severity =
// DIRECTION_SEV_SCALE × excess (capped at 2) so it competes on the same 0–2
// scale as skill scores against SCHEMA_MIN_SEVERITY. Using excess-over-baseline
// rather than raw share is what lets one threshold separate a true Gambler
// (loose 0.62, baseline 0.14 → excess 0.56) from a strong uniform player
// (under 0.63, baseline 0.53 → excess 0.22) even though their raw shares are
// nearly equal.
//
// Calibrated against `npm run playtest:personas -- --trials=10/20` (8 directional
// personas × 40 sessions, real loop). Per-persona mean cell shares (trials=8):
//   conflict-avoider under 0.91 · overaggressor over 0.77 · gambler loose 0.62
//   steady-strong under 0.63 · improver under 0.49 · villain-blind under≈0.50.
// Excess maps those to severities ~2.0 / 1.64 / 1.39 for the true directional
// leaks and ~0.5 / 0 / ~0.1 for the neutral players — cleanly across the 1.25
// bar. Sweep:
//   • DIRECTION_SEV_SCALE 2.0 left the Gambler (loose excess 0.56 → 1.11) below
//     the bar; 2.5 lifts it to 1.39 while keeping steady-strong (0.54) and the
//     villain-blind personas (<0.3) well under it. 3.0 started catching
//     steady-strong's high-variance trials.
//   • MIN_DIRECTION_EVIDENCE 6 keeps a 2–3-mistake early streak from naming a
//     schema; strong players clear it (~24 lifetime by s40) yet still score far
//     below the bar via low excess, so the floor guards early sessions, not
//     steady state.
//   • DIRECTION_DOMINANCE 0.4 is a cheap plurality sanity floor; the excess
//     severity gate is the binding constraint (a 0.4 under-share is below its
//     0.53 baseline → excess 0 anyway).
//   • TRANSIENT-MISLABEL FIX (post-calibration adversarial sweep, July 18):
//     final-session bars hid that cumulative shares are NOISY at low evidence —
//     a steady 85% player wore "The Conflict Avoider" for sessions ~9-20 in
//     4/10 trials (his rare misses genuinely skew passive, and at 8-15 weighted
//     misses the share random-walks above the bar before converging). Two
//     guards: the floor rose 6 → 10, and severity ramps linearly with evidence
//     up to DIRECTION_FULL_EVIDENCE — early spikes are discounted exactly when
//     samples are small, true leaks (share ≥ 0.62-0.91) still clear the bar by
//     ~s10-14 and hold. Verified: zero wrong direction labels in ANY session of
//     any trial across all personas (the sweep in scripts/ isn't a gate — re-run
//     the playtest + the session-level sweep after touching these knobs).
//   • MATERIALITY GATE (second adversarial pass, July 18): even with the ramp,
//     ONE steady-strong trial wore "The Conflict Avoider" from s19 to s40 —
//     a strong player accrues miss-evidence so slowly (~0.5/session) that early
//     random skew freezes into the lifetime tally. The tell: direction schemas
//     describe LEAKY players, and his weighted-miss rate was only ~0.11 of hands
//     played. Direction schemas now also require evidence/hands ≥
//     DIRECTION_MISS_MATERIALITY — true directional leaks run ~0.22-0.30, strong
//     players ~0.08-0.12; a mild lean below the floor reads Balanced, which is
//     the honest answer (severity philosophy, July 5).
const MIN_DIRECTION_EVIDENCE = 10;
const DIRECTION_FULL_EVIDENCE = 20;
const DIRECTION_MISS_MATERIALITY = 0.15;
const DIRECTION_DOMINANCE = 0.4;
const DIRECTION_SEV_SCALE = 2.5;

// v2 hybrid: DIRECTION schemas score from the direction tally, SKILL schemas
// from absolute per-skill weakness; the single highest severity across all six
// wins (below the bar or tied → Balanced). `directionTally` is optional — when
// missing/undefined the direction schemas simply can't qualify, so skill
// schemas + Balanced still work (legacy callers, pre-v2 users with no tally).
export function deriveSchema(skills, sessionsCompleted, directionTally) {
  if (sessionsCompleted < 5) return null;  // locked: not enough data to diagnose

  let best = null;
  let bestScore = 0;
  let tied = false;
  const consider = (schema, score) => {
    if (score > bestScore + 1e-9) { bestScore = score; best = schema; tied = false; }
    else if (best && Math.abs(score - bestScore) < 1e-9) { tied = true; }
  };

  for (const s of SCHEMAS) {
    if (s.direction) {
      // Direction schema — scored from the direction-of-error tally, relative to
      // the neutral baseline so a uniform-mistaking player can't trip it.
      const ev = directionTally?.evidence ?? 0;
      if (ev < MIN_DIRECTION_EVIDENCE) continue;
      const hands = directionTally?.hands ?? 0;
      if (hands > 0 && ev / hands < DIRECTION_MISS_MATERIALITY) continue;
      const share = (directionTally[s.direction] ?? 0) / ev;
      if (share < DIRECTION_DOMINANCE) continue;
      const base = DIRECTION_BASELINE[s.direction];
      const excess = base >= 1 ? 0 : Math.max(0, (share - base) / (1 - base));
      // Confidence ramp: full severity only once the tally is deep enough to
      // trust the share (see transient-mislabel fix above).
      const confidence = Math.min(1, ev / DIRECTION_FULL_EVIDENCE);
      consider(s, Math.min(2, DIRECTION_SEV_SCALE * excess * confidence));
    } else {
      // Skill schema — absolute-weakness scoring, UNCHANGED from v1.
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
      // Normalize by skills actually measured so multi-skill schemas aren't
      // mechanically favored over single-skill ones.
      consider(s, raw / measured);
    }
  }

  // No dominant, unambiguous leak → Balanced (kills the array-order tiebreak
  // that always crowned index 01). Requires a clear winner above the severity bar.
  if (!best || bestScore < SCHEMA_MIN_SEVERITY || tied) return BALANCED_SCHEMA;

  // Direction schemas display no per-skill "affected" chips (the chips were
  // removed from the card in July 2026); the return shape stays identical.
  if (best.direction) {
    return { name: best.name, quote: best.quote, index: best.index, total: '06', affected: [] };
  }
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

  return { ...user, skills, streak, lastSessionDate, rebuys, sessionsCompleted, schema, pokerScore, coachNote, scenarioHistory, recentHands, directionTally, bestSessionCorrect };
}
