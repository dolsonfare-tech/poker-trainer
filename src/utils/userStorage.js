const USER_KEY = 'cr_user';

const DEFAULT_SKILLS = {
  preflop:    { rating: 'gray', attempts: 0 },
  position:   { rating: 'gray', attempts: 0 },
  aggression: { rating: 'gray', attempts: 0 },
  betsize:    { rating: 'gray', attempts: 0 },
  bluffing:   { rating: 'gray', attempts: 0 },
  potodds:    { rating: 'gray', attempts: 0 },
  reads:      { rating: 'gray', attempts: 0 },
  opponent:   { rating: 'gray', attempts: 0 },
};

export function loadUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveUser(user) {
  try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch {}
}

export function createUser(username) {
  return {
    displayName: username,
    initials: username.slice(0, 2).toUpperCase(),
    streak: 0,
    lastSessionDate: null,
    sessionsCompleted: 0,
    skills: Object.fromEntries(
      Object.entries(DEFAULT_SKILLS).map(([k, v]) => [k, { ...v }])
    ),
    schema: null,
    coachNote: null,
    pokerScore: null,
    leaderboard: null,
  };
}

// ── Schema derivation ──────────────────────────────────────────────────────────
const SCHEMAS = [
  { name: 'The Conflict Avoider',      quote: "I shouldn't put money in unless I'm sure", index: '01', primary: ['aggression', 'bluffing'] },
  { name: 'The Gambler',               quote: 'Any two cards can win',                     index: '02', primary: ['preflop', 'potodds']    },
  { name: 'The Positional Blind Spot', quote: "I don't factor in where I'm sitting",       index: '03', primary: ['position']              },
  { name: 'The Results Thinker',       quote: 'If it worked, it was right',                index: '04', primary: ['reads']                 },
  { name: 'The Exploitable Regular',   quote: "I play my hand, not my opponent",           index: '05', primary: ['opponent']              },
  { name: 'The Overaggressor',         quote: 'Pressure wins pots regardless',             index: '06', primary: ['betsize']               },
];

const SKILL_DISPLAY = {
  preflop: 'Preflop', position: 'Position', aggression: 'Aggression',
  betsize: 'Bet Sizing', bluffing: 'Bluffing', potodds: 'Pot Odds',
  reads: 'Reads', opponent: 'Opponent',
};

function deriveSchema(skills, sessionsCompleted) {
  if (sessionsCompleted < 5) return null;

  let best = null;
  let bestScore = 0;

  for (const s of SCHEMAS) {
    let score = 0;
    for (const sk of s.primary) {
      const d = skills[sk];
      if (!d || d.attempts < 3) continue;
      if (d.rating === 'red')    score += 2;
      if (d.rating === 'yellow') score += 1;
    }
    if (score > bestScore) { bestScore = score; best = s; }
  }

  if (!best) return null;

  const affected = best.primary
    .filter(sk => skills[sk] && (skills[sk].rating === 'red' || skills[sk].rating === 'yellow'))
    .map(sk => ({ skill: SKILL_DISPLAY[sk], level: skills[sk].rating }));

  return { name: best.name, quote: best.quote, index: best.index, total: '06', affected };
}

function derivePokerScore(skills) {
  const SCORE = { green: 100, yellow: 65, red: 30 };
  const rated = Object.values(skills).filter(d => d.attempts >= 5 && d.rating !== 'gray');
  if (rated.length === 0) return null;
  return Math.round(rated.reduce((sum, d) => sum + (SCORE[d.rating] ?? 0), 0) / rated.length);
}

// ── Rating progression ─────────────────────────────────────────────────────────
const RATING_ORDER = ['red', 'yellow', 'green'];

function nextRating(current, result) {
  const base = current === 'gray' ? 'red' : current;
  const i = RATING_ORDER.indexOf(base);
  if (result === 'correct')   return RATING_ORDER[Math.min(i + 1, 2)];
  if (result === 'incorrect') return RATING_ORDER[Math.max(i - 1, 0)];
  return base;
}

// ── Streak ────────────────────────────────────────────────────────────────────
function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function calcStreak(user) {
  const today = todayString();
  if (user.lastSessionDate === today) return { streak: user.streak, lastSessionDate: today };
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const newStreak = user.lastSessionDate === yesterdayStr ? user.streak + 1 : 1;
  return { streak: newStreak, lastSessionDate: today };
}

// ── Apply session ─────────────────────────────────────────────────────────────
export function applySessionResults(user, skillResults, coachRead) {
  const skills = Object.fromEntries(
    Object.entries(user.skills).map(([key, data]) => {
      const result = skillResults[key];
      if (!result) return [key, data];
      return [key, { rating: nextRating(data.rating, result), attempts: data.attempts + 1 }];
    })
  );

  const { streak, lastSessionDate } = calcStreak(user);
  const sessionsCompleted = user.sessionsCompleted + 1;
  const schema     = deriveSchema(skills, sessionsCompleted);
  const pokerScore = derivePokerScore(skills);

  const weakest = Object.entries(skills)
    .filter(([, d]) => d.rating === 'red' && d.attempts > 0)
    .map(([k]) => SKILL_DISPLAY[k])[0] ?? null;

  const coachNote = coachRead
    ? { body: coachRead, focus: weakest }
    : user.coachNote;

  return { ...user, skills, streak, lastSessionDate, sessionsCompleted, schema, pokerScore, coachNote };
}
