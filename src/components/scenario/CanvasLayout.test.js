// MOD-004 (Wave 2): CanvasLayout extracted from ScenarioCard.jsx.
//
// Wave 2's ratchet for this file is a geometry smoke test. The e2e suite owns
// the real measured guards (a browser is the only place `.sc2-table` has a
// width); what this file pins is the STRUCTURE those guards depend on —
// `.sc2-stage` wrapping `.sc2-table`, the overlay living inside the stage, and
// the chrome never being pushed around by the combo pill. The `.sc2-table`
// width law in CLAUDE.md says a broken canvas renders as a vertical line while
// functional tests stay green; these assertions catch the nesting half of that
// failure, and only the screenshot/e2e step catches the CSS half.
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('../../utils/analytics', () => ({ track: jest.fn() }));

import CanvasLayout from './CanvasLayout';
import { track } from '../../utils/analytics';

const SEATS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

const scenario = (over = {}) => ({
  id: 'sc_test',
  tag: 'Pot Odds',
  pot: '$14',
  board: ['A♠', '7♦', '2♣'],
  hand: [{ r: 'K', s: '♥', c: 'red' }, { r: 'Q', s: '♥', c: 'red' }],
  villain: { label: 'Tight Nit' },
  correct: 'call',
  options: [
    { val: 'fold', label: 'Fold', cls: 'fold' },
    { val: 'call', label: 'Call $12', cls: 'call' },
  ],
  positions: SEATS.map((label) => ({
    label, action: 'Folds',
    state: label === 'BB' ? 'hero' : label === 'CO' ? 'active' : 'folded',
  })),
  ...over,
});

const layout = (props = {}) => {
  const s = props.scenario ?? scenario();
  return render(<CanvasLayout
    scenario={s} currentIndex={0} total={8}
    totalSeconds={60} correctCount={0}
    options={s.options} onDecision={() => {}} decided={false}
    showTimer={false} onTimeout={() => {}}
    feedback={null} timedOut={false} onNext={() => {}} nextLabel="Next hand"
    {...props} />);
};

beforeEach(() => { jest.clearAllMocks(); });

// ── Geometry / structure smoke ─────────────────────────────────────────────

test('the canvas renders without crashing and keeps the stage → table nesting', () => {
  layout();
  const stage = document.querySelector('.sc2-stage');
  expect(stage).not.toBeNull();
  // The `.sc2-table` width law: the table must be a direct child of the stage.
  // If this nesting changes, the explicit width:100% in App.css no longer
  // applies to the collapsing grid item and the felt renders as a line.
  expect(stage.querySelector(':scope > .sc2-table')).not.toBeNull();
});

test('every canvas region renders exactly once', () => {
  layout();
  for (const sel of ['.sc2-chrome', '.street-bar', '.sc2-stage', '.sc2-table',
                     '.sc2-villain-mobile', '.sc2-history', '.st-ticker', '.sc2-actions']) {
    expect(document.querySelectorAll(sel)).toHaveLength(1);
  }
});

test('the skill tag and progress live in the chrome, above the stage', () => {
  layout();
  expect(document.querySelector('.sc2-chrome')).toHaveTextContent('Pot Odds');
  expect(document.querySelector('.sc2-chrome .session-progress')).toHaveTextContent('Hand 1 / 8');
});

// ── Chrome behaviour ───────────────────────────────────────────────────────

test('the combo pill only appears from two in a row, and stays inside the chrome', () => {
  layout({ combo: 1 });
  expect(document.querySelector('.sc2-combo')).toBeNull();
  layout({ combo: 3 });
  expect(document.querySelector('.sc2-chrome .sc2-combo')).toHaveTextContent('3 in a row');
});

test('the timer renders only when the caller asks for it', () => {
  layout();
  expect(document.querySelector('svg')).toBeNull();
  layout({ showTimer: true });
  expect(screen.getByText('60')).toBeInTheDocument();
});

test('a resurfaced miss is labelled honestly, and a confident miss gets its own line', () => {
  layout({ scenario: scenario({ replay: true }) });
  expect(screen.getByText(/You missed this one before/)).toBeInTheDocument();

  layout({ scenario: scenario({ replay: true, confidentMiss: true }) });
  expect(screen.getByText(/You answered this fast last time/)).toBeInTheDocument();
});

// ── Feedback overlay + peek ────────────────────────────────────────────────

test('with no feedback there is no overlay, and the action buttons are live', () => {
  layout();
  expect(document.querySelector('.sc2-overlay')).toBeNull();
  expect(document.querySelectorAll('.sc2-btn')).toHaveLength(2);
});

test('the overlay mounts inside the stage so it covers the felt, not the page', () => {
  layout({ feedback: { grade: 'correct', loading: false, text: 'Right price.', choice: 'call' }, decided: true });
  expect(document.querySelector('.sc2-stage > .sc2-overlay')).not.toBeNull();
  expect(document.querySelector('.sc2-actions')).toBeNull();   // decided hides the buttons
});

test('peeking lifts the overlay, hides it from assistive tech, and tracks the event', () => {
  layout({ feedback: { grade: 'incorrect', loading: false, text: 'Too thin.', choice: 'fold' }, decided: true });
  fireEvent.click(screen.getByText(/Show table/));

  const overlay = document.querySelector('.sc2-overlay');
  expect(overlay).toHaveClass('sc2-overlay-peek');
  expect(overlay).toHaveAttribute('aria-hidden', 'true');
  expect(track).toHaveBeenCalledWith('table_peeked', { scenario_id: 'sc_test' });

  fireEvent.click(screen.getByText(/Back to analysis/));
  expect(document.querySelector('.sc2-overlay')).not.toHaveClass('sc2-overlay-peek');
});

test('the Next button waits for the coach text to finish loading', () => {
  layout({ feedback: { grade: 'correct', loading: true, text: '', choice: 'call' }, decided: true });
  expect(document.querySelector('.next-btn')).toBeNull();
  layout({ feedback: { grade: 'correct', loading: false, text: 'Right price.', choice: 'call' }, decided: true });
  expect(screen.getByText('Next hand')).toBeInTheDocument();
});

// ── Villain strip ──────────────────────────────────────────────────────────

test('the mobile villain strip carries the same read as the felt bubble', () => {
  layout();
  const strip = document.querySelector('.sc2-villain-mobile');
  expect(strip).toHaveTextContent('Tight Nit');
  expect(strip).toHaveTextContent('acts after you, every street');
});

test('the strip becomes tappable only when a guide handler exists', () => {
  layout();
  expect(document.querySelector('.sc2-strip')).not.toHaveClass('sc2-strip-tappable');

  const onVillainInfo = jest.fn();
  layout({ onVillainInfo });
  fireEvent.click(document.querySelector('.sc2-strip-tappable'));
  expect(onVillainInfo).toHaveBeenCalledWith('Tight Nit');
});
