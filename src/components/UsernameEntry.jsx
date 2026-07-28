import { useState } from 'react';
import { hasSupabase } from '../utils/supabase';
import { emitProfileCreateFailed } from '../utils/events';

export default function UsernameEntry({ onSubmit, defaultName, onSwitchAccount }) {
  const [name, setName]   = useState(defaultName ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError('Must be at least 2 characters'); return; }
    if (trimmed.length > 20) { setError('Must be 20 characters or less'); return; }
    setBusy(true);
    try {
      await onSubmit(trimmed);
      // Success unmounts this screen — don't touch state after it
    } catch (err) {
      console.error('Profile creation failed', err);
      emitProfileCreateFailed(err?.message);
      setError("Couldn't save your profile — check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <div className="ue-screen">
      <div className="ue-card">
        <div className="ue-logo">Check<em>Raise</em></div>
        <div className="ue-title">Create your profile</div>
        {/* In Supabase mode this screen appears AFTER sign-in — progress saves
            to the account, not the device. The device wording is only true in
            localStorage-only mode. */}
        <div className="ue-subtitle">
          {hasSupabase
            ? 'Your stats and progress save to your account and follow you on any device.'
            : 'Your stats and progress will be saved to this device.'}
        </div>
        <form className="ue-form" onSubmit={handleSubmit}>
          <input
            className={`ue-input${error ? ' ue-input-error' : ''}`}
            type="text"
            placeholder="Choose a username"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            maxLength={20}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {error && <div className="ue-error">{error}</div>}
          <button
            className="ue-submit-btn"
            type="submit"
            disabled={busy || name.trim().length < 2}
          >
            {busy ? 'Setting up…' : "Let's Play →"}
          </button>
        </form>
        {onSwitchAccount && (
          <button type="button" className="ue-switch" onClick={onSwitchAccount}>
            Not you? Sign in with a different account
          </button>
        )}
      </div>
    </div>
  );
}
