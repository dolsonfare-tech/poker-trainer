// CA-040 tap-target guards. The disagree/dispute flow and guide controls ARE
// the playtest feedback-capture mechanism — on a 390×844 phone each one must
// present a ≥44px hit area (audit measured 13–43px). boundingBox() measures
// the border box, so padding-grown hit areas count while the negative-margin
// half of the idiom keeps the visual layout unchanged — no screenshot diffs.
import { baseUser, seedAndOpen, stubCoach, playSession, backToDashboard } from './helpers.mjs';

// MIN is the accessibility requirement; REQUIRED is what this guard enforces.
// They differ deliberately. An element sized to EXACTLY 44px sits on the
// comparison boundary, where sub-pixel layout rounding decides the result — so
// the check passes or fails at random. `.vg-close` was exactly 44×44 and flaked
// roughly 1 run in 4 (July 27 2026); `.db-account-btn` had the same problem and
// was lifted to 45px in ea857ae without generalising the lesson.
// Demanding 45 makes "exactly 44" a DETERMINISTIC failure rather than a coin
// flip, and costs one pixel. A flaky gate is worse than no gate: it trains
// everyone to re-run until green.
const MIN = 44;
const REQUIRED = MIN + 1;

// Two separate fixes live here, because the first one was not enough.
//
// 1. REQUIRED = 45, not 44. An element sized to exactly the threshold sits on
//    the comparison boundary, so the result is decided by layout rounding.
//    `.vg-close` was 44x44 and flaked ~1 run in 4; `.db-account-btn` had the
//    same problem and was lifted in ea857ae without generalising the lesson.
//    Demanding one extra pixel makes "exactly 44" a deterministic failure.
//
// 2. Compare the ROUNDED measurement. boundingBox() returns floats, and a
//    nominal 45px box can measure 44.99 — which failed a raw `>= 45` while the
//    log printed "h=45", claiming a size it was simultaneously rejecting.
//    Rounding first makes the check agree with what it reports, and with what
//    the CSS author wrote. A true 44px box still rounds to 44 and still fails.
//
// A flaky gate is worse than no gate: it trains everyone to re-run until green.
export default async function run({ browser, baseURL, check }) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await stubCoach(page);
  await seedAndOpen(page, baseURL, baseUser(), { cr_last_difficulty: 'intermediate' });

  const tap = async (label, selector, { width = false } = {}) => {
    const box = await page.locator(selector).first().boundingBox();
    const h = box ? Math.round(box.height) : 0;
    const w = box ? Math.round(box.width) : 0;
    const ok = !!box && h >= REQUIRED && (!width || w >= REQUIRED);
    check(`${label} hit area ≥ ${MIN}px (needs ≥ ${REQUIRED} off the boundary)`, ok,
      box ? `h=${h}${width ? ` w=${w}` : ''}` : 'missing');
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

  // ── Session summary: collapsed review row ──
  // `.ss-hr-row` only renders when at least one hand is missed this session
  // (SessionSummary.jsx gates "Hands to Review" on `missedHands.length > 0`),
  // and playSession() clicks the first enabled action on every hand with no
  // seeded RNG, so an individual session can land on zero misses (see
  // mobilefold.spec.mjs). Retry a few sessions rather than accept a guard
  // that flakes on that draw.
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.db-cta-btn', { timeout: 20000 });
  let hrRows = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    await playSession(page);
    hrRows = await page.locator('.ss-hr-row').count();
    if (hrRows > 0) break;
    await backToDashboard(page);
  }
  if (hrRows > 0) {
    await tap('.ss-hr-row', '.ss-hr-row');
  } else {
    check('.ss-hr-row hit area — SKIPPED (4 sessions in a row missed zero hands, no row rendered to measure)',
      true, 'skipped');
  }

  await page.close();
}
