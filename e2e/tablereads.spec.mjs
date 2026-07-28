// Table Reads e2e (CA-050, Wave 4). Previously ZERO e2e coverage.
//
// Two things only this layer can catch:
//
// 1. Layout collapse. Table Reads renders its own screen — its own replay
//    board, its own chip row — and none of it is covered by the .sc2-* geometry
//    guards. The July 18 table-collapse shipped to production with every
//    functional test green because a grid item with no explicit width rendered
//    as a vertical line. Nothing structural prevents the same class of bug
//    here, so the collapse guards are mirrored onto this screen.
//
// 2. Mode-local scoring. DECISIONS.md and the founder decision of July 18 say
//    Table Reads writes to its OWN tally and never to the 8 skill ratings,
//    streak, or session count — observation accuracy is not decision accuracy,
//    and a future Pro gate depends on the separation holding. That claim spans
//    the component, persistence, and the dashboard; a unit test can only see
//    one of the three. Here it is asserted end to end against real localStorage.
import { baseUser, seedAndOpen, stubCoach } from './helpers.mjs';

const readUser = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('cr_user')));
const readTR = (page) => page.evaluate(() =>
  JSON.parse(localStorage.getItem('cr_table_reads_stats') || 'null'));

export default async function run({ browser, baseURL, check }) {
  // Mobile: the tightest layout, and where a collapse or a below-fold chip row
  // actually strands a player.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await stubCoach(page);
  await seedAndOpen(page, baseURL, baseUser(), { cr_last_difficulty: 'intermediate' });

  const before = await readUser(page);

  await page.click('.db-tablereads-link');
  await page.waitForSelector('.tr-replay', { timeout: 10000 });

  // ── Collapse guards (the July 18 lesson, applied to this screen) ──────────
  const replay = await page.locator('.tr-replay').boundingBox();
  check('replay board has real width (collapse guard)', !!replay && replay.width > 200,
    replay ? `w=${Math.round(replay.width)}` : 'missing');
  check('replay board has real height', !!replay && replay.height > 60,
    replay ? `h=${Math.round(replay.height)}` : 'missing');
  check('replay board fits the viewport width', !!replay && replay.x >= 0 && replay.x + replay.width <= 390,
    replay ? `x=${Math.round(replay.x)} right=${Math.round(replay.x + replay.width)}` : 'missing');

  // The question leads, before any chips — closed-book while the hand plays.
  check('question renders before the chips', await page.locator('.tr-question-lead').count() > 0);
  check('chips withheld until the hand is fully revealed',
    await page.locator('.tr-chip').count() === 0);

  await page.click('.tr-replay'); // skip the street-by-street reveal
  await page.waitForSelector('.tr-chip', { timeout: 10000 });

  const rows = await page.locator('.tr-row').count();
  check('replay rows rendered after the skip', rows >= 2, `rows=${rows}`);

  // ── The chip row must be reachable, not stranded below the fold ───────────
  const chips = page.locator('.tr-chip');
  const chipCount = await chips.count();
  check('four archetype chips offered', chipCount === 4, `n=${chipCount}`);
  for (let i = 0; i < chipCount; i++) {
    const b = await chips.nth(i).boundingBox();
    const bottom = b ? Math.round(b.y + b.height) : 0;
    // Chips may sit below the fold on a long replay, but must be scrollable to
    // and never clipped horizontally — a chip off the right edge is untappable.
    check(`chip ${i + 1} within the viewport width`,
      !!b && b.x >= 0 && b.x + b.width <= 390, b ? `right=${Math.round(b.x + b.width)}` : 'missing');
    if (i === 0) check('first chip is positioned (not collapsed)', !!b && b.height > 20, `bottom=${bottom}`);
  }

  // ── Answer → feedback teaches, regardless of right or wrong ──────────────
  await chips.first().click();
  await page.waitForSelector('.tr-next-btn', { timeout: 10000 });
  check('verdict shown after the pick', await page.locator('.tr-verdict').count() > 0);
  const tell = (await page.textContent('.tr-tell')) || '';
  check('the tell is always taught, right or wrong', tell.trim().length > 20,
    `${tell.trim().slice(0, 40)}…`);

  // ── Play out the remaining hands to the summary ──────────────────────────
  for (let i = 1; i < 5; i++) {
    await page.click('.tr-next-btn');
    await page.waitForSelector('.tr-replay', { timeout: 10000 });
    await page.click('.tr-replay');
    await page.waitForSelector('.tr-chip', { timeout: 10000 });
    await page.locator('.tr-chip').first().click();
    await page.waitForSelector('.tr-next-btn', { timeout: 10000 });
  }
  await page.click('.tr-next-btn');
  await page.waitForSelector('.tr-summary', { timeout: 10000 });

  const score = (await page.textContent('.tr-score')) || '';
  check('summary reports a score out of five', /\d+ \/ 5/.test(score), score.trim());
  check('summary states the scoring is separate',
    ((await page.textContent('.tr-scored-note')) || '').includes('separately'));

  // ── Mode-local scoring: the whole point of the separation ────────────────
  const trStats = await readTR(page);
  check('Table Reads wrote its own lifetime tally', !!trStats && trStats.attempts === 5,
    `attempts=${trStats?.attempts}`);

  const after = await readUser(page);
  check('…and did NOT touch the session count',
    after.sessionsCompleted === before.sessionsCompleted,
    `${before.sessionsCompleted} → ${after.sessionsCompleted}`);
  check('…did NOT touch the streak', after.streak === before.streak,
    `${before.streak} → ${after.streak}`);
  check('…did NOT touch the Poker IQ', after.pokerScore === before.pokerScore,
    `${before.pokerScore} → ${after.pokerScore}`);
  check('…and did NOT write to any of the 8 skill ratings',
    JSON.stringify(after.skills) === JSON.stringify(before.skills));

  // ── Re-deal returns to a live first hand ─────────────────────────────────
  await page.click('.tr-again-btn');
  await page.waitForSelector('.tr-replay', { timeout: 10000 });
  const count = (await page.textContent('.tr-count')) || '';
  check('“Read Another Table” restarts at hand 1', count.includes('Hand 1 of'), count.trim());

  // ── Back to the dashboard ────────────────────────────────────────────────
  await page.click('.tr-replay');
  await page.waitForSelector('.tr-chip', { timeout: 10000 });
  await page.locator('.tr-chip').first().click();
  await page.waitForSelector('.tr-next-btn', { timeout: 10000 });
  for (let i = 1; i < 5; i++) {
    await page.click('.tr-next-btn');
    await page.waitForSelector('.tr-replay', { timeout: 10000 });
    await page.click('.tr-replay');
    await page.waitForSelector('.tr-chip', { timeout: 10000 });
    await page.locator('.tr-chip').first().click();
    await page.waitForSelector('.tr-next-btn', { timeout: 10000 });
  }
  await page.click('.tr-next-btn');
  await page.waitForSelector('.tr-back-link', { timeout: 10000 });
  await page.click('.tr-back-link');
  await page.waitForSelector('.db-cta-btn', { timeout: 20000 });
  check('back link returns to the dashboard', await page.locator('.db-cta-btn').count() > 0);

  await page.close();
}
