// Spaced repetition v0 — the session builder.
//
// Replaces pure-random dealing with three ordered priorities:
//   1. Resurface at most ONE missed hand whose cooldown has elapsed (the
//      comeback loop) — tagged { replay: true } so the UI can label it
//      honestly instead of hoping the player doesn't notice the repeat.
//   2. Unseen scenarios, with two slots weighted toward the player's
//      weakest rated skills (red first, then yellow) — this is what makes
//      the dashboard's "Focus this session" line actually come true.
//   3. Least-recently-seen fallback when the unseen pool runs dry, so small
//      pools (per-difficulty, or a jest-mocked pool of one) always deal.
//
// Scenario history is DERIVED state: in Supabase mode it's rebuilt from the
// append-only `sessions` rows on profile load (hands already store
// scenarioId), locally it rides the cached user object. No schema change.

export const RESURFACE_COOLDOWN_SESSIONS = 2; // full sessions between a miss and its comeback
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

/**
 * Deal a session from `pool` (already filtered to the chosen difficulty).
 *
 * history: { [scenarioId]: { seen, lastResult, lastSeenAt } } where
 *          lastSeenAt is the 1-based session number it last appeared in.
 * skills:  the user's skills map (ratings drive the weak-slot weighting).
 * sessionsCompleted: total sessions played — the cooldown clock.
 *
 * Resurfaced misses are shallow copies tagged { replay: true }; everything
 * else is the pool's own object, untouched.
 */
export function buildSession(pool, { history = {}, skills = {}, sessionsCompleted = 0, length = 5 } = {}) {
  const picked = [];
  const pickedIds = new Set();
  const skillCount = {};
  const preCap = preflopCap(length);
  let preCount = 0;
  const take = (s, replay = false) => {
    picked.push(replay ? { ...s, replay: true } : s);
    pickedIds.add(s.id);
    skillCount[s.skill] = (skillCount[s.skill] ?? 0) + 1;
    if (isPreflop(s)) preCount++;
  };
  const preBlocked = (s) => isPreflop(s) && preCount >= preCap;

  // 1 — comeback hand: a clear miss (incorrect, not partial), cooled down,
  // oldest miss first. Shuffle before the stable sort so same-age misses
  // don't resurface in authoring order.
  const misses = shuffle(
    pool.filter((s) => {
      const h = history[s.id];
      return h && h.lastResult === 'incorrect'
        && sessionsCompleted - h.lastSeenAt >= RESURFACE_COOLDOWN_SESSIONS;
    })
  ).sort((a, b) => history[a.id].lastSeenAt - history[b.id].lastSeenAt);
  for (const s of misses.slice(0, MAX_REPLAYS_PER_SESSION)) {
    if (picked.length < length) take(s, true);
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

/**
 * Fold one session's hands into a history map (pure — returns a new map).
 * `hands` entries need { scenarioId, result }; `sessionNo` is the 1-based
 * number of the session they were played in.
 */
export function applyHandsToHistory(history, hands, sessionNo) {
  const next = { ...history };
  for (const h of hands ?? []) {
    if (!h?.scenarioId) continue;
    const prev = next[h.scenarioId];
    next[h.scenarioId] = {
      seen: (prev?.seen ?? 0) + 1,
      lastResult: h.result,
      lastSeenAt: sessionNo,
    };
  }
  return next;
}

/**
 * Rebuild the full history map from chronologically ordered `sessions` rows.
 * Rows can be fewer than sessionsCompleted (pre-Supabase migrated sessions
 * have no rows) — the base offset keeps lastSeenAt on the same scale as the
 * live sessionsCompleted counter so cooldown math stays honest.
 */
export function historyFromSessions(rows, sessionsCompleted = 0) {
  const list = rows ?? [];
  const base = Math.max(0, sessionsCompleted - list.length);
  let history = {};
  list.forEach((row, i) => {
    history = applyHandsToHistory(history, row.hands, base + i + 1);
  });
  return history;
}
