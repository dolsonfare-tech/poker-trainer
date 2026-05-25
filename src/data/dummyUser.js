// ─── Dummy User Data (Phase 1.5) ──────────────────────────────────────────
// Returning user state — full dummy data for tester validation.
// New-user state (gray dots, locked schema) built in Phase 2 with real data.
// In Phase 2 this entire file is replaced by Supabase.

const DUMMY_USER = {
  // ── Identity ──────────────────────────────────────────────────────────
  displayName: 'RiverRat_KC',
  initials: 'RR',

  // ── Streak & Sessions ─────────────────────────────────────────────────
  streak: 8,
  lastSessionDate: null, // null = hasn't played today (triggers warning after 6pm)
  sessionsCompleted: 47,

  // ── XP ────────────────────────────────────────────────────────────────
  xp: 1240,
  level: 4,

  // ── Coach greeting ────────────────────────────────────────────────────
  // Phase 2: generated dynamically based on user state
  coachGreeting: "Eight days running. The hard part is showing up — you already did.",

  // ── Skill ratings ─────────────────────────────────────────────────────
  // rating: 'green' | 'yellow' | 'red' | 'gray' (unrated)
  skills: {
    preflop:    { rating: 'green',  attempts: 34 },
    position:   { rating: 'green',  attempts: 28 },
    aggression: { rating: 'red',    attempts: 31 },
    betsize:    { rating: 'yellow', attempts: 22 },
    bluffing:   { rating: 'red',    attempts: 19 },
    potodds:    { rating: 'yellow', attempts: 25 },
    reads:      { rating: 'green',  attempts: 30 },
    opponent:   { rating: 'gray',   attempts: 4  },
  },

  // ── Schema diagnosis ──────────────────────────────────────────────────
  // Phase 2: evolves over time based on decision history
  schema: {
    name: 'The Conflict Avoider',
    quote: "I shouldn't put money in unless I'm sure",
    index: '01',
    total: '06',
    affected: [
      { skill: 'Aggression', level: 'red'    },
      { skill: 'Bluffing',   level: 'red'    },
      { skill: 'Bet Sizing', level: 'yellow' },
    ],
  },
  sessionsRequiredForSchema: 5,

  // ── Leaderboard ───────────────────────────────────────────────────────
  // Phase 2: real data from Supabase
  // Phase 1.5: collapsed view — your rank chip + top 3 only
  leaderboard: {
    yourRank: 47,
    total: 1247,
    top: [
      { rank: 1, name: 'Dave245',     streak: 41 },
      { rank: 2, name: 'TFETonerichguy', streak: 38 },
      { rank: 3, name: 'homegymislife24x7',    streak: 29 },
    ],
  },
};

export default DUMMY_USER;