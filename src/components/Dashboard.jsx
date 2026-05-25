import { useState, useEffect } from 'react';
import DUMMY_USER from '../data/dummyUser';

// ─── Skill display names ───────────────────────────────────────────────────
const SKILL_NAMES = {
  preflop:    'Preflop',
  position:   'Position',
  aggression: 'Aggression',
  betsize:    'Bet Sizing',
  bluffing:   'Bluffing',
  potodds:    'Pot Odds',
  reads:      'Reads',
  opponent:   'Opponent',
};

// ─── Streak warning threshold (after 6pm local time) ──────────────────────
function shouldShowStreakWarning(lastSessionDate, streak) {
  if (!streak || streak === 0) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (lastSessionDate === today) return false;
  const hour = new Date().getHours();
  return hour >= 18;
}

// ─── Skill dot ────────────────────────────────────────────────────────────
function SkillDot({ skill, data }) {
  const colorMap = {
    green:  { bg: 'var(--green)',  glow: 'rgba(46,204,113,0.7)' },
    yellow: { bg: 'var(--yellow)', glow: 'rgba(240,165,0,0.7)'  },
    red:    { bg: 'var(--red)',    glow: 'rgba(231,76,60,0.7)'  },
    gray:   { bg: 'rgba(255,255,255,0.15)', glow: 'none'        },
  };
  const { bg, glow } = colorMap[data.rating] || colorMap.gray;
  return (
    <div className="db-skill-item">
      <div
        className="db-skill-dot"
        style={{
          background: bg,
          boxShadow: glow !== 'none' ? `0 0 8px ${glow}` : 'none',
        }}
      />
      <span className="db-skill-label">{SKILL_NAMES[skill]}</span>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard({ onStartSession, stats }) {
  // Merge localStorage stats with dummy user baseline
  const streak = stats?.streak ?? DUMMY_USER.streak;
  const lastSessionDate = stats?.lastSessionDate ?? DUMMY_USER.lastSessionDate;
  const showWarning = shouldShowStreakWarning(lastSessionDate, streak);
  const sessionsCompleted = DUMMY_USER.sessionsCompleted;
  const schemaUnlocked = sessionsCompleted >= DUMMY_USER.sessionsRequiredForSchema;
  const userRank = DUMMY_USER.leaderboard.find(e => e.isUser)?.rank ?? '—';

  // Pulse animation state for CTA button
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPulse(true), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="dashboard">

      {/* ── Top bar: account + plan ── */}
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

      {/* ── Streak + rank hero ── */}
      <div className="db-hero">
        <div className="db-streak-block">
          <div className="db-streak-number">{streak}</div>
          <div className="db-streak-label">Day Streak</div>
          {streak > 0 && <div className="db-streak-flame">🔥</div>}
        </div>
        <div className="db-divider" />
        <div className="db-rank-block">
          <div className="db-rank-number">#{userRank}</div>
          <div className="db-rank-label">Global Rank</div>
        </div>
      </div>

      {/* ── CTA ── */}
      <button
        className={`db-cta-btn ${pulse ? 'db-cta-pulse' : ''}`}
        onClick={onStartSession}
      >
        Start Today's Session
        <span className="db-cta-arrow">→</span>
      </button>

      {/* ── Skill dots ── */}
      <div className="db-section">
        <div className="db-section-label">Skill Profile</div>
        <div className="db-skills-grid">
          {Object.entries(DUMMY_USER.skills).map(([skill, data]) => (
            <SkillDot key={skill} skill={skill} data={data} />
          ))}
        </div>
      </div>

      {/* ── Schema diagnosis ── */}
      <div className="db-section">
        <div className="db-section-label">Poker Archetype</div>
        {schemaUnlocked ? (
          <div className="db-schema-card">
            <div className="db-schema-name">{DUMMY_USER.schema}</div>
          </div>
        ) : (
          <div className="db-schema-locked">
            <div className="db-schema-lock-icon">🃏</div>
            <div className="db-schema-lock-text">
              Play {DUMMY_USER.sessionsRequiredForSchema - sessionsCompleted} more session{DUMMY_USER.sessionsRequiredForSchema - sessionsCompleted !== 1 ? 's' : ''} to unlock your poker archetype
            </div>
            <div className="db-schema-progress">
              <div
                className="db-schema-progress-fill"
                style={{ width: `${(sessionsCompleted / DUMMY_USER.sessionsRequiredForSchema) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Leaderboard ── */}
      <div className="db-section">
        <div className="db-section-label">Leaderboard · Longest Streak</div>
        <div className="db-leaderboard">
          {DUMMY_USER.leaderboard.map(entry => (
            <div
              key={entry.rank}
              className={`db-lb-row ${entry.isUser ? 'db-lb-row-you' : ''}`}
            >
              <span className="db-lb-rank">#{entry.rank}</span>
              <span className="db-lb-name">{entry.name}</span>
              <span className="db-lb-streak">
                {entry.streak > 0 ? `🔥 ${entry.streak}` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}