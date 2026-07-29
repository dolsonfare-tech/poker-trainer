// Dashboard account menu (replaces the window.confirm sign-out) and the
// guest-gated CTA — both need a Supabase-mode dashboard, mocked here.
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('../utils/supabase', () => ({ supabase: {}, hasSupabase: true }));
jest.mock('../utils/db', () => ({ submitFeedback: jest.fn() }));

import Dashboard from './Dashboard';
import { createUser } from '../utils/session';
import { SKILL_NAMES } from '../data/constants';

const user = { ...createUser('RiverRat'), sessionsCompleted: 3 };

test('sign-out lives behind the account menu, not a confirm dialog', () => {
  const onSignOut = jest.fn();
  render(<Dashboard user={user} onStartSession={() => {}} onSignOut={onSignOut} onRename={() => {}} />);

  // No menu until the account pill is tapped
  expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
  fireEvent.click(screen.getByTitle('Account'));
  fireEvent.click(screen.getByText('Sign out'));
  expect(onSignOut).toHaveBeenCalled();
});

// ── Streak status line (M1–M3) ───────────────────────────────────────────
const dash = (props) => render(
  <Dashboard onStartSession={() => {}} onSignOut={() => {}} onRename={() => {}} {...props} />
);

test('milestone proximity shows under the stats row when within reach (M3)', () => {
  // lastSessionDate must be set (yesterday) so streakAlive returns true and the
  // proximity line is not suppressed — an incoherent streak>0 + no date is dead.
  //
  // The clock MUST be frozen. streakAlive compares the stored date against the
  // real `new Date()`, so with a hard-coded lastSessionDate this test's result
  // depends on the machine's timezone: "yesterday" in EDT is already two days
  // ago in UTC, where the streak reads as dead and the line never renders. That
  // is what turned CI red on every push (run #17, July 26 2026) while the same
  // suite stayed green locally. Invariants rule 23 now pins the pairing.
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-07-26T12:00:00'));
  try {
    dash({ user: { ...createUser('Climber'), streak: 5, sessionsCompleted: 5, lastSessionDate: '2026-07-25' } });
    expect(screen.getByText(/2 more to a full week ★/)).toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

test('a used Rebuy states it plainly after the session (M1)', () => {
  dash({
    user: { ...createUser('Saver'), streak: 11, rebuys: 0, sessionsCompleted: 11 },
    sessionDelta: { rebuyUsed: true, streakBroken: false, prevStreak: 10 },
  });
  expect(screen.getByText(/Rebuy used — streak intact/)).toBeInTheDocument();
});

test('held Rebuys surface as a protection note in steady state (M1)', () => {
  dash({ user: { ...createUser('Holder'), streak: 9, rebuys: 2, sessionsCompleted: 9 } });
  expect(screen.getByText(/2 Rebuys held/)).toBeInTheDocument();
});

test('a broken streak shows the consistency record, never a bare reset (M2)', () => {
  dash({
    user: { ...createUser('Resetter'), streak: 1, rebuys: 0, sessionsCompleted: 20, activeDaysLast30: 26 },
    sessionDelta: { streakBroken: true, rebuyUsed: false, prevStreak: 20, activeDaysLast30: 26 },
  });
  expect(screen.getByText(/played 26 of the last 30 days/)).toBeInTheDocument();
});

test('the Unrated ledger row hides once every skill is rated', () => {
  const rated = Object.fromEntries(
    Object.keys(SKILL_NAMES).map(k => [k, { rating: 'yellow', attempts: 10, correct: 6 }])
  );
  dash({ user: { ...createUser('Rated'), skills: rated } });
  expect(screen.queryByText('Unrated')).not.toBeInTheDocument();
  // Empty Weak/Strong rows stay — they are dynamic and their empty state is signal
  expect(screen.getByText('Weak')).toBeInTheDocument();
  expect(screen.getByText('Strong')).toBeInTheDocument();
});

test('the Unrated ledger row shows while unrated skills exist', () => {
  dash({ user: createUser('Fresh') });
  expect(screen.getByText('Unrated')).toBeInTheDocument();
});

// ── Last Session's Read lives inside the Player Profile card ────────────────
test('a structured coach read renders headline + evidence + watch-for inside the Player Profile card', () => {
  const u = {
    ...createUser('Reader'),
    sessionsCompleted: 6,
    coachNote: {
      body: JSON.stringify({
        headline: 'You over-fold to river bets',
        evidence: ['Folded top pair to the nit', 'Passed on a value raise'],
        watchFor: 'Believe passive raisers on scary boards',
      }),
      focus: 'Pot Odds',
    },
  };
  dash({ user: u });

  // Headline + watch-for render, inside the profile card (C″, 2026-07-29)
  const headline = document.querySelector('.db-schema-card .db-profile-read-headline');
  expect(headline).toHaveTextContent('You over-fold to river bets');
  expect(screen.getByText(/Believe passive raisers/)).toBeInTheDocument();
  // Evidence rows and focus chip stay in the notebook — they don't render
  // on the card (founder decision: diagnosis and prescription only)
  expect(screen.queryByText(/Folded top pair to the nit/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Passed on a value raise/)).not.toBeInTheDocument();
  expect(document.querySelector('.db-profile-read-focus-skill')).toBeNull();
  // The standalone "Last Session's Read" section is gone
  expect(document.querySelector('.db-coach-note')).toBeNull();
});

test('a legacy prose read clamps inside the profile card', () => {
  const prose = 'You keep folding to river aggression from tight players. That leaks value over time.';
  const u = { ...createUser('P'), sessionsCompleted: 6, coachNote: { body: prose, focus: null } };
  dash({ user: u });

  const el = document.querySelector('.db-schema-card .db-profile-read-prose');
  expect(el).toHaveTextContent(prose);
  expect(document.querySelector('.db-profile-read-headline')).toBeNull();
  expect(document.querySelector('.db-coach-note')).toBeNull();
});

// ── Coach's Notebook (read history under the current read) ──────────────────
const structured = (headline, evidence = [], watchFor = '') =>
  JSON.stringify({ headline, evidence, watchFor });

const withNotebook = (past) => ({
  ...createUser('Historian'),
  sessionsCompleted: 8,
  coachNote: { body: structured('Newest read headline'), focus: null },
  coachReads: [{ date: '2026-07-19', body: structured('Newest read headline') }, ...past],
});

test('the notebook toggle is hidden with fewer than two reads', () => {
  const u = {
    ...createUser('Solo'),
    sessionsCompleted: 8,
    coachNote: { body: structured('Only read'), focus: null },
    coachReads: [{ date: '2026-07-19', body: structured('Only read') }],
  };
  dash({ user: u });
  expect(screen.queryByText(/Past reads/)).not.toBeInTheDocument();
});

test('the notebook toggle shows the count of prior reads', () => {
  const past = [
    { date: '2026-07-18', body: structured('Older read one') },
    { date: '2026-07-17', body: structured('Older read two') },
  ];
  dash({ user: withNotebook(past) });
  expect(screen.getByText(/Past reads · 2/)).toBeInTheDocument();
});

test('the notebook is hidden for guests (the caller gates it)', () => {
  const past = [
    { date: '2026-07-18', body: structured('Older read one') },
    { date: '2026-07-17', body: structured('Older read two') },
  ];
  render(<Dashboard user={withNotebook(past)} guest onStartSession={() => {}}
    onSignOut={() => {}} onRename={() => {}} onGuestSignIn={() => {}} />);
  expect(screen.queryByText(/Past reads/)).not.toBeInTheDocument();
});

test('expanding the notebook lists prior reads only, excluding the newest', () => {
  const past = [
    { date: '2026-07-18', body: structured('Older read one') },
    { date: '2026-07-17', body: structured('Older read two') },
  ];
  dash({ user: withNotebook(past) });
  fireEvent.click(screen.getByText(/Past reads · 2/));

  const list = document.querySelector('.db-notebook-list');
  expect(list).toHaveTextContent('Jul 18');
  expect(list).toHaveTextContent('Older read one');
  expect(list).toHaveTextContent('Older read two');
  // The newest read is shown in the strip above, never duplicated in the list.
  expect(list).not.toHaveTextContent('Newest read headline');
});

test('tapping a structured notebook row expands to its evidence and watch-for', () => {
  const past = [
    { date: '2026-07-18', body: structured('Older read one', ['Chased a dead draw', 'Under-bet the nuts'], 'Price your draws') },
  ];
  dash({ user: withNotebook(past) });
  fireEvent.click(screen.getByText(/Past reads · 1/));
  // Detail is collapsed until the row is tapped
  expect(screen.queryByText('Chased a dead draw')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Older read one'));
  expect(screen.getByText('Chased a dead draw')).toBeInTheDocument();
  expect(screen.getByText('Under-bet the nuts')).toBeInTheDocument();
  expect(screen.getByText('Price your draws')).toBeInTheDocument();
});

test('a legacy prose notebook row renders clamped, and expanding un-clamps without duplicating', () => {
  const prose = 'You keep folding rivers to tight players — that leaks value over many hands.';
  const past = [{ date: '2026-07-18', body: prose }];
  dash({ user: withNotebook(past) });
  fireEvent.click(screen.getByText(/Past reads · 1/));
  const headline = document.querySelector('.db-notebook-list .db-notebook-headline');
  expect(headline).toHaveTextContent(prose);
  expect(headline).toHaveClass('db-notebook-clamp');
  // Expand: the row un-clamps (full prose in place) and NO detail block renders —
  // a detail would repeat the same text (founder-reported duplication, July 19).
  fireEvent.click(headline);
  expect(headline).not.toHaveClass('db-notebook-clamp');
  expect(document.querySelector('.db-notebook-detail')).toBeNull();
  expect(screen.getAllByText(new RegExp('You keep folding rivers'))).toHaveLength(1);
});

test('gated guest sees the sign-in CTA instead of Deal Me In', () => {
  const onGuestSignIn = jest.fn();
  const guest = { ...createUser('Guest'), sessionsCompleted: 1 };
  render(<Dashboard user={guest} guest guestGated onGuestSignIn={onGuestSignIn}
    onStartSession={() => {}} onSignOut={() => {}} onRename={() => {}} />);

  expect(screen.queryByText(/Deal Me In/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Edit username')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText(/Sign In Free to Keep Playing/));
  expect(onGuestSignIn).toHaveBeenCalledWith('dashboard');
});

// ── CA-039 + CA-045 — honest streak display for lapsed users ────────────────
// All tests fix the clock to after-6pm so StreakWarning's time gate is open.
describe('StreakWarning + stats-chip honesty (CA-039, CA-045)', () => {
  const AFTER_6PM = new Date('2026-07-26T20:00:00');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(AFTER_6PM);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('stale streak: no "on the line" banner and stats chip shows 0 (CA-039)', () => {
    // lastSessionDate 205 days ago — streak is dead, rebuys can't cover
    const u = {
      ...createUser('Lapsed'),
      streak: 3,
      rebuys: 2,
      lastSessionDate: '2026-01-01',
      sessionsCompleted: 10,
    };
    dash({ user: u });
    // Banner must NOT say "on the line"
    expect(screen.queryByText(/on the line/)).not.toBeInTheDocument();
    // Stats chip must show 0, not 3
    const chip = document.querySelector('.db-stat-num:not(.db-stat-cream)');
    expect(chip).toHaveTextContent('0');
  });

  it('live streak (yesterday): banner shows with the count (CA-039)', () => {
    const u = {
      ...createUser('Active'),
      streak: 5,
      rebuys: 0,
      lastSessionDate: '2026-07-25',
      sessionsCompleted: 5,
    };
    dash({ user: u });
    expect(screen.getByText(/5-day streak/)).toBeInTheDocument();
    expect(screen.getByText(/on the line/)).toBeInTheDocument();
  });

  it('zero-session account: no db-streak-warning at all, even after 6pm (CA-045)', () => {
    const u = {
      ...createUser('NewUser'),
      streak: 0,
      rebuys: 0,
      lastSessionDate: null,
      sessionsCompleted: 0,
    };
    dash({ user: u });
    expect(document.querySelector('.db-streak-warning')).toBeNull();
  });

  it('existing user with streak 0 still sees the no-play-today nudge (CA-045 pin)', () => {
    // streak 0 but sessionsCompleted > 0 — must show the plain nudge, not the
    // "on the line" banner, and must NOT be suppressed by the CA-045 guard.
    const u = {
      ...createUser('Dormant'),
      streak: 0,
      rebuys: 0,
      lastSessionDate: '2026-07-24',
      sessionsCompleted: 5,
    };
    dash({ user: u });
    expect(document.querySelector('.db-streak-warning')).not.toBeNull();
    expect(screen.getByText(/You haven't played today/)).toBeInTheDocument();
    expect(screen.queryByText(/on the line/)).not.toBeInTheDocument();
  });
});

// ── CA-042: locked-schema countdown clamp ────────────────────────────────────
test('locked-schema card clamps countdown at zero when sessionsCompleted exceeds SCHEMA_UNLOCK_SESSIONS', () => {
  // CA-042: when a user's sessionsCompleted (12) exceeds SCHEMA_UNLOCK_SESSIONS (5),
  // the countdown was showing "Play -7 more sessions" — should show refresh copy instead.
  const u = {
    ...createUser('Exceeded'),
    sessionsCompleted: 12,
    schema: null, // locked state
  };
  dash({ user: u });

  const lockedCard = document.querySelector('.db-schema-locked-text');
  expect(lockedCard).toBeInTheDocument();
  // Must NOT contain "-7"
  expect(lockedCard).not.toHaveTextContent(/-7/);
  // Should show the refresh message
  expect(lockedCard).toHaveTextContent(/Play a session to refresh your profile/);
});

// ── C″ restructure (2026-07-29): the stat strip is gone ────────────────────
test('the recent-form strip no longer renders', () => {
  // hands populated (not just the session-level total/correct fields) — the
  // strip's own render gate (deriveRecentForm → total === windowHands.length)
  // only trips on real hands, so an empty `hands: []` array would pass this
  // assertion whether or not the strip was actually deleted.
  const hands = Array.from({ length: 5 }, (_, i) => ({ skill: 'potodds', result: i < 3 ? 'correct' : 'incorrect' }));
  dash({ user: { ...createUser('Stripless'), sessionsCompleted: 12,
    recentSessions: [{ date: '2026-07-28', correct: 3, total: 5, hands }] } });
  expect(document.querySelector('.db-form')).toBeNull();
  expect(screen.queryByText(/to resurface/i)).not.toBeInTheDocument();
});

// ── CA-031: GUEST_GATE_CTA single-source pin ──────────────────────────────────
test('CA-031: Dashboard.jsx does not hard-code the guest CTA string', () => {
  const fs = require('fs');
  const src = fs.readFileSync(
    require.resolve('./Dashboard'),
    'utf8'
  );
  // The literal must not appear in Dashboard.jsx — it should come from the constant
  expect(src).not.toMatch(/'Sign In Free to Keep Playing'/);
  expect(src).not.toMatch(/"Sign In Free to Keep Playing"/);
});

// ── Task 3: Queue chip on the Deal Me In button ─────────────────────────────
test('the Deal Me In button carries the remediation queue as its reason-to-play', () => {
  dash({ user: { ...createUser('Grinder'), sessionsCompleted: 12,
    scenarioHistory: { sc_001: { remediating: true }, sc_002: { remediating: true } } } });
  expect(screen.getByText(/2 missed hands waiting/)).toBeInTheDocument();
});

test('an empty queue shows no chip — silence, never a hedge', () => {
  dash({ user: { ...createUser('CleanSlate'), sessionsCompleted: 12 } });
  expect(screen.queryByText(/missed hand/i)).not.toBeInTheDocument();
});

test('a single queued hand reads in the singular', () => {
  dash({ user: { ...createUser('One'), sessionsCompleted: 12,
    scenarioHistory: { sc_001: { remediating: true } } } });
  expect(screen.getByText(/1 missed hand waiting/)).toBeInTheDocument();
});

test('guests get no queue chip', () => {
  dash({ user: { ...createUser('Guesty'),
    scenarioHistory: { sc_001: { remediating: true } } }, guest: true, onGuestSignIn: () => {} });
  expect(screen.queryByText(/missed hand/i)).not.toBeInTheDocument();
});
