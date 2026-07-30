// useAdvanceKey — the keyboard stand-in for the Next button (founder queue
// item 5, July 29 2026).
//
// CanvasLayout.test.js covers this through the canvas, where `active` is
// derived from feedback/peek/guideOpen. These are the unit-level guards for the
// hook's own contract: which keys it claims, which it leaves alone, and that it
// stops listening when it should. The teardown case is the one the canvas tests
// cannot see — a leaked window listener keeps advancing hands after the overlay
// is gone, and nothing else in the suite would notice.
import { renderHook } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { useAdvanceKey } from './useAdvanceKey';

const mount = (props) => {
  const onAdvance = jest.fn();
  const out = renderHook(
    ({ active }) => useAdvanceKey({ active, onAdvance }),
    { initialProps: { active: true, ...props } },
  );
  return { onAdvance, ...out };
};

const press = (key, init = {}, target = document.body) =>
  fireEvent.keyDown(target, { key, ...init });

test('space advances', () => {
  const { onAdvance } = mount();
  press(' ');
  expect(onAdvance).toHaveBeenCalledTimes(1);
});

test('enter advances', () => {
  const { onAdvance } = mount();
  press('Enter');
  expect(onAdvance).toHaveBeenCalledTimes(1);
});

test('an inactive hook claims nothing', () => {
  const { onAdvance } = mount({ active: false });
  press(' ');
  press('Enter');
  expect(onAdvance).not.toHaveBeenCalled();
});

test('other keys are left alone', () => {
  const { onAdvance } = mount();
  for (const k of ['a', 'Escape', 'ArrowRight', 'Tab']) press(k);
  expect(onAdvance).not.toHaveBeenCalled();
});

test('modified space and enter stay with the browser', () => {
  const { onAdvance } = mount();
  press(' ', { metaKey: true });
  press(' ', { ctrlKey: true });
  press('Enter', { altKey: true });
  press('Enter', { shiftKey: true });
  expect(onAdvance).not.toHaveBeenCalled();
});

// The browser already fires click on a focused button for Space/Enter, so
// claiming the key too would run both actions from one press.
test('a keypress aimed at a focused control is left to that control', () => {
  const { onAdvance } = mount();
  const btn = document.createElement('button');
  document.body.appendChild(btn);
  try {
    press(' ', {}, btn);
    expect(onAdvance).not.toHaveBeenCalled();
  } finally {
    btn.remove();
  }
});

test('space is prevented from scrolling the page while the hook is active', () => {
  mount();
  const e = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  document.body.dispatchEvent(e);
  expect(e.defaultPrevented).toBe(true);
});

test('going inactive stops the listening', () => {
  const { onAdvance, rerender } = mount();
  rerender({ active: false });
  press(' ');
  expect(onAdvance).not.toHaveBeenCalled();
});

test('unmounting removes the window listener', () => {
  const { onAdvance, unmount } = mount();
  unmount();
  press(' ');
  expect(onAdvance).not.toHaveBeenCalled();
});
