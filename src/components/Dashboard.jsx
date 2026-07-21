import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { SKILL_NAMES } from '../data/constants';
import { toLocalDateString, RENAME_COOLDOWN_MS, milestoneProximity, parseCoachRead, SCHEMA_UNLOCK_SESSIONS } from '../utils/userStorage';
import { track } from '../utils/analytics';
import { hasSupabase } from '../utils/supabase';
import { submitFeedback } from '../utils/db';
import AdSlot from './AdSlot';

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

// ─── Streak status line (M1–M3) ───────────────────────────────────────────
// One factual line under the stats row, priority-ordered. Transient
// post-session moments come first: a Rebuy silently covering a missed day
// (M1), or a broken streak paired with the consistency record so it never
// reads as a bare reset (M2). Steady state: milestone proximity when a
// milestone is within reach (M3), else the held-Rebuy protection note. Quiet
// and factual, no guilt tones (M4).
function StreakStatus({ user, sessionDelta }) {
  const { streak, rebuys = 0 } = user;
  if (sessionDelta?.rebuyUsed) {
    return <div className="db-streak-status db-streak-rebuy">🛟 Rebuy used — streak intact</div>;
  }
  if (sessionDelta?.streakBroken) {
    const n = sessionDelta.activeDaysLast30;
    return (
      <div className="db-streak-status db-streak-broken-line">
        {n != null
          ? `New run — you've played ${n} of the last 30 days.`
          : 'New run — every session rebuilds the streak.'}
      </div>
    );
  }
  const prox = milestoneProximity(streak);
  if (prox) {
    // The stats chip directly above already shows the streak count — never
    // repeat info; this line carries only the proximity.
    return (
      <div className="db-streak-status db-streak-proximity">
        {prox.remaining} more to {prox.name} ★
      </div>
    );
  }
  if (rebuys > 0) {
    return (
      <div className="db-streak-status db-streak-held">
        🛟 {rebuys} Rebuy{rebuys > 1 ? 's' : ''} held — covers a missed day
      </div>
    );
  }
  return null;
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

function SkillLedger({ skills, prevSkills }) {
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

// ─── Beta feedback ─────────────────────────────────────────────────────────
// Quiet one-liner at the dashboard bottom that expands into a category +
// text form. Inserts into the Supabase `feedback` table (insert-only RLS);
// in localStorage-only mode (dev/jest, no backend) it still renders and
// "sends" so the UI stays testable — nothing persists there by design.
const FEEDBACK_CATEGORIES = [
  ['gameplay', 'Gameplay'],
  ['scenarios', 'Scenarios'],
  ['technical', 'Technical'],
  ['idea', 'Idea'],
];

function BetaFeedback() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(null);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');

  const submit = async () => {
    if (!category || !text.trim() || status === 'sending') return;
    setStatus('sending');
    setError('');
    try {
      if (hasSupabase) await submitFeedback(category, text.trim());
      track('feedback_submitted', { category, length: text.trim().length });
      setStatus('sent');
    } catch (err) {
      console.error('Feedback failed', err);
      track('feedback_submit_failed');
      setError("Couldn't send — check your connection and try again.");
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="db-beta">
        <div className="db-beta-thanks">🃏 Dealt to the founders — thank you.</div>
      </div>
    );
  }

  return (
    <div className="db-beta">
      {!open ? (
        <button className="db-beta-toggle" onClick={() => { setOpen(true); track('feedback_opened'); }}>
          <span className="db-beta-chip">Beta</span>
          Something broken, boring, or brilliant? Tell us →
        </button>
      ) : (
        <div className="db-beta-form">
          <div className="db-beta-head">
            <span className="db-beta-chip">Beta</span>
            Feedback on gameplay, scenarios, technical issues, or ideas
          </div>
          <div className="db-beta-cats">
            {FEEDBACK_CATEGORIES.map(([key, label]) => (
              <button
                key={key}
                className={`db-beta-cat ${category === key ? 'db-beta-cat-active' : ''}`}
                onClick={() => setCategory(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            className="db-beta-text"
            rows={3}
            maxLength={2000}
            placeholder="What happened — or what should exist?"
            value={text}
            onChange={e => setText(e.target.value)}
          />
          {error && <div className="db-beta-error">{error}</div>}
          <div className="db-beta-actions">
            <button className="db-beta-cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button
              className="db-beta-send"
              disabled={!category || !text.trim() || status === 'sending'}
              onClick={submit}
            >
              {status === 'sending' ? 'Sending…' : 'Send feedback'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Coach's Notebook ──────────────────────────────────────────────────────
// The latest Coach's Read lives in the strip above; every prior read is kept in
// the history (user.coachReads, newest first). This is a quiet, in-place list —
// no modal. A collapsed row is date + headline; tapping expands the full read.
// Hidden when there are fewer than two reads total (the strip already shows the
// only one) and for guests (the caller gates that).

// 'YYYY-MM-DD' → compact "Jul 18" without a UTC shift (local constructor).
function fmtReadDate(iso) {
  const [y, m, d] = (iso ?? '').split('-').map(Number);
  if (!y || !m || !d) return iso ?? '';
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function CoachNotebook({ reads, includeLatest = false }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null); // index of the expanded row
  // The newest read is normally the one shown in the strip above — exclude it.
  // When there's no strip (latest session produced no read), the notebook is
  // the only surface for the history, so include everything.
  const past = includeLatest ? (reads ?? []) : (reads ?? []).slice(1);
  if (past.length < 1) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) track('coach_notebook_opened', { reads: past.length });
  };

  return (
    <div className="db-notebook">
      <button className="db-notebook-toggle" onClick={toggle} aria-expanded={open}>
        <span className="db-notebook-arrow">{open ? '▾' : '▸'}</span>
        Past reads · {past.length}
      </button>
      {open && (
        <ul className="db-notebook-list">
          {past.map((r, i) => {
            const parsed = parseCoachRead(r.body);
            const isOpen = expanded === i;
            const headline = parsed?.structured ? parsed.structured.headline : (parsed?.legacy ?? '');
            return (
              <li key={i} className="db-notebook-item">
                <button
                  className="db-notebook-row"
                  aria-expanded={isOpen}
                  onClick={() => setExpanded(isOpen ? null : i)}
                >
                  <span className="db-notebook-date">{fmtReadDate(r.date)}</span>
                  <span className={`db-notebook-headline${isOpen ? '' : ' db-notebook-clamp'}`}>
                    {headline}
                  </span>
                </button>
                {/* Legacy prose has no separate detail — its "headline" IS the
                    whole read, so expanding just un-clamps the row (a detail
                    block would duplicate the text; founder-reported July 19). */}
                {isOpen && parsed?.structured && (
                  <div className="db-notebook-detail">
                    {parsed.structured.evidence.length > 0 && (
                      <ul className="db-profile-read-evidence">
                        {parsed.structured.evidence.map((e, j) => (
                          <li key={j} className="db-profile-read-evidence-row">{e}</li>
                        ))}
                      </ul>
                    )}
                    {parsed.structured.watchFor && (
                      <div className="db-profile-read-watchfor">
                        <span className="db-profile-read-wf-label">Watch for</span>
                        <span className="db-profile-read-wf-text">{parsed.structured.watchFor}</span>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Username editor ──────────────────────────────────────────────────────
// Inline in the topbar, opened from the ✎ next to the account pill. Same
// validation as first-time creation (UsernameEntry). Renames are limited to
// once a week — the form checks locally so the common case reads as a clear
// message, and the DB trigger enforces it for real in Supabase mode.
function UsernameEditor({ user, onRename, onClose }) {
  const [name, setName]   = useState(user.displayName);
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);

  const nextChangeAt = user.usernameChangedAt
    ? new Date(new Date(user.usernameChangedAt).getTime() + RENAME_COOLDOWN_MS)
    : null;
  const onCooldown = nextChangeAt && nextChangeAt > new Date();
  const fmtDate = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  if (onCooldown) {
    return (
      <div className="db-rename">
        <span className="db-rename-note">
          Name changes are limited to once a week — you can change yours again on {fmtDate(nextChangeAt)}.
        </span>
        <button type="button" className="db-rename-cancel" onClick={onClose}>OK</button>
      </div>
    );
  }

  const save = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError('Must be at least 2 characters'); return; }
    if (trimmed.length > 20) { setError('Must be 20 characters or less'); return; }
    if (trimmed === user.displayName) { onClose(); return; }
    setBusy(true);
    try {
      await onRename(trimmed);
      track('username_changed');
      onClose();
    } catch (err) {
      console.error('Username change failed', err);
      const rateLimited = err?.code === 'rate_limited';
      track('username_change_failed', { reason: rateLimited ? 'rate_limited' : 'error' });
      setError(rateLimited
        ? 'Name changes are limited to once a week.'
        : "Couldn't save — check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <form className="db-rename" onSubmit={save}>
      <input
        className="db-rename-input"
        type="text"
        value={name}
        onChange={e => { setName(e.target.value); setError(''); }}
        maxLength={20}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="New username"
      />
      <button
        type="submit"
        className="db-rename-save"
        disabled={busy || name.trim().length < 2}
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
      <button type="button" className="db-rename-cancel" onClick={onClose} disabled={busy}>
        Cancel
      </button>
      {error && <div className="db-rename-error">{error}</div>}
    </form>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────
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

  const displayIQ       = useCountUp(iqTo,         iqFrom,       900, 300);
  const displayStreak   = useCountUp(streak,        streakFrom,   700, 150);
  const displaySessions = useCountUp(sessionsTo,    sessionsFrom, 700, 500);

  // Pro tier doesn't exist yet — the button measures demand (PostHog) and is
  // honest about it. Wire real upgrade flow here when the tier ships.
  const [proTeased, setProTeased] = useState(false);
  const teasePro = () => {
    track('go_pro_clicked');
    setProTeased(true);
    setTimeout(() => setProTeased(false), 2500);
  };

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
              onClick={() => { setEditingName(true); track('username_edit_opened'); }}
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
          <div className="db-profile-split">
            <div className="db-profile-schema">
              {schema ? (
                <>
                  <div className="db-schema-name">{schema.name}</div>
                  <div className="db-schema-quote">{schema.quote}</div>
                  {sessionsCompleted < 10 && (
                    <div className="db-schema-early">Early read · sharpens as you play</div>
                  )}
                  {onSchemaInfo && (
                    <button
                      className="db-schema-guide-link"
                      onClick={() => onSchemaInfo(schema.name)}
                    >
                      About this read →
                    </button>
                  )}
                </>
              ) : (
                <div className="db-schema-locked">
                  <div className="db-schema-locked-icon">🔒</div>
                  {/* "player profile" not "archetype" — archetype is the VILLAIN
                      word (Table Reads, the guide); the player-side diagnosis
                      must not borrow it. */}
                  <div className="db-schema-locked-text">
                    {`Play ${SCHEMA_UNLOCK_SESSIONS - sessionsCompleted} more session${SCHEMA_UNLOCK_SESSIONS - sessionsCompleted !== 1 ? 's' : ''} to unlock your player profile`}
                  </div>
                </div>
              )}
            </div>
            <div className="db-profile-divider" />
            <div className="db-profile-skills">
              <SkillLedger skills={skills} prevSkills={sessionDelta?.prevSkills ?? null} />
            </div>
          </div>

          {/* ── Last Session's Read ──
              The read belongs to the player profile (founder decision) — a
              full-width strip beneath the schema/ledger columns. Compact:
              headline + watch-for + focus chip; the per-hand evidence rows
              stay on the summary. Legacy prose reads clamp to ~2 lines. */}
          {(() => {
            // The notebook must not vanish just because the LATEST session
            // produced no read (daily cap / failed call) — with no strip it
            // becomes the only surface for the history, latest included.
            const readsCount = user.coachReads?.length ?? 0;
            const showNotebook = !guest && readsCount >= (coachNote ? 2 : 1);
            if (!coachNote && !showNotebook) return null;
            const parsed = coachNote ? parseCoachRead(coachNote.body) : null;
            return (
              <div className="db-profile-read">
                {coachNote && (<>
                <div className="db-profile-read-label">Last Session's Read</div>
                {parsed?.structured ? (
                  <>
                    <div className="db-profile-read-headline">{parsed.structured.headline}</div>
                    {parsed.structured.evidence.length > 0 && (
                      <ul className="db-profile-read-evidence">
                        {parsed.structured.evidence.map((e, i) => (
                          <li key={i} className="db-profile-read-evidence-row">{e}</li>
                        ))}
                      </ul>
                    )}
                    {parsed.structured.watchFor && (
                      <div className="db-profile-read-watchfor">
                        <span className="db-profile-read-wf-label">Watch for</span>
                        <span className="db-profile-read-wf-text">{parsed.structured.watchFor}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="db-profile-read-prose">{parsed?.legacy}</p>
                )}
                {coachNote.focus && (
                  <div className="db-profile-read-focus">
                    <span className="db-profile-read-focus-label">Focus this session</span>
                    <span className="db-profile-read-focus-skill">{coachNote.focus}</span>
                  </div>
                )}
                </>)}
                {showNotebook && (
                  <CoachNotebook reads={user.coachReads} includeLatest={!coachNote} />
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="db-cta-block">
        <button
          className={`db-cta-btn ${pulse ? 'db-cta-visible' : ''}`}
          onClick={guestGated ? () => onGuestSignIn('dashboard') : onStartSession}
        >
          {guestGated ? 'Sign In Free to Keep Playing' : 'Deal Me In'}
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
