import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { SKILL_NAMES } from '../../data/constants';

// ─── Skill ledger ─────────────────────────────────────────────────────────
// Skills grouped by status, weakest first — the dashboard's job is to surface
// leaks. Rows on mobile, four columns ≥700px (CSS switches the layout; the
// markup is identical). After a session, each changed skill flies from its
// old group to its new one via FLIP: measure pill positions, re-render with
// the new rating, then transform-animate the delta. Ratings come straight
// from the stored engine output — no re-derivation, so the ledger can never
// disagree with the engine.

const RATING_GROUPS = [
  { key: 'red',    label: 'Weak',    sym: '▼' },
  { key: 'yellow', label: 'Work On', sym: '◆' },
  { key: 'green',  label: 'Strong',  sym: '●' },
  { key: 'gray',   label: 'Unrated', sym: '○' },
];

const ratingsOf = (skills) =>
  Object.fromEntries(Object.keys(SKILL_NAMES).map(k => [k, skills[k]?.rating ?? 'gray']));

export default function SkillLedger({ skills, prevSkills }) {
  const [ratings, setRatings] = useState(() => ratingsOf(prevSkills ?? skills));
  const [landing, setLanding] = useState({});   // skill → new rating, drives the touchdown glow
  const pillRefs = useRef({});
  const flip = useRef(null);                    // { rects, mover } captured just before a move

  useEffect(() => {
    if (!prevSkills) return;
    const start = ratingsOf(prevSkills);
    const final = ratingsOf(skills);
    const moves = Object.keys(start).filter(k => start[k] !== final[k]);
    if (moves.length === 0) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timers = moves.map((k, i) => setTimeout(() => {
      if (!reduced) {
        flip.current = {
          mover: k,
          rects: Object.fromEntries(
            Object.entries(pillRefs.current).map(([s, el]) => [s, el.getBoundingClientRect()])
          ),
        };
      }
      setLanding(l => ({ ...l, [k]: final[k] }));
      setRatings(r => ({ ...r, [k]: final[k] }));
    }, reduced ? 1000 : 1000 + i * 750));
    const clear = setTimeout(
      () => setLanding({}),
      1000 + (reduced ? 0 : (moves.length - 1) * 750) + 1600
    );
    return () => { timers.forEach(clearTimeout); clearTimeout(clear); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- animates the mount-time session delta once

  useLayoutEffect(() => {
    if (!flip.current) return;
    const { rects, mover } = flip.current;
    flip.current = null;
    Object.entries(pillRefs.current).forEach(([k, el]) => {
      const before = rects[k];
      if (!before) return;
      const after = el.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      const isMover = k === mover;
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      if (isMover) el.style.zIndex = '5';
      el.getBoundingClientRect(); // flush, so the transition starts from the offset
      el.style.transition = isMover
        ? 'transform 0.55s cubic-bezier(0.22, 0.9, 0.3, 1)'
        : 'transform 0.3s ease';
      el.style.transform = '';
      setTimeout(() => { el.style.transition = ''; el.style.zIndex = ''; }, isMover ? 600 : 350);
    });
  }, [ratings]);

  return (
    <div className="db-skill-ledger">
      {RATING_GROUPS.map(({ key, label, sym }) => {
        const members = Object.keys(SKILL_NAMES).filter(k => ratings[k] === key);
        // Unrated is the one group that can never repopulate (attempts only
        // grow), so once every skill is rated the row is permanently dead
        // space — hide it. Weak/Work On/Strong stay visible when empty: they
        // are dynamic, and their empty states carry signal ("no weak skills").
        if (key === 'gray' && members.length === 0) return null;
        return (
          <div key={key} className="db-ledger-group">
            <div className={`db-ledger-head db-ledger-${key}`}>
              <span className="db-ledger-sym">{sym}</span>
              <span className="db-ledger-name">{label}</span>
              {members.length > 0 && <span className="db-ledger-count">{members.length}</span>}
            </div>
            <div className="db-ledger-pills">
              {members.length === 0 && <span className="db-ledger-empty">—</span>}
              {members.map(k => (
                <span
                  key={k}
                  ref={el => { if (el) pillRefs.current[k] = el; }}
                  className={`db-skill-pill${landing[k] ? ` db-pill-land-${landing[k]}` : ''}`}
                >
                  {SKILL_NAMES[k]}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
