// SignIn e2e — the missing ratchet for the July 27 2026 guest-first fix
// (ROADMAP triage item 8). Previously ZERO e2e coverage on the one screen where
// a cold visitor decides whether to stay, pinned in jest only.
//
// This lane exists because SignIn is unreachable from the other one: `e2e:build`
// blanks the Supabase vars, `hasSupabase` goes false, and App boots straight to
// UsernameEntry. Only a build WITH Supabase env renders SignIn at all — see
// e2e/buildmode.mjs for the two-build story and the guard that keeps a lane from
// running against the wrong one.
//
// Network: the build points at `https://stub.supabase.e2e`, a host that cannot
// resolve. Every request to it is intercepted here; anything not explicitly
// armed is aborted AND recorded, so a request this spec did not expect fails the
// run instead of silently hanging. The first check below turns supabase-js's
// "boot reads localStorage, no network until you ask it for something" into an
// asserted fact rather than a claim in a comment.
//
// ── OUT OF SCOPE (partial coverage, deliberately — do not read this file as
//    "SignIn is covered") ─────────────────────────────────────────────────────
//   · Magic-link COMPLETION. This spec asserts the link was requested and the
//     sent state renders. Actual email delivery and the redirect back with a
//     session are untestable without a live Supabase project.
//   · OAuth. `REACT_APP_GOOGLE_AUTH` is unset in this build, so the Google
//     button does not render; a check below pins that it is absent rather than
//     letting silence look like coverage. The signInWithOAuth path navigates
//     away before anything is observable in-app and is untested.
//   · Any real Supabase traffic. Every request is stubbed; this proves the
//     CLIENT's behavior around the API, never the API's.
import { baseUser } from '../helpers.mjs';

const VW = 390, VH = 844;

const FRESH_SUBTITLE = 'Free to play — no account needed.';
const SIGNIN_SUBTITLE = 'Sign in or create your account — no password needed.';
const REVEAL_LABEL = 'Sign in or create an account →';

// A device that already spent its one free guest session: an UNTAGGED cache
// (no cr_user_owner) whose profile is named 'Guest' with sessionsCompleted at
// or above GUEST_FREE_SESSIONS — the exact pair useGuest.guestOffer() reads
// (src/hooks/useGuest.js:83-86). Built from the suite's production-shaped
// fixture so this is a real profile record, not a two-field stub.
const guestUsedProfile = () =>
  baseUser({ displayName: 'Guest', initials: 'GU', sessionsCompleted: 1 });

// One handler for the whole stub origin. A single dispatcher rather than
// layered page.route() calls: Playwright resolves overlapping routes in reverse
// registration order with fallback(), and that ordering is exactly the kind of
// harness subtlety that makes a net look armed while it is not.
async function interceptSupabase(page) {
  const net = { otp: null, otpRequests: [], stray: [] };
  await page.route(/stub\.supabase\.e2e/, async (route) => {
    const req = route.request();
    if (/\/auth\/v1\/otp/.test(req.url()) && net.otp) {
      let body = null;
      try { body = req.postDataJSON(); } catch { body = req.postData(); }
      net.otpRequests.push(body);
      return route.fulfill({
        status: net.otp.status, contentType: 'application/json', body: net.otp.body,
      });
    }
    // Not armed, or not the OTP endpoint: record and kill it. Reaching here is
    // the failure, not the abort.
    net.stray.push(`${req.method()} ${req.url()}`);
    return route.abort();
  });
  return net;
}

