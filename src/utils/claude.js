import { supabase, hasSupabase } from './supabase';
import { track } from './analytics';

export async function fetchCoachRead(sessionHistory) {
  // One entry per hand actually played, with the per-hand result — NOT the
  // per-skill deduped skillResults (two hands sharing a skill would misreport
  // the earlier one). chose vs correctAction lets the coach see the direction
  // of each mistake (too passive vs too aggressive), not just right/wrong.
  const decisionsPlayed = sessionHistory.map(h => {
    const s = h.scenario;
    const hero = s.positions.find(p => p.state === 'hero');
    const choseOpt = s.options.find(o => o.val === h.choiceVal);
    const correctOpt = s.options.find(o => o.val === s.correct);
    return {
      scenario: s.tag,
      villain: s.villain.label,
      villainNotes: s.villain.notes,
      tableContext: s.tableContext || null,
      hand: s.hand.map(c => c.r + c.s).join(''),
      position: hero ? hero.label : '',
      chose: choseOpt ? choseOpt.label : 'Timed out (no action)',
      correctAction: correctOpt ? correctOpt.label : '',
      result: h.result,
    };
  });

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
