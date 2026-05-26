// ─── Dummy User Data (Phase 1.5) ──────────────────────────────────────────
// Returning user state — full dummy data for tester validation.
// In Phase 2 this entire file is replaced by Supabase.

const DUMMY_USER = {
  // ── Identity ──────────────────────────────────────────────────────────
  displayName: 'homegymislife24x7',
  initials: 'AA',

  // ── Streak & Sessions ─────────────────────────────────────────────────
  streak: 8,
  lastSessionDate: null,
  sessionsCompleted: 47,

  // ── Skill ratings ─────────────────────────────────────────────────────
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

  // ── Friends Leaderboard ───────────────────────────────────────────────
  // Phase 2: real friends from Supabase social graph
  // isUser flags the current user's row for highlighting
  leaderboard: {
    yourRank: 3,
    total: 4,
    top: [
      { rank: 1, name: 'Dave245',          streak: 41, isUser: false },
      { rank: 2, name: 'TFETonerichguy',   streak: 38, isUser: false },
      { rank: 3, name: 'homegymislife24x7',      streak: 8,  isUser: true  },
      { rank: 4, name: 'TickBite69',streak: 5,  isUser: false },
    ],
  },
};

export default DUMMY_USER;