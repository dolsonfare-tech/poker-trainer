// Comprehension surfaces: the FILE line (audit C1 — session reads must render
// at decision time; sc_167 is the flagship case) and the Coach's Notebook
// (history renders, newest excluded, legacy rows never duplicate — the
// July 19 founder-reported bug).
import { baseUser, uniformSkills, seedAndOpen, stubCoach, playSession } from './helpers.mjs';

export default async function run({ browser, baseURL, check }) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1080 } });
  await stubCoach(page);

  // ── FILE line: weight the dealer toward potodds (sc_167's skill) and play
  // until a FILE-carrying hand appears (10 table-file scenarios exist; two
  // sessions of weak-potodds dealing reliably surface one).
  const skills = uniformSkills('gray', 0, 0);
  skills.potodds = { rating: 'red', attempts: 10, correct: 2 };
  skills.reads = { rating: 'red', attempts: 10, correct: 2 };
  await seedAndOpen(page, baseURL, baseUser({ skills }), { cr_last_difficulty: 'intermediate' });

  let fileSeen = null;
  for (let session = 0; session < 3 && !fileSeen; session++) {
    await page.click('.db-cta-btn');
    await page.waitForSelector('.ds-confirm-btn', { timeout: 10000 });
    await page.click('.ds-confirm-btn');
    for (let i = 0; i < 5; i++) {
      await page.waitForSelector('.sc2-actions button:not([disabled])', { timeout: 20000 });
      if (!fileSeen && await page.locator('.st-tablefile').count() > 0) {
        fileSeen = (await page.textContent('.st-tablefile')).trim();
        const box = await page.locator('.st-tablefile').boundingBox();
        check('FILE line visible at decision time', !!box && box.width > 200, fileSeen.slice(0, 60));
      }
      await page.click('.sc2-actions button:not([disabled])');
      await page.waitForSelector('.next-btn', { timeout: 20000 });
      await page.click('.next-btn');
    }
    await page.waitForSelector('.summary-card', { timeout: 20000 });
    await page.click('.ss-dash-link');
    await page.waitForSelector('.db-cta-btn', { timeout: 20000 });
  }
  check('a table-file scenario surfaced within 3 weak-skill sessions', !!fileSeen);

  // ── Notebook: seeded history, expand, no legacy duplication
  const mk = (h) => JSON.stringify({ headline: h, evidence: ['e'], watchFor: 'w' });
  const prose = 'Legacy prose read that must appear exactly once when expanded.';
  const reads = [
    { date: '2026-07-19', body: mk('Newest read') },
    { date: '2026-07-18', body: mk('Older structured read') },
    { date: '2026-07-17', body: prose },
  ];
  await seedAndOpen(page, baseURL, baseUser({
    coachNote: { body: reads[0].body, focus: null },
    coachReads: reads,
  }));
  await page.click('text=/Past reads · 2/');
  await page.waitForSelector('.db-notebook-list', { timeout: 5000 });
  const list = await page.textContent('.db-notebook-list');
  check('notebook lists prior reads', list.includes('Older structured read'));
  check('newest read not duplicated into the list', !list.includes('Newest read'));
  await page.click('text=Legacy prose read');
  await page.waitForTimeout(200);
  const count = await page.locator(`text=${prose}`).count();
  check('expanded legacy read appears exactly once', count === 1, `count=${count}`);

  await page.close();
}
