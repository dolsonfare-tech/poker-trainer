// The ONLY file that talks to Google AdSense. Same pattern as analytics.js /
// supabase.js: no env var → every export is a silent no-op, zero ads, zero
// network calls (keeps local dev and jest clean).
//
// Two-stage rollout, both Vercel env flips, no code changes:
//   1. REACT_APP_ADSENSE_CLIENT (ca-pub-…) — injects the loader script only.
//      This is what the AdSense site review looks for ("site not connected"
//      until it finds the code), and with no slot IDs set nothing visible
//      renders. Set this as soon as the AdSense account exists.
//   2. REACT_APP_ADSENSE_SLOT_DASHBOARD / REACT_APP_ADSENSE_SLOT_SUMMARY —
//      per-placement ad unit IDs, created in the AdSense dashboard after
//      approval. Each one turns on that placement independently.
//
// Also required post-account-creation: public/ads.txt with the line
//   google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
// (can't be authored now — it contains the publisher ID).
//
// Placement policy (decided July 2026): session summary + dashboard only,
// NEVER the decision screen.

export const ADSENSE_CLIENT = process.env.REACT_APP_ADSENSE_CLIENT;
export const hasAds = Boolean(ADSENSE_CLIENT);

export const AD_SLOTS = {
  dashboard: process.env.REACT_APP_ADSENSE_SLOT_DASHBOARD,
  summary: process.env.REACT_APP_ADSENSE_SLOT_SUMMARY,
};

let loaderInjected = false;

export function ensureAdsLoader() {
  if (!hasAds || loaderInjected) return;
  loaderInjected = true;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(s);
}
