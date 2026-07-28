// VillainGuide e2e (CA-050, Wave 4). Previously ZERO e2e coverage.
//
// The guide is a scrolling panel inside a fixed full-screen overlay — the exact
// construction where content clips silently. Every tab renders fine in jsdom
// because jsdom has no layout; only a real browser can say whether the last
// glossary entry is reachable or sitting under the fold with no way to scroll
// to it. This is the player's ONLY in-app reference, so an unreachable tab is
// an unanswerable question mid-session.
//
// The focus deep-link gets its own attention: tapping a villain read on the
// table opens the guide scrolled to that villain. That is a scrollIntoView call
// inside a modal, which either works or silently leaves the player at the top
// of a five-tab reference with no idea what they were meant to see.
import { baseUser, seedAndOpen, stubCoach } from './helpers.mjs';

const TABS = ['Villains', 'Schemas', 'Skills', 'Positions', 'Glossary'];
const VW = 390, VH = 844;

// The guide slides up on open. waitForSelector resolves the moment the node is
// attached, which is ~17px and one repaint before it is where it will finally
// sit — measuring there yields geometry that is real but transient, and a
// backdrop tap at the top of the screen lands on the app BEHIND the modal
// because the overlay has not covered it yet.
//
// Waiting on the settled transform rather than a timeout keeps this
// deterministic: a slower machine waits longer instead of failing. A magic
// sleep would be the flaky-gate pattern this suite explicitly rejects
// (see taptargets.spec.mjs on why a coin-flip gate is worse than no gate).
const settled = (page) => page.waitForFunction(() => {
  const el = document.querySelector('.vg-overlay');
  return !!el && getComputedStyle(el).transform === 'none';
}, null, { timeout: 5000 });

export default async function run({ browser, baseURL, check }) {
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  await stubCoach(page);
  await seedAndOpen(page, baseURL, baseUser(), { cr_last_difficulty: 'intermediate' });

  await page.click('.info-btn');
  await page.waitForSelector('.vg-panel', { timeout: 10000 });
  await settled(page);

  // The backdrop must cover the whole viewport once settled — anything it
  // leaves uncovered is a live control sitting behind a modal.
  const overlay = await page.locator('.vg-overlay').boundingBox();
  check('backdrop covers the full viewport once open',
    !!overlay && overlay.y <= 0.5 && overlay.height >= VH - 1,
    overlay ? `y=${overlay.y.toFixed(1)} h=${Math.round(overlay.height)}` : 'missing');

  // ── The panel must actually be on screen ─────────────────────────────────
  const panel = await page.locator('.vg-panel').boundingBox();
  check('guide panel has real width (collapse guard)', !!panel && panel.width > 250,
    panel ? `w=${Math.round(panel.width)}` : 'missing');
  check('guide panel fits the viewport width', !!panel && panel.x >= 0 && panel.x + panel.width <= VW,
    panel ? `x=${Math.round(panel.x)} right=${Math.round(panel.x + panel.width)}` : 'missing');
  check('guide panel top is on screen', !!panel && panel.y >= 0 && panel.y < VH,
    panel ? `y=${Math.round(panel.y)}` : 'missing');

  // The close control has to be visible without scrolling — a modal you must
  // scroll to escape is a trap on a phone.
  const close = await page.locator('.vg-close').boundingBox();
  check('close control is reachable without scrolling',
    !!close && close.y >= 0 && close.y + close.height <= VH,
    close ? `bottom=${Math.round(close.y + close.height)}` : 'missing');

  // ── Every tab renders content, and the list is scrollable to its end ─────
  for (const tab of TABS) {
    await page.click(`.vg-tab:text-is("${tab}")`);
    await page.waitForTimeout(120);

    const items = await page.locator('.vg-item').count();
    check(`${tab} tab renders entries`, items > 0, `n=${items}`);

    // Scroll the panel to the bottom and confirm the LAST entry becomes
    // visible. This is the clipping guard: a panel with the wrong overflow
    // renders every item in the DOM while the tail is unreachable.
    const reachable = await page.evaluate(() => {
      const panelEl = document.querySelector('.vg-panel');
      const list = document.querySelector('.vg-list');
      const last = list?.lastElementChild;
      if (!panelEl || !last) return null;
      // Scroll whichever element owns the overflow.
      const scroller = panelEl.scrollHeight > panelEl.clientHeight ? panelEl : list;
      scroller.scrollTop = scroller.scrollHeight;
      const r = last.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
    });
    check(`${tab} tab scrolls to its last entry`,
      !!reachable && reachable.h > 0 && reachable.top < VH,
      reachable ? `last top=${reachable.top} h=${reachable.h}` : 'missing');

    // Switching tabs must not push the panel off screen.
    const still = await page.locator('.vg-panel').boundingBox();
    check(`${tab} tab keeps the panel on screen`, !!still && still.y < VH && still.x >= 0,
      still ? `y=${Math.round(still.y)}` : 'missing');
  }

  // ── Dismissal ────────────────────────────────────────────────────────────
  await page.click('.vg-close');
  await page.waitForTimeout(150);
  check('close button dismisses the guide', await page.locator('.vg-panel').count() === 0);

  await page.click('.info-btn');
  await page.waitForSelector('.vg-panel', { timeout: 10000 });
  await settled(page);
  // Tap the backdrop in the gap ABOVE the panel, computed rather than guessed.
  const sheet = await page.locator('.vg-panel').boundingBox();
  check('there is backdrop above the sheet to tap', !!sheet && sheet.y > 20,
    sheet ? `panel y=${Math.round(sheet.y)}` : 'missing');
  await page.mouse.click(VW / 2, Math.max(2, Math.round(sheet.y / 2)));
  await page.waitForTimeout(200);
  check('backdrop tap dismisses the guide', await page.locator('.vg-panel').count() === 0);

  // ── Focus deep-link from Table Reads feedback ────────────────────────────
  // The real journey: identify a player, then tap through to read about that
  // archetype. The guide must open ON that entry, not at the top of the list.
  await page.click('.db-tablereads-link');
  await page.waitForSelector('.tr-replay', { timeout: 10000 });
  await page.click('.tr-replay');
  await page.waitForSelector('.tr-chip', { timeout: 10000 });
  await page.locator('.tr-chip').first().click();
  await page.waitForSelector('.tr-guide-link', { timeout: 10000 });

  const linkLabel = ((await page.textContent('.tr-guide-link')) || '').trim();
  await page.click('.tr-guide-link');
  await page.waitForSelector('.vg-panel', { timeout: 10000 });
  await settled(page);

  const focused = await page.locator('.vg-item-focus').count();
  check('the guide opens focused on the archetype tapped through to', focused === 1,
    `focus targets=${focused} · link="${linkLabel.slice(0, 40)}"`);

  const pos = await page.evaluate(() => {
    const el = document.querySelector('.vg-item-focus');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom) };
  });
  // scrollIntoView({block:'center'}) should leave it inside the viewport, not
  // parked above or below it.
  check('…and that entry is scrolled into view, not left off screen',
    !!pos && pos.bottom > 0 && pos.top < VH,
    pos ? `top=${pos.top} bottom=${pos.bottom}` : 'missing');

  await page.close();
}
