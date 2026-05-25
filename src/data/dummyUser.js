// ─── Dummy User Data (Phase 1.5) ──────────────────────────────────────────
// All screens read from this file in Phase 1.5.
// In Phase 2 this is replaced by real Supabase data.

const DUMMY_USER = {
  // ── Identity ──────────────────────────────────────────────────────────
  displayName: 'RiverRat_KC',
  initials: 'RR',

  // ── Streak ────────────────────────────────────────────────────────────
  // streak: 0 = new user with no sessions yet
  streak: 0,
  lastSessionDate: null,

  // ── XP ────────────────────────────────────────────────────────────────
  xp: 0,
  level: 1,

  // ── Skill ratings ─────────────────────────────────────────────────────
  // rating: 'green' | 'yellow' | 'red' | 'gray' (unrated)
  skills: {
    preflop:    { rating: 'gray', attempts: 0 },
    position:   { rating: 'gray', attempts: 0 },
    aggression: { rating: 'gray', attempts: 0 },
    betsize:    { rating: 'gray', attempts: 0 },
    bluffing:   { rating: 'gray', attempts: 0 },
    potodds:    { rating: 'gray', attempts: 0 },
    reads:      { rating: 'gray', attempts: 0 },
    opponent:   { rating: 'gray', attempts: 0 },
  },

  // ── Schema diagnosis ──────────────────────────────────────────────────
  // null until 5 sessions completed
  schema: null,
  sessionsCompleted: 0,
  sessionsRequiredForSchema: 5,

  // ── Leaderboard (global, hardcoded for Phase 1.5) ─────────────────────
  leaderboard: [
    { rank: 1,  name: 'Dave245',    streak: 41, isUser: false },
    { rank: 2,  name: 'RichTone101',  streak: 38, isUser: false },
    { rank: 3,  name: 'Cyrus_homegym',   streak: 0,  isUser: true  },
    { rank: 4,  name: 'NitPickr',      streak: 29, isUser: false },
    { rank: 5,  name: 'PotOddsOnly',   streak: 24, isUser: false },
    { rank: 6,  name: 'CheckRaiser',   streak: 19, isUser: false },
    { rank: 7,  name: 'MindYourBB',    streak: 14, isUser: false },
    { rank: 8,  name: 'SemiBluffKing', streak: 11, isUser: false },
    { rank: 9,  name: 'UTGorFold',     streak: 8,  isUser: false },
    { rank: 10, name: 'Villain_Read',  streak: 5,  isUser: false },
  ],
};

export default DUMMY_USER;