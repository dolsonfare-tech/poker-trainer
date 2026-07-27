import posthog from 'posthog-js';

// The ONLY file that talks to PostHog. Same pattern as supabase.js: when the
// env key is absent (local dev, jest) every export is a silent no-op.
const KEY = process.env.REACT_APP_POSTHOG_KEY;

// ── Never report from a developer machine (July 27, 2026) ────────────────
// The key alone used to be the gate, which meant any build made with .env
// present carried the PRODUCTION key — including `npm start` and the static
// build the e2e suite drives. Local browsing and every local e2e run therefore
// wrote synthetic events into the real project. Found during intake triage: two
// `coach_read_failed` events traced to a local static server answering POST
// /api/coach-read with 501, and a burst of `decision_made` matching the same
// afternoon's manual testing.
//
// This is not just noise. ROADMAP item 6 defines a decision rule that resizes
// the session unit from `session_started.chained` and `decision_made` counts,
// and item 2 requires tester data to stay separable from organic users. Fake
// events feed a real product decision.
//
// Two layers now: e2e:build blanks the key (see package.json), and this refuses
// to initialise on a local host regardless of what got baked in. Set
// REACT_APP_POSTHOG_ALLOW_LOCAL=1 to deliberately test the integration itself.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
const isLocalHost = typeof window !== 'undefined' &&
  LOCAL_HOSTS.includes(window.location?.hostname);
const allowLocal = process.env.REACT_APP_POSTHOG_ALLOW_LOCAL === '1';

export const hasAnalytics = Boolean(KEY) && (!isLocalHost || allowLocal);

if (hasAnalytics) {
  posthog.init(KEY, {
    api_host: process.env.REACT_APP_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only', // anonymous visitors don't burn person quota
    autocapture: false, // explicit funnel events only — keeps the data clean
  });
}

// Funnel events (build the PostHog funnel from these, in this order):
//   sign_in_link_sent → signed_in → profile_created (first visit only)
//   → session_started → decision_made ×5 → session_completed
// Coach's Read health: coach_read_ok vs coach_read_failed (reason/status).
export function track(event, props) {
  if (hasAnalytics) posthog.capture(event, props);
}

// Ties events to the Supabase user id so funnels survive device changes
export function identify(userId, props) {
  if (hasAnalytics) posthog.identify(userId, props);
}

export function resetAnalytics() {
  if (hasAnalytics) posthog.reset();
}
