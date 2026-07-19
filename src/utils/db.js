// Supabase reads/writes for user data. The in-memory user object keeps the
// exact userStorage.js shape, so the rest of the app doesn't know or care
// whether it came from localStorage or the database.
import { supabase } from './supabase';
import { DEFAULT_SKILLS, deriveSchema, derivePokerScore, RECENT_HANDS_CAP, COACH_READS_CAP, createUser, toLocalDateString, addHandsToDirectionTally, EMPTY_DIRECTION_TALLY } from './userStorage';
import { historyFromSessions } from './spacedrep';

const SKILL_KEYS = Object.keys(DEFAULT_SKILLS);

// Distinct local calendar days with a session in the last 30 days — feeds the
// broken-streak moment (M2: "you've played X of the last 30 days"). Derived
// from the append-only session log; null with no rows (localStorage mode falls
// back to copy-only). Today's just-finished session isn't in the rows yet at
// that moment, which only ever undercounts by one — acceptable for encouragement.
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
function activeDaysLast30(sessionRows) {
  if (!sessionRows?.length) return null;
  const now = Date.now();
  const days = new Set();
  for (const r of sessionRows) {
    const t = new Date(r.created_at).getTime();
    if (Number.isNaN(t) || now - t > THIRTY_DAYS_MS) continue;
    days.add(toLocalDateString(new Date(t)));
  }
  return days.size;
}

// Rolling recent-hands buffer for the recency-weighted Poker IQ (F3), rebuilt
// from the append-only session log — self-healing across devices, same pattern
// as scenarioHistory. sessionRows arrive ordered created_at ascending (oldest
// first); flatten each row's hands[] in that order and keep the last CAP so the
// buffer is chronological, newest last, exactly like applySessionResults builds it.
export function recentHandsFromSessions(sessionRows) {
  const stream = [];
  for (const r of sessionRows ?? []) {
    for (const h of r.hands ?? []) stream.push({ skill: h.skill, result: h.result });
  }
  return stream.length > RECENT_HANDS_CAP ? stream.slice(stream.length - RECENT_HANDS_CAP) : stream;
}

// Direction-of-error tally for schema v2, rebuilt from the append-only session
// log — lifetime and order-independent (it's a sum), self-healing across devices
// like recentHands/scenarioHistory. Each hand carries scenarioId + choiceVal +
// result; rows whose hands predate the choiceVal field skip gracefully
// (addHandsToDirectionTally drops hands with no directional signal).
export function directionTallyFromSessions(sessionRows) {
  const hands = [];
  for (const r of sessionRows ?? []) for (const h of r.hands ?? []) hands.push(h);
  return addHandsToDirectionTally(EMPTY_DIRECTION_TALLY, hands);
}

// Coach's Notebook history, rebuilt from the append-only session log —
// self-healing across devices, same pattern as recentHands/scenarioHistory.
// Rows arrive created_at ascending (oldest first); skip null/empty coach_read,
// date each read from created_at via the local-date helper, newest first, cap.
// Bodies are the RAW stored strings (structured JSON or legacy prose) — the
// dashboard parses them at render time.
export function coachReadsFromSessions(sessionRows) {
  const out = [];
  for (const r of sessionRows ?? []) {
    const body = r.coach_read;
    if (typeof body !== 'string' || !body.trim()) continue;
    out.push({ date: toLocalDateString(new Date(r.created_at)), body });
  }
  out.reverse();  // ascending rows → newest first
  return out.length > COACH_READS_CAP ? out.slice(0, COACH_READS_CAP) : out;
}

