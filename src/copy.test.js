// ── CA-032: copy.js unit tests + source pins ──────────────────────────────────
import { activeDaysLine } from './copy';
const fs = require('fs');

test('activeDaysLine (dashboard, n set) leads with "New run"', () => {
  expect(activeDaysLine(12, { surface: 'dashboard' })).toBe(
    "New run — you've played 12 of the last 30 days."
  );
});

test('activeDaysLine (dashboard, n null) uses the every-session fallback', () => {
  expect(activeDaysLine(null, { surface: 'dashboard' })).toBe(
    'New run — every session rebuilds the streak.'
  );
});

test('activeDaysLine (summary, n set) trails with "One session starts the next run"', () => {
  expect(activeDaysLine(12, { surface: 'summary' })).toBe(
    "You've played 12 of the last 30 days. One session starts the next run."
  );
});

test('activeDaysLine (summary, n null) uses the keep-showing-up fallback', () => {
  expect(activeDaysLine(null, { surface: 'summary' })).toBe(
    "You keep showing up — that's what builds the read. One session starts the next run."
  );
});

// ── CA-032 source pins: neither surface hard-codes the consistency-record copy ─
// Wave 2 (MOD-003) moved the line's render site out of Dashboard.jsx and into
// dashboard/StreakStatus.jsx. Scanning only Dashboard.jsx would leave this pin
// passing while guarding nothing, so it sweeps the whole dashboard directory —
// and any file added there later is covered without touching this test.
const path = require('path');

const dashboardSources = () => {
  const dir = path.join(__dirname, 'components', 'dashboard');
  return [
    require.resolve('./components/Dashboard'),
    ...fs.readdirSync(dir).filter(f => /\.jsx$/.test(f)).map(f => path.join(dir, f)),
  ];
};

test('CA-032: no dashboard surface hard-codes the consistency-record line', () => {
  const files = dashboardSources();
  expect(files.length).toBeGreaterThan(1);   // the sweep actually found the split modules
  for (const f of files) {
    expect(`${path.basename(f)}: ${fs.readFileSync(f, 'utf8')}`).not.toMatch(/of the last 30 days/);
  }
});

test('CA-032: SessionSummary.jsx does not hard-code the consistency-record line', () => {
  const src = fs.readFileSync(require.resolve('./components/SessionSummary'), 'utf8');
  expect(src).not.toMatch(/of the last 30 days/);
});
