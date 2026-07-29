// Coach's Read parsing + notebook cap.
//
// MOD-001 (Wave 3): split out of userStorage.js. Leaf module — depends on
// nothing, which is why it goes first in the dependency order.

// ── Coach's Notebook ────────────────────────────────────────────────────────
// A player accumulates one Coach's Read per session; the dashboard surfaces the
// latest in the Player Profile strip and the rest in the notebook history. The
// history is DERIVED state (like recentHands/scenarioHistory): in Supabase mode
// db.js rebuilds it fresh from the append-only session log; here we keep it in
// the localStorage cache, newest first, capped. Entries hold the RAW stored
// string (structured JSON or legacy prose) — parseCoachRead runs at render time.
// One read per five sessions (Phase B), so 12 reads is ~60 sessions of history
// — 30 would have been 150. Both enforcement sites use this symbol, so the
// change is one line. NOTE: db.test.js builds a 40-row fixture to prove
// truncation; lowering is safe, raising above 40 would silently stop testing it.
export const COACH_READS_CAP = 12;

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
