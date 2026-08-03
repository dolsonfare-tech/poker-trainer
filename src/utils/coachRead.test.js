// Coach's Read parsing: structured JSON with a legacy-prose fallback.
//
// MOD-001 (Wave 3): split out of userStorage.test.js alongside the source.
//
// The server's validator is pinned HERE, beside the client's parser, on purpose
// (v3, August 2 2026). They are the two ends of one wire format: normalizeCoachRead
// decides what may be stored, parseCoachRead decides what can be rendered, and a
// change to either that the other does not expect is invisible until a paid live
// call writes an unrenderable read into an append-only log. Three read
// generations now sit in that log at once, so the compatibility triple below is
// the real contract, not a nicety.
import { parseCoachRead } from './coachRead';
import { normalizeCoachRead, COACH_SCHEMA } from '../../api/coach-read';

// ── parseCoachRead (structured JSON with legacy-prose fallback) ──────────────
test('parseCoachRead reads a valid structured JSON read', () => {
  const raw = JSON.stringify({
    headline: 'You fold too much to river pressure',
    evidence: ['Folded top pair to the nit on K94r', 'Passed on a value raise vs the station'],
    watchFor: 'When a passive player checks the river, bet for value',
  });
  const out = parseCoachRead(raw);
  expect(out.legacy).toBeUndefined();
  expect(out.structured.headline).toMatch(/fold too much/);
  expect(out.structured.evidence).toHaveLength(2);
  expect(out.structured.watchFor).toMatch(/passive player/);
});

test('parseCoachRead treats prose as a legacy read', () => {
  const prose = 'You are folding too often against aggressive regulars. Tighten up.';
  expect(parseCoachRead(prose)).toEqual({ legacy: prose });
});

test('parseCoachRead falls back to legacy when JSON is not a read shape', () => {
  // Valid JSON, but not the coach-read object (no string headline)
  expect(parseCoachRead('[1,2,3]')).toEqual({ legacy: '[1,2,3]' });
  expect(parseCoachRead('{"foo":"bar"}')).toEqual({ legacy: '{"foo":"bar"}' });
  expect(parseCoachRead('42')).toEqual({ legacy: '42' });
});

test('parseCoachRead tolerates a structured read missing optional fields', () => {
  const out = parseCoachRead(JSON.stringify({ headline: 'Clean session, keep watching pot odds' }));
  expect(out.structured.headline).toMatch(/Clean session/);
  expect(out.structured.evidence).toEqual([]);
  expect(out.structured.watchFor).toBe('');
});

test('parseCoachRead returns null for empty or missing input', () => {
  expect(parseCoachRead(null)).toBeNull();
  expect(parseCoachRead('')).toBeNull();
  expect(parseCoachRead('   ')).toBeNull();
  expect(parseCoachRead(undefined)).toBeNull();
});

// ── normalizeCoachRead (api/coach-read.js) — the server's side of the wire ───
// v3 shape: two string fields, nothing else. Until now this validator's first
// execution was a paid live call, which is the same blind spot the eval
// harness's --selftest exists to close.

test('normalizeCoachRead accepts the v3 two-field read and re-serializes it', () => {
  const raw = JSON.stringify({
    headline: "You've been snap calling tight players a lot lately.",
    watchFor: 'A Tight Nit rarely bluffs, so make sure yours is strong.',
  });
  const out = JSON.parse(normalizeCoachRead(raw));
  expect(Object.keys(out)).toEqual(['headline', 'watchFor']);
  expect(out.headline).toMatch(/snap calling/);
  expect(out.watchFor).toMatch(/Tight Nit/);
});

test('normalizeCoachRead drops a stray evidence field rather than storing it', () => {
  // The schema forbids one upstream, so this is defence in depth: whatever
  // reaches the DB is canonical two-field JSON, and the notebook's legacy branch
  // is reserved for reads written BEFORE v3, not for new ones leaking a field.
  const raw = JSON.stringify({ headline: 'Aa bb.', evidence: ['cc'], watchFor: 'Dd ee.' });
  expect(JSON.parse(normalizeCoachRead(raw))).toEqual({ headline: 'Aa bb.', watchFor: 'Dd ee.' });
});

test('normalizeCoachRead passes malformed structured output through untouched', () => {
  // Passthrough is the graceful-degradation path: the client renders it as
  // prose. Swallowing it would turn a bad read into no read at all.
  const noWatchFor = JSON.stringify({ headline: 'Aa bb.' });
  expect(normalizeCoachRead(noWatchFor)).toBe(noWatchFor);

  const wrongType = JSON.stringify({ headline: 'Aa bb.', watchFor: ['Dd ee.'] });
  expect(normalizeCoachRead(wrongType)).toBe(wrongType);

  expect(normalizeCoachRead('[1,2,3]')).toBe('[1,2,3]');
});

test('normalizeCoachRead passes legacy prose through as itself', () => {
  const prose = 'You keep folding to river aggression from tight players.';
  expect(normalizeCoachRead(prose)).toBe(prose);
  expect(normalizeCoachRead('')).toBe('');
  expect(normalizeCoachRead(null)).toBeNull();
});

test('COACH_SCHEMA is the two-field v3 shape and cannot grow one silently', () => {
  // The founder's "numbers gone everywhere" call is only as real as
  // additionalProperties:false — without it the model may re-add the evidence
  // array it was told to stop writing, and every render path would show it.
  expect(Object.keys(COACH_SCHEMA.properties).sort()).toEqual(['headline', 'watchFor']);
  expect(COACH_SCHEMA.required.sort()).toEqual(['headline', 'watchFor']);
  expect(COACH_SCHEMA.additionalProperties).toBe(false);
});

// ── The compatibility triple ────────────────────────────────────────────────
// Three generations of read are alive in the append-only session log at once,
// and derived state means they are all re-read on every profile load. All three
// must render, with no migration, forever.

test('all three read generations render through parseCoachRead', () => {
  const v3 = parseCoachRead(JSON.stringify({
    headline: 'The clock has been making too many of your decisions for you.',
    watchFor: 'When the timer gets low, pick the safest line and commit.',
  }));
  expect(v3.structured.headline).toMatch(/The clock/);
  expect(v3.structured.watchFor).toMatch(/safest line/);
  // The forward-compatible default that made dropping the field a zero-migration
  // change: no evidence key on the wire renders as no bullets, not as a crash.
  expect(v3.structured.evidence).toEqual([]);

  const v2 = parseCoachRead(JSON.stringify({
    headline: 'Sharper stretch than the last one; calls still loose',
    evidence: ['20 of 50 this stretch, up from 10 of 50 before'],
    watchFor: 'Next time a raise crosses your mind, make it',
  }));
  expect(v2.structured.evidence).toHaveLength(1);
  expect(v2.structured.watchFor).toMatch(/raise crosses/);

  const legacy = parseCoachRead('You are folding too often against aggressive regulars.');
  expect(legacy.structured).toBeUndefined();
  expect(legacy.legacy).toMatch(/aggressive regulars/);
});

test('a normalized v3 read round-trips into the renderer', () => {
  // The join the card performs, end to end: what the server stores is what the
  // player reads as one paragraph.
  const stored = normalizeCoachRead(JSON.stringify({
    headline: "You've been snap calling tight players a lot lately.",
    watchFor: 'A Tight Nit rarely bluffs, so make sure yours is strong.',
  }));
  const { structured } = parseCoachRead(stored);
  expect([structured.headline, structured.watchFor].filter(Boolean).join(' '))
    .toBe("You've been snap calling tight players a lot lately. A Tight Nit rarely bluffs, so make sure yours is strong.");
});
