// MOD-003 (Wave 2): SkillLedger extracted from Dashboard.jsx.
//
// The FLIP animation was completely untested inside the monolith — jsdom
// reports every rect as 0×0 at 0,0, so the measurement path silently
// short-circuits and any regression in it looked green. Wave 2's ratchet is
// this file: Element.prototype.getBoundingClientRect is stubbed to hand back a
// real "before" position for the first sweep and a different "after" position
// on the second, which is the only way the dx/dy branch can be exercised.
import '@testing-library/jest-dom';
import { render, screen, act } from '@testing-library/react';
import SkillLedger from './SkillLedger';
import { SKILL_NAMES } from '../../data/constants';

const KEYS = Object.keys(SKILL_NAMES);
const MOVER = KEYS[0];

const allRated = (rating) =>
  Object.fromEntries(KEYS.map(k => [k, { rating, attempts: 10, correct: 5 }]));

const withOnePromoted = () => ({ ...allRated('yellow'), [MOVER]: { rating: 'green', attempts: 12, correct: 10 } });

// ── Rect stub: first KEYS.length reads are the "before" sweep ──────────────
const realRect = Element.prototype.getBoundingClientRect;
let rectCalls = 0;
const stubRects = () => {
  rectCalls = 0;
  Element.prototype.getBoundingClientRect = function () {
    const left = rectCalls++ < KEYS.length ? 300 : 0;
    return { left, top: 0, right: left, bottom: 0, width: 0, height: 0, x: left, y: 0, toJSON() {} };
  };
};

const setReducedMotion = (matches) => {
  window.matchMedia = jest.fn().mockReturnValue({
    matches, media: '', onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
  });
};

const pill = (key) => screen.getByText(SKILL_NAMES[key]);
// The rating class lives on the group HEAD, not the group wrapper — walk up to
// the wrapper so the pills row can be inspected.
const group = (rating) => document.querySelector(`.db-ledger-${rating}`)?.closest('.db-ledger-group');

afterEach(() => {
  Element.prototype.getBoundingClientRect = realRect;
  jest.useRealTimers();
});

// ── Static rendering ──────────────────────────────────────────────────────

test('groups render weakest-first with per-group counts', () => {
  render(<SkillLedger skills={allRated('red')} prevSkills={null} />);
  const heads = [...document.querySelectorAll('.db-ledger-name')].map(e => e.textContent);
  expect(heads).toEqual(['Weak', 'Work On', 'Strong']);   // Unrated hidden: nothing is gray
  expect(document.querySelector('.db-ledger-red .db-ledger-count')).toHaveTextContent(String(KEYS.length));
});

test('the Unrated row hides once every skill is rated, but empty dynamic rows stay', () => {
  render(<SkillLedger skills={allRated('yellow')} prevSkills={null} />);
  expect(screen.queryByText('Unrated')).not.toBeInTheDocument();
  expect(screen.getByText('Weak')).toBeInTheDocument();
  expect(screen.getByText('Strong')).toBeInTheDocument();
  expect(document.querySelectorAll('.db-ledger-empty').length).toBe(2); // Weak + Strong
});

test('an unrated skill lands in the gray group, which then renders', () => {
  render(<SkillLedger skills={{}} prevSkills={null} />);
  expect(screen.getByText('Unrated')).toBeInTheDocument();
});

test('with no prevSkills the ledger renders the current ratings immediately — no animation', () => {
  jest.useFakeTimers();
  setReducedMotion(false);
  render(<SkillLedger skills={withOnePromoted()} prevSkills={null} />);
  expect(document.querySelector('.db-ledger-green .db-ledger-count')).toHaveTextContent('1');
  expect(pill(MOVER)).not.toHaveClass(`db-pill-land-green`);
});

// ── FLIP measurement path ─────────────────────────────────────────────────

test('a promoted skill starts in its OLD group and flies to the new one', () => {
  jest.useFakeTimers();
  setReducedMotion(false);
  stubRects();
  render(<SkillLedger skills={withOnePromoted()} prevSkills={allRated('yellow')} />);

  // Mount renders the PREVIOUS ratings — the move has not happened yet
  expect(group('green').querySelector('.db-ledger-empty')).not.toBeNull();
  expect(group('yellow').querySelectorAll('.db-skill-pill').length).toBe(KEYS.length);

  act(() => { jest.advanceTimersByTime(1000); });   // first move fires at t=1000

  // Landed: the pill is now in Strong and wears the touchdown glow
  expect(document.querySelector('.db-ledger-green .db-ledger-count')).toHaveTextContent('1');
  expect(pill(MOVER)).toHaveClass('db-pill-land-green');
});

test('the mover gets the long FLIP transition and a lifted z-index, both cleaned up after', () => {
  jest.useFakeTimers();
  setReducedMotion(false);
  stubRects();
  render(<SkillLedger skills={withOnePromoted()} prevSkills={allRated('yellow')} />);
  act(() => { jest.advanceTimersByTime(1000); });

  const el = pill(MOVER);
  expect(el.style.transition).toContain('cubic-bezier');
  expect(el.style.zIndex).toBe('5');
  // The transform is applied then immediately released so the element animates
  // back to its real position — after the layout effect it must be empty.
  expect(el.style.transform).toBe('');

  act(() => { jest.advanceTimersByTime(600); });
  expect(el.style.transition).toBe('');
  expect(el.style.zIndex).toBe('');
});

test('non-movers that get pushed along animate on the short transition', () => {
  jest.useFakeTimers();
  setReducedMotion(false);
  stubRects();
  render(<SkillLedger skills={withOnePromoted()} prevSkills={allRated('yellow')} />);
  act(() => { jest.advanceTimersByTime(1000); });

  const bystander = pill(KEYS[1]);
  expect(bystander.style.transition).toBe('transform 0.3s ease');
  expect(bystander.style.zIndex).toBe('');
});

test('prefers-reduced-motion skips the measurement entirely but still updates the ledger', () => {
  jest.useFakeTimers();
  setReducedMotion(true);
  stubRects();
  render(<SkillLedger skills={withOnePromoted()} prevSkills={allRated('yellow')} />);
  act(() => { jest.advanceTimersByTime(1000); });

  expect(document.querySelector('.db-ledger-green .db-ledger-count')).toHaveTextContent('1');
  expect(pill(MOVER).style.transition).toBe('');
  expect(pill(MOVER).style.zIndex).toBe('');
});

test('the touchdown glow is cleared once the whole sequence finishes', () => {
  jest.useFakeTimers();
  setReducedMotion(false);
  stubRects();
  render(<SkillLedger skills={withOnePromoted()} prevSkills={allRated('yellow')} />);
  act(() => { jest.advanceTimersByTime(1000 + 1600); });
  expect(pill(MOVER)).not.toHaveClass('db-pill-land-green');
});

test('identical prev and current ratings schedule no animation at all', () => {
  jest.useFakeTimers();
  setReducedMotion(false);
  render(<SkillLedger skills={allRated('yellow')} prevSkills={allRated('yellow')} />);
  act(() => { jest.advanceTimersByTime(5000); });
  expect(document.querySelector('.db-pill-land-yellow')).toBeNull();
  expect(window.matchMedia).not.toHaveBeenCalled();
});
