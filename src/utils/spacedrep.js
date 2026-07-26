import { CONTRAST_PAIRS } from '../data/scenarios';
import { localDateFrom } from './dates';

// Spaced repetition v2 — the session builder.
//
// Replaces pure-random dealing with three ordered priorities:
//   1. Resurface at most ONE missed hand that is DUE on the graduation ladder
//      (the comeback loop) — tagged { replay: true } so the UI can label it
//      honestly instead of hoping the player doesn't notice the repeat.
//   2. Unseen scenarios, with two slots weighted toward the player's
//      weakest rated skills (red first, then yellow) — this is what makes
//      the dashboard's "Focus this session" line actually come true.
//   3. Least-recently-seen fallback when the unseen pool runs dry, so small
//      pools (per-difficulty, or a jest-mocked pool of one) always deal.
//
// Scenario history is DERIVED state: in Supabase mode it's rebuilt from the
// append-only `sessions` rows on profile load (hands store scenarioId +
// result + decisionMs), locally it rides the cached user object. No schema
// change — the ladder rung/streak and the calendar dates are folded out of
// the same rows historyFromSessions already replays.
//
// v2 upgrades (July 2026, RESEARCH_LEARNING_SCIENCE.md Piece 1 R1–R3 / Piece 2 F2):
//   R1 — graduation ladder: a miss is NOT cleared by one correct replay. It
//        needs GRADUATION_TARGET spaced correct retrievals, resurfacing on an
//        expanding LADDER_SESSIONS interval; a new miss resets it to rung 0.
//        Successive-relearning evidence: one-and-done corrections are fragile.
//   R2 — binge-massing fix: the cooldown floor is max(N sessions, 1 calendar
//        day), so chained same-day sessions ("Deal Next Session →") can't
//        resurface a same-day miss (session-count-only cooldowns are massed
//        practice in disguise). Wall clock: sessions.created_at / today.
//   F2 — a fast + wrong answer ≈ a high-confidence error (the most correctable
//        and most relapse-prone kind): confident misses jump the resurface
//        queue, and the flag rides the replay object for the coach payload.

// Resurface interval (in fully-completed sessions) by ladder rung. A rung is
// the count of spaced correct retrievals since the last miss: rung 0 = just
// missed. Expanding to mirror the ~1/3/8-day successive-relearning rhythm for
// a daily player. R3: a fixed ladder is within noise of SM-2/FSRS at this pool
// size and infinitely more debuggable — do NOT add per-item ease.
export const LADDER_SESSIONS = [2, 5, 13];
// Spaced corrects needed to clear a miss (graduate off the ladder) — GRADED by
// how many times the hand has been missed (F1 fix, July 18, 2026):
//   - a hand missed only ONCE is a cheap lapse → GRADUATION_TARGET_FIRST (2);
//   - a REPEAT miss is the hypercorrection-relapse case the 3-rung ladder
//     exists for → GRADUATION_TARGET_REPEAT (3).
// Both stay inside R1's 2–3-retrieval evidence range (RESEARCH_LEARNING_SCIENCE
// Piece 1). The graded target is what lets a leaky player's queue actually
// drain: at realistic accuracy 3-spaced-corrects-with-miss-resets is an ~8-hand
// consecutive-success chain per graduation; halving it for first-timers roughly
// doubles their drain rate.
export const GRADUATION_TARGET_FIRST = 2;
export const GRADUATION_TARGET_REPEAT = 3;
// Back-compat: the ladder's rung count and the conservative (repeat) target.
// Kept exported for call sites/tests that reference the old single knob.
export const GRADUATION_TARGET = GRADUATION_TARGET_REPEAT;
// Graduation target for a hand with a known lifetime miss count. A remediating
// entry with an UNDEFINED miss count (legacy / pre-graded history) is treated
// as a repeat offender (3) — the conservative pre-graded default.
const graduationTargetFor = (misses) =>
  misses == null ? GRADUATION_TARGET_REPEAT
    : misses <= 1 ? GRADUATION_TARGET_FIRST
      : GRADUATION_TARGET_REPEAT;
