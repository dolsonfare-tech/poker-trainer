// CA-040 tap-target guards. The disagree/dispute flow and guide controls ARE
// the playtest feedback-capture mechanism — on a 390×844 phone each one must
// present a ≥44px hit area (audit measured 13–43px). boundingBox() measures
// the border box, so padding-grown hit areas count while the negative-margin
// half of the idiom keeps the visual layout unchanged — no screenshot diffs.
import { baseUser, seedAndOpen, stubCoach } from './helpers.mjs';

const MIN = 44;

export default async function run({ browser, baseURL, check }) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await stubCoach(page);
  await seedAndOpen(page, baseURL, baseUser(), { cr_last_difficulty: 'intermediate' });

  const tap = async (label, selector, { width = false } = {}) => {
    const box = await page.locator(selector).first().boundingBox();
    const ok = !!box && box.height >= MIN && (!width || box.width >= MIN);
    check(`${label} hit area ≥ ${MIN}px`, ok,
      box ? `h=${Math.round(box.height)}${width ? ` w=${Math.round(box.width)}` : ''}` : 'missing');
  };

  // ── Dashboard: account button ──
  await tap('.db-account-btn', '.db-account-btn');

  // ── VillainGuide (topbar info button): close + tab ──
  await page.click('.info-btn');
  await page.waitForSelector('.vg-close', { timeout: 10000 });
  await tap('.vg-close', '.vg-close', { width: true });
  await tap('.vg-tab', '.vg-tab');
  await page.click('.vg-close');

  // ── Table Reads feedback: guide link + next button ──
  await page.click('.db-tablereads-link');
  await page.waitForSelector('.tr-replay', { timeout: 10000 });
  await page.click('.tr-replay'); // skip the street-by-street reveal
  await page.waitForSelector('.tr-chip', { timeout: 10000 });
  await page.click('.tr-chip');
  await page.waitForSelector('.tr-next-btn', { timeout: 10000 });
  await tap('.tr-guide-link', '.tr-guide-link');
  await tap('.tr-next-btn', '.tr-next-btn');

  // ── Session feedback overlay: disagree toggle, then its reason chips ──
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.db-cta-btn', { timeout: 20000 });
  await page.click('.db-cta-btn');
  await page.waitForSelector('.ds-confirm-btn', { timeout: 10000 });
  await page.click('.ds-confirm-btn');
  await page.waitForSelector('.sc2-actions button:not([disabled])', { timeout: 20000 });
  await page.click('.sc2-actions button:not([disabled])');
  await page.waitForSelector('.fb-disagree-toggle', { timeout: 20000 });
  await tap('.fb-disagree-toggle', '.fb-disagree-toggle');
  await page.click('.fb-disagree-toggle');
  await page.waitForSelector('.fb-disagree-chip', { timeout: 5000 });
  await tap('.fb-disagree-chip', '.fb-disagree-chip');

  await page.close();
}
