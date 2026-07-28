// Villain archetype labels — the eight opponents the dealer can seat.
//
// Extracted from scenarios.js (CA-014, Wave 4). It is eight strings, but living
// inside the 438 KB scenario library meant every consumer dragged the whole
// library in: VillainGuide is rendered eagerly by App, so this one constant
// alone pinned the entire pool into the main bundle regardless of what the
// lazy-loading did elsewhere.
//
// scenarios.js still imports from here (mkScenario stamps `villain.label` at
// build time) and re-exports for the existing import sites, so this stays the
// single source — the guide can never drift from what the game deals.
export const VILLAIN_LABELS = {
  'aggressive':      'Aggressive Regular',
  'passive':         'Passive Player',
  'tight':           'Tight Recreational',
  'loose':           'Loose Recreational',
  'calling-station': 'Calling Station',
  'maniac':          'Maniac',
  'nit':             'Tight Nit',
  'unknown':         'Unknown',
};
