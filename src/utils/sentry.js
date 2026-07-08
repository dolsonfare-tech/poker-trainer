import * as Sentry from '@sentry/react';

// The ONLY file that talks to Sentry. Same pattern as analytics.js: when the
// env var is absent (local dev, jest) every export is a silent no-op.
// The DSN is public by design (like the PostHog key) — plain env var in Vercel.
const DSN = process.env.REACT_APP_SENTRY_DSN;
export const hasSentry = Boolean(DSN);

if (hasSentry) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.NODE_ENV,
    // Errors only — no tracing, no session replay. PostHog covers product
    // analytics; Sentry's job here is just the crashes we can't see.
    sendDefaultPii: false,
  });
}

// Called next to identify()/resetAnalytics() in App.jsx so a crash report
// carries the Supabase user id (id only — no email/name).
export function setSentryUser(userId) {
  if (hasSentry) Sentry.setUser({ id: userId });
}

export function clearSentryUser() {
  if (hasSentry) Sentry.setUser(null);
}
