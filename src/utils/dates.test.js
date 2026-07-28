// ── CA-028: dates.js unit tests + source pins ─────────────────────────────────
import { toLocalDateString, localDateFrom, formatShortDate } from './dates';
const fs = require('fs');

// ── toLocalDateString ─────────────────────────────────────────────────────────

test('toLocalDateString formats a Date as YYYY-MM-DD in local time', () => {
  // Use a fixed local date to avoid UTC-offset flakiness
  const d = new Date(2026, 6, 25); // July 25 2026, local midnight
  expect(toLocalDateString(d)).toBe('2026-07-25');
});

test('toLocalDateString zero-pads month and day', () => {
  const d = new Date(2026, 0, 5); // Jan 5 2026
  expect(toLocalDateString(d)).toBe('2026-01-05');
});

// ── localDateFrom ─────────────────────────────────────────────────────────────

test('localDateFrom converts an ISO timestamp to local YYYY-MM-DD', () => {
  // Use local midnight so the result is unambiguous regardless of host timezone
  const iso = new Date(2026, 6, 18).toISOString();
  expect(localDateFrom(iso)).toBe('2026-07-18');
});

test('localDateFrom returns null for falsy input', () => {
  expect(localDateFrom(null)).toBeNull();
  expect(localDateFrom(undefined)).toBeNull();
  expect(localDateFrom('')).toBeNull();
});

test('localDateFrom returns null for an unparseable string', () => {
  expect(localDateFrom('not-a-date')).toBeNull();
});

test('localDateFrom accepts a Date object directly', () => {
  const d = new Date(2026, 11, 1); // Dec 1 2026
  expect(localDateFrom(d)).toBe('2026-12-01');
});

// ── formatShortDate ────────────────────────────────────────────────────────────

test('formatShortDate formats a YYYY-MM-DD string without a UTC shift', () => {
  expect(formatShortDate('2026-07-18')).toBe(
    new Date(2026, 6, 18).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  );
});

test('formatShortDate formats a Date object', () => {
  const d = new Date(2026, 6, 18);
  expect(formatShortDate(d)).toBe(
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  );
});

test('formatShortDate returns the input unchanged for an unparseable string', () => {
  expect(formatShortDate('not-a-date')).toBe('not-a-date');
  expect(formatShortDate('')).toBe('');
});

// ── CA-028 source pin ─────────────────────────────────────────────────────────
// The companion pin on userStorage.js is gone: that file was deleted when the
// MOD-001 barrel was removed, and a deleted file cannot redefine anything. The
// general guarantee now lives in check-invariants.mjs rule 27 ('dates-owner'),
// which covers EVERY src file rather than the two that had already gone wrong.

test('CA-028: spacedrep.js does not define localDateFrom (imports from dates.js)', () => {
  const src = fs.readFileSync(require.resolve('./spacedrep'), 'utf8');
  expect(src).not.toMatch(/function\s+localDateFrom\b/);
  expect(src).not.toMatch(/const\s+localDateFrom\s*=/);
});

// ── CA-037 source pin: Dashboard's two inline formatters are gone ─────────────
// Wave 2 (MOD-003) moved both call sites into dashboard/CoachNotebook.jsx and
// dashboard/UsernameEditor.jsx. The pin sweeps the whole dashboard directory so
// it can't be satisfied by an empty Dashboard.jsx, and so new files added there
// inherit the rule automatically.

test('CA-037: no dashboard surface defines fmtReadDate or an inline fmtDate (they import formatShortDate)', () => {
  const path = require('path');
  const dir = path.join(__dirname, '..', 'components', 'dashboard');
  const files = [
    require.resolve('../components/Dashboard'),
    ...fs.readdirSync(dir).filter(f => /\.jsx$/.test(f)).map(f => path.join(dir, f)),
  ];
  expect(files.length).toBeGreaterThan(1);   // the sweep actually found the split modules
  for (const f of files) {
    const src = `${path.basename(f)}: ${fs.readFileSync(f, 'utf8')}`;
    expect(src).not.toMatch(/function\s+fmtReadDate\b/);
    expect(src).not.toMatch(/const\s+fmtDate\s*=/);
  }
});
