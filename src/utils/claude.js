import { supabase, hasSupabase } from './supabase';

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

  const res = await fetch('/api/coach-read', {
    method: 'POST',
    headers,
    body: JSON.stringify({ decisionsPlayed }),
  });

  if (!res.ok) return '';
  const data = await res.json();
  return data.text || '';
}
