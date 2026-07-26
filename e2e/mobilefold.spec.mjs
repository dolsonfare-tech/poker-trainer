// CA-038 mobile-fold guards. At 390×844 the July 2026 audit measured ZERO
// action buttons visible on a dealt hand (all below the fold) and the "How you
// got here" ticker fully off-screen — the 60s clock runs while a phone player
// discovers scrolling. These checks pin the fix: from scrollTop 0, with NO
// scrolling, every action button and at least the top of the ticker must be
// inside the 844px fold, on hand 1, at BOTH difficulties; the dashboard's
// primary CTA must sit above the fold too. Also re-asserts the July 18
// table-collapse guard at phone width (desktop smoke covers 1200px only).
import { baseUser, seedAndOpen, stubCoach, STRUCTURED_READ } from './helpers.mjs';

const VIEW = { width: 390, height: 844 };

export default async function run({ browser, baseURL, check }) {
  const page = await browser.newPage({ viewport: VIEW });
  await stubCoach(page);
  // Seed the REAL-USER dashboard height: a coach read + notebook history make
  // the Player Profile card its production size (the audit measured the CTA
  // below the fold on a played account, not a bare one).
  const read = JSON.stringify(STRUCTURED_READ);
  await seedAndOpen(page, baseURL, baseUser({
    coachNote: { body: read, focus: 'potodds' },
    coachReads: [{ date: '2026-07-24', body: read }, { date: '2026-07-23', body: read }],
  }), { cr_last_difficulty: 'intermediate' });

  // ── Dashboard: primary CTA above the fold, no scroll ──
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  const cta = await page.locator('.db-cta-btn').boundingBox();
  check('dashboard CTA fully above the fold', !!cta && cta.y + cta.height <= VIEW.height,
    cta ? `bottom=${Math.round(cta.y + cta.height)}` : 'missing');

  // ── Gameplay: hand 1 at each difficulty, measured from scrollTop 0 ──
  const guardHand = async (difficulty) => {
    await page.evaluate((d) => localStorage.setItem('cr_last_difficulty', d), difficulty);
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.db-cta-btn', { timeout: 20000 });
    await page.click('.db-cta-btn');
    await page.waitForSelector('.ds-confirm-btn', { timeout: 10000 });
    await page.click('.ds-confirm-btn');
    await page.waitForSelector('.sc2-actions button:not([disabled])', { timeout: 20000 });
    // Playwright clicks auto-scroll; measure what a player sees from the top.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    const scrollY = await page.evaluate(() => window.scrollY);
    check(`[${difficulty}] measuring from scrollTop 0`, scrollY === 0, `scrollY=${scrollY}`);

    // July 18 collapse class, at phone width
    const table = await page.locator('.sc2-table').boundingBox();
    check(`[${difficulty}] table has real width at 390px (collapse guard)`,
      !!table && table.width >= 300, table ? `w=${Math.round(table.width)}` : 'missing');
    check(`[${difficulty}] table has real height at 390px`,
      !!table && table.height >= 240, table ? `h=${Math.round(table.height)}` : 'missing');

    // Every action button fully inside the fold — the playtest-critical fix
    const buttons = page.locator('.sc2-actions button');
    const n = await buttons.count();
    check(`[${difficulty}] 2-3 action buttons rendered`, n >= 2 && n <= 3, `n=${n}`);
    for (let i = 0; i < n; i++) {
      const b = await buttons.nth(i).boundingBox();
      check(`[${difficulty}] action button ${i + 1} fully above the fold`,
        !!b && b.y + b.height <= VIEW.height,
        b ? `bottom=${Math.round(b.y + b.height)}` : 'missing');
    }

    // Ticker at least partially visible without scrolling
    const hist = await page.locator('.sc2-history').boundingBox();
    check(`[${difficulty}] ticker top inside the fold`, !!hist && hist.y < VIEW.height,
      hist ? `top=${Math.round(hist.y)}` : 'missing');

    // Hero cluster containment (July 26 regression: the 315px felt compression
    // left the fixed-size hero cluster anchored at bottom:-8px, putting the
    // cards on the felt border and the YOU chip outside the table box).
    // Founder-approved contract at phone width: cards inside the felt oval,
    // label/chip inside the table box. Desktop deliberately straddles the rail
    // (original canvas design) — this guard is mobile-only.
    const felt = await page.locator('.sc2-felt').boundingBox();
    const cards = await page.locator('.sc2-hero-cards').boundingBox();
    const chip = await page.locator('.sc2-you-chip').boundingBox();
    check(`[${difficulty}] hero cards inside the felt oval`,
      !!cards && !!felt && cards.y + cards.height <= felt.y + felt.height,
      cards && felt ? `cards bottom=${Math.round(cards.y + cards.height)} felt bottom=${Math.round(felt.y + felt.height)}` : 'missing');
    check(`[${difficulty}] YOU chip inside the table box`,
      !!chip && !!table && chip.y + chip.height <= table.y + table.height + 0.5,
      chip && table ? `chip bottom=${Math.round(chip.y + chip.height)} table bottom=${Math.round(table.y + table.height)}` : 'missing');
  };

  await guardHand('intermediate');
  await guardHand('beginner');

  await page.close();
}
