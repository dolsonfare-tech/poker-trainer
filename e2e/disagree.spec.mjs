// Feedback capture e2e (CA-050, Wave 4). Previously ZERO e2e coverage; the
// beta feedback form had no test of ANY kind for its submit path until today.
//
// These two surfaces are how the founder finds out anything is wrong — the
// disagree box reports a bad grading, the beta form reports everything else.
// A silent break here does not look like a bug. It looks like quiet users.
//
// jest now covers both components and their schema contracts. What only this
// layer can show is that the controls are actually reachable in a real browser:
// the disagree box sits at the BOTTOM of a feedback overlay that appears
// mid-session, and the beta form sits at the bottom of a scrolling dashboard.
// Either one can render perfectly and still be unusable if it lands outside the
// scrollable area.
import { baseUser, seedAndOpen, stubCoach } from './helpers.mjs';

const VW = 390, VH = 844;

export default async function run({ browser, baseURL, check }) {
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  await stubCoach(page);
  await seedAndOpen(page, baseURL, baseUser(), { cr_last_difficulty: 'intermediate' });

  // ── Disagree box: reachable, then a one-tap report ───────────────────────
  await page.click('.db-cta-btn');
  await page.waitForSelector('.ds-confirm-btn', { timeout: 10000 });
  await page.click('.ds-confirm-btn');
  await page.waitForSelector('.sc2-actions button:not([disabled])', { timeout: 20000 });
  await page.click('.sc2-actions button:not([disabled])');
  await page.waitForSelector('.fb-disagree-toggle', { timeout: 20000 });

  const toggle = await page.locator('.fb-disagree-toggle').boundingBox();
  check('disagree prompt has a real hit box', !!toggle && toggle.width > 100 && toggle.height > 10,
    toggle ? `w=${Math.round(toggle.width)} h=${Math.round(toggle.height)}` : 'missing');
  check('disagree prompt fits the viewport width',
    !!toggle && toggle.x >= 0 && toggle.x + toggle.width <= VW,
    toggle ? `right=${Math.round(toggle.x + toggle.width)}` : 'missing');

  // It may sit below the fold on a long feedback panel — what matters is that
  // scrolling brings it into view. An element the page cannot scroll to is
  // invisible in practice however well it renders.
  const reachable = await page.evaluate(() => {
    const el = document.querySelector('.fb-disagree-toggle');
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom) };
  });
  check('disagree prompt can be scrolled into view',
    reachable.top < VH && reachable.bottom > 0, `top=${reachable.top}`);

  await page.click('.fb-disagree-toggle');
  await page.waitForSelector('.fb-disagree-chip', { timeout: 5000 });
  const chips = await page.locator('.fb-disagree-chip').count();
  check('four reasons offered', chips === 4, `n=${chips}`);

  const chipBox = await page.locator('.fb-disagree-chip').first().boundingBox();
  check('reason chips fit the viewport width',
    !!chipBox && chipBox.x >= 0 && chipBox.x + chipBox.width <= VW,
    chipBox ? `right=${Math.round(chipBox.x + chipBox.width)}` : 'missing');

  await page.locator('.fb-disagree-chip').first().click();
  await page.waitForSelector('.fb-disagree-thanks', { timeout: 5000 });
  check('the flag is acknowledged', await page.locator('.fb-disagree-thanks').count() === 1);
  // The chips are replaced, not merely disabled — no second flag for one hand.
  check('reason chips are withdrawn after reporting',
    await page.locator('.fb-disagree-chip').count() === 0);

  // Moving to the next hand resets the box: a per-hand control, not a per-
  // session one. A sticky "thanks" would silently block every later report.
  await page.click('.next-btn');
  await page.waitForSelector('.sc2-actions button:not([disabled])', { timeout: 20000 });
  await page.click('.sc2-actions button:not([disabled])');
  await page.waitForSelector('.fb-disagree-toggle', { timeout: 20000 });
  check('the next hand offers a fresh disagree prompt',
    await page.locator('.fb-disagree-thanks').count() === 0);

  // ── Beta feedback form on the dashboard ──────────────────────────────────
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.db-cta-btn', { timeout: 20000 });

  const openBox = await page.evaluate(() => {
    const el = document.querySelector('.db-beta-toggle');
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), w: Math.round(r.width) };
  });
  check('beta feedback prompt exists and scrolls into view',
    !!openBox && openBox.top < VH && openBox.w > 100,
    openBox ? `top=${openBox.top} w=${openBox.w}` : 'missing');

  await page.click('.db-beta-toggle');
  await page.waitForSelector('.db-beta-form', { timeout: 5000 });

  const send = page.locator('.db-beta-send');
  check('send is refused before a category and text are given',
    await send.isDisabled());

  await page.locator('.db-beta-cat').first().click();
  check('send still refused with a category but no text', await send.isDisabled());

  await page.fill('.db-beta-text', 'E2E: the disagree chips were unreachable on my phone.');
  check('send enabled once both are present', await send.isEnabled());

  await send.click();
  await page.waitForSelector('.db-beta-thanks', { timeout: 5000 });
  check('the report is acknowledged', await page.locator('.db-beta-thanks').count() === 1);
  // The form is gone — a second submit of the same text is not offered.
  check('the form closes after sending', await page.locator('.db-beta-form').count() === 0);

  await page.close();
}
