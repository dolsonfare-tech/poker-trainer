import { CONFIDENT_MISS_MS } from './spacedrep.js';
import { addHandsToDirectionTally, EMPTY_DIRECTION_TALLY } from './schema.js';
import { MIN_RATED_ATTEMPTS } from '../data/constants.js';

// ─── Coach window ──────────────────────────────────────────────────────────
// Turns the trailing session log into the PATTERNS the meta-read interprets.
//
// Two deliberate shapes:
//
// 1. The read is prompted on aggregates, not raw hands. Fifty raw hands is ~10x
//    the prompt tokens and the wrong input for a pattern-level claim — F5 says
//    the read's job is the cross-hand why, never a restatement of results the
//    player already saw per hand.
// 2. `lookup` is a PARAMETER, never an import. `scenarios.js` is a lazy-loaded
//    chunk (CA-014); importing it here would pull 94KB back into the main
//    bundle and fail check:bundle. The server and the eval harness each build
//    their own lookup and pass it in.

export const COACH_WINDOW = 10;

const MAX_CITED = 5;   // confident misses / repeat offenders sent to the model

const isConfidentMiss = (h) =>
  h.result === 'incorrect'
  && typeof h.decisionMs === 'number' && h.decisionMs > 0 && h.decisionMs <= CONFIDENT_MISS_MS;

// A timeout is the player never acting — the clock ran out. useSessionRun writes
// BOTH `choiceVal: null` and `decisionMs: null` for that case, so both are
// required here. Keying on `result` would be wrong (a timeout grades
// 'incorrect', and so does an ordinary bad choice), and keying on decisionMs
// alone would be wrong too (an answered hand can carry a null decisionMs when
// the shown-at timestamp is missing). A freeze is a distinct behaviour from a
// bad choice and carries no direction — schema.js already refuses to classify
// it — so the prompt needs to see it separately or it reads as patternless.
//
// HAZARD: this is the ONE predicate in the codebase where a MISSING value is an
// affirmative signal. Everywhere else (directionOfHand, isConfidentMiss) a
// null/absent field means "no signal, skip". So it demands the keys be PRESENT
// and null, never merely absent: no writer emits a reduced hand shape today, but
// if one ever did, a bare `== null` test would report that players froze on
// hands they actually answered, inside a prompt that forbids inventing
// statistics. Presence is what distinguishes a recorded freeze from missing data.
const isTimeout = (h) =>
  h != null && 'choiceVal' in h && 'decisionMs' in h
  && h.choiceVal == null && h.decisionMs == null;

// Pre-aggregation by opponent (July 29, 2026 — live eval finding 2).
//
// The prompt used to hand the model a flat LIST of confident-error lines and
// leave it to TALLY them itself. On a window holding Calling Station x1, Tight
// Recreational x1, Tight Nit x2 and Maniac x1, two live runs out of two returned
// "two vs Tight Nit, two vs Tight Recreational" — an invented statistic, under a
// prompt rule that forbids exactly that. Counting items in a list and reporting
// the count is a known-unreliable operation for a language model, and it is the
// one place Phase B asked for arithmetic after building the whole window seam to
// feed PATTERNS instead of raw hands.
//
// So the count is computed here and the model READS it. Two properties matter:
//
//  1. Grouping runs over the CITED slice (the <= MAX_CITED entries that actually
//     reach the prompt), never the full window. A tally of 30 above a list of 5
//     is a contradiction the model has to resolve, and it would resolve it by
//     inventing. The number it sees always describes the lines it can see.
//  2. Individual spots survive INSIDE each group — seat + hole cards + street is
//     what tells two same-tag, same-villain hands apart (describeSpot in
//     api/coach-read.js), and losing it would trade one defect for another.
//
// Deterministic order: count desc, then villain name, so the prompt bytes for a
// given window are stable across runs.
const groupByVillain = (items) => {
  const groups = new Map();
  for (const it of items) {
    const villain = it.villain || 'Unknown';
    const g = groups.get(villain) ?? { villain, count: 0, spots: [] };
    g.count += 1;
    g.spots.push(it);
    groups.set(villain, g);
  }
  return [...groups.values()].sort(
    (a, b) => b.count - a.count || a.villain.localeCompare(b.villain),
  );
};

