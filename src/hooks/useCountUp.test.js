// MOD-003 (Wave 2): useCountUp extracted from Dashboard.jsx.
// The load-bearing property is the from === to identity — the dashboard mounts
// without a sessionDelta on every ordinary visit, and in that case the first
// synchronous render must already show the honest number (CA-039 depends on it).
import { renderHook, act } from '@testing-library/react';
import useCountUp from './useCountUp';

describe('useCountUp', () => {
  afterEach(() => { jest.useRealTimers(); });

  test('from === to renders the value statically — no animation, no delay', () => {
    const { result } = renderHook(() => useCountUp(42, 42, 700, 500));
    expect(result.current).toBe(42);
  });

  test('from !== to starts at `from` and does not move before the delay elapses', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useCountUp(10, 0, 900, 300));
    expect(result.current).toBe(0);
    act(() => { jest.advanceTimersByTime(299); });
    expect(result.current).toBe(0);
  });

  test('after the delay the animation runs and lands exactly on `to`', () => {
    jest.useFakeTimers();
    // Drive rAF manually, one frame per call, with the clock jumping past
    // `duration` on the second frame so the ease clamps at p === 1.
    let ts = 0;
    const rafSpy = jest.spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => { ts += 1000; if (ts <= 3000) cb(ts); return 1; });

    const { result } = renderHook(() => useCountUp(10, 0, 900, 300));
    act(() => { jest.advanceTimersByTime(300); });
    expect(result.current).toBe(10);

    rafSpy.mockRestore();
  });

  test('unmounting before the delay cancels the pending animation', () => {
    jest.useFakeTimers();
    const rafSpy = jest.spyOn(window, 'requestAnimationFrame');
    const { unmount } = renderHook(() => useCountUp(10, 0, 900, 300));
    unmount();
    act(() => { jest.advanceTimersByTime(1000); });
    expect(rafSpy).not.toHaveBeenCalled();
    rafSpy.mockRestore();
  });
});
