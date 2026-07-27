import { useState, useEffect } from 'react';

// ─── Count-up animation ───────────────────────────────────────────────────
// Animates a number from `from` to `to` with an ease-out cubic over
// `duration` ms, after an optional `delay`. When from === to no animation
// runs and the value renders statically — that identity is what lets the
// dashboard mount without a sessionDelta and still show honest numbers on
// the very first (synchronous) paint.
export default function useCountUp(to, from, duration = 900, delay = 0) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    setValue(from);
    if (from === to) return;
    let start = null;
    let raf;
    const timer = setTimeout(() => {
      const tick = (ts) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        setValue(Math.round(from + (to - from) * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [to, from]); // eslint-disable-line
  return value;
}