// Kept for back-compat (tests + call sites) — the bottom rung's interval.
export const RESURFACE_COOLDOWN_SESSIONS = LADDER_SESSIONS[0];
// Fast + wrong under this threshold reads as a confident (high-conviction)
// miss. 15s of a 60s clock — a snap decision, not a considered one. A timeout
// is slow-wrong (froze), the opposite, so it never counts (decisionMs null).
export const CONFIDENT_MISS_MS = 15000;

// Replay slots are DYNAMIC (F1 fix): normally 1 redemption hand per session
// (not a re-exam), but SURGE to 2 while the pool-scoped remediation queue is
// backed up past SURGE_QUEUE_THRESHOLD — one slot can't drain a leaky player's
// queue when ~1.9 new misses arrive per session. Both replays go through the
// same eligibility path (due rung interval + calendar-day floor + confident-
// miss ordering) and both carry the honest replay chip; two still leaves 3
// slots for weak-skill targeting + R4 pairing.
export const SURGE_QUEUE_THRESHOLD = 8;
const WEAK_SLOT_TARGET = 2;                   // slots aimed at red/yellow skills
const MAX_PER_SKILL = 2;                      // soft cap — a targeted session, not 5 of one drill
// R4 contrast-pair-aware dealing (RESEARCH_LEARNING_SCIENCE.md Piece 1 R4): the
// authored CONTRAST_PAIRS are the product's interleaving mechanism — juxtaposing
// a pair in the SAME session (adjacent, so the contrast is felt) is what makes it
// teach. When a weak-skill slot seats a scenario that has an eligible same-pool
// partner, we also seat the partner (spending a general slot). One pair per
// session — a variety guard, tunable here.
const MAX_CONTRAST_PAIRS_PER_SESSION = 1;
// Preflop-street cap (founder, July 8): weak-skill weighting on preflop/
// position leaks was filling half a session with boardless preflop spots —
// samey and frustrating. 2 of 5 max; postflop streets vary enough to stay
// uncapped. Soft: yields when the pool leaves no choice.
const preflopCap = (length) => Math.max(1, Math.floor(length * 0.4));
const isPreflop = (s) => !s.board;

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// id → [partner ids] from the flat list of 2-item contrast groups. A scenario
// may sit in several groups (so it can have several partners); ids match
// scenario `id` exactly (legacy = numeric, batch = string — never normalized).
function buildPartnerIndex(pairs) {
  const idx = new Map();
  for (const group of pairs ?? []) {
    if (!Array.isArray(group) || group.length !== 2) continue;
    const [a, b] = group;
    if (!idx.has(a)) idx.set(a, []);
    if (!idx.has(b)) idx.set(b, []);
    if (!idx.get(a).includes(b)) idx.get(a).push(b);
    if (!idx.get(b).includes(a)) idx.get(b).push(a);
  }
  return idx;
}

// Place the seated contrast pair adjacent in the dealt order (juxtaposition is
// the mechanism). Moves the second member to sit right after the first,
// preserving every other hand's relative order.
function enforceAdjacency(list, [idA, idB]) {
  const ib = list.findIndex((s) => s.id === idB);
  const ia = list.findIndex((s) => s.id === idA);
  if (ia === -1 || ib === -1 || Math.abs(ia - ib) === 1) return list;
  const out = [...list];
  const [moved] = out.splice(ib, 1);
  const anchor = out.findIndex((s) => s.id === idA); // recompute after the splice
  out.splice(anchor + 1, 0, moved);
  return out;
}

// ── Graduation ladder (R1/R2) ──────────────────────────────────────────────

const ladderInterval = (rung) => LADDER_SESSIONS[Math.min(rung, LADDER_SESSIONS.length - 1)];

// A scenario is "remediating" while it's working through the ladder (missed,
// not yet cleared by GRADUATION_TARGET spaced corrects). New shape carries an
// explicit flag; pre-v2 / test-fixture entries fall back to "last result was a
// miss" so old history still resurfaces once.
const isRemediating = (h) => (h ? (h.remediating ?? h.lastResult === 'incorrect') : false);

