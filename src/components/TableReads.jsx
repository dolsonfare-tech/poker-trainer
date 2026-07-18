import { useEffect, useMemo, useState } from 'react';
import OBSERVATIONS, { ARCHETYPE_LABELS } from '../data/observations';
import { loadTableReadsStats, saveTableReadsStats } from '../utils/userStorage';
import { track } from '../utils/analytics';

// Table Reads — the inverse trainer: watch the hand, name the player.
// Design + authored content in TABLE_READS_DESIGN.md. Mode-local scoring
// only (founder decision July 18) — no writes to the 8-skill ratings.

const TR_SESSION_LENGTH = 5;
const REVEAL_MS = 1100; // street-by-street cadence; tap skips

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Beginner hands (showdown-confirmed) lead until the player has ~2 sessions
// of lifetime attempts; after that the whole pool shuffles together.
export function dealObservations(pool, lifetimeAttempts) {
  if (lifetimeAttempts < TR_SESSION_LENGTH * 2) {
    return [
      ...shuffle(pool.filter((o) => o.difficulty === 'beginner')),
      ...shuffle(pool.filter((o) => o.difficulty === 'intermediate')),
    ].slice(0, TR_SESSION_LENGTH);
  }
  return shuffle(pool).slice(0, TR_SESSION_LENGTH);
}

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export default function TableReads({ onBack }) {
  const [deck, setDeck] = useState(() => dealObservations(OBSERVATIONS, loadTableReadsStats().attempts));
  const [index, setIndex] = useState(0);
  const [revealCount, setRevealCount] = useState(reducedMotion() ? Infinity : 1);
  const [picked, setPicked] = useState(null);
  const [results, setResults] = useState([]);
  const [showSummary, setShowSummary] = useState(false);
  const [lifetime, setLifetime] = useState(loadTableReadsStats);

  const ob = deck[index];
  // Reveal units: replay rows, then the showdown line (when one exists)
  const totalUnits = ob ? ob.replay.length + (ob.showdown ? 1 : 0) : 0;
  const fullyRevealed = revealCount >= totalUnits;

  const chips = useMemo(
    () => (ob ? shuffle([ob.answer, ...ob.distractors]) : []),
    [ob]
  );

  useEffect(() => {
    track('table_reads_started', { lifetime_attempts: loadTableReadsStats().attempts });
  }, []);

  useEffect(() => {
    if (fullyRevealed) return undefined;
    const t = setInterval(() => setRevealCount((c) => c + 1), REVEAL_MS);
    return () => clearInterval(t);
  }, [fullyRevealed, index]);

  if (!ob && !showSummary) return null;

  const handlePick = (key) => {
    if (picked) return;
    const correct = key === ob.answer;
    setPicked(key);
    setResults((r) => [...r, { id: ob.id, correct }]);
    const next = { attempts: lifetime.attempts + 1, correct: lifetime.correct + (correct ? 1 : 0) };
    setLifetime(next);
    saveTableReadsStats(next);
    track('table_reads_answered', { observation_id: ob.id, picked: key, correct });
  };

  const handleNext = () => {
    if (index + 1 >= deck.length) {
      track('table_reads_completed', { correct: results.filter((r) => r.correct).length, total: results.length });
      setShowSummary(true);
      return;
    }
    setIndex(index + 1);
    setPicked(null);
    setRevealCount(reducedMotion() ? Infinity : 1);
  };

  const handleAgain = () => {
    setDeck(dealObservations(OBSERVATIONS, lifetime.attempts));
    setIndex(0);
    setPicked(null);
    setResults([]);
    setShowSummary(false);
    setRevealCount(reducedMotion() ? Infinity : 1);
    track('table_reads_started', { lifetime_attempts: lifetime.attempts, again: true });
  };

  if (showSummary) {
    const correct = results.filter((r) => r.correct).length;
    return (
      <div className="tr-screen">
        <div className="tr-header">
          <span className="tr-title">Table Reads</span>
        </div>
        <div className="tr-summary">
          <div className="tr-score"><span className="tr-score-num">{correct} / {results.length}</span> players identified</div>
          <div className="tr-lifetime">All time: {lifetime.correct} of {lifetime.attempts} reads</div>
          <button className="tr-again-btn" onClick={handleAgain}>Read Another Table →</button>
          <button className="tr-back-link" onClick={onBack}>Back to dashboard</button>
        </div>
      </div>
    );
  }

  const isCorrect = picked === ob.answer;

  return (
    <div className="tr-screen">
      <div className="tr-header">
        <span className="tr-title">Table Reads</span>
        <span className="tr-count">Hand {index + 1} of {deck.length}</span>
      </div>

      <div className="tr-context">{ob.context}</div>

      <div
        className="tr-replay"
        onClick={() => !fullyRevealed && setRevealCount(Infinity)}
        title={fullyRevealed ? undefined : 'Tap to skip ahead'}
      >
        {ob.replay.slice(0, revealCount).map((row) => (
          <div className="tr-row" key={row.street}>
            <span className="tr-street">
              {row.street}
              {row.board && <span className="tr-board"> {row.board}</span>}
            </span>
            <span className="tr-actions">{row.segments.map((sg) => sg.text).join(' · ')}</span>
          </div>
        ))}
        {ob.showdown && revealCount >= ob.replay.length + 1 && (
          <div className="tr-row tr-showdown">
            <span className="tr-street">SHOWDOWN</span>
            <span className="tr-actions">{ob.showdown}</span>
          </div>
        )}
        {!fullyRevealed && <div className="tr-dealing">···</div>}
      </div>

      {fullyRevealed && !picked && (
        <div className="tr-question-block">
          <div className="tr-question">Who is Seat 3?</div>
          <div className="tr-chips">
            {chips.map((key) => (
              <button key={key} className="tr-chip" onClick={() => handlePick(key)}>
                {ARCHETYPE_LABELS[key]}
              </button>
            ))}
          </div>
        </div>
      )}

      {picked && (
        <div className={`tr-feedback ${isCorrect ? 'tr-right' : 'tr-wrong'}`}>
          <div className="tr-verdict">
            {isCorrect
              ? <>✓ {ARCHETYPE_LABELS[ob.answer]} — you read it</>
              : <>✗ Not {ARCHETYPE_LABELS[picked]}. This is the {ARCHETYPE_LABELS[ob.answer]}.</>}
          </div>
          {!isCorrect && <div className="tr-whynot">{ob.whyNot[picked]}</div>}
          <div className="tr-tell">
            <span className="tr-tell-label">The tell:</span> {ob.tell}
          </div>
          <button className="tr-next-btn" onClick={handleNext}>
            {index + 1 >= deck.length ? 'See My Reads →' : 'Next Hand →'}
          </button>
        </div>
      )}
    </div>
  );
}
