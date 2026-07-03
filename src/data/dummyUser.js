// ─── Dummy User Data (Phase 1.5) ──────────────────────────────────────────
// Returning user state — full dummy data for tester validation.
// In Phase 2 this entire file is replaced by Supabase.

const DUMMY_USER = {
  // ── Identity ──────────────────────────────────────────────────────────
  displayName: 'RiverRat72',
  initials: 'RR',

  // ── Streak & Sessions ─────────────────────────────────────────────────
  streak: 8,
  lastSessionDate: null,
  sessionsCompleted: 47,

  // ── Skill ratings ─────────────────────────────────────────────────────
  // rating derives from correct/attempts (see constants.js deriveRating):
  // green ≥75%, yellow 50–74%, red <50%, gray until 5 attempts.
  // partial answers earn 0.5 correct.
  skills: {
    preflop:    { rating: 'green',  attempts: 34, correct: 28   },
    position:   { rating: 'green',  attempts: 28, correct: 22   },
    aggression: { rating: 'red',    attempts: 31, correct: 12.5 },
    betsize:    { rating: 'yellow', attempts: 22, correct: 13   },
    bluffing:   { rating: 'red',    attempts: 19, correct: 7    },
    potodds:    { rating: 'yellow', attempts: 25, correct: 15.5 },
    reads:      { rating: 'green',  attempts: 30, correct: 24   },
    opponent:   { rating: 'gray',   attempts: 4,  correct: 2    },
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

  // ── Coach's Note ─────────────────────────────────────────────────────
  // Phase 2: generated per-session based on recent skill data
  coachNote: {
    body: "You're avoiding confrontation with draws. When you flop a flush draw on a wet board, lean into the aggression — opponents can't call profitably every time. Passive play here gifts them a free card and kills your fold equity.",
    focus: 'Aggression',
  },

  // ── Poker Score ───────────────────────────────────────────────────────
  // Phase 2: calculated from difficulty level + skill ratings over time.
  // Requires 20 sessions to unlock. Beginner-only play caps at ~70.
  // Algorithm TBD — this is a placeholder for UI validation.
  pokerScore: 68,

  // ── Friends Leaderboard ───────────────────────────────────────────────
  // Phase 2: real friends from Supabase social graph
  // isUser flags the current user's row for highlighting
  leaderboard: {
    yourRank: 3,
    total: 4,
    top: [
      { rank: 1, name: 'Dave245',          streak: 41, isUser: false },
      { rank: 2, name: 'HinduHustler420',   streak: 38, isUser: false },
      { rank: 3, name: 'RiverRat72',      streak: 8,  isUser: true  },
      { rank: 4, name: 'TickBite69',streak: 5,  isUser: false },
    ],
  },
};

export default DUMMY_USER;