// Due for a comeback? Both the rung's session interval AND the 1-calendar-day
// floor (R2) must have elapsed. Degrades to session-count-only when there are
// no dates to compare (legacy history, or unit tests that pass no clock).
function dueForResurface(h, sessionsCompleted, currentDate) {
  if (!isRemediating(h)) return false;
  if (sessionsCompleted - h.lastSeenAt < ladderInterval(h.rung ?? 0)) return false;
  if (currentDate && h.lastSeenDate && currentDate === h.lastSeenDate) return false;
  return true;
}

/**
 * Deal a session from `pool` (already filtered to the chosen difficulty).
 *
 * history: { [scenarioId]: { seen, lastResult, lastSeenAt, lastSeenDate,
 *          remediating, rung, lastMissConfident } } — lastSeenAt is the 1-based
 *          session number it last appeared in; the ladder fields drive R1/R2
 *          resurfacing (see applyHandsToHistory for how they're derived).
 * skills:  the user's skills map (ratings drive the weak-slot weighting).
 * sessionsCompleted: total sessions played — the cooldown clock.
 * currentDate: today (YYYY-MM-DD) — the R2 calendar-day floor. null → the day
 *          floor is skipped (session-count-only, for legacy/no-clock callers).
 *
 * Resurfaced misses are shallow copies tagged { replay: true }; everything
 * else is the pool's own object, untouched.
 */
