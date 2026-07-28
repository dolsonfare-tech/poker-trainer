import { useState } from 'react';
import { supabase } from '../utils/supabase';
import { track } from '../utils/analytics';

// Flip on by setting REACT_APP_GOOGLE_AUTH=1 (env + Vercel) once the Google
// provider is configured in Supabase. signInWithOAuth navigates away BEFORE
// any error can surface in-app, so an unconfigured provider = raw 400 page.
const GOOGLE_ENABLED = process.env.REACT_APP_GOOGLE_AUTH === '1';

// CA-003: pin auth redirects to the configured site URL instead of trusting
// whatever host the page is served from. CRA inlines the env var at build
// time, so a module-scope const is correct. Without REACT_APP_SITE_URL the
// behavior is byte-identical to before (local dev + preview builds keep
// working); set REACT_APP_SITE_URL=https://checkraise.ai in Vercel to harden prod.
const SITE_URL = process.env.REACT_APP_SITE_URL || window.location.origin;

// onGuestPlay: renders the "try a free session" path (guest flow, July 2026).
// guestUsed: the device already played its free guest session — show the
// carry-over reassurance instead of the CTA.
export default function SignIn({ onGuestPlay, guestUsed }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Guest-first hierarchy (July 2026): a fresh visitor (onGuestPlay set) sees the
  // guest CTA as the primary action and the sign-in stack behind a quiet reveal.
  // A used-up guest / real-name-cache visitor (no onGuestPlay) sees the form now.
  const [showSignIn, setShowSignIn] = useState(!onGuestPlay);

  const sendLink = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: SITE_URL },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      track('sign_in_link_error', { message: err.message });
    } else {
      setSent(true);
      track('sign_in_link_sent');
    }
  };

  const signInWithGoogle = async () => {
    setError('');
    track('google_sign_in_clicked');
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: SITE_URL },
    });
    if (err) {
      setError(/not enabled|unsupported/i.test(err.message)
        ? 'Google sign-in is coming soon — use the email link below for now.'
        : err.message);
    }
  };

  return (
    <div className="ue-screen">
      <div className="ue-card">
        <div className="ue-logo">Check<em>Raise</em></div>
        {/* First-five-seconds pitch: a cold visitor (r/poker, a shared link)
            lands here — lead with what it does, not with the sign-in demand.
            Founders keep this deliberately spare (July 2026). */}
        <div className="ue-title">Find the leak in your poker game</div>
        {/* The subtitle follows the state. Once the player has chosen the
            account path, "no account needed" is answering a question they have
            already moved past — and it undersells that this IS the sign-up. */}
        <div className="ue-subtitle">
          {!onGuestPlay || showSignIn
            ? 'Sign in or create your account — no password needed.'
            : 'Free to play — no account needed.'}
        </div>
        {guestUsed && (
          <div className="si-guest-note">
            ♠ Your free session's results are saved on this device — sign in and they carry over.
          </div>
        )}

        {sent ? (
          <div className="si-sent">
            ✉️ Check your email — we sent a sign-in link to <b>{email.trim()}</b>.
            <div className="si-sent-sub">You can close this tab; the link brings you back.</div>
          </div>
        ) : (
          <>
            {/* Guest CTA disappears once the account path is open: a player who
                tapped "sign in" has already declined it, and leaving it as the
                loudest button on the screen competes with the choice they just
                made (founder report, July 27 2026). */}
            {onGuestPlay && !showSignIn && (
              <button type="button" className="si-guest-btn" onClick={onGuestPlay}>
                Play a Free Session →
              </button>
            )}
            {onGuestPlay && !showSignIn ? (
              // "Already have an account?" told a NEW visitor this path was not
              // for them, while the magic link is exactly how they would sign
              // up — the capability existed and the copy hid it.
              <button type="button" className="si-signin-link" onClick={() => setShowSignIn(true)}>
                Sign in or create an account →
              </button>
            ) : (
              <>
                {GOOGLE_ENABLED && (
                  <>
                    <button className="si-google-btn" type="button" onClick={signInWithGoogle}>
                      <span className="si-g">G</span> Continue with Google
                    </button>
                    <div className="si-divider"><span>or</span></div>
                  </>
                )}
                <form className="ue-form" onSubmit={sendLink}>
                  <input
                    className={`ue-input${error ? ' ue-input-error' : ''}`}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    required
                    autoComplete="email"
                  />
                  {error && <div className="ue-error">{error}</div>}
                  <button className="ue-submit-btn" type="submit" disabled={busy || !email.includes('@')}>
                    {busy ? 'Sending…' : 'Email me a sign-in link →'}
                  </button>
                </form>
              </>
            )}
          </>
        )}
        <div className="si-legal">
          <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a>
        </div>
      </div>
    </div>
  );
}
