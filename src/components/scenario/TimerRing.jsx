import { useEffect, useRef, useState } from 'react';

// ─── Timer Ring ────────────────────────────────────────────────────────────
// Owns its own countdown so the 1-second tick re-renders only the ring, not
// the whole app tree. Remounted per scenario via key; frozen via `paused`.

export default function TimerRing({ totalSeconds, paused, onTimeout }) {
  const [seconds, setSeconds] = useState(totalSeconds);
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => { onTimeoutRef.current = onTimeout; });

  useEffect(() => {
    if (paused) return;
    // fired guard: in throttled background tabs, callbacks already queued
    // can still run after clearInterval — the timeout must fire exactly once
    let fired = false;
    const id = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(id);
          if (!fired) {
            fired = true;
            onTimeoutRef.current();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused]);

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - seconds / totalSeconds);
  const color = seconds <= 10 ? 'var(--red)' : seconds <= 30 ? 'var(--yellow)' : 'var(--green)';
  return (
    <div style={{ position: 'relative', width: '42px', height: '42px', flexShrink: 0 }}>
      <svg width="42" height="42" viewBox="0 0 42 42" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="21" cy="21" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle cx="21" cy="21" r={radius} fill="none" stroke={color} strokeWidth="3"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease', filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      {/* tr-seconds carries no styling — it is the stable handle the pause
          guards select on. Reading the countdown by tag/position broke every
          time the ring's markup moved. */}
      <div className="tr-seconds" style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: '13px', fontWeight: '700',
        color, transition: 'color 0.5s ease',
      }}>{seconds}</div>
    </div>
  );
}