export function buildSession(pool, { history = {}, skills = {}, sessionsCompleted = 0, length = 5, currentDate = null, contrastPairs = CONTRAST_PAIRS } = {}) {
  const picked = [];
  const pickedIds = new Set();
  const skillCount = {};
  const preCap = preflopCap(length);
  let preCount = 0;
  const take = (s, replay = false, h = null) => {
    // Replays carry the confident-miss flag so the summary/coach payload can
    // treat a fast+wrong comeback differently (F2).
    picked.push(replay ? { ...s, replay: true, confidentMiss: !!h?.lastMissConfident } : s);
    pickedIds.add(s.id);
    skillCount[s.skill] = (skillCount[s.skill] ?? 0) + 1;
    if (isPreflop(s)) preCount++;
  };
  const preBlocked = (s) => isPreflop(s) && preCount >= preCap;

  // R4 pairing state. `seatedPair` records the one pair we co-deal so the final
  // order can put them adjacent; it's spent from a general slot, never from the
  // resurfaced-miss slot (partners in pickedIds are already ineligible).
  const partnersOf = buildPartnerIndex(contrastPairs);
  let pairsSeated = 0;
  let seatedPair = null;
  const canSeat = (s) =>
    !pickedIds.has(s.id) && (skillCount[s.skill] ?? 0) < MAX_PER_SKILL && !preBlocked(s);
  // After seating a weak-skill pick `x`, seat one eligible contrast partner (if
  // any) into a general slot. Prefers an unseen partner; a seen one still
  // teaches the contrast (novelty is secondary). Respects the length + caps.
  const seatContrastPartner = (x) => {
    if (pairsSeated >= MAX_CONTRAST_PAIRS_PER_SESSION || picked.length >= length) return;
    const partnerIds = partnersOf.get(x.id);
    if (!partnerIds) return;
    const candidates = shuffle(
      partnerIds.map((pid) => pool.find((p) => p.id === pid)).filter((y) => y && canSeat(y))
    );
    if (!candidates.length) return;
    const y = candidates.find((c) => !history[c.id]) ?? candidates[0];
    take(y);
    pairsSeated++;
    seatedPair = [x.id, y.id];
  };

  // 1 — comeback hand(s): scenarios still on the graduation ladder whose rung
  // interval AND the 1-day floor have both elapsed. Confident misses (fast +
  // wrong) first, then oldest. Shuffle before the stable sort so same-age
  // misses don't resurface in authoring order. Replay count SURGES to 2 when the
  // POOL-SCOPED remediation queue is deeper than the threshold — a deep beginner
  // queue must not surge an intermediate session, so the depth counts only
  // remediating hands whose id is in THIS pool.
  const remediationDepth = pool.filter((s) => isRemediating(history[s.id])).length;
  const maxReplays = remediationDepth > SURGE_QUEUE_THRESHOLD ? 2 : 1;
  const misses = shuffle(
    pool.filter((s) => dueForResurface(history[s.id], sessionsCompleted, currentDate))
  ).sort((a, b) => {
    const ha = history[a.id], hb = history[b.id];
    const conf = (hb.lastMissConfident ? 1 : 0) - (ha.lastMissConfident ? 1 : 0);
    return conf !== 0 ? conf : ha.lastSeenAt - hb.lastSeenAt;
  });
  // Walk the due list rather than a pre-sliced window: F4's replay pairing can
  // seat a due miss's partner as a FRESH deal, and if both members of a pair
  // are due (perfectly possible post-miss), the partner must not then be dealt
  // again as the second surge replay — skip already-seated hands and let the
  // next eligible miss take the slot. (This loop historically ran into an empty
  // session and needed no guard; F4 broke that assumption — caught as duplicate
  // ids by the persona harness.)
  let replaysSeated = 0;
  for (const s of misses) {
    if (replaysSeated >= maxReplays || picked.length >= length) break;
    if (pickedIds.has(s.id)) continue;
    take(s, true, history[s.id]);
    replaysSeated++;
    // F4: re-encountering a missed hand NEXT TO its contrast partner is the
    // highest-value juxtaposition — seat the partner (fresh deal, no replay
    // tag) when one is eligible. Shares the 1-pair-per-session cap.
    seatContrastPartner(s);
  }

  // 2 — unseen, weakest skills first (red before yellow), capped per skill
  // and per the preflop-street cap
  const unseen = shuffle(pool.filter((s) => !history[s.id] && !pickedIds.has(s.id)));
  let weakPicked = 0;
  // F4: within each tier, PREFER pair members (pass 1) over the rest (pass 2) —
  // pairing only ever triggers off a weak-slot or replay seat, and leaving it
  // to shuffle luck fired pairs in only ~1-3 of 40 sessions. Preference, not a
  // guarantee: all caps and the 1-pair session cap still apply, and pass 2
  // keeps any pass-1 skip fully eligible.
  for (const tier of ['red', 'yellow']) {
    for (const preferPaired of [true, false]) {
      for (const s of unseen) {
        if (weakPicked >= WEAK_SLOT_TARGET || picked.length >= length) break;
        if (preferPaired && !partnersOf.has(s.id)) continue;
        if (pickedIds.has(s.id)) continue;
        if (skills[s.skill]?.rating !== tier) continue;
        if ((skillCount[s.skill] ?? 0) >= MAX_PER_SKILL) continue;
        if (preBlocked(s)) continue;
        take(s);
        weakPicked++;
        // R4: juxtapose this weak-skill hand with its contrast partner.
        seatContrastPartner(s);
      }
    }
  }

  // 2b — fill from the remaining unseen: first respecting the caps
  // (skill + preflop variety), then anything left if the pool is too thin
  // to be picky
  for (const respectCaps of [true, false]) {
    for (const s of unseen) {
      if (picked.length >= length) break;
      if (pickedIds.has(s.id)) continue;
      if (respectCaps && ((skillCount[s.skill] ?? 0) >= MAX_PER_SKILL || preBlocked(s))) continue;
      take(s);
    }
  }

  // 3 — pool exhausted: re-deal seen scenarios, least recently seen first,
  // preferring non-capped streets before giving the cap up
  const seen = shuffle(pool.filter((s) => history[s.id] && !pickedIds.has(s.id)))
    .sort((a, b) => history[a.id].lastSeenAt - history[b.id].lastSeenAt);
  for (const respectCaps of [true, false]) {
    for (const s of seen) {
      if (picked.length >= length) break;
      if (pickedIds.has(s.id)) continue;
      if (respectCaps && preBlocked(s)) continue;
      take(s);
    }
  }

  const dealt = shuffle(picked);
  return seatedPair ? enforceAdjacency(dealt, seatedPair) : dealt;
}

