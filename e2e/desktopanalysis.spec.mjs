// Desktop side-by-side Hand Analysis (tester feedback #1, July 2026).
//
// The complaint: on desktop the analysis covered the table, hiding the board
// you had just played at the moment you were being told what to do with it.
// The fix is a >=1280px breakpoint that moves the panel into a second grid
// column (App.css, `.sc2-analysis`).
//
// This is the measured half of the ratchet, and it deliberately checks BOTH
// directions. A one-sided "the panel is beside the table" check passes just as
// happily if the breakpoint leaks down to phones, where there is no room for
// two columns and the stacked overlay is correct. So: wide asserts separation,
// narrow asserts the overlay still covers.
//
// It also re-runs the collapse guard at the new breakpoint. Changing
// `grid-template-columns` on `.sc2-stage` is precisely the change class the
// `.sc2-table` width law in CLAUDE.md was written for — the July 18 bug shipped
// a 0px-wide table while every functional test stayed green.
import { baseUser, seedAndOpen, stubCoach } from './helpers.mjs';

const WIDE = { width: 1440, height: 900 };   // above the 1280 breakpoint
const NARROW = { width: 1200, height: 1080 }; // below it — stacked fallback

const overlaps = (a, b) => !!a && !!b &&
  a.x < b.x + b.width && b.x < a.x + a.width &&
  a.y < b.y + b.height && b.y < a.y + a.height;

// Deals one hand, stopping while it is still live.
async function dealOneHand(page, baseURL) {
  await stubCoach(page);
  await seedAndOpen(page, baseURL, baseUser(), { cr_last_difficulty: 'intermediate' });
  await page.click('.db-cta-btn');
  await page.waitForSelector('.ds-confirm-btn', { timeout: 10000 });
  await page.click('.ds-confirm-btn');
  await page.waitForSelector('.sc2-actions button:not([disabled])', { timeout: 20000 });
}

// Answers the live hand, leaving the analysis on screen.
async function answerHand(page) {
  await page.click('.sc2-actions button:not([disabled])');
  await page.waitForSelector('.sc2-overlay', { timeout: 20000 });
  await page.waitForTimeout(350); // let the sc2-rise animation settle before measuring
}

async function playToAnalysis(page, baseURL) {
  await dealOneHand(page, baseURL);
  await answerHand(page);
}

export default async function run({ browser, baseURL, check }) {
  // ── Wide: the panel sits beside the felt ─────────────────────────────────
  const wide = await browser.newPage({ viewport: WIDE });
  await dealOneHand(wide, baseURL);

  // Baseline while the hand is still live — the ticker's resting place.
  const playHistory = await wide.locator('.sc2-history').boundingBox();
  const playTable = await wide.locator('.sc2-table').boundingBox();

  await answerHand(wide);

  const table = await wide.locator('.sc2-table').boundingBox();
  const panel = await wide.locator('.sc2-overlay').boundingBox();
  const history = await wide.locator('.sc2-history').boundingBox();

  // The founder report this layout was corrected for (July 28): opening the
  // analysis used to drop the hand-so-far by 192px and slide the felt out from
  // under it, leaving the ticker stranded beneath the analysis panel. Both
  // halves are pinned here — it must not move, and it must stay over the felt.
  check('the hand-so-far does not drop when the analysis opens',
    !!history && !!playHistory && Math.abs(history.y - playHistory.y) <= 1,
    history && playHistory ? `play.y=${Math.round(playHistory.y)} analysis.y=${Math.round(history.y)}` : 'missing');
  // The felt and the ticker are one unit: whatever the split does to the
  // gameplay column, their offset from each other must survive it. This is the
  // alignment half of the report — the ticker stranded mid-card was the felt
  // sliding out from under it, not the ticker moving on its own.
  check('the hand-so-far holds its offset from the felt',
    !!history && !!table && !!playHistory && !!playTable &&
    Math.abs((history.x - table.x) - (playHistory.x - playTable.x)) <= 1,
    history && table && playHistory && playTable
      ? `play offset=${Math.round(playHistory.x - playTable.x)} analysis offset=${Math.round(history.x - table.x)}`
      : 'missing');
  // Fit-content collapse guard. `.sc2-history` is a grid item with margin:auto,
  // so dropping its explicit width silently shrinks it to its longest line —
  // the same class of bug as the July 18 table collapse, and just as invisible.
  check('the hand-so-far keeps its full width in both states',
    !!history && !!playHistory &&
    history.width === playHistory.width && history.width >= 600,
    history && playHistory ? `play=${Math.round(playHistory.width)} analysis=${Math.round(history.width)}` : 'missing');
  check('the hand-so-far stays within the table column, not under the panel',
    !!history && !!table &&
    history.x >= table.x && history.x + history.width <= table.x + table.width,
    history && table
      ? `history=${Math.round(history.x)}..${Math.round(history.x + history.width)} table=${Math.round(table.x)}..${Math.round(table.x + table.width)}`
      : 'missing');
  // The felt keeps its exact playing size across the transition — a table that
  // resized between playing and reviewing would break the comparison the panel
  // is asking the player to make.
  check('the felt keeps its playing dimensions',
    !!table && !!playTable &&
    table.width === playTable.width && table.height === playTable.height,
    table && playTable ? `play=${Math.round(playTable.width)} analysis=${Math.round(table.width)}` : 'missing');

  check('table survives the two-column stage (collapse guard)',
    !!table && table.width >= 400 && table.height >= 300,
    table ? `w=${Math.round(table.width)} h=${Math.round(table.height)}` : 'missing');
  check('analysis panel has usable width',
    !!panel && panel.width >= 300,
    panel ? `w=${Math.round(panel.width)}` : 'missing');
  check('analysis does NOT cover the table at 1440px', !overlaps(table, panel),
    table && panel
      ? `table=${Math.round(table.x)}..${Math.round(table.x + table.width)} panel=${Math.round(panel.x)}..${Math.round(panel.x + panel.width)}`
      : 'missing');
  check('analysis sits to the RIGHT of the table, not under it',
    !!table && !!panel && panel.x >= table.x + table.width,
    panel && table ? `panel.x=${Math.round(panel.x)} table.right=${Math.round(table.x + table.width)}` : 'missing');

  // The peek workaround is redundant once the table is visible, and its return
  // chip is hidden with it — a visible peek button here could strand the panel.
  check('peek control is withdrawn when the table is already in view',
    await wide.locator('.sc2-peek-btn').count() === 0 ||
    !(await wide.locator('.sc2-peek-btn').isVisible()));

  // The 1200px card is pulled out of .session-container with negative margins.
  // If that arithmetic is ever wrong it shows up as a horizontal scrollbar.
  const overflow = await wide.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('no horizontal overflow from the widened card', overflow <= 0, `overflow=${overflow}px`);

  await wide.close();

  // ── Narrow: the stacked overlay is still the correct layout ──────────────
  // Negative control. Without this, a breakpoint that leaked down to every
  // viewport would pass the wide checks above and quietly break mobile.
  const narrow = await browser.newPage({ viewport: NARROW });
  await playToAnalysis(narrow, baseURL);

  const nTable = await narrow.locator('.sc2-table').boundingBox();
  const nPanel = await narrow.locator('.sc2-overlay').boundingBox();
  check('below 1280 the analysis still covers the table', overlaps(nTable, nPanel),
    nTable && nPanel
      ? `table.x=${Math.round(nTable.x)} panel.x=${Math.round(nPanel.x)}`
      : 'missing');
  check('below 1280 the peek control is still offered',
    await narrow.locator('.sc2-peek-btn').isVisible());

  await narrow.close();
}
