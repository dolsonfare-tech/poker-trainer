import { useState } from 'react';
import { supabase } from '../utils/supabase';
import { track } from '../utils/analytics';

// Flip on by setting REACT_APP_GOOGLE_AUTH=1 (env + Vercel) once the Google
// provider is configured in Supabase. signInWithOAuth navigates away BEFORE
// any error can surface in-app, so an unconfigured provider = raw 400 page.
const GOOGLE_ENABLED = process.env.REACT_APP_GOOGLE_AUTH === '1';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sendLink = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
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
      options: { redirectTo: window.location.origin },
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
            lands here — lead with what it does, not with the sign-in demand. */}
        <div className="ue-title">Find the leak in your game</div>
        <div className="ue-subtitle">
          Five real Hold'em spots a day, every decision graded.
          Sign in free — your stats and streak follow you on every device.
        </div>

        {sent ? (
          <div className="si-sent">
            ✉️ Check your email — we sent a sign-in link to <b>{email.trim()}</b>.
            <div className="si-sent-sub">You can close this tab; the link brings you back.</div>
          </div>
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
        <div className="si-legal">
          <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a>
        </div>
      </div>
    </div>
  );
}
