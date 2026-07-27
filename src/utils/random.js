// ── Random utilities ─────────────────────────────────────────────────────────
// Single source for the shuffle primitive — previously kept byte-identical
// copies in spacedrep.js and TableReads.jsx (CA-029).

/**
 * Immutable Fisher-Yates shuffle.
 * Moved verbatim from spacedrep.js / TableReads.jsx.
 */
export function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
