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
// Spaced corrects needed to clear a miss (graduate off the ladder).
export const GRADUATION_TARGET = LADDER_SESSIONS.length;
// Kept for back-compat (tests + call sites) — the bottom rung's interval.
export const RESURFACE_COOLDOWN_SESSIONS = LADDER_SESSIONS[0];
// Fast + wrong under this threshold reads as a confident (high-conviction)
// miss. 15s of a 60s clock — a snap decision, not a considered one. A timeout
// is slow-wrong (froze), the opposite, so it never counts (decisionMs null).
export const CONFIDENT_MISS_MS = 15000;

const MAX_REPLAYS_PER_SESSION = 1;            // one redemption hand per session, not a re-exam
const WEAK_SLOT_TARGET = 2;                   // slots aimed at red/yellow skills
const MAX_PER_SKILL = 2;                      // soft cap — a targeted session, not 5 of one drill
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
export function buildSession(pool, { history = {}, skills = {}, sessionsCompleted = 0, length = 5, currentDate = null } = {}) {
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

  // 1 — comeback hand: a scenario still on the graduation ladder whose rung
  // interval AND the 1-day floor have both elapsed. Confident misses (fast +
  // wrong) first, then oldest. Shuffle before the stable sort so same-age
  // misses don't resurface in authoring order.
  const misses = shuffle(
    pool.filter((s) => dueForResurface(history[s.id], sessionsCompleted, currentDate))
  ).sort((a, b) => {
    const ha = history[a.id], hb = history[b.id];
    const conf = (hb.lastMissConfident ? 1 : 0) - (ha.lastMissConfident ? 1 : 0);
    return conf !== 0 ? conf : ha.lastSeenAt - hb.lastSeenAt;
  });
  for (const s of misses.slice(0, MAX_REPLAYS_PER_SESSION)) {
    if (picked.length < length) take(s, true, history[s.id]);
  }

  // 2 — unseen, weakest skills first (red before yellow), capped per skill
  // and per the preflop-street cap
  const unseen = shuffle(pool.filter((s) => !history[s.id] && !pickedIds.has(s.id)));
  let weakPicked = 0;
  for (const tier of ['red', 'yellow']) {
    for (const s of unseen) {
      if (weakPicked >= WEAK_SLOT_TARGET || picked.length >= length) break;
      if (pickedIds.has(s.id)) continue;
      if (skills[s.skill]?.rating !== tier) continue;
      if ((skillCount[s.skill] ?? 0) >= MAX_PER_SKILL) continue;
      if (preBlocked(s)) continue;
      take(s);
      weakPicked++;
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

  return shuffle(picked);
}

const isConfidentMiss = (decisionMs) =>
  typeof decisionMs === 'number' && decisionMs > 0 && decisionMs <= CONFIDENT_MISS_MS;

// ISO timestamp → local YYYY-MM-DD (mirrors userStorage.toLocalDateString, but
// kept local to avoid a circular import). A day rolls over at the player's
// midnight, consistent with the live currentDate the caller passes.
function localDateFrom(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Fold one session's hands into a history map (pure — returns a new map).
 * `hands` entries need { scenarioId, result } and may carry `decisionMs`;
 * `sessionNo` is the 1-based number of the session they were played in and
 * `sessionDate` its calendar day (YYYY-MM-DD, null in legacy/no-clock paths).
 *
 * The per-scenario ladder state (remediating / rung / lastMissConfident) is
 * derived here so it rebuilds identically from live play and from replayed
 * `sessions` rows:
 *   - a miss (re)enters the ladder at rung 0 and records whether it was a
 *     confident (fast) miss;
 *   - a SPACED correct (a different calendar day from the last sighting) is one
 *     retrieval up the ladder — GRADUATION_TARGET of them clears it. A same-day
 *     correct is massed practice and doesn't advance (R2);
 *   - a partial is neutral (neither advances nor resets).
 */
export function applyHandsToHistory(history, hands, sessionNo, sessionDate = null) {
  const next = { ...history };
  for (const h of hands ?? []) {
    if (!h?.scenarioId) continue;
    const prev = next[h.scenarioId];
    let remediating = isRemediating(prev);
    let rung = prev?.rung ?? 0;
    let lastMissConfident = prev?.lastMissConfident ?? false;

    if (h.result === 'incorrect') {
      remediating = true;
      rung = 0;
      lastMissConfident = isConfidentMiss(h.decisionMs);
    } else if (h.result === 'correct' && remediating) {
      // Missing dates on either side (legacy rows) → treat as spaced, since we
      // can't prove massing.
      const spaced = !sessionDate || !prev?.lastSeenDate || sessionDate !== prev.lastSeenDate;
      if (spaced && ++rung >= GRADUATION_TARGET) {
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
