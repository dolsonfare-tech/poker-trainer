import { useState, useEffect } from 'react';
import DUMMY_USER from '../data/dummyUser';

// ─── Skill display names ───────────────────────────────────────────────────
const SKILL_NAMES = {
  preflop:    'Preflop',
  position:   'Position',
  aggression: 'Aggression',
  betsize:    'Bet Size',
  bluffing:   'Bluffing',
  potodds:    'Pot Odds',
  reads:      'Reads',
  opponent:   'Opponent',
};

// ─── Streak warning: after 6pm if haven't played today ────────────────────
function shouldShowStreakWarning(lastSessionDate, streak) {
  if (!streak || streak === 0) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (lastSessionDate === today) return false;
  return new Date().getHours() >= 18;
}

// ─── Skill dot ────────────────────────────────────────────────────────────
function SkillDot({ skill, data }) {
  const colorMap = {
    green:  { bg: '#56c878', glow: 'rgba(86,200,120,0.6)'  },
    yellow: { bg: '#e89028', glow: 'rgba(232,144,40,0.6)'  },
    red:    { bg: '#e25555', glow: 'rgba(226,85,85,0.6)'   },
    gray:   { bg: 'rgba(255,255,255,0.15)', glow: 'none'   },
  };
  const { bg, glow } = colorMap[data.rating] || colorMap.gray;
  return (
    <div className="db-skill-item">
      <div className="db-skill-dot" style={{
        background: bg,
        boxShadow: glow !== 'none' ? `0 0 8px ${glow}` : 'none',
      }} />
      <span className="db-skill-label">{SKILL_NAMES[skill]}</span>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard({ onStartSession, stats }) {
  const streak = DUMMY_USER.streak;
  const lastSessionDate = DUMMY_USER.lastSessionDate;
  const showWarning = shouldShowStreakWarning(lastSessionDate, streak);

  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPulse(true), 400);
    return () => clearTimeout(t);
  }, []);

  const { schema, skills, leaderboard, sessionsCompleted } = DUMMY_USER;

  // Coach copy that doesn't mention streak (streak is already visible above)
  const coachCopy = "Your aggression is the leak. Today's 5 hands are designed to fix it.";

  return (
    <div className="dashboard">

      {/* ── Topbar: account + plan ── */}
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

      {/* ── Streak warning ── */}
      {showWarning && (
        <div className="db-streak-warning">
          🔥 Your {streak}-day streak is at risk — play before midnight
        </div>
      )}

      {/* ── Compact stats row: streak + sessions ── */}
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
      </div>

      {/* ── Coach greeting — no streak mention ── */}
      <div className="db-greeting">
        <div className="db-greeting-av">M</div>
        <div className="db-greeting-text">{coachCopy}</div>
      </div>

      {/* ── Skill dots ── */}
      <div className="db-section">
        <div className="db-section-label">
          <span>Skill Profile</span>
          <span className="db-section-meta">last 20 attempts</span>
        </div>
        <div className="db-skills-grid">
          {Object.entries(skills).map(([skill, data]) => (
            <SkillDot key={skill} skill={skill} data={data} />
          ))}
        </div>
      </div>

      {/* ── Schema / Poker Archetype ── */}
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
          <div className="db-schema-mini-label">
            Schema · {schema.index} of {schema.total}
          </div>
          <div className="db-schema-name">{schema.name}</div>
          <div className="db-schema-quote">{schema.quote}</div>
          <div className="db-schema-affected">
            <div className="db-affected-label">Affecting</div>
            <div className="db-affected-row">
              {schema.affected.map(({ skill, level }) => (
                <div key={skill} className={`db-affected-chip db-chip-${level}`}>
                  {skill}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Leaderboard (collapsed) ── */}
      <div className="db-section">
        <div className="db-section-label">
          <span>Leaderboard · Longest Streak</span>
        </div>
        <div className="db-leaderboard">
          <div className="db-lb-rank-line">
            <div className="db-lb-your-rank">
              Your rank · <strong>#{leaderboard.yourRank}</strong> of {leaderboard.total.toLocaleString()}
            </div>
            <button className="db-lb-see-full" onClick={() => {}}>See full →</button>
          </div>
          <div className="db-lb-top-label">Top players</div>
          <div className="db-lb-rows">
            {leaderboard.top.map(entry => (
              <div key={entry.rank} className="db-lb-row">
                <span className="db-lb-rank">#{entry.rank}</span>
                <span className="db-lb-name">{entry.name}</span>
                <span className="db-lb-streak">🔥 {entry.streak}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA — anchored at bottom for thumb reach ── */}
      <div className="db-cta-block">
        <button
          className={`db-cta-btn ${pulse ? 'db-cta-visible' : ''}`}
          onClick={onStartSession}
        >
          Start Today's Session
          <span className="db-cta-arrow">→</span>
        </button>
        <div className="db-cta-sub">
          Today's queue · <strong>5 hands targeting aggression</strong>
        </div>
      </div>

    </div>
  );
}