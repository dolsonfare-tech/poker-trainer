// Supabase reads/writes for user data. The in-memory user object keeps the
// exact userStorage.js shape, so the rest of the app doesn't know or care
// whether it came from localStorage or the database.
import { supabase } from './supabase';
import { DEFAULT_SKILLS, deriveSchema, createUser } from './userStorage';

const SKILL_KEYS = Object.keys(DEFAULT_SKILLS);

function assembleUser(profile, skillRows) {
  const skills = Object.fromEntries(
    SKILL_KEYS.map((k) => {
      const row = skillRows.find((r) => r.skill === k);
      return [k, row
        ? { rating: row.rating, attempts: row.attempts, correct: Number(row.correct) }
        : { ...DEFAULT_SKILLS[k] }];
    })
  );
  return {
    displayName: profile.display_name,
    initials: profile.initials,
    streak: profile.streak,
    lastSessionDate: profile.last_session_date,
    sessionsCompleted: profile.sessions_completed,
    skills,
    schema: deriveSchema(skills, profile.sessions_completed),
    pokerScore: profile.poker_score,
    coachNote: profile.coach_note_body
      ? { body: profile.coach_note_body, focus: profile.coach_note_focus }
      : null,
    leaderboard: null,
  };
}

/** Signed-in user's profile + skills, or null when no profile row exists yet. */
export async function fetchRemoteUser() {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;
  const { data: profile, error } = await supabase
    .from('profiles').select('*').eq('id', uid).maybeSingle();
  if (error) throw error;
  if (!profile) return null;
  const { data: skillRows, error: skillsErr } = await supabase
    .from('skills').select('*').eq('user_id', uid);
  if (skillsErr) throw skillsErr;
  return assembleUser(profile, skillRows ?? []);
}

/**
 * First sign-in: create the profile + skill rows. When a pre-Supabase
 * localStorage profile exists, its history migrates so testers keep progress.
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
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    sessions_completed: base.sessionsCompleted ?? 0,
    poker_score: base.pokerScore ?? null,
    coach_note_body: base.coachNote?.body ?? null,
    coach_note_focus: base.coachNote?.focus ?? null,
  };
  const { error } = await supabase.from('profiles').upsert(profile);
  if (error) throw error;
  const skillRows = SKILL_KEYS.map((k) => ({
    user_id: uid,
    skill: k,
    ...(base.skills?.[k] ?? DEFAULT_SKILLS[k]),
  }));
  const { error: skillsErr } = await supabase
    .from('skills').upsert(skillRows, { onConflict: 'user_id,skill' });
  if (skillsErr) throw skillsErr;
  return fetchRemoteUser();
}

/** Persist post-session state (profile fields + all 8 skills). */
export async function saveRemoteUser(user) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return;
  const { error } = await supabase.from('profiles').update({
    streak: user.streak,
    last_session_date: user.lastSessionDate,
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
