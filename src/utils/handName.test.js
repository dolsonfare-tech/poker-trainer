// MOD-004 (Wave 2): getHandName extracted from ScenarioCard.jsx into
// src/utils/handName.js. Invariant rule 19 pins it single-file; these pin the
// output shape, including the CLAUDE.md ban on shorthand notation (KQs / 98d).
import getHandName from './handName';

const card = (r, s) => ({ r, s, c: '♥♦'.includes(s) ? 'red' : 'black' });

test('a pair is named as pocket rank, pluralized', () => {
  expect(getHandName([card('A', '♠'), card('A', '♥')])).toBe('Pocket Aces');
  expect(getHandName([card('2', '♠'), card('2', '♣')])).toBe('Pocket Twos');
  expect(getHandName([card('T', '♠'), card('T', '♦')])).toBe('Pocket Tens');
});

test('matching suits read as Suited', () => {
  expect(getHandName([card('K', '♥'), card('Q', '♥')])).toBe('King-Queen Suited');
});

test('mismatched suits read as Offsuit', () => {
  expect(getHandName([card('9', '♠'), card('8', '♦')])).toBe('Nine-Eight Offsuit');
});

test('rank order follows the card order it was dealt, not a re-sort', () => {
  expect(getHandName([card('7', '♠'), card('J', '♠')])).toBe('Seven-Jack Suited');
});

// The original form of this test asserted `not.toMatch(/^[AKQJT2-9]{2}[so]?$/)`,
// which no possible getHandName output can match — every branch returns a string
// containing "Pocket " or "-", so the assertion could never fail. Assert the
// POSITIVE shape instead: the output must be one of the two spoken forms, and
// every rank token must be a spoken word rather than a card character.
const SPOKEN_RANKS = ['Ace', 'King', 'Queen', 'Jack', 'Ten', 'Nine', 'Eight', 'Seven', 'Six', 'Five', 'Four', 'Three', 'Two'];

test('every rank pair produces a spoken name — never shorthand (CLAUDE.md: no KQs/98d)', () => {
  const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
  for (const r1 of ranks) {
    for (const r2 of ranks) {
      const name = getHandName([card(r1, '♠'), card(r2, '♥')]);
      expect(name).toMatch(/^(Pocket [A-Za-z]+s|[A-Za-z]+-[A-Za-z]+ (Suited|Offsuit))$/);
      const tokens = name.startsWith('Pocket ')
        ? [name.slice('Pocket '.length).replace(/s$/, '')]
        : name.split(' ')[0].split('-');
      // A missing RANK_NAMES entry surfaces here as 'undefined', not a silent pass.
      tokens.forEach(t => expect(SPOKEN_RANKS).toContain(t));
    }
  }
});
