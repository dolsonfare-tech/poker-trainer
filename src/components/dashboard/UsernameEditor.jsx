import { useState } from 'react';
import { RENAME_COOLDOWN_MS } from '../../utils/session';
import { track } from '../../utils/analytics';
import { formatShortDate } from '../../utils/dates';

// ─── Username editor ──────────────────────────────────────────────────────
// Inline in the topbar, opened from the ✎ next to the account pill. Same
// validation as first-time creation (UsernameEntry). Renames are limited to
// once a week — the form checks locally so the common case reads as a clear
// message, and the DB trigger enforces it for real in Supabase mode.
export default function UsernameEditor({ user, onRename, onClose }) {
  const [name, setName]   = useState(user.displayName);
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);

  const nextChangeAt = user.usernameChangedAt
    ? new Date(new Date(user.usernameChangedAt).getTime() + RENAME_COOLDOWN_MS)
    : null;
  const onCooldown = nextChangeAt && nextChangeAt > new Date();

  if (onCooldown) {
    return (
      <div className="db-rename">
        <span className="db-rename-note">
          Name changes are limited to once a week — you can change yours again on {formatShortDate(nextChangeAt)}.
        </span>
        <button type="button" className="db-rename-cancel" onClick={onClose}>OK</button>
      </div>
    );
  }

  const save = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError('Must be at least 2 characters'); return; }
    if (trimmed.length > 20) { setError('Must be 20 characters or less'); return; }
    if (trimmed === user.displayName) { onClose(); return; }
    setBusy(true);
    try {
      await onRename(trimmed);
      track('username_changed');
      onClose();
    } catch (err) {
      console.error('Username change failed', err);
      const rateLimited = err?.code === 'rate_limited';
      track('username_change_failed', { reason: rateLimited ? 'rate_limited' : 'error' });
      setError(rateLimited
        ? 'Name changes are limited to once a week.'
        : "Couldn't save — check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <form className="db-rename" onSubmit={save}>
      <input
        className="db-rename-input"
        type="text"
        value={name}
        onChange={e => { setName(e.target.value); setError(''); }}
        maxLength={20}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="New username"
      />
      <button
        type="submit"
        className="db-rename-save"
        disabled={busy || name.trim().length < 2}
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
      <button type="button" className="db-rename-cancel" onClick={onClose} disabled={busy}>
        Cancel
      </button>
      {error && <div className="db-rename-error">{error}</div>}
    </form>
  );
}