function assembleUser(profile, skillRows, sessionRows) {
  const skills = Object.fromEntries(
    SKILL_KEYS.map((k) => {
      const row = skillRows.find((r) => r.skill === k);
      return [k, row
        ? { rating: row.rating, attempts: row.attempts, correct: Number(row.correct) }
        : { ...DEFAULT_SKILLS[k] }];
    })
  );
  const recentHands = recentHandsFromSessions(sessionRows);
  const directionTally = directionTallyFromSessions(sessionRows);
  return {
    displayName: profile.display_name,
    initials: profile.initials,
    streak: profile.streak,
    lastSessionDate: profile.last_session_date,
    rebuys: profile.rebuys ?? 0,
    activeDaysLast30: activeDaysLast30(sessionRows),
    sessionsCompleted: profile.sessions_completed,
    skills,
    schema: deriveSchema(skills, profile.sessions_completed, directionTally),
    // Direction-of-error tally (schema v2), rebuilt from the session log so the
    // hybrid diagnosis follows the account across devices; also kept in memory
    // so applySessionResults can increment it between loads.
    directionTally,
    // Derived fresh from live accuracy (like `schema` above), not the trusted
    // profiles.poker_score column, so existing users heal off the old
    // bucket-based number on their next load rather than at their next session.
    // The column is still written on create/save — only its read is bypassed.
    // Recency-weighted (F3) off the rebuilt recent-hands buffer.
    pokerScore: derivePokerScore(skills, recentHands),
    // Rolling recent-hands buffer (F3) — rebuilt from the session log so the
    // recency-weighted IQ follows the account across devices.
    recentHands,
    coachNote: profile.coach_note_body
      ? { body: profile.coach_note_body, focus: profile.coach_note_focus }
      : null,
    // Coach's Notebook — full read history derived from the session log
    // (newest first, capped), self-healing like recentHands/scenarioHistory.
    coachReads: coachReadsFromSessions(sessionRows),
    usernameChangedAt: profile.username_changed_at ?? null,
    // Derived from the append-only session log — feeds the session builder
    // (no repeats, comeback hands) and follows the account across devices.
    scenarioHistory: historyFromSessions(sessionRows, profile.sessions_completed),
    // Personal best, also derived (sessions store correct_count); null until
    // a session row exists so a first result is never celebrated as a "best".
    bestSessionCorrect: sessionRows?.length
      ? Math.max(...sessionRows.map(r => r.correct_count ?? 0))
      : null,
    leaderboard: null,
  };
}

/** Signed-in user's profile + skills, or null when no profile row exists yet. */
export async function fetchRemoteUser() {
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  // A locally stored session the server rejects (revoked, or the auth user
  // was deleted) is NOT "no profile yet" — returning null here dead-ends the
  // player on UsernameEntry with a session that can't insert anything.
  if (authErr && (authErr.status === 401 || authErr.status === 403)) {
    const err = new Error('Stored session rejected by the server');
    err.code = 'invalid_session';
    throw err;
  }
  const uid = auth?.user?.id;
  if (!uid) return null;
  const { data: profile, error } = await supabase
    .from('profiles').select('*').eq('id', uid).maybeSingle();
  if (error) throw error;
  if (!profile) return null;
  const { data: skillRows, error: skillsErr } = await supabase
    .from('skills').select('*').eq('user_id', uid);
  if (skillsErr) throw skillsErr;
  const { data: sessionRows, error: sessionsErr } = await supabase
    .from('sessions').select('hands, correct_count, created_at, coach_read')
    .eq('user_id', uid)
    .order('created_at', { ascending: true });
  if (sessionsErr) throw sessionsErr;
  return assembleUser(profile, skillRows ?? [], sessionRows ?? []);
}

/**
 * First sign-in: create the profile + skill rows. When a pre-Supabase
 * localStorage profile exists, its history migrates so testers keep progress.
 *
 * ignoreDuplicates on both writes: this path must NEVER overwrite rows that
 * already exist. Reaching it with a live profile (e.g. a transient fetch
 * failure sent the player to UsernameEntry) would otherwise zero their stats
 * in the DB. On conflict nothing is written and the trailing fetchRemoteUser
 * returns the real profile; retrying a partially failed create still fills
 * in whatever's missing.
 */
