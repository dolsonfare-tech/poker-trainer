import { useState, useEffect } from 'react';
import DUMMY_USER from '../data/dummyUser';
import { SKILL_NAMES, SKILL_DESCRIPTIONS, COLOR_LABELS } from '../data/constants';

// ─── Skill dot with tap-for-description ───────────────────────────────────
function SkillDot({ skill, data }) {
  const [expanded, setExpanded] = useState(false);

  const colorMap = {
    green:  { bg: '#56c878', glow: 'rgba(86,200,120,0.6)'  },
    yellow: { bg: '#e89028', glow: 'rgba(232,144,40,0.6)'  },
    red:    { bg: '#e25555', glow: 'rgba(226,85,85,0.6)'   },
    gray:   { bg: 'rgba(255,255,255,0.15)', glow: 'none'   },
  };
  const { bg, glow } = colorMap[data.rating] || colorMap.gray;

  return (
    <div
      className={`db-skill-item ${expanded ? 'db-skill-expanded' : ''}`}
      onClick={() => setExpanded(e => !e)}
      style={{ cursor: 'pointer' }}
    >
      <div className="db-skill-dot" style={{
        background: bg,
        boxShadow: glow !== 'none' ? `0 0 8px ${glow}` : 'none',
      }} />
      <span className="db-skill-label">{SKILL_NAMES[skill]}</span>
      {expanded && (
        <div className="db-skill-desc">
          <div className="db-skill-desc-text">{SKILL_DESCRIPTIONS[skill]}</div>
          <div className="db-skill-desc-rating">{COLOR_LABELS[data.rating]}</div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ onStartSession, stats }) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPulse(true), 400);
    return () => clearTimeout(t);
  }, []);

  const { schema, skills, sessionsCompleted, coachNote, pokerScore } = DUMMY_USER;

  // Use live localStorage streak if the user has played at least once,
  // otherwise fall back to dummy data so fresh testers see a realistic view.
  const streak = stats?.lastSessionDate ? stats.streak : DUMMY_USER.streak;

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
          <span className="db-stat-num">{streak}</span>
          <span className="db-stat-flame">🔥</span>
          <span className="db-stat-label">day streak</span>
        </div>
        <div className="db-stat-divider" />
        <div className="db-stat-chip">
          <span className="db-stat-num db-stat-cream">{sessionsCompleted}</span>
          <span className="db-stat-label">sessions</span>
        </div>
        <div className="db-stat-divider" />
        <div className="db-stat-chip">
          <span className="db-stat-num db-stat-cream">
            {pokerScore ?? '—'}
            {pokerScore != null && <span className="db-stat-denom">/100</span>}
          </span>
          <span className="db-stat-label">poker score</span>
        </div>
      </div>

      {/* ── Poker Archetype ── */}
      <div className="db-section">
        <div className="db-section-label">
          <span>Poker Archetype</span>
          <span className="db-section-meta">updated this morning</span>
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
          {Object.entries(skills).map(([skill, data]) => (
            <SkillDot key={skill} skill={skill} data={data} />
          ))}
        </div>
        <div className="db-skill-legend">
          <span className="db-legend-item"><span className="db-legend-dot db-legend-green" />Strong</span>
          <span className="db-legend-item"><span className="db-legend-dot db-legend-yellow" />Work On</span>
          <span className="db-legend-item"><span className="db-legend-dot db-legend-red" />Weak</span>
          <span className="db-legend-item"><span className="db-legend-dot db-legend-gray" />Unrated</span>
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
