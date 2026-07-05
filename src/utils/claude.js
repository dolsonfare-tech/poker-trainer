import { supabase, hasSupabase } from './supabase';
import { track } from './analytics';

export async function fetchCoachRead(shuffledScenarios, skillResults, lastIndex) {
  const decisionsPlayed = shuffledScenarios.slice(0, lastIndex + 1).map(s => ({
    scenario: s.tag,
    villain: s.villain.label,
    villainNotes: s.villain.notes,
    tableContext: s.tableContext || null,
    skill: s.skill,
    result: skillResults[s.skill] || 'unknown',
  }));

  // The endpoint requires a signed-in user (per-user daily cap server-side)
  const headers = { 'Content-Type': 'application/json' };
  if (hasSupabase) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  // The UI shows a graceful fallback on any failure, which once hid a dead
  // endpoint for weeks — so every non-success path gets tracked explicitly.
  let res;
  try {
    res = await fetch('/api/coach-read', {
      method: 'POST',
      headers,
      body: JSON.stringify({ decisionsPlayed }),
    });
  } catch (err) {
    track('coach_read_failed', { reason: 'network' });
    throw err;
  }

  if (!res.ok) {
    track('coach_read_failed', { reason: 'http', status: res.status });
    return '';
  }
  const data = await res.json();
  if (!data.text) {
    track('coach_read_failed', { reason: 'empty_response' });
    return '';
  }
  track('coach_read_ok');
  return data.text;
}
