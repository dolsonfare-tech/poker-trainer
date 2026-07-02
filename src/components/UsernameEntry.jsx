import { useState } from 'react';

export default function UsernameEntry({ onSubmit }) {
  const [name, setName]   = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError('Must be at least 2 characters'); return; }
    if (trimmed.length > 20) { setError('Must be 20 characters or less'); return; }
    onSubmit(trimmed);
  };

  return (
    <div className="ue-screen">
      <div className="ue-card">
        <div className="ue-logo">Check<em>Raise</em></div>
        <div className="ue-title">Create your profile</div>
        <div className="ue-subtitle">Your stats and progress will be saved to this device.</div>
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
            disabled={name.trim().length < 2}
          >
            Let's Play →
          </button>
        </form>
      </div>
    </div>
  );
}
