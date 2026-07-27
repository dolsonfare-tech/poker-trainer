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

// ── CA-028 source pins: neither source file defines the function anymore ───────

test('CA-028: userStorage.js does not define toLocalDateString (re-export only)', () => {
  const src = fs.readFileSync(require.resolve('./userStorage'), 'utf8');
  // A definition looks like `function toLocalDateString` or `const toLocalDateString =`
  // A re-export line (`export { toLocalDateString }` or `export { toLocalDateString } from`) does NOT match
  expect(src).not.toMatch(/function\s+toLocalDateString\b/);
  expect(src).not.toMatch(/const\s+toLocalDateString\s*=/);
});

test('CA-028: spacedrep.js does not define localDateFrom (imports from dates.js)', () => {
  const src = fs.readFileSync(require.resolve('./spacedrep'), 'utf8');
  expect(src).not.toMatch(/function\s+localDateFrom\b/);
  expect(src).not.toMatch(/const\s+localDateFrom\s*=/);
});

// ── CA-037 source pin: Dashboard.jsx's two inline formatters are gone ──────────

test('CA-037: Dashboard.jsx does not define fmtReadDate or an inline fmtDate (imports formatShortDate)', () => {
  const src = fs.readFileSync(require.resolve('../components/Dashboard'), 'utf8');
  expect(src).not.toMatch(/function\s+fmtReadDate\b/);
  expect(src).not.toMatch(/const\s+fmtDate\s*=/);
});