const tally = (sessions) => {
  const hands = sessions.flatMap(s => s.hands ?? []);
  return {
    hands,
    correct: hands.filter(h => h.result === 'correct').length,
    total: hands.length,
  };
};

/** sessions: NEWEST FIRST. lookup: (scenarioId) => { tag, skill, villain, spot } | null */
export function aggregate(sessions, lookup) {
  const all = Array.isArray(sessions) ? sessions : [];
  const win = all.slice(0, COACH_WINDOW);
  const prevWin = all.slice(COACH_WINDOW, COACH_WINDOW * 2);
  const meta = (id) => (typeof lookup === 'function' ? lookup(id) : null) ?? {};

  const { hands, correct, total } = tally(win);
  const prev = tally(prevWin);

  const bySkill = new Map();
  for (const h of hands) {
    const key = h.skill ?? meta(h.scenarioId).skill;
    if (!key) continue;
    const s = bySkill.get(key) ?? { skill: key, attempts: 0, correct: 0 };
    s.attempts += 1;
    if (h.result === 'correct') s.correct += 1;
    bySkill.set(key, s);
  }

  const missesById = new Map();
  for (const h of hands) {
    if (h.result === 'correct') continue;
    missesById.set(h.scenarioId, (missesById.get(h.scenarioId) ?? 0) + 1);
  }

  // MIN_RATED_ATTEMPTS is the PRODUCT-WIDE evidence bar, imported rather than
  // re-stated: the skill ledger greys out anything under it and the recent-form
  // strip refuses to name it, precisely so the surfaces cannot contradict each
  // other. Without it here, a lone `- betsize: 0 of 1` line was the only 0%
  // skill in the window and the read headlined bet sizing while the ledger
  // showed Bet Sizing as unrated — three surfaces, one player, three answers.
  // It is also the entire justification for a ten-session window over six ("a
  // skill averages ~6 attempts and usually clears the bar; at six sessions it
  // averages under four and usually does not"), so applying it here is what
  // makes that argument true rather than aspirational.
  //
  // Sub-bar skills are dropped from `skills` — the only list the prompt renders
  // — instead of being carried alongside it, so there is no second list a
  // future edit can render by mistake. `unratedSkills` is names only, for the
  // eval doc and debugging; it never reaches the model.
  const ranked = [...bySkill.values()].sort(
    (a, b) => b.attempts - a.attempts || a.skill.localeCompare(b.skill),
  );

  const spotOf = (id) => meta(id).spot ?? '';

  const confidentCited = hands.filter(isConfidentMiss).slice(0, MAX_CITED).map(h => ({
    skill: h.skill ?? meta(h.scenarioId).skill ?? 'Unknown',
    villain: meta(h.scenarioId).villain ?? 'Unknown',
    scenario: meta(h.scenarioId).tag ?? 'Unknown',
    // Seat + hole cards + street: what tells two same-tag, same-villain spots
    // apart in the prompt. Empty (not 'Unknown') when the id does not resolve.
    spot: spotOf(h.scenarioId),
  }));

  const repeatsCited = [...missesById.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CITED)
    .map(([id, misses]) => ({
      scenario: meta(id).tag ?? 'Unknown',
      villain: meta(id).villain ?? 'Unknown',
      spot: spotOf(id),
      misses,
    }));

  return {
    sessions: win.length,
    hands: hands.length,
    accuracy: { correct, total },
    previous: prevWin.length > 0 ? { correct: prev.correct, total: prev.total } : null,
    skills: ranked.filter(s => s.attempts >= MIN_RATED_ATTEMPTS),
    unratedSkills: ranked.filter(s => s.attempts < MIN_RATED_ATTEMPTS).map(s => s.skill),
    direction: addHandsToDirectionTally(EMPTY_DIRECTION_TALLY, hands),
    timeouts: hands.filter(isTimeout).length,
    confidentMisses: confidentCited,
    repeats: repeatsCited,
    // The tallies the PROMPT renders. See groupByVillain above.
    confidentByVillain: groupByVillain(confidentCited),
    repeatsByVillain: groupByVillain(repeatsCited),
  };
}
