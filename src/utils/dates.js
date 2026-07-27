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

/**
 * Date object or 'YYYY-MM-DD' string → compact "Jul 18" (local time, no UTC
 * shift for string input). Accepts either shape so both former call sites
 * (Dashboard.jsx's `fmtReadDate` for strings, `fmtDate` for Date objects)
 * collapse into one function (CA-037).
 */
export function formatShortDate(dateOrString) {
  let d;
  if (dateOrString instanceof Date) {
    d = dateOrString;
  } else {
    const [y, m, day] = String(dateOrString ?? '').split('-').map(Number);
    if (!y || !m || !day) return dateOrString ?? '';
    d = new Date(y, m - 1, day);
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
