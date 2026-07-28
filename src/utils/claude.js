import { supabase, hasSupabase } from './supabase';
import { CONFIDENT_MISS_MS } from './spacedrep';
import { emitCoachReadFailed, emitCoachReadOk } from './events';

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
      // Fast + wrong ≈ a confident miss (F2): the highest-leverage coaching
      // moment — the leak they don't know they have. A timeout is slow-wrong,
      // never confident (decisionMs null).
      confidentMiss: h.result === 'incorrect'
        && typeof h.decisionMs === 'number' && h.decisionMs > 0 && h.decisionMs <= CONFIDENT_MISS_MS,
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
    emitCoachReadFailed('network');
    throw err;
  }

  if (res.status === 429) {
    // Daily cap (DAILY_LIMIT in api/coach-read.js) — surfaced honestly in the
    // summary instead of the generic fallback, which reads as a broken feature.
    emitCoachReadFailed('daily_limit');
    const err = new Error('Daily coach limit reached');
    err.code = 'daily_limit';
    throw err;
  }
  if (!res.ok) {
    emitCoachReadFailed('http', res.status);
    return '';
  }
  const data = await res.json();
  if (!data.text) {
    emitCoachReadFailed('empty_response');
    return '';
  }
  emitCoachReadOk();
  return data.text;
}
