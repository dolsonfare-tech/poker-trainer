import { useState, useEffect } from 'react';
import DUMMY_USER from '../data/dummyUser';
import { SKILL_NAMES, SKILL_DESCRIPTIONS, COLOR_LABELS } from '../data/constants';

// ─── Count-up animation ───────────────────────────────────────────────────
function useCountUp(to, from, duration = 900, delay = 0) {
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

// ─── Rating transition helper ─────────────────────────────────────────────
const RATING_ORDER = ['red', 'yellow', 'green'];
function nextRating(current, result) {
  const base = current === 'gray' ? 'red' : current;
  const i = RATING_ORDER.indexOf(base);
  if (result === 'correct')   return RATING_ORDER[Math.min(i + 1, 2)];
  if (result === 'incorrect') return RATING_ORDER[Math.max(i - 1, 0)];
  return current;
}

// ─── Skill dot ────────────────────────────────────────────────────────────
function SkillDot({ skill, data, sessionResult, index }) {
  const [expanded, setExpanded] = useState(false);
  const [displayRating, setDisplayRating] = useState(data.rating);

  useEffect(() => {
    if (!sessionResult) return;
    const newRating = nextRating(data.rating, sessionResult);
    if (newRating === data.rating) return;
    const t = setTimeout(() => setDisplayRating(newRating), 1000 + index * 80);
    return () => clearTimeout(t);
  }, [sessionResult]); // eslint-disable-line

  const colorMap = {
    green:  { color: '#56c878', glow: 'rgba(86,200,120,0.6)',  symbol: '●' },
    yellow: { color: '#e89028', glow: 'rgba(232,144,40,0.6)',  symbol: '◆' },
    red:    { color: '#e25555', glow: 'rgba(226,85,85,0.6)',   symbol: '▼' },
    gray:   { color: 'rgba(255,255,255,0.25)', glow: 'none',   symbol: '○' },
  };
  const { color, glow, symbol } = colorMap[displayRating] || colorMap.gray;

  return (
    <div
      className={`db-skill-item ${expanded ? 'db-skill-expanded' : ''}`}
      onClick={() => setExpanded(e => !e)}
      style={{ cursor: 'pointer' }}
    >
      <span className="db-skill-dot" style={{
        color,
        textShadow: glow !== 'none' ? `0 0 8px ${glow}` : 'none',
      }}>{symbol}</span>
      <span className="db-skill-label">{SKILL_NAMES[skill]}</span>
      {expanded && (
        <div className="db-skill-desc">
          <div className="db-skill-desc-text">{SKILL_DESCRIPTIONS[skill]}</div>
          <div className="db-skill-desc-rating">{COLOR_LABELS[displayRating]}</div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard({ onStartSession, stats, sessionDelta }) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPulse(true), 400);
    return () => clearTimeout(t);
  }, []);

  const { schema, skills, sessionsCompleted, coachNote, pokerScore } = DUMMY_USER;

  const streak = stats?.lastSessionDate ? stats.streak : DUMMY_USER.streak;

  // Animation targets — when no sessionDelta, from === to so no animation runs
  const iqFrom       = pokerScore ?? 0;
  const iqTo         = sessionDelta ? iqFrom + sessionDelta.iqDelta : iqFrom;
  const streakFrom   = sessionDelta ? sessionDelta.prevStreak : streak;
  const sessionsFrom = sessionsCompleted;
  const sessionsTo   = sessionDelta ? sessionsCompleted + 1 : sessionsCompleted;

  const displayIQ       = useCountUp(iqTo,       iqFrom,       900, 300);
  const displayStreak   = useCountUp(streak,      streakFrom,   700, 150);
  const displaySessions = useCountUp(sessionsTo,  sessionsFrom, 700, 500);

  return (
    <div className="dashboard">

      {/* ── Topbar ── */}
      <div className="db-topbar">
        <button className="db-account-btn" onClick={() => {}}>
          <div className="db-avatar">{DUMMY_USER.initials}</div>
          <span className="db-username">{DUMMY_USER.displayName}</span>
        </button>
        <div className="db-plan-pill">
          <span className="db-plan-label">Free Plan</span>
          <button className="db-gopro-btn" onClick={() => {}}>Go Pro</button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="db-stats-row">
        <div className="db-stat-chip">
          <span className="db-stat-num db-stat-cream">
            {displayIQ ?? '—'}
            {pokerScore != null && <span className="db-stat-denom">/100</span>}
          </span>
          <span className="db-stat-label">poker iq</span>
        </div>
        <div className="db-stat-divider" />
        <div className="db-stat-chip">
          <span className="db-stat-num">{displayStreak}</span>
          <span className="db-stat-flame">🔥</span>
          <span className="db-stat-label">day streak</span>
        </div>
        <div className="db-stat-divider" />
        <div className="db-stat-chip">
          <span className="db-stat-num db-stat-cream">{displaySessions}</span>
          <span className="db-stat-label">sessions</span>
        </div>
      </div>

      {/* ── Poker Archetype ── */}
      <div className="db-section">
        <div className="db-section-label">
          <span>Poker Archetype</span>
        </div>
        <div className="db-schema-card">
          <span className="db-schema-corner db-corner-tl" />
          <span className="db-schema-corner db-corner-tr" />
          <span className="db-schema-corner db-corner-bl" />
          <span className="db-schema-corner db-corner-br" />
          <div className="db-schema-mini-label">Schema · {schema.index} of {schema.total}</div>
          <div className="db-schema-name">{schema.name}</div>
          <div className="db-schema-quote">{schema.quote}</div>
          <div className="db-schema-affected">
            <div className="db-affected-label">Affecting</div>
            <div className="db-affected-row">
              {schema.affected.map(({ skill, level }) => (
                <div key={skill} className={`db-affected-chip db-chip-${level}`}>{skill}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Skill Profile ── */}
      <div className="db-section">
        <div className="db-section-label">
          <span>Skill Profile</span>
          <span className="db-section-meta">tap a skill to learn more</span>
        </div>
        <div className="db-skills-grid">
          {Object.entries(skills).map(([skill, data], idx) => (
            <SkillDot
              key={skill}
              skill={skill}
              data={data}
              sessionResult={sessionDelta?.skillResults?.[skill]}
              index={idx}
            />
          ))}
        </div>
        <div className="db-skill-legend">
          <span className="db-legend-item"><span className="db-legend-sym db-legend-green">●</span>Strong</span>
          <span className="db-legend-item"><span className="db-legend-sym db-legend-yellow">◆</span>Work On</span>
          <span className="db-legend-item"><span className="db-legend-sym db-legend-red">▼</span>Weak</span>
          <span className="db-legend-item"><span className="db-legend-sym db-legend-gray">○</span>Unrated</span>
        </div>
      </div>

      {/* ── Coach's Note ── */}
      <div className="db-section">
        <div className="db-section-label">
          <span>Coach's Note</span>
        </div>
        <div className="db-coach-note">
          <p className="db-coach-note-body">{coachNote.body}</p>
          <div className="db-coach-note-footer">
            <span className="db-coach-note-focus-label">Focus this session</span>
            <span className="db-coach-note-focus">{coachNote.focus}</span>
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="db-cta-block">
        <button
          className={`db-cta-btn ${pulse ? 'db-cta-visible' : ''}`}
          onClick={onStartSession}
        >
          Deal Me In
          <span className="db-cta-arrow">→</span>
        </button>
      </div>

    </div>
  );
}
