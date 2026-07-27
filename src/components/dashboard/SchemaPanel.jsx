import { SCHEMA_UNLOCK_SESSIONS } from '../../utils/userStorage';

// ─── Player schema panel ──────────────────────────────────────────────────
// Left half of the Player Profile card: the read itself, or the locked state
// with an honest countdown to the unlock.
//
// "player profile" not "archetype" — archetype is the VILLAIN word (Table
// Reads, the guide); the player-side diagnosis must not borrow it.
export default function SchemaPanel({ schema, sessionsCompleted, onSchemaInfo }) {
  if (!schema) {
    // CA-042: sessionsCompleted can exceed the unlock threshold while the
    // schema is still null (a refresh hasn't run) — clamp at zero rather than
    // promising "Play -7 more sessions".
    const left = Math.max(0, SCHEMA_UNLOCK_SESSIONS - sessionsCompleted);
    return (
      <div className="db-profile-schema">
        <div className="db-schema-locked">
          <div className="db-schema-locked-icon">🔒</div>
          <div className="db-schema-locked-text">
            {left > 0
              ? `Play ${left} more session${left !== 1 ? 's' : ''} to unlock your player profile`
              : 'Play a session to refresh your profile'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="db-profile-schema">
      <div className="db-schema-name">{schema.name}</div>
      <div className="db-schema-quote">{schema.quote}</div>
      {sessionsCompleted < 10 && (
        <div className="db-schema-early">Early read · sharpens as you play</div>
      )}
      {onSchemaInfo && (
        <button className="db-schema-guide-link" onClick={() => onSchemaInfo(schema.name)}>
          About this read →
        </button>
      )}
    </div>
  );
}