export async function createRemoteProfile(username, localUser) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error('Not signed in');
  const base = localUser ?? createUser(username);
  const profile = {
    id: uid,
    display_name: username,
    initials: username.slice(0, 2).toUpperCase(),
    streak: base.streak ?? 0,
    last_session_date: base.lastSessionDate ?? null,
    rebuys: base.rebuys ?? 0,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    sessions_completed: base.sessionsCompleted ?? 0,
    poker_score: base.pokerScore ?? null,
    coach_note_body: base.coachNote?.body ?? null,
    coach_note_focus: base.coachNote?.focus ?? null,
  };
  const { error } = await supabase
    .from('profiles').upsert(profile, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
  const skillRows = SKILL_KEYS.map((k) => ({
    user_id: uid,
    skill: k,
    ...(base.skills?.[k] ?? DEFAULT_SKILLS[k]),
  }));
  const { error: skillsErr } = await supabase
    .from('skills').upsert(skillRows, { onConflict: 'user_id,skill', ignoreDuplicates: true });
  if (skillsErr) throw skillsErr;
  const created = await fetchRemoteUser();
  // Migrated local play (guest session / pre-Supabase tester) has no sessions
  // rows, so the rebuilt scenarioHistory is empty — carry the local map so
  // this device doesn't re-deal hands they just played. Later loads rebuild
  // from rows only; a one-time possible repeat after that is accepted.
  if (created && base.scenarioHistory) {
    created.scenarioHistory = { ...base.scenarioHistory, ...created.scenarioHistory };
  }
  return created;
}

/** Persist post-session state (profile fields + all 8 skills). */
export async function saveRemoteUser(user) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return;
  const { error } = await supabase.from('profiles').update({
    streak: user.streak,
    last_session_date: user.lastSessionDate,
    rebuys: user.rebuys ?? 0,
    sessions_completed: user.sessionsCompleted,
    poker_score: user.pokerScore,
    coach_note_body: user.coachNote?.body ?? null,
    coach_note_focus: user.coachNote?.focus ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', uid);
  if (error) throw error;
  const skillRows = SKILL_KEYS.map((k) => ({ user_id: uid, skill: k, ...user.skills[k] }));
  const { error: skillsErr } = await supabase
    .from('skills').upsert(skillRows, { onConflict: 'user_id,skill' });
  if (skillsErr) throw skillsErr;
}

/**
 * Rename the signed-in user (once per week). The DB trigger
 * `username_change_limit` enforces the cooldown and owns username_changed_at;
 * a rejected rename surfaces here as err.code = 'rate_limited'.
 */
export async function updateDisplayName(username) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error('Not signed in');
  const { data, error } = await supabase.from('profiles').update({
    display_name: username,
    initials: username.slice(0, 2).toUpperCase(),
    updated_at: new Date().toISOString(),
  }).eq('id', uid).select('username_changed_at').single();
  if (error) {
    if (error.message?.includes('username_rate_limited')) {
      const err = new Error('Username was changed within the last week');
      err.code = 'rate_limited';
      throw err;
    }
    throw error;
  }
  return data;
}

/** Append one completed session to the history log. */
export async function recordSession({ difficulty, hands, correctCount, coachRead }) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return;
  const { error } = await supabase.from('sessions').insert({
    user_id: uid,
    difficulty,
    hands,
    correct_count: correctCount,
    coach_read: coachRead ?? null,
  });
  if (error) throw error;
}

/** Scenario grading disagreement ("Disagree?" chips) — insert-only, like feedback. */
export async function submitScenarioFeedback({ scenarioId, choice, result, reason }) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error('Not signed in');
  const { error } = await supabase.from('scenario_feedback').insert({
    user_id: uid,
    scenario_id: scenarioId,
    choice: choice ?? null,
    result,
    reason,
  });
  if (error) throw error;
}

/** Beta feedback — insert-only; founders read it with the service role. */
export async function submitFeedback(category, body) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error('Not signed in');
  const { error } = await supabase.from('feedback').insert({
    user_id: uid,
    category,
    body,
  });
  if (error) throw error;
}
