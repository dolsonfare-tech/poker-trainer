// Streak mechanics across simulated days — the transitions unit tests can't
// reach without clock control. Condensed from the July 18 verification run
// (which went 20/20 across an 11-day ladder): consecutive advance, the day-7
// milestone earning a Rebuy, a missed day consuming it with the streak intact,
// and the broken-streak moment. The Date shim reads __day_offset from
// localStorage; seeds position each test one session from the transition.
import { baseUser, seedAndOpen, stubCoach, installClock, setDay, playSession, backToDashboard, dayStr, loadUser } from './helpers.mjs';

export default async function run({ browser, baseURL, check }) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1080 } });
  await installClock(page);
  await stubCoach(page);

  // Day 6 streak, played yesterday → today's session = Day 7 milestone + Rebuy
  await seedAndOpen(page, baseURL,
    baseUser({ streak: 6, lastSessionDate: dayStr(-1), rebuys: 0 }),
    { cr_last_difficulty: 'intermediate', __day_offset: '0' });
  let s = await playSession(page);
  check('day 7 milestone line', s.includes('Day 7 secured') && s.includes('a full week'));
  await backToDashboard(page);
  let u = await loadUser(page);
  check('Rebuy earned at the milestone', u.rebuys === 1, `rebuys=${u.rebuys}`);
  check('dashboard shows the held Rebuy', (await page.textContent('.app')).includes('1 Rebuy held'));

  // Skip a day → the Rebuy silently covers it, streak advances to 8
  await setDay(page, 2);
  s = await playSession(page);
  check('Rebuy-used line on the summary', s.includes('Rebuy used — streak intact'));
  check('streak advanced through the gap', s.includes('Day 8 secured'));
  await backToDashboard(page);
  u = await loadUser(page);
  check('Rebuy consumed', u.rebuys === 0, `rebuys=${u.rebuys}`);

  // Skip again with no Rebuys → the broken-streak moment, never a bare reset
  await setDay(page, 4);
  s = await playSession(page);
  check('broken-streak moment shown', s.includes('Streak reset — start a new run'));
  check('no bare "Day 1 secured" on a break', !s.includes('Day 1 secured'));
  await backToDashboard(page);
  u = await loadUser(page);
  check('streak reset to 1', u.streak === 1, `streak=${u.streak}`);

  await page.close();
}
