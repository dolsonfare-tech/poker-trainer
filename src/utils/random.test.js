// ── CA-029: random.js unit tests + source pins ────────────────────────────────
import { shuffle } from './random';
const fs = require('fs');

test('shuffle returns all input elements, in some order', () => {
  const input = [1, 2, 3, 4, 5];
  const out = shuffle(input);
  expect(out).toHaveLength(input.length);
  expect([...out].sort()).toEqual(input);
});

test('shuffle does not mutate the input array', () => {
  const input = [1, 2, 3, 4, 5];
  const copy = [...input];
  shuffle(input);
  expect(input).toEqual(copy);
});

// ── CA-029 source pins: neither former copy defines shuffle anymore ────────────

test('CA-029: spacedrep.js does not define shuffle (imports from random.js)', () => {
  const src = fs.readFileSync(require.resolve('./spacedrep'), 'utf8');
  expect(src).not.toMatch(/function\s+shuffle\b/);
});

test('CA-029: TableReads.jsx does not define shuffle (imports from random.js)', () => {
  const src = fs.readFileSync(require.resolve('../components/TableReads'), 'utf8');
  expect(src).not.toMatch(/function\s+shuffle\b/);
});
