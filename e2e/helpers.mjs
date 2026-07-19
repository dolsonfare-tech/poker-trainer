// Shared helpers for the e2e suite. Plain async functions, no test framework —
// specs export `run(ctx)` and report through ctx.check(); e2e/run.mjs
// orchestrates. All specs run against the static production build in
// localStorage mode and stub /api/coach-read (a Vercel function the static
// server doesn't have).

export const SKILL_KEYS = ['preflop', 'position', 'aggression', 'betsize', 'bluffing', 'potodds', 'reads', 'opponent'];

export function uniformSkills(rating = 'yellow', attempts = 10, correct = 6) {
  return Object.fromEntries(SKILL_KEYS.map(k => [k, { rating, attempts, correct }]));
}

export function baseUser(overrides = {}) {
  return {
    displayName: 'E2E', initials: 'EE',
    streak: 1, lastSessionDate: '2026-01-01', rebuys: 0,
    sessionsCompleted: 12, bestSessionCorrect: 4,
    skills: uniformSkills(), coachNote: null, pokerScore: 60,
    scenarioHistory: {}, recentHands: [], coachReads: [],
    ...overrides,
  };
}

export const STRUCTURED_READ = {
  headline: 'You are playing your cards, not the villain.',
  evidence: ['Fired a bluff into the calling station; bluffs need a folder.'],
  watchFor: 'Let his tendencies override your default plan.',
};

export async function stubCoach(page, read = STRUCTURED_READ) {
  await page.route('**/api/coach-read', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ text: typeof read === 'string' ? read : JSON.stringify(read) }),
    }));
}

// Fake-clock shim: Date is offset by localStorage.__day_offset days. Installed
// before any app code runs; specs advance days with setDay().
export async function installClock(page) {
  await page.addInitScript(() => {
    const RealDate = Date;
    const off = () => Number(localStorage.getItem('__day_offset') || 0) * 86400000;
    // eslint-disable-next-line no-global-assign
    Date = class extends RealDate {
      constructor(...args) { if (args.length === 0) super(RealDate.now() + off()); else super(...args); }
      static now() { return RealDate.now() + off(); }
    };
  });
}

export async function seedAndOpen(page, baseURL, user, extra = {}) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([u, kv]) => {
    localStorage.setItem('cr_user', JSON.stringify(u));
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
  }, [user, extra]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.db-cta-btn', { timeout: 20000 });
}

export async function setDay(page, offset) {
  await page.evaluate((o) => localStorage.setItem('__day_offset', String(o)), offset);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.db-cta-btn', { timeout: 20000 });
}

export function dayStr(offsetDays) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Plays one full 5-hand session from the dashboard; returns summary-card text.
// `perHand` (optional) runs before each decision — geometry guards live there.
export async function playSession(page, { perHand } = {}) {
  await page.click('.db-cta-btn');
  await page.waitForSelector('.ds-confirm-btn', { timeout: 10000 });
  await page.click('.ds-confirm-btn');
  for (let i = 0; i < 5; i++) {
    await page.waitForSelector('.sc2-actions button:not([disabled])', { timeout: 20000 });
    if (perHand) await perHand(i);
    await page.click('.sc2-actions button:not([disabled])');
    await page.waitForSelector('.next-btn', { timeout: 20000 });
    await page.click('.next-btn');
  }
  await page.waitForSelector('.summary-card', { timeout: 20000 });
  await page.waitForTimeout(300);
  return page.textContent('.summary-card');
}

export async function backToDashboard(page) {
  await page.click('.ss-dash-link');
  await page.waitForSelector('.db-cta-btn', { timeout: 20000 });
}

export const loadUser = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('cr_user')));
