// CA-038 mobile-fold guards. At 390×844 the July 2026 audit measured ZERO
// action buttons visible on a dealt hand (all below the fold) and the "How you
// got here" ticker fully off-screen — the 60s clock runs while a phone player
// discovers scrolling. These checks pin the fix: from scrollTop 0, with NO
// scrolling, every action button and at least the top of the ticker must be
// inside the 844px fold, on hand 1, at BOTH difficulties; the dashboard's
// primary CTA must sit above the fold too. Also re-asserts the July 18
// table-collapse guard at phone width (desktop smoke covers 1200px only).
import { baseUser, seedAndOpen, stubCoach, playSession, STRUCTURED_READ } from './helpers.mjs';

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

  // ── Chrome must NOT be re-compressed (founder report, July 27 2026) ──
  // CA-038 originally shrank the header to 26px and the logo to 1.8rem to buy
  // fold height. It bought none: the CTA is position:sticky, so it pins to the
  // viewport bottom no matter how tall the content above it is — the CTA's
  // bottom edge measures 759px with the compression and 759px without it. The
  // squeeze was pure cost, and the founder reported the result as "all squished
  // together". This guard stops a future fold optimisation from re-taking it.
  const header = await page.locator('.header').boundingBox();
  check('mobile chrome is not compressed (header keeps its desktop size)',
    !!header && header.height >= 120, header ? `h=${Math.round(header.height)}` : 'missing');
  const logoPx = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('.logo')).fontSize));
  check('logo keeps its full size on mobile', logoPx >= 38, `${logoPx}px`);

  // The sticky bar must fade its scroll edge. With a hard opaque edge, content
  // scrolling under it was sliced mid-sentence (the Coach's Read was visibly
  // guillotined), which reads as broken rather than as "there is more below".
  const fade = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.db-cta-block'), '::before');
    return { content: cs.content, bg: cs.backgroundImage };
  });
  check('sticky CTA fades the scroll edge instead of cutting it',
    fade.content !== 'none' && /gradient/.test(fade.bg), fade.bg.slice(0, 40));

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
    const chip = await page.locator('.sc2-you-chip').boundingBox();

    // The felt is an ELLIPSE, so comparing bounding-box bottoms is not enough:
    // the hero cards are ~86px wide, and at that horizontal offset the curve
    // sits well above the bbox bottom. The old bbox form of this check passed
    // (cards bottom 559 vs felt bottom 561) while the card corners were
    // measurably outside the oval at 1.041 — the founder saw the overlap on a
    // real device that the guard called clean. Corners against the real curve.
    const cardCorners = await page.evaluate(() => {
      const c = document.querySelector('.sc2-hero-cards').getBoundingClientRect();
      const f = document.querySelector('.sc2-felt').getBoundingClientRect();
      const cx = f.left + f.width / 2, cy = f.top + f.height / 2;
      const rx = f.width / 2, ry = f.height / 2;
      const n = (x, y) => ((x - cx) ** 2) / (rx * rx) + ((y - cy) ** 2) / (ry * ry);
      return Math.max(n(c.left, c.bottom), n(c.right, c.bottom));
    });
    check(`[${difficulty}] hero cards inside the felt OVAL (corner test, not bbox)`,
      cardCorners <= 0.99, `worst corner=${cardCorners.toFixed(3)} (>1 = outside the curve)`);
    check(`[${difficulty}] YOU chip inside the table box`,
      !!chip && !!table && chip.y + chip.height <= table.y + table.height + 0.5,
      chip && table ? `chip bottom=${Math.round(chip.y + chip.height)} table bottom=${Math.round(table.y + table.height)}` : 'missing');

    // Hand name vs the felt rim (tester report, July 27 2026). The name printed
    // straight through the 3px gold border at every width 320-414, so a tester
    // read "SIX-FIVE SUITED" as "Sive-five suited". The name must start BELOW
    // the rim, on the dark band. 3px = the felt's border width.
    const name = await page.locator('.sc2-hand-name').boundingBox();
    check(`[${difficulty}] hand name clears the felt rim`,
      !!name && !!felt && name.y >= felt.y + felt.height + 3,
      name && felt ? `name top=${Math.round(name.y)} rim bottom=${Math.round(felt.y + felt.height + 3)}` : 'missing');

    // ...and is never truncated. A `max-width: %` on the name resolves against
    // the shrink-to-fit `.sc2-hero`, which silently ellipsises it — a fix for
    // the rim collision was drafted that way and hid the player's own hand
    // ("QUEEN-SEVEN OFF…"). Unreadable beats overlapping, so pin both.
    const nameFits = await page.evaluate(() => {
      const n = document.querySelector('.sc2-hand-name');
      return !!n && n.scrollWidth <= n.clientWidth + 1;
    });
    check(`[${difficulty}] hand name renders in full (no ellipsis)`, nameFits);

    const nameInFelt = await page.evaluate(() => {
      const n = document.querySelector('.sc2-hand-name').getBoundingClientRect();
      const f = document.querySelector('.sc2-felt').getBoundingClientRect();
      return n.left >= f.left && n.right <= f.right;
    });
    check(`[${difficulty}] hand name within the felt's horizontal span`, nameInFelt);
  };

  await guardHand('intermediate');
  await guardHand('beginner');

  // ── Session summary: the chain button must clear the fold ──
  // Measured July 2026: with full-size review rows the summary was 1814px tall
  // and "Deal Next Session" sat at y=1640 on an 844px screen — nearly two
  // screens of scrolling to continue. Removing the coach read got it to 1375;
  // collapsing Hands to Review got it above the fold. This guard is what stops
  // the page silently growing back: every future addition answers to it.
  //
  // guardHand() leaves the page mid-hand (action buttons dealt, not yet
  // clicked) rather than at the dashboard, so navigate back before
  // playSession() — it starts by clicking `.db-cta-btn`.
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.db-cta-btn', { timeout: 20000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await playSession(page);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);

  const chain = await page.locator('.restart-btn').boundingBox();
  check('summary chain button fully above the fold', !!chain && chain.y + chain.height <= VIEW.height,
    chain ? `bottom=${Math.round(chain.y + chain.height)} fold=${VIEW.height}` : 'missing');

  const collapsed = await page.locator('.ss-hr-detail').count();
  check('review rows start collapsed', collapsed === 0, `expanded=${collapsed}`);

  await page.close();
}
