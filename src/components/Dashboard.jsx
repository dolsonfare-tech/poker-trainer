import { useState, useEffect } from 'react';
import { GUEST_GATE_CTA } from '../data/constants';
import { streakAlive } from '../utils/streak';
import { hasSupabase } from '../utils/supabase';
import useCountUp from '../hooks/useCountUp';
import AdSlot from './AdSlot';
import StreakWarning from './dashboard/StreakWarning';
import StreakStatus from './dashboard/StreakStatus';
import SchemaPanel from './dashboard/SchemaPanel';
import SkillLedger from './dashboard/SkillLedger';
import LastSessionRead from './dashboard/LastSessionRead';
import RecentForm from './dashboard/RecentForm';
import BetaFeedback from './dashboard/BetaFeedback';
import UsernameEditor from './dashboard/UsernameEditor';
import { emitGoProClicked, emitUsernameEditOpened } from '../utils/events';
import { deriveRecentForm } from '../utils/recentForm';

// ─── Dashboard ────────────────────────────────────────────────────────────
// Layout skeleton only. Every self-contained section lives in
// ./dashboard/* (MOD-003, Wave 2) — this file composes them and owns the
// stats row, Player Profile card, and CTA block.
export default function Dashboard({ onStartSession, user, sessionDelta, onSignOut, onRename, guest, guestGated, onGuestSignIn, onTableReads, onSchemaInfo }) {
  const [editingName, setEditingName] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPulse(true), 400);
    return () => clearTimeout(t);
  }, []);

  const { schema, skills, sessionsCompleted, coachNote, pokerScore, streak, displayName, initials } = user;

  // Animation targets — when no sessionDelta, from === to so no animation runs
  const iqFrom       = sessionDelta?.prevPokerScore ?? pokerScore ?? 0;
  const iqTo         = pokerScore ?? (sessionDelta ? iqFrom + sessionDelta.iqDelta : iqFrom);
  // A broken streak counts up from 0 (a fresh run), never a demoralizing drop
  // from the old value to 1 (M2 — never a bare reset).
  const streakFrom   = sessionDelta ? (sessionDelta.streakBroken ? 0 : sessionDelta.prevStreak) : streak;
  const sessionsFrom = sessionDelta?.prevSessions ?? sessionsCompleted;
  const sessionsTo   = sessionDelta ? sessionsFrom + 1 : sessionsCompleted;
  // CA-039: a lapsed streak (beyond Rebuy coverage) shows 0, not the stale
  // stored value — playing today would start a new run, not extend the old one.
  // When no sessionDelta is present there is no animation: from === to.
  const effectiveStreak = streakAlive(user) ? streak : 0;
  // Preserve the M2 "count up from 0" animation for a just-broken streak, but
  // for a statically displayed lapsed streak start the animation from 0 too so
  // the initial (synchronous) render already shows the honest value.
  const streakAnimFrom  = sessionDelta ? streakFrom : effectiveStreak;

  const displayIQ       = useCountUp(iqTo,               iqFrom,           900, 300);
  const displayStreak   = useCountUp(effectiveStreak,     streakAnimFrom,   700, 150);
  const displaySessions = useCountUp(sessionsTo,          sessionsFrom,     700, 500);

  // Pro tier doesn't exist yet — the button measures demand (PostHog) and is
  // honest about it. Wire real upgrade flow here when the tier ships.
  const [proTeased, setProTeased] = useState(false);
  const teasePro = () => {
    emitGoProClicked();
    setProTeased(true);
    setTimeout(() => setProTeased(false), 2500);
  };

  // Deterministic recent form — computed at render from derived state, so it
  // costs nothing and is never stale.
  const recentForm = guest ? null : deriveRecentForm({
    recentSessions: user.recentSessions,
    skills,
    scenarioHistory: user.scenarioHistory,
  });

  return (
    <div className="dashboard">

      {/* ── Topbar ── */}
      <div className="db-topbar">
        {guest ? (
          <div className="db-account">
            <div className="db-account-btn db-account-static">
              <div className="db-avatar">♠</div>
              <span className="db-username">Guest</span>
            </div>
            <button className="db-guest-signin" onClick={() => onGuestSignIn('topbar')}>
              Sign in free
            </button>
          </div>
        ) : editingName ? (
          <UsernameEditor user={user} onRename={onRename} onClose={() => setEditingName(false)} />
        ) : (
          <div className="db-account">
            {/* The menu is the deliberate second tap that used to be a
                window.confirm — no native dialogs in the felt-and-gold UI */}
            <button
              className="db-account-btn"
              title="Account"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={hasSupabase ? () => setMenuOpen(o => !o) : undefined}
            >
              <div className="db-avatar">{initials}</div>
              <span className="db-username">{displayName}</span>
            </button>
            <button
              className="db-name-edit"
              title="Edit username"
              aria-label="Edit username"
              onClick={() => { setEditingName(true); emitUsernameEditOpened(); }}
            >
              ✎
            </button>
            {menuOpen && (
              <>
                <div className="db-menu-scrim" onClick={() => setMenuOpen(false)} />
                <div className="db-account-menu" role="menu">
                  <button className="db-menu-item" role="menuitem" onClick={() => { setMenuOpen(false); onSignOut(); }}>
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {/* Guests have no plan — the pill is noise until an account exists */}
        {!guest && (
          <div className="db-plan-pill">
            <span className="db-plan-label">Free Plan</span>
            <button className="db-gopro-btn" onClick={teasePro} disabled={proTeased}>
              {proTeased ? 'Coming soon ✨' : 'Go Pro'}
            </button>
          </div>
        )}
      </div>

      {/* No streak nag for guests — the gate means they couldn't act on it */}
      {!guest && <StreakWarning user={user} />}

      {/* ── Stats row ── */}
      <div className="db-stats-row">
        <div className="db-stat-chip">
          <span className="db-stat-num db-stat-cream">
            {pokerScore != null ? displayIQ : '—'}
            {pokerScore != null && <span className="db-stat-denom">/100</span>}
          </span>
          <span className="db-stat-label">poker iq</span>
          {/* Same empty-state copy the summary uses — the dashboard is where
              a new player stares first, so don't leave a bare dash. */}
          {pokerScore == null && (
            <span className="db-stat-hint">unlocks as skills get rated</span>
          )}
        </div>
        {/* Guests play one gated session — a streak they can't extend is noise */}
        {!guest && (
          <>
            <div className="db-stat-divider" />
            <div className="db-stat-chip">
              <span className="db-stat-num">{displayStreak}</span>
              <span className="db-stat-flame">🔥</span>
              <span className="db-stat-label">day streak</span>
            </div>
          </>
        )}
        <div className="db-stat-divider" />
        <div className="db-stat-chip">
          <span className="db-stat-num db-stat-cream">{displaySessions}</span>
          <span className="db-stat-label">sessions</span>
        </div>
      </div>

      {/* Streak status: Rebuy/proximity/broken-run copy (M1–M3). Guests play a
          single gated session, so streak mechanics don't apply to them. */}
      {!guest && <StreakStatus user={user} sessionDelta={sessionDelta} />}

      {/* ── Player Profile: schema + skill ledger, one card ──
          One diagnosis: the skills are the evidence, the schema is the read.
          Schema left / skills right on desktop, stacked on mobile. */}
      <div className="db-section">
        <div className="db-section-label">
          <span>Player Profile</span>
        </div>
        <div className="db-schema-card">
          <span className="db-schema-corner db-corner-tl" />
          <span className="db-schema-corner db-corner-tr" />
          <span className="db-schema-corner db-corner-bl" />
          <span className="db-schema-corner db-corner-br" />
          {/* Recent form sits ABOVE the schema/ledger split, not below it. Two
              reasons, and the first is not cosmetic: on mobile `.db-cta-block`
              is position:sticky with an OPAQUE background (CA-038), so anything
              at the bottom of this card is painted underneath it and invisible
              until the player scrolls. Measured July 28 2026 at 390x844 — the
              strip sat at y761 under a sticky bar spanning y686-844, and
              elementFromPoint at its centre returned the Table Reads link.
              Second: this line is "what just happened", the card below it is the
              lifetime read. Recent before lifetime is the honest order. */}
          {recentForm && <RecentForm form={recentForm} />}

          <div className="db-profile-split">
            <SchemaPanel
              schema={schema}
              sessionsCompleted={sessionsCompleted}
              onSchemaInfo={onSchemaInfo}
            />
            <div className="db-profile-divider" />
            <div className="db-profile-skills">
              <SkillLedger skills={skills} prevSkills={sessionDelta?.prevSkills ?? null} />
            </div>
          </div>

          <LastSessionRead coachNote={coachNote} coachReads={user.coachReads} guest={guest} />
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="db-cta-block">
        <button
          className={`db-cta-btn ${pulse ? 'db-cta-visible' : ''}`}
          onClick={guestGated ? () => onGuestSignIn('dashboard') : onStartSession}
        >
          {guestGated ? GUEST_GATE_CTA : 'Deal Me In'}
          <span className="db-cta-arrow">→</span>
        </button>
        {guestGated && (
          <div className="db-guest-note">
            Your free session's results are saved — they carry over to your account.
          </div>
        )}
        {onTableReads && (
          <button className="db-tablereads-link" onClick={onTableReads}>
            🃏 Table Reads — watch a hand, name the player
            <span className="db-tr-beta">Free during beta</span>
          </button>
        )}
      </div>

      {/* Feedback inserts require auth — guests get the form after signing in */}
      {!guest && <BetaFeedback />}

      <AdSlot placement="dashboard" />

    </div>
  );
}
