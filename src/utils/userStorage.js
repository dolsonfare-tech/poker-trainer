// ── userStorage.js — RE-EXPORT BARREL (MOD-001, Wave 3) ──────────────────
// The 685-line module that owned persistence, streaks, schema derivation, the
// Poker IQ, coach-read parsing and session application was split into six
// single-responsibility modules. This file now re-exports all of them so the
// 18 existing import sites keep working untouched — the split lands as a pure
// move, with no call-site churn to hide a behavioural change in.
//
// TARGET_ARCHITECTURE §4 keeps the barrel for ONE release. Removing it means
// repointing every importer at the module it actually needs; `grep -rn
// "from '.*userStorage'" src/` finds them. Deleting it earlier would mix a
// mechanical move with a 18-file rewrite in the same diff, which is exactly
// what makes a refactor unreviewable.

export { loadUser, saveUser, clearUser, setCacheOwner, cacheOwner,
         loadLastDifficulty, saveLastDifficulty,
         loadTableReadsStats, saveTableReadsStats } from './persistence';

export { RENAME_COOLDOWN_MS, DEFAULT_SKILLS, createUser,
         applySessionResults } from './session';

export { REBUY_CAP, STREAK_MILESTONES_LIST, MILESTONE_NAMES,
         milestoneProximity, calcStreak, streakAlive } from './streak';

export { classifyDirection, directionOfHand, EMPTY_DIRECTION_TALLY,
         addHandsToDirectionTally, BALANCED_SCHEMA, STUDENT_SCHEMA,
         SCHEMA_UNLOCK_SESSIONS, deriveSchema } from './schema';

export { RECENT_WINDOW, RECENT_HANDS_CAP,
         derivePokerScore, appendRecentHands } from './iq';

export { COACH_READS_CAP, parseCoachRead } from './coachRead';

// Was re-exported from here before the split (CA-028); kept so importers of
// toLocalDateString via userStorage stay green.
export { toLocalDateString } from './dates';
