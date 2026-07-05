import posthog from 'posthog-js';

// The ONLY file that talks to PostHog. Same pattern as supabase.js: when the
// env key is absent (local dev, jest) every export is a silent no-op.
const KEY = process.env.REACT_APP_POSTHOG_KEY;
export const hasAnalytics = Boolean(KEY);

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
