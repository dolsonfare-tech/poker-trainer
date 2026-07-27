// Coach's Read parsing: structured JSON with a legacy-prose fallback.
//
// MOD-001 (Wave 3): split out of userStorage.test.js alongside the source.
import { parseCoachRead } from './coachRead';

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
