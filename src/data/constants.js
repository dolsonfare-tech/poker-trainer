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
