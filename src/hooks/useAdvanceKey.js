import { useEffect } from 'react';

// ─── useAdvanceKey (founder queue item 5, July 29 2026) ────────────────────
// Space/Enter as a stand-in for CLICKING the gameplay canvas's Next button —
// desktop players shouldn't reach for the mouse between hands.
//
// It is deliberately NOT auto-advance. The caller passes `active`, which must
// track the Next button's own visibility: the key exists exactly when the
// button does and never fires on a timer. If this hook ever grows its own
// setTimeout, the feature has become the thing the founder ruled out.
//
// Extracted from CanvasLayout rather than inlined: adding the effect there
// pushed the file to 167 lines against its 160-line budget (invariant 21), and
// the rule's instruction is to extract rather than raise the number.
export function useAdvanceKey({ active, onAdvance }) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      // Cmd/Ctrl+Space is Spotlight / input-source switching, Alt+Enter is a
      // window shortcut — none of them ours to eat.
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      // A focused control already answers Space/Enter itself. Without this the
      // disagree chips would submit the flag AND skip the hand in one press.
      if (e.target?.closest?.('button, a, input, textarea, select, [contenteditable]')) return;
      e.preventDefault(); // Space would otherwise page the window down
      onAdvance();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onAdvance]);
}

export default useAdvanceKey;
