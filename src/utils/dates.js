// ── Date utilities ────────────────────────────────────────────────────────────
// Local time, not UTC — a day rolls over at the player's midnight.
// Single source for both userStorage.js (streak math) and spacedrep.js
// (calendar-day cooldown), which previously kept byte-identical copies to
// avoid a circular import (CA-028).

/**
 * Date → local YYYY-MM-DD string.
 * Moved verbatim from userStorage.js ~:533.
 */
export function toLocalDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * ISO timestamp (or any Date-parseable value) → local YYYY-MM-DD string,
 * or null for falsy / unparseable input.
 * Moved verbatim from spacedrep.js ~:304.
 */
export function localDateFrom(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
