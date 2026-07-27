// MOD-004 (Wave 2): ActionButtons extracted from ScenarioCard.jsx.
// The label split at the first "(" is what keeps the price detail on its own
// sub-line — a regression there crowds the verb and hurts the decision read.
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import ActionButtons from './ActionButtons';

const options = [
  { val: 'fold',  label: 'Fold',              cls: 'fold' },
  { val: 'call',  label: 'Call $12 (pot odds 3.2:1)', cls: 'call' },
  { val: 'raise', label: 'Raise to $40',      cls: 'raise' },
];

test('every option renders with its chip glyph', () => {
  render(<ActionButtons options={options} onDecision={() => {}} decided={false} />);
  expect(screen.getByText('✕')).toBeInTheDocument();
  expect(screen.getByText('=')).toBeInTheDocument();
  expect(screen.getByText('↑')).toBeInTheDocument();
});

test('an unknown class falls back to a neutral glyph rather than blank', () => {
  render(<ActionButtons options={[{ val: 'x', label: 'Check', cls: 'check' }]} onDecision={() => {}} decided={false} />);
  expect(screen.getByText('·')).toBeInTheDocument();
});

test('a parenthesised detail becomes the sub-line, not part of the verb', () => {
  render(<ActionButtons options={options} onDecision={() => {}} decided={false} />);
  expect(screen.getByText('Call $12')).toBeInTheDocument();
  expect(screen.getByText('pot odds 3.2:1')).toBeInTheDocument();
});

test('a label with no parenthesis renders whole, with no empty sub-line', () => {
  render(<ActionButtons options={[options[0]]} onDecision={() => {}} decided={false} />);
  expect(screen.getByText('Fold')).toBeInTheDocument();
  expect(document.querySelector('.sc2-btn-sub')).toBeNull();
});

test('clicking an option reports its val, not its label', () => {
  const onDecision = jest.fn();
  render(<ActionButtons options={options} onDecision={onDecision} decided={false} />);
  fireEvent.click(screen.getByText('Raise to $40'));
  expect(onDecision).toHaveBeenCalledWith('raise');
});

test('once decided every button is disabled — no double-submit', () => {
  const onDecision = jest.fn();
  render(<ActionButtons options={options} onDecision={onDecision} decided />);
  const buttons = [...document.querySelectorAll('.sc2-btn')];
  expect(buttons).toHaveLength(3);
  buttons.forEach(b => expect(b).toBeDisabled());
  fireEvent.click(buttons[0]);
  expect(onDecision).not.toHaveBeenCalled();
});
