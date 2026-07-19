// Core session flow + GEOMETRY GUARDS. The July 18 table-collapse shipped to
// prod with every functional test green — the game was playable while the
// table rendered as a 0px-wide line. These guards assert the layout's
// load-bearing geometry, cheaply and deterministically (no screenshot diffs).
import { baseUser, seedAndOpen, stubCoach, playSession, STRUCTURED_READ } from './helpers.mjs';

export default async function run({ browser, baseURL, check }) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1080 } });
  await stubCoach(page);
  await seedAndOpen(page, baseURL, baseUser(), { cr_last_difficulty: 'intermediate' });

  const summary = await playSession(page, {
    perHand: async (i) => {
      if (i > 0) return; // geometry is layout-static; guard once
      const table = await page.locator('.sc2-table').boundingBox();
      check('table has real width (collapse guard)', !!table && table.width >= 400, `w=${table?.width}`);
      check('table has real height', !!table && table.height >= 300, `h=${table?.height}`);
      const felt = await page.locator('.sc2-felt').boundingBox();
      check('felt is visible and table-sized', !!felt && felt.width >= 350 && felt.height >= 200,
        felt ? `w=${Math.round(felt.width)} h=${Math.round(felt.height)}` : 'missing');
      const hero = await page.locator('.sc2-hero-cards').boundingBox();
      check('hero cards visible', !!hero && hero.width > 40, hero ? `w=${hero.width}` : 'missing');
      const opts = await page.locator('.sc2-actions button').count();
      check('2-3 action options rendered', opts >= 2 && opts <= 3, `n=${opts}`);
      const ticker = await page.locator('.st-ticker').boundingBox();
      check('hand-so-far ticker visible', !!ticker && ticker.width > 300, ticker ? `w=${ticker.width}` : 'missing');
      // villain bubble must not cover the hero cards or the board (July 18 class)
      const bubble = await page.locator('.sc2-bubble').boundingBox();
      const board = await page.locator('.sc2-board').boundingBox();
      const overlaps = (a, b) => !!a && !!b &&
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      check('villain bubble clear of the board', !overlaps(bubble, board));
      check('villain bubble clear of hero cards', !overlaps(bubble, hero));
    },
  });

  check('summary shows the real IQ line', /\d+ → \d+|Unlocked · \d+|Unlocks as skills/.test(summary));
  check('structured coach read renders', summary.includes(STRUCTURED_READ.headline));
  check('watch-for line renders', summary.includes(STRUCTURED_READ.watchFor));
  check('chaining CTA present', summary.includes('Deal Next Session'));
  await page.close();
}