export default async function run({ browser, baseURL, check }) {
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  const net = await interceptSupabase(page);

  // Wait on .si-legal, not .ue-card — the 'loading' phase ("Shuffling up…") and
  // UsernameEntry both render .ue-card, so it cannot tell us we are on SignIn.
  const open = async (seed = null) => {
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.evaluate((s) => {
      localStorage.clear();
      if (s) localStorage.setItem('cr_user', JSON.stringify(s));
    }, seed);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.si-legal', { timeout: 20000 });
  };
  const count = (sel) => page.locator(sel).count();
  const text = async (sel) => ((await page.textContent(sel)) || '').trim();

  // ── 0. Boot fires no Supabase network ────────────────────────────────────
  // The whole lane rests on this: supabase-js only reads localStorage on
  // construction, so a build pointed at an unresolvable host still boots
  // normally. If that ever stops being true this check fails first and explains
  // every timeout after it, instead of leaving the lane looking flaky.
  await open();
  check('boot reaches SignIn with zero Supabase network',
    net.stray.length === 0 && net.otpRequests.length === 0,
    net.stray.length ? `unexpected: ${net.stray.slice(0, 3).join(', ')}` : 'no requests');

  // ── 1. Guest-first hierarchy (fresh visitor) ─────────────────────────────
  check('fresh visitor is offered the free session', await count('.si-guest-btn') === 1);
  check('…and the email form is not in the DOM yet', await count('.ue-form') === 0,
    `forms=${await count('.ue-form')}`);
  check('…behind a reveal that reads as sign-in OR sign-up',
    await text('.si-signin-link') === REVEAL_LABEL, `"${await text('.si-signin-link')}"`);
  check('…and the subtitle leads with free-to-play',
    await text('.ue-subtitle') === FRESH_SUBTITLE, `"${await text('.ue-subtitle')}"`);

  // "Primary" measured, not assumed. The guest CTA is filled (gold) and the
  // reveal is a bare text link — that contrast IS the hierarchy, so compare the
  // painted background and the stacking order rather than eyeballing markup.
  const weight = await page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { y: r.y, area: r.width * r.height, bg: cs.backgroundColor };
    };
    return { cta: box('.si-guest-btn'), link: box('.si-signin-link') };
  });
  const transparent = (c) => !c || c === 'transparent' || /rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(c);
  check('…the free-session CTA is the filled, primary control',
    !!weight.cta && !transparent(weight.cta.bg) && transparent(weight.link?.bg),
    `cta bg=${weight.cta?.bg} · link bg=${weight.link?.bg}`);
  check('…and it sits above the reveal, with more weight',
    !!weight.cta && !!weight.link && weight.cta.y < weight.link.y && weight.cta.area > weight.link.area,
    weight.cta && weight.link
      ? `cta y=${Math.round(weight.cta.y)} a=${Math.round(weight.cta.area)} · link y=${Math.round(weight.link.y)} a=${Math.round(weight.link.area)}`
      : 'missing');

  // Scope boundary, pinned: OAuth is out of scope BECAUSE the button is absent
  // in this build. If REACT_APP_GOOGLE_AUTH ever leaks in, this fails and the
  // header's out-of-scope note stops being true silently.
  check('Google OAuth stays out of this build (scope boundary)',
    await count('.si-google-btn') === 0);

  // ── 2. Reveal toggle — the July 27 regression target ─────────────────────
  await page.click('.si-signin-link');
  await page.waitForSelector('.ue-form', { timeout: 5000 });
  check('revealing sign-in shows the email form', await count('.ue-form') === 1);
  check('…and REMOVES the guest CTA (July 27 founder fix)',
    await count('.si-guest-btn') === 0, `guest CTAs=${await count('.si-guest-btn')}`);
  check('…and flips the subtitle to the account framing',
    await text('.ue-subtitle') === SIGNIN_SUBTITLE, `"${await text('.ue-subtitle')}"`);

  // ── 3. Guest CTA lands the player in the product ─────────────────────────
  // Smoke only — smoke.spec.mjs owns the session itself. What matters here is
  // that the button on the sign-in screen is wired to something.
  await open();
  await page.click('.si-guest-btn');
  await page.waitForSelector('.ds-confirm-btn', { timeout: 20000 });
  check('the free-session CTA lands the player on the level picker',
    await count('.ds-confirm-btn') === 1 && await count('.si-legal') === 0);

  // ── 4. Email form — success path ─────────────────────────────────────────
  await open();
  await page.click('.si-signin-link');
  await page.waitForSelector('.ue-form', { timeout: 5000 });
  const submitDisabled = () => page.locator('.ue-submit-btn').isDisabled();
  check('submit is disabled with an empty field', await submitDisabled());
  await page.fill('.ue-input', 'player');
  check('…and still disabled without an @', await submitDisabled());
  // Typed with surrounding spaces on purpose. `<input type="email">` runs the
  // HTML value-sanitization algorithm (strip leading/trailing whitespace)
  // before React sees it, so this does NOT exercise SignIn's own `email.trim()`
  // — that line is unreachable through the UI. What it does assert is the
  // user-facing property: a padded typo cannot reach Supabase as a padded
  // address, whichever layer strips it.
  await page.fill('.ue-input', '  player@example.com  ');
  check('…and enabled once the address is plausible', !(await submitDisabled()));

  net.otp = { status: 200, body: '{}' };
  await page.click('.ue-submit-btn');
  await page.waitForSelector('.si-sent', { timeout: 10000 });
  const sent = await text('.si-sent');
  check('a magic link is requested exactly once', net.otpRequests.length === 1,
    `requests=${net.otpRequests.length}`);
  check('…carrying the address unpadded on the wire',
    net.otpRequests[0]?.email === 'player@example.com', `wire=${JSON.stringify(net.otpRequests[0]?.email)}`);
  check('…the sent state echoes the address back', sent.includes('player@example.com'),
    `"${sent.slice(0, 60)}"`);
  check('…and tells the player they can close the tab',
    (await text('.si-sent-sub')).includes('close this tab'));
  check('…with the form gone (no second submit)', await count('.ue-form') === 0);

  // ── 5. Email form — error path ───────────────────────────────────────────
  // GoTrue error shape: supabase-js reads `msg` off a non-2xx body and surfaces
  // it as error.message, which is what SignIn renders verbatim.
  const ERR = 'Email rate limit exceeded';
  await open();
  await page.click('.si-signin-link');
  await page.waitForSelector('.ue-form', { timeout: 5000 });
  net.otp = { status: 400, body: JSON.stringify({ code: 400, msg: ERR }) };
  await page.fill('.ue-input', 'player@example.com');
  await page.click('.ue-submit-btn');
  await page.waitForSelector('.ue-error', { timeout: 10000 });
  check('a failed send surfaces the reason', (await text('.ue-error')).includes(ERR),
    `"${await text('.ue-error')}"`);
  check('…marks the field as the thing to fix',
    (await page.getAttribute('.ue-input', 'class') || '').includes('ue-input-error'));
  check('…and does NOT claim a link was sent', await count('.si-sent') === 0);

  await page.locator('.ue-input').pressSequentially('x');
  check('typing in the field clears the error', await count('.ue-error') === 0);
  check('…and un-marks the input',
    !((await page.getAttribute('.ue-input', 'class') || '').includes('ue-input-error')));

  // ── 6. A used-up guest ───────────────────────────────────────────────────
  net.otp = null;
  await open(guestUsedProfile());
  const note = await text('.si-guest-note');
  check('a used-up guest sees the carry-over reassurance', note.includes('carry over'),
    `"${note.slice(0, 70)}"`);
  // The glyph itself, not just the sentence: invariant 36 pins the source, this
  // pins that the rendered copy still carries it.
  check('…led by the spade', note.startsWith('♠'), `starts "${note.slice(0, 3)}"`);
  check('…and is NOT re-offered a free session', await count('.si-guest-btn') === 0,
    `guest CTAs=${await count('.si-guest-btn')}`);
  check('…but gets the account path straight away', await count('.ue-form') === 1);

  // ── Closing network assertion ────────────────────────────────────────────
  // Everything above ran with one armed endpoint. Anything else that reached
  // for the network — a profile fetch on a screen that has no session, a
  // settings call, a retry — shows up here.
  check('no un-intercepted Supabase request fired all spec',
    net.stray.length === 0, net.stray.slice(0, 4).join(' · ') || 'clean');

  await page.close();
}
