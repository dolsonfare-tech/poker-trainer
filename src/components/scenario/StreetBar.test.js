// MOD-004 (Wave 2): StreetBar extracted from ScenarioCard.jsx.
// The board length → street mapping is the whole component; a 5-card board is
// the river, and 1/2-card boards can't happen in Hold'em (they collapse to the
// river branch by design rather than rendering a bogus street).
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import StreetBar from './StreetBar';

const current = () => document.querySelector('.street-current')?.textContent;
const past = () => [...document.querySelectorAll('.street-past')].map(e => e.textContent);

test('an empty board is Preflop, with nothing behind it', () => {
  render(<StreetBar boardLength={0} />);
  expect(current()).toBe('Preflop');
  expect(past()).toEqual([]);
});

test('three cards is the Flop, Preflop behind it', () => {
  render(<StreetBar boardLength={3} />);
  expect(current()).toBe('Flop');
  expect(past()).toEqual(['Preflop']);
});

test('four cards is the Turn', () => {
  render(<StreetBar boardLength={4} />);
  expect(current()).toBe('Turn');
  expect(past()).toEqual(['Preflop', 'Flop']);
});

test('five cards is the River, every earlier street behind it', () => {
  render(<StreetBar boardLength={5} />);
  expect(current()).toBe('River');
  expect(past()).toEqual(['Preflop', 'Flop', 'Turn']);
});

test('all four streets always render, so the bar never reflows mid-hand', () => {
  render(<StreetBar boardLength={3} />);
  expect(document.querySelectorAll('.street-pip')).toHaveLength(4);
});
