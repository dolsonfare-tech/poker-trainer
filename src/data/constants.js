// ─── Shared skill constants ───────────────────────────────────────────────
// Single source of truth used by Dashboard, SessionSummary, and any future
// screen that needs skill names, descriptions, or rating labels.

// ─── Difficulty labels (CA-030) ──────────────────────────────────────────────
// Single source for the three difficulty display names — same pattern as
// SKILL_NAMES. DifficultySelector derives each card's label from this map;
// SessionSummary imports this instead of maintaining its own private copy.
export const DIFFICULTY_LABELS = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  expert:       'Expert',
};

// ─── Guest gate CTA (CA-031) ─────────────────────────────────────────────────
// The call-to-action shown to a guest who has used their free session.
// Dashboard renders it alone; SessionSummary appends ' →'.
// GUEST_FREE_SESSIONS and the 'Guest' display name stay in App.jsx (config,
// not display copy).
export const GUEST_GATE_CTA = 'Sign In Free to Keep Playing';

export const SKILL_NAMES = {
  preflop:    'Preflop',
  position:   'Position',
  aggression: 'Aggression',
  betsize:    'Bet Size',
  bluffing:   'Bluffing',
  potodds:    'Pot Odds',
  reads:      'Reads',
  opponent:   'Opponent',
};

export const SKILL_DESCRIPTIONS = {
  preflop:    'Right starting hands by position',
  position:   'Adjusting play based on your seat',
  aggression: 'Calibrating when to bet and raise',
  betsize:    'Sizing bets to achieve their purpose',
  bluffing:   'Bluffing at the right frequency',
  potodds:    'Calling profitably vs. over-folding',
  reads:      'Reacting to villain betting patterns',
  opponent:   'Adjusting strategy for villain type',
};

// ─── Player schemas ─────────────────────────────────────────────────────────
// Single source for the 6 schema definitions. The diagnosis engine
// (deriveSchema in userStorage.js) reads name/quote plus the scoring field; the
// reference guide (VillainGuide) reads name/quote/desc. Edit here and both stay
// in step. Quotes carry no trailing period — the dashboard card and the guide
// add their own quote marks.
//
// Schema-diagnosis v2 (July 18, 2026 — founder decision, hybrid model):
//   • DIRECTION schemas carry a `direction` field ('under' | 'loose' | 'over')
//     and are scored from the fold/call/raise DIRECTION of a player's mistakes
//     (the direction tally in userStorage.js), NOT per-skill accuracy. Two
//     players with identical accuracy but opposite mistakes (over-folding vs
//     over-raising) must diagnose differently, and accuracy alone can't tell
//     them apart — worse, it manufactures the opposite label (a passive player's
//     misses turn `betsize` red, and red betsize used to read as aggression).
//   • SKILL schemas (Positional Blind Spot, Results Thinker, Exploitable
//     Regular) have NO `direction` field and keep the absolute-weakness scoring
//     off their `primary` skill.
//   • The `primary` arrays on the three DIRECTION schemas are NO LONGER scored
//     (founder call July 18: aggression / bluffing / preflop / potodds / betsize
//     no longer name a schema — they live in the skill ledger). They're kept as
//     reference only; VillainGuide doesn't read them.
export const PLAYER_SCHEMAS = [
  {
    name: 'The Conflict Avoider',
    quote: "I shouldn't put money in unless I'm sure",
    direction: 'under',                 // chose more passive than correct
    primary: ['aggression', 'bluffing'],
    desc: 'You fold too often and only bet the nuts, leaking value and getting pushed off winning hands. Loosen up — bet strong-but-not-perfect hands and call down more.',
  },
  {
    name: 'The Gambler',
    quote: 'Any two cards can win',
    direction: 'loose',                 // called when folding was correct
    primary: ['preflop', 'potodds'],
    desc: 'You play too many hands and chase weak draws, bleeding chips preflop and on bad odds. Tighten your starting hands and fold when the price is wrong.',
  },
  {
    name: 'The Positional Blind Spot',
    quote: "I don't factor in where I'm sitting",
    primary: ['position'],
    desc: 'You play the same whether first or last to act, ignoring the edge position gives you. Play tighter out of position and widen up on the button.',
  },
  {
    name: 'The Results Thinker',
    quote: 'If it worked, it was right',
    primary: ['reads'],
    desc: 'You judge decisions by whether they won, not whether they were correct, so lucky mistakes stick around. At the table it shows in your Reads — you remember how the hand ended, not what the betting was telling you. Grade the decision, not the outcome.',
  },
  {
    name: 'The Exploitable Regular',
    quote: 'I play my hand, not my opponent',
    primary: ['opponent'],
    desc: "Your fundamentals are fine but you don't adjust to who you're facing, so tougher opponents exploit you. Read villain tendencies and deviate to attack them.",
  },
  {
    name: 'The Overaggressor',
    quote: 'Pressure wins pots regardless',
    direction: 'over',                  // chose raise when call/fold was correct
    primary: ['betsize'],
    desc: 'You bet and raise too often and too big, turning good hands into bluffs and spewing chips. Pick better spots and size for a purpose.',
  },
];

export const RATING_ORDER = ['red', 'yellow', 'green'];

// ─── Rating engine: true accuracy ─────────────────────────────────────────
// Ratings are derived from correct/attempts: green ≥75%, yellow 50–74%,
// red <50%, gray until 5 attempts. A 'partial' (acceptable but not optimal)
// answer earns half credit. These thresholds are engine internals — never
// surface them in user-facing copy (the guide shows status names only).

export const MIN_RATED_ATTEMPTS = 5;

export const RESULT_CREDIT = { correct: 1, partial: 0.5, incorrect: 0 };

export function deriveRating(correct, attempts) {
  if (attempts < MIN_RATED_ATTEMPTS) return 'gray';
  const pct = correct / attempts;
  if (pct >= 0.75) return 'green';
  if (pct >= 0.5)  return 'yellow';
  return 'red';
}

/** Fold one hand's result into a skill's {rating, attempts, correct}. */
export function applyHandToSkill(data, result) {
  if (!(result in RESULT_CREDIT)) return data;
  const attempts = data.attempts + 1;
  const correct  = (data.correct ?? 0) + RESULT_CREDIT[result];
  return { ...data, attempts, correct, rating: deriveRating(correct, attempts) };
}
