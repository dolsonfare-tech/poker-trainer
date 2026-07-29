import { supabase, hasSupabase } from './supabase';
import { emitCoachReadFailed, emitCoachReadOk } from './events';

export async function fetchCoachRead() {
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
      // No payload by design: the server builds the window from the
      // append-only log itself, so there is nothing here for a client to
      // inflate or fabricate (CA-001).
      body: '{}',
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
