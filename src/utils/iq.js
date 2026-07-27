// Poker IQ — the headline number.
//
// MOD-001 (Wave 3): split out of userStorage.js.
import { RESULT_CREDIT } from '../data/constants';

// Poker IQ — RECENCY-WEIGHTED as of July 18, 2026 (docs/findings/PERSONA_PLAYTEST_FINDINGS.md
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
