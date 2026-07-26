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

// spacedrep is imported for CONFIDENT_MISS_MS only — provide the real value
// so confidentMiss derivation inside decisionsPlayed works correctly.
jest.mock('./spacedrep', () => ({
  CONFIDENT_MISS_MS: 15000,
}));

import { fetchCoachRead } from './claude';

// ── Minimal sessionHistory fixture ───────────────────────────────────────────
// fetchCoachRead maps sessionHistory → decisionsPlayed payload before fetching.
// Each entry needs: scenario (with positions/options/correct/tag/villain/hand/tableContext)
// and choiceVal/result/decisionMs.

function makeHand({ result = 'correct', choiceVal = 'call', decisionMs = null } = {}) {
  return {
    scenario: {
      tag: 'potodds',
      villain: { label: 'Tight-Aggressive', notes: 'Solid regular.' },
      tableContext: null,
      hand: [{ r: 'A', s: '♠' }, { r: 'K', s: '♥' }],
      positions: [
        { state: 'hero', label: 'BTN' },
        { state: 'villain', label: 'CO' },
      ],
      options: [
        { val: 'fold', label: 'Fold', cls: 'fold' },
        { val: 'call', label: 'Call $10', cls: 'call' },
        { val: 'raise', label: 'Raise to $30', cls: 'raise' },
      ],
      correct: 'call',
    },
    choiceVal,
    result,
    decisionMs,
  };
}

const SESSION = [makeHand()];

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

  const result = await fetchCoachRead(SESSION);

  expect(result).toBe('Great session!');
  expect(mockTrack).toHaveBeenCalledTimes(1);
  expect(mockTrack).toHaveBeenCalledWith('coach_read_ok');
});

// ── !res.ok (e.g. 502) ────────────────────────────────────────────────────────

test('!res.ok: returns empty string (does NOT throw)', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: false, status: 502, json: {} })
  );

  const result = await fetchCoachRead(SESSION);

  expect(result).toBe('');
});

test('!res.ok: tracks coach_read_failed with reason:http and the status', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: false, status: 502, json: {} })
  );

  await fetchCoachRead(SESSION);

  expect(mockTrack).toHaveBeenCalledTimes(1);
  expect(mockTrack).toHaveBeenCalledWith('coach_read_failed', { reason: 'http', status: 502 });
});

test('!res.ok: carries the actual HTTP status in the tracking payload (503 variant)', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: false, status: 503, json: {} })
  );

  await fetchCoachRead(SESSION);

  expect(mockTrack).toHaveBeenCalledWith('coach_read_failed', { reason: 'http', status: 503 });
});

// ── data.text missing ─────────────────────────────────────────────────────────

test('missing data.text: returns empty string (does NOT throw)', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: true, status: 200, json: {} })  // no text field
  );

  const result = await fetchCoachRead(SESSION);

  expect(result).toBe('');
});

test('missing data.text: tracks coach_read_failed with reason:empty_response', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: true, status: 200, json: {} })
  );

  await fetchCoachRead(SESSION);

  expect(mockTrack).toHaveBeenCalledTimes(1);
  expect(mockTrack).toHaveBeenCalledWith('coach_read_failed', { reason: 'empty_response' });
});

test('empty string data.text: also returns empty string and tracks empty_response', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: true, status: 200, json: { text: '' } })
  );

  const result = await fetchCoachRead(SESSION);

  expect(result).toBe('');
  expect(mockTrack).toHaveBeenCalledWith('coach_read_failed', { reason: 'empty_response' });
});

// ── Network rejection ─────────────────────────────────────────────────────────

test('network rejection: THROWS (re-throws the fetch error)', async () => {
  const netErr = new TypeError('Failed to fetch');
  jest.spyOn(global, 'fetch').mockRejectedValue(netErr);

  await expect(fetchCoachRead(SESSION)).rejects.toThrow('Failed to fetch');
});

test('network rejection: tracks coach_read_failed with reason:network before throwing', async () => {
  const netErr = new TypeError('Failed to fetch');
  jest.spyOn(global, 'fetch').mockRejectedValue(netErr);

  await expect(fetchCoachRead(SESSION)).rejects.toThrow();

  expect(mockTrack).toHaveBeenCalledTimes(1);
  expect(mockTrack).toHaveBeenCalledWith('coach_read_failed', { reason: 'network' });
});

test('network rejection: re-throws the exact same error instance', async () => {
  const netErr = new TypeError('Failed to fetch');
  jest.spyOn(global, 'fetch').mockRejectedValue(netErr);

  let caught;
  try { await fetchCoachRead(SESSION); } catch (e) { caught = e; }

  expect(caught).toBe(netErr);
});

// ── 429 daily-limit ───────────────────────────────────────────────────────────
// This is a DISTINCT branch: throws an Error with err.code='daily_limit'.
// App.jsx catches it at err?.code === 'daily_limit' and sets coachLimited=true,
// which SessionSummary renders as the honest cap copy (not the generic fallback).

test('429: THROWS (does not return a value)', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: false, status: 429, json: {} })
  );

  await expect(fetchCoachRead(SESSION)).rejects.toThrow();
});

test('429: thrown error has err.code === "daily_limit"', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: false, status: 429, json: {} })
  );

  let caught;
  try { await fetchCoachRead(SESSION); } catch (e) { caught = e; }

  expect(caught).toBeInstanceOf(Error);
  expect(caught.code).toBe('daily_limit');
});

test('429: tracks coach_read_failed with reason:daily_limit', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    makeResponse({ ok: false, status: 429, json: {} })
  );

  await expect(fetchCoachRead(SESSION)).rejects.toThrow();

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
  try { returned = await fetchCoachRead(SESSION); } catch { threw = true; }

  expect(threw).toBe(true);
  expect(returned).toBeUndefined();
});
