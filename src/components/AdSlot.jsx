import { useEffect } from 'react';
import { hasAds, ADSENSE_CLIENT, AD_SLOTS, ensureAdsLoader } from '../utils/ads';

// A single responsive AdSense unit. `placement` is a key into AD_SLOTS
// ('dashboard' | 'summary'); renders nothing unless both the client env var
// and that placement's slot ID are set — so this can sit in the tree
// permanently at zero cost.
export default function AdSlot({ placement }) {
  const slot = AD_SLOTS[placement];
  const enabled = hasAds && Boolean(slot);

  useEffect(() => {
    if (!enabled) return;
    ensureAdsLoader();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      // AdSense throws if the loader is blocked (ad blockers) — never let
      // that take down the screen.
    }
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="ad-slot">
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
