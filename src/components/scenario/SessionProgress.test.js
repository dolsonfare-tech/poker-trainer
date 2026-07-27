// MOD-004 (Wave 2): SessionProgress extracted from ScenarioCard.jsx.
// The index is 0-based internally and 1-based on screen — an off-by-one here
// tells the player they are on hand 0 of 8.
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import SessionProgress from './SessionProgress';

test('the hand number is displayed 1-based', () => {
  render(<SessionProgress currentIndex={0} total={8} correctCount={0} />);
  expect(screen.getByText('1')).toBeInTheDocument();
  expect(screen.getByText(/\/ 8/)).toBeInTheDocument();
});

test('the last hand reads as total-of-total, not total+1', () => {
  render(<SessionProgress currentIndex={7} total={8} correctCount={5} />);
  expect(document.querySelector('.session-progress')).toHaveTextContent('Hand 8 / 8');
});

test('the running tally is labelled "correct" (founder, July 8 — the honest-labeling rule covers per-hand grading, not the tally)', () => {
  render(<SessionProgress currentIndex={3} total={8} correctCount={2} />);
  expect(document.querySelector('.correct-count')).toHaveTextContent('2');
  expect(document.querySelector('.session-progress')).toHaveTextContent('2 correct');
});
