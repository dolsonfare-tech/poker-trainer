// CA-055: pin fetchCoachRead's non-happy-path error branches.
//
// The endpoint 404'd silently for weeks behind a graceful fallback (real prod
// incident).  These tests lock in the ACTUAL return shape and PostHog tracking
// for every branch so a future regression surfaces immediately.
//
// Branch contracts (read from claude.js directly — do not invent):
//   network rejection → THROWS (re-throws); reason 'network'
//   429              → THROWS Error with err.code='daily_limit'; reason 'daily_limit'
//   !res.ok (e.g. 502) → returns '' (empty string); reason 'http' + status
//   data.text falsy  → returns '' ; reason 'empty_response'
//   happy path       → returns data.text (string); tracks 'coach_read_ok'

// ── Mocks ────────────────────────────────────────────────────────────────────

// analytics mock — matches the single-file ownership invariant
const mockTrack = jest.fn();
jest.mock('./analytics', () => ({
  track: (...args) => mockTrack(...args),
}));

// supabase mock — the module owns its own client; tests just need hasSupabase
// false so the auth-header path is skipped (not under test here).
jest.mock('./supabase', () => ({
  get supabase() { return null; },
  hasSupabase: false,
}));

import { fetchCoachRead } from './claude';

// No sessionHistory fixture any more: fetchCoachRead takes no arguments and
// sends no payload. The server builds the window from the append-only log, so
// there is nothing left on the client to shape into a request body.

// ── Helpers ───────────────────────────────────────────────────────────────────

// Build a minimal Response-like object that fetch can resolve to.
function makeResponse({ ok, status, json }) {
  return {
    ok,
    status,
    json: () => Promise.resolve(json),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Happy path ────────────────────────────────────────────────────────────────

test('happy path: returns data.text and tracks coach_read_ok', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: true, status: 200, json: { text: 'Great session!' } })
  );

  const result = await fetchCoachRead();

  expect(result).toBe('Great session!');
  expect(mockTrack).toHaveBeenCalledTimes(1);
  expect(mockTrack).toHaveBeenCalledWith('coach_read_ok');
});

// ── The request itself ───────────────────────────────────────────────────────

test('the client sends no payload — the server builds the window itself', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: true, status: 200, json: { text: 'read' } })
  );

  await fetchCoachRead();

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/coach-read');
  expect(init.method).toBe('POST');
  // The body carries no hand data at all: anything here would be client-trusted
  // input the server must not depend on (CA-001).
  expect(JSON.parse(init.body || '{}')).toEqual({});
});

// ── !res.ok (e.g. 502) ────────────────────────────────────────────────────────

test('!res.ok: returns empty string (does NOT throw)', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: false, status: 502, json: {} })
  );

  const result = await fetchCoachRead();

  expect(result).toBe('');
});

test('!res.ok: tracks coach_read_failed with reason:http and the status', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: false, status: 502, json: {} })
  );

  await fetchCoachRead();

  expect(mockTrack).toHaveBeenCalledTimes(1);
  expect(mockTrack).toHaveBeenCalledWith('coach_read_failed', { reason: 'http', status: 502 });
});

test('!res.ok: carries the actual HTTP status in the tracking payload (503 variant)', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: false, status: 503, json: {} })
  );

  await fetchCoachRead();

  expect(mockTrack).toHaveBeenCalledWith('coach_read_failed', { reason: 'http', status: 503 });
});

// ── data.text missing ─────────────────────────────────────────────────────────

test('missing data.text: returns empty string (does NOT throw)', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: true, status: 200, json: {} })  // no text field
  );

  const result = await fetchCoachRead();

  expect(result).toBe('');
});

test('missing data.text: tracks coach_read_failed with reason:empty_response', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: true, status: 200, json: {} })
  );

  await fetchCoachRead();

  expect(mockTrack).toHaveBeenCalledTimes(1);
  expect(mockTrack).toHaveBeenCalledWith('coach_read_failed', { reason: 'empty_response' });
});

test('empty string data.text: also returns empty string and tracks empty_response', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: true, status: 200, json: { text: '' } })
  );

  const result = await fetchCoachRead();

  expect(result).toBe('');
  expect(mockTrack).toHaveBeenCalledWith('coach_read_failed', { reason: 'empty_response' });
});

// ── Network rejection ─────────────────────────────────────────────────────────

test('network rejection: THROWS (re-throws the fetch error)', async () => {
  const netErr = new TypeError('Failed to fetch');
  jest.spyOn(global, 'fetch').mockRejectedValue(netErr);

  await expect(fetchCoachRead()).rejects.toThrow('Failed to fetch');
});

test('network rejection: tracks coach_read_failed with reason:network before throwing', async () => {
  const netErr = new TypeError('Failed to fetch');
  jest.spyOn(global, 'fetch').mockRejectedValue(netErr);

  await expect(fetchCoachRead()).rejects.toThrow();

  expect(mockTrack).toHaveBeenCalledTimes(1);
  expect(mockTrack).toHaveBeenCalledWith('coach_read_failed', { reason: 'network' });
});

test('network rejection: re-throws the exact same error instance', async () => {
  const netErr = new TypeError('Failed to fetch');
  jest.spyOn(global, 'fetch').mockRejectedValue(netErr);

  let caught;
  try { await fetchCoachRead(); } catch (e) { caught = e; }

  expect(caught).toBe(netErr);
});

// ── 429 daily-limit ───────────────────────────────────────────────────────────
// This is a DISTINCT branch: throws an Error with err.code='daily_limit'.
// utils/session.js:submitSession catches it at err?.code === 'daily_limit' and
// returns limited:true; useSessionRun holds that as coachLimited and the
// Dashboard read strip renders the honest cap copy (LastSessionRead).
//
// This comment named App.jsx and SessionSummary until July 29 2026 — both were
// correct before Wave 3 moved the consumer into useSessionRun and Phase A took
// the read off the summary. It went stale describing the exact hop that was
// silently missing: nothing read `limited` at all until queue item 6.

test('429: THROWS (does not return a value)', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: false, status: 429, json: {} })
  );

  await expect(fetchCoachRead()).rejects.toThrow();
});

test('429: thrown error has err.code === "daily_limit"', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: false, status: 429, json: {} })
  );

  let caught;
  try { await fetchCoachRead(); } catch (e) { caught = e; }

  expect(caught).toBeInstanceOf(Error);
  expect(caught.code).toBe('daily_limit');
});

test('429: tracks coach_read_failed with reason:daily_limit', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: false, status: 429, json: {} })
  );

  await expect(fetchCoachRead()).rejects.toThrow();

  expect(mockTrack).toHaveBeenCalledTimes(1);
  expect(mockTrack).toHaveBeenCalledWith('coach_read_failed', { reason: 'daily_limit' });
});

// ── Contract boundary: 429 is NOT handled as generic !res.ok ─────────────────
// 429 must be checked BEFORE !res.ok so the daily-limit throw wins.
// Verify: a 429 does NOT return '' (it throws instead).

test('429 does NOT silently return empty string — it throws, distinguishing cap from error', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: false, status: 429, json: {} })
  );

  let returned;
  let threw = false;
  try { returned = await fetchCoachRead(); } catch { threw = true; }

  expect(threw).toBe(true);
  expect(returned).toBeUndefined();
});
