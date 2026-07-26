import '@testing-library/jest-dom';
import { render, fireEvent } from '@testing-library/react';
import VillainGuide from './VillainGuide';

it('closes on Escape', () => {
  const onClose = jest.fn();
  render(<VillainGuide onClose={onClose} />);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('does not close on other keys', () => {
  const onClose = jest.fn();
  render(<VillainGuide onClose={onClose} />);
  fireEvent.keyDown(document, { key: 'Enter' });
  expect(onClose).not.toHaveBeenCalled();
});