const isConfidentMiss = (decisionMs) =>
  typeof decisionMs === 'number' && decisionMs > 0 && decisionMs <= CONFIDENT_MISS_MS;

// localDateFrom imported from dates.js at the top of this file (CA-028).
// Previously kept a local copy here to avoid the userStorage→spacedrep
// circular import; dates.js has no such dependency.

/**
 * Fold one session's hands into a history map (pure — returns a new map).
 * `hands` entries need { scenarioId, result } and may carry `decisionMs`;
 * `sessionNo` is the 1-based number of the session they were played in and
 * `sessionDate` its calendar day (YYYY-MM-DD, null in legacy/no-clock paths).
 *
 * The per-scenario ladder state (remediating / rung / lastMissConfident) is
 * derived here so it rebuilds identically from live play and from replayed
 * `sessions` rows:
 *   - a miss (re)enters the ladder at rung 0, bumps the lifetime `misses`
 *     count, and records whether it was a confident (fast) miss;
 *   - a SPACED correct (a different calendar day from the last sighting) is one
 *     retrieval up the ladder — the GRADED target (2 for a once-missed hand, 3
 *     for a repeat offender) clears it. A same-day correct is massed practice
 *     and doesn't advance (R2);
 *   - a partial is neutral (neither advances nor resets).
 *
 * `misses` is lifetime and derived — historyFromSessions rebuilds it by replay,
 * so there's no schema change. It stays UNDEFINED for legacy/pre-graded entries
 * until the next real miss re-establishes it (the graduation check treats
 * undefined as a repeat offender — the conservative default).
 */
export function applyHandsToHistory(history, hands, sessionNo, sessionDate = null) {
  const next = { ...history };
  for (const h of hands ?? []) {
    if (!h?.scenarioId) continue;
    const prev = next[h.scenarioId];
    let remediating = isRemediating(prev);
    let rung = prev?.rung ?? 0;
    let lastMissConfident = prev?.lastMissConfident ?? false;
    let misses = prev?.misses; // undefined for legacy / never-missed entries

    if (h.result === 'incorrect') {
      remediating = true;
      rung = 0;
      lastMissConfident = isConfidentMiss(h.decisionMs);
      misses = (misses ?? 0) + 1;
    } else if (h.result === 'correct' && remediating) {
      // Missing dates on either side (legacy rows) → treat as spaced, since we
      // can't prove massing.
      const spaced = !sessionDate || !prev?.lastSeenDate || sessionDate !== prev.lastSeenDate;
      // `misses` here is still the incoming (pre-hand) lifetime count, so an
      // entry that entered remediation with no `misses` field grades at 3.
      if (spaced && ++rung >= graduationTargetFor(misses)) {
        remediating = false;
        rung = 0;
        lastMissConfident = false;
      }
    }

    next[h.scenarioId] = {
      seen: (prev?.seen ?? 0) + 1,
      lastResult: h.result,
      lastSeenAt: sessionNo,
      lastSeenDate: sessionDate ?? prev?.lastSeenDate ?? null,
      remediating,
      rung,
      lastMissConfident,
      misses,
    };
  }
  return next;
}

/**
 * Rebuild the full history map from chronologically ordered `sessions` rows.
 * Rows can be fewer than sessionsCompleted (pre-Supabase migrated sessions
 * have no rows) — the base offset keeps lastSeenAt on the same scale as the
 * live sessionsCompleted counter so cooldown math stays honest. Each row's
 * `created_at` supplies the calendar day for the R2 day floor.
 */
export function historyFromSessions(rows, sessionsCompleted = 0) {
  const list = rows ?? [];
  const base = Math.max(0, sessionsCompleted - list.length);
  let history = {};
  list.forEach((row, i) => {
    history = applyHandsToHistory(history, row.hands, base + i + 1, localDateFrom(row.created_at));
  });
  return history;
}
