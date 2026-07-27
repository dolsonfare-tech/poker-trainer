// DifficultySelector — selection behaviour + the July 27 2026 glyph-rendering
// pins. The component had no test file before; these cover the parts a founder
// or tester actually reported on.
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import DifficultySelector from './DifficultySelector';
import { DIFFICULTY_LABELS } from '../data/constants';

const fs = require('fs');
const path = require('path');
const appCss = () => fs.readFileSync(path.join(__dirname, '..', 'App.css'), 'utf8');
const rule = (selector) => {
  const src = appCss();
  const i = src.indexOf(`\n${selector} {`);
  return i === -1 ? '' : src.slice(i, src.indexOf('\n}', i));
};

test('all three levels render, with Expert disabled', () => {
  render(<DifficultySelector onSelect={() => {}} />);
  expect(screen.getByText(DIFFICULTY_LABELS.beginner)).toBeInTheDocument();
  expect(screen.getByText(DIFFICULTY_LABELS.intermediate)).toBeInTheDocument();
  expect(screen.getByText(DIFFICULTY_LABELS.expert)).toBeInTheDocument();
  expect(document.querySelector('.ds-card.disabled')).toBeDisabled();
  expect(screen.getByText('Coming Soon')).toBeInTheDocument();
});

test('an unavailable initial difficulty falls back to beginner', () => {
  render(<DifficultySelector onSelect={() => {}} initialDifficulty="expert" />);
  const selected = document.querySelector('.ds-card.selected');
  expect(selected).toHaveTextContent(DIFFICULTY_LABELS.beginner);
});

test('a stored difficulty is preselected, and picking another moves the selection', () => {
  render(<DifficultySelector onSelect={() => {}} initialDifficulty="intermediate" />);
  expect(document.querySelector('.ds-card.selected')).toHaveTextContent(DIFFICULTY_LABELS.intermediate);
  fireEvent.click(screen.getByText(DIFFICULTY_LABELS.beginner));
  expect(document.querySelector('.ds-card.selected')).toHaveTextContent(DIFFICULTY_LABELS.beginner);
  expect(document.querySelectorAll('.ds-card.selected')).toHaveLength(1);
});

test('the disabled Expert card cannot be selected', () => {
  render(<DifficultySelector onSelect={() => {}} />);
  fireEvent.click(screen.getByText(DIFFICULTY_LABELS.expert));
  expect(document.querySelector('.ds-card.selected')).toHaveTextContent(DIFFICULTY_LABELS.beginner);
});

test('confirming reports the selected key, not the label', () => {
  const onSelect = jest.fn();
  render(<DifficultySelector onSelect={onSelect} initialDifficulty="intermediate" />);
  fireEvent.click(screen.getByText(/Start Session/));
  expect(onSelect).toHaveBeenCalledWith('intermediate');
});

// ── Glyph rendering pins (founder report, July 27 2026) ──────────────────────
// "The logos are blue-ish now." Nothing in the repo had changed — the .ds-*
// block was byte-identical to pre-audit — but `.ds-card-icon` declared neither
// a font-family nor a colour, so each platform picked for itself: Chromium
// painted the suits near-black via Arial, Apple fell back to Apple Color Emoji
// and painted them blue-grey. Unspecified rendering drifts with OS emoji
// updates, so these pin the two declarations that make it deterministic.

test('every level icon is a suit requesting TEXT presentation', () => {
  const src = fs.readFileSync(require.resolve('./DifficultySelector'), 'utf8');
  // ♣ / ♠ / ♦ — the Expert card's lightning bolt (U+26A1) was swapped for a
  // diamond on July 27 2026: it is emoji-by-default, so it rendered in colour
  // on Apple platforms no matter what the CSS said, and clashed with its
  // monochrome siblings. A suit also completes the set.
  // The source writes the selector as the escape text `︎`, so match the
  // literal characters rather than fighting regex escaping.
  for (const suit of ['♣', '♠', '♦']) {
    expect(src).toContain(`${suit}\\uFE0E`);
  }
  // No emoji-presentation codepoint may be used as a level icon again.
  const icons = [...src.matchAll(/icon: '([^']*)'/g)].map(m => m[1]);
  expect(icons).toHaveLength(3);
  for (const icon of icons) expect(icon).not.toMatch(/\p{Emoji_Presentation}/u);
});

test('.ds-card-icon declares an explicit font-family and colour', () => {
  // Strip comments first: the rule carries a long explanatory note that itself
  // names "Apple Color Emoji", which an unfiltered scan would read as the stack
  // naming an emoji font.
  const decl = rule('.ds-card-icon').replace(/\/\*[\s\S]*?\*\//g, '');
  const fontFamily = decl.match(/font-family:([^;]*);/)?.[1] ?? '';
  expect(fontFamily.trim()).not.toBe('');
  expect(decl).toMatch(/(^|\n)\s*color:/);
  // The stack must reach a monochrome suit font before any emoji font can claim
  // the glyph — so no emoji family may appear in it at all.
  expect(fontFamily).not.toMatch(/Emoji/i);
});

test('the icon follows its label into the selected (gold) state', () => {
  expect(appCss()).toMatch(/\.ds-card\.selected \.ds-card-icon\s*\{[^}]*color:\s*var\(--gold\)/);
});
