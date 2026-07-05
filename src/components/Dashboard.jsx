import { useState, useEffect } from 'react';
import { SKILL_NAMES, SKILL_DESCRIPTIONS, COLOR_LABELS } from '../data/constants';
import { toLocalDateString } from '../utils/userStorage';

// ─── Streak warning (backlog item, pulled into launch scope July 2026) ────
// After 6pm local, if today's session hasn't been played, nudge — protecting
// the streak is the whole retention loop.
function StreakWarning({ user }) {
  const now = new Date();
  const playedToday = user.lastSessionDate === toLocalDateString(now);
  if (playedToday || now.getHours() < 18) return null;
  return (
    <div className="db-streak-warning">
      {user.streak > 0
        ? <>🔥 Your <b>{user.streak}-day streak</b> is on the line — play one session before midnight.</>
        : <>🃏 You haven't played today — one session keeps the reads sharp.</>}
    </div>
  );
}

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

// ─── Skill dot ────────────────────────────────────────────────────────────
function SkillDot({ skill, data, targetRating, index }) {
  const [expanded, setExpanded] = useState(false);
  const [displayRating, setDisplayRating] = useState(data.rating);

  // Animate from the pre-session rating to the actual stored post-session
  // rating — no re-derivation, so it can never disagree with the engine.
  useEffect(() => {
    if (!targetRating || targetRating === data.rating) return;
    const t = setTimeout(() => setDisplayRating(targetRating), 1000 + index * 80);
    return () => clearTimeout(t);
  }, [targetRating]); // eslint-disable-line

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
export default function Dashboard({ onStartSession, user, sessionDelta, onSignOut }) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPulse(true), 400);
    return () => clearTimeout(t);
  }, []);

  const { schema, skills, sessionsCompleted, coachNote, pokerScore, streak, displayName, initials } = user;

  // Skill dots use pre-session snapshot so animations show correct before→after transition
  const skillsForDots = sessionDelta?.prevSkills ?? skills;

  // Animation targets — when no sessionDelta, from === to so no animation runs
  const iqFrom       = sessionDelta?.prevPokerScore ?? pokerScore ?? 0;
  const iqTo         = pokerScore ?? (sessionDelta ? iqFrom + sessionDelta.iqDelta : iqFrom);
  const streakFrom   = sessionDelta ? sessionDelta.prevStreak : streak;
  const sessionsFrom = sessionDelta?.prevSessions ?? sessionsCompleted;
  const sessionsTo   = sessionDelta ? sessionsFrom + 1 : sessionsCompleted;

  const displayIQ       = useCountUp(iqTo,         iqFrom,       900, 300);
  const displayStreak   = useCountUp(streak,        streakFrom,   700, 150);
  const displaySessions = useCountUp(sessionsTo,    sessionsFrom, 700, 500);

  return (
    <div className="dashboard">

      {/* ── Topbar ── */}
      <div className="db-topbar">
        <button className="db-account-btn" onClick={onSignOut} title="Sign out">
          <div className="db-avatar">{initials}</div>
          <span className="db-username">{displayName}</span>
        </button>
        <div className="db-plan-pill">
          <span className="db-plan-label">Free Plan</span>
          <button className="db-gopro-btn" onClick={() => {}}>Go Pro</button>
        </div>
      </div>

      <StreakWarning user={user} />

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
        {schema ? (
          <div className="db-schema-card">
            <span className="db-schema-corner db-corner-tl" />
            <span className="db-schema-corner db-corner-tr" />
            <span className="db-schema-corner db-corner-bl" />
            <span className="db-schema-corner db-corner-br" />
            <div className="db-schema-mini-label">Schema · {schema.index} of {schema.total}</div>
            <div className="db-schema-name">{schema.name}</div>
            <div className="db-schema-quote">{schema.quote}</div>
            {schema.affected.length > 0 && (
              <div className="db-schema-affected">
                <div className="db-affected-label">Affecting</div>
                <div className="db-affected-row">
                  {schema.affected.map(({ skill, level }) => (
                    <div key={skill} className={`db-affected-chip db-chip-${level}`}>{skill}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="db-schema-locked">
            <div className="db-schema-locked-icon">{sessionsCompleted >= 5 ? '🔍' : '🔒'}</div>
            <div className="db-schema-locked-text">
              {sessionsCompleted >= 5
                ? 'No leak detected yet — your archetype surfaces once a weakness shows a pattern'
                : `Play ${5 - sessionsCompleted} more session${5 - sessionsCompleted !== 1 ? 's' : ''} to unlock your archetype`}
            </div>
          </div>
        )}
      </div>

      {/* ── Skill Profile ── */}
      <div className="db-section">
        <div className="db-section-label">
          <span>Skill Profile</span>
          <span className="db-section-meta">tap a skill to learn more</span>
        </div>
        <div className="db-skills-grid">
          {Object.entries(skillsForDots).map(([skill, data], idx) => (
            <SkillDot
              key={skill}
              skill={skill}
              data={data}
              targetRating={sessionDelta ? skills[skill]?.rating : null}
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
      {coachNote && (
        <div className="db-section">
          <div className="db-section-label">
            <span>Last Session's Read</span>
          </div>
          <div className="db-coach-note">
            <p className="db-coach-note-body">{coachNote.body}</p>
            {coachNote.focus && (
              <div className="db-coach-note-footer">
                <span className="db-coach-note-focus-label">Focus this session</span>
                <span className="db-coach-note-focus">{coachNote.focus}</span>
              </div>
            )}
          </div>
        </div>
      )}

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
