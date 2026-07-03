// ─── Shared skill constants ───────────────────────────────────────────────
// Single source of truth used by Dashboard, SessionSummary, and any future
// screen that needs skill names, descriptions, or rating labels.

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

export const COLOR_LABELS = {
  green:  'Strong · 75%+ accuracy',
  yellow: 'Work On · 50–74% accuracy',
  red:    'Weak · below 50% accuracy',
  gray:   'Unrated · fewer than 5 attempts',
};

export const RATING_ORDER = ['red', 'yellow', 'green'];

// ─── Rating engine: true accuracy ─────────────────────────────────────────
// Ratings are derived from correct/attempts, matching COLOR_LABELS exactly:
// green ≥75%, yellow 50–74%, red <50%, gray until 5 attempts.
// A 'partial' (acceptable but not optimal) answer earns half credit.

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
