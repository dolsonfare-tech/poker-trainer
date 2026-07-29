import { CONFIDENT_MISS_MS } from './spacedrep';
import { addHandsToDirectionTally, EMPTY_DIRECTION_TALLY } from './schema';

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

const tally = (sessions) => {
  const hands = sessions.flatMap(s => s.hands ?? []);
  return {
    hands,
    correct: hands.filter(h => h.result === 'correct').length,
    total: hands.length,
  };
};

/** sessions: NEWEST FIRST. lookup: (scenarioId) => { tag, skill, villain } | null */
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

  return {
    sessions: win.length,
    hands: hands.length,
    accuracy: { correct, total },
    previous: prevWin.length > 0 ? { correct: prev.correct, total: prev.total } : null,
    skills: [...bySkill.values()].sort(
      (a, b) => b.attempts - a.attempts || a.skill.localeCompare(b.skill),
    ),
    direction: addHandsToDirectionTally(EMPTY_DIRECTION_TALLY, hands),
    confidentMisses: hands.filter(isConfidentMiss).slice(0, MAX_CITED).map(h => ({
      skill: h.skill ?? meta(h.scenarioId).skill ?? 'Unknown',
      villain: meta(h.scenarioId).villain ?? 'Unknown',
      scenario: meta(h.scenarioId).tag ?? 'Unknown',
    })),
    repeats: [...missesById.entries()]
      .filter(([, n]) => n > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CITED)
      .map(([id, misses]) => ({
        scenario: meta(id).tag ?? 'Unknown',
        villain: meta(id).villain ?? 'Unknown',
        misses,
      })),
  };
}
