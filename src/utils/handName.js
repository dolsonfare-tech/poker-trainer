// ─── Hand name derivation ──────────────────────────────────────────────────
// Turns a two-card hand ([{ r, s, c }, { r, s, c }]) into the spoken name the
// gameplay canvas prints under the hole cards. Never shorthand notation
// (KQs / 98d) — CLAUDE.md's "What to Never Do" bans it in player-facing text.

const RANK_NAMES = {
  'A': 'Ace', 'K': 'King', 'Q': 'Queen', 'J': 'Jack',
  'T': 'Ten', '9': 'Nine', '8': 'Eight', '7': 'Seven',
  '6': 'Six', '5': 'Five', '4': 'Four', '3': 'Three', '2': 'Two',
};

export default function getHandName(hand) {
  const [c1, c2] = hand;
  const r1 = c1.r; const r2 = c2.r;
  const suited = c1.s === c2.s;
  if (r1 === r2) return `Pocket ${RANK_NAMES[r1]}s`;
  return `${RANK_NAMES[r1]}-${RANK_NAMES[r2]} ${suited ? 'Suited' : 'Offsuit'}`;
}
