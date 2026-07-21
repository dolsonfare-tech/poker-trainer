import { useEffect, useMemo, useState } from 'react';
import OBSERVATIONS, { ARCHETYPE_LABELS } from '../data/observations';
import { loadTableReadsStats, saveTableReadsStats } from '../utils/userStorage';
import { track } from '../utils/analytics';

// Table Reads — the inverse trainer: watch the hand, name the player.
// Design + authored content in TABLE_READS_DESIGN.md. Mode-local scoring
// only (founder decision July 18) — no writes to the 8-skill ratings.

const TR_SESSION_LENGTH = 5;
const REVEAL_MS = 1100; // street-by-street cadence; tap skips
// Beginner (showdown-confirmed) hands lead until the player has this many
// lifetime attempts; after that the whole pool shuffles together. Lowered
// 10 → 4 (July 20, 2026) so a second session stops re-dealing the 4 beginners.
const BEGINNER_FIRST_ATTEMPTS = 4;

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Deal a session honoring, in order: the difficulty policy (beginner-first
// until BEGINNER_FIRST_ATTEMPTS lifetime attempts, then the whole pool),
// then a preference tier — never-seen, then seen-but-never-correct, then
// seen-correct — and finally deprioritizing any hand from the immediately
// previous session so chained sessions don't repeat. Shuffle randomness is
// preserved WITHIN each preference tier. `stats` is the full persisted stats
// object; a bare number is tolerated for back-compat (treated as attempts).
export function dealObservations(pool, stats = {}) {
  if (typeof stats === 'number') stats = { attempts: stats };
  const attempts = stats.attempts ?? 0;
  const seen = new Set(stats.seenIds || []);
  const correct = new Set(stats.correctIds || []);
  const prevDeck = new Set(stats.lastDeck || []);

  const groups = attempts < BEGINNER_FIRST_ATTEMPTS
    ? [pool.filter((o) => o.difficulty === 'beginner'), pool.filter((o) => o.difficulty === 'intermediate')]
    : [pool];

  // 0 = never seen, 1 = seen but never correct, 2 = seen and correct
  const tier = (o) => (!seen.has(o.id) ? 0 : (!correct.has(o.id) ? 1 : 2));

  const ordered = [];
  for (const group of groups) {
    const fresh = [];
    const repeats = []; // hands from the previous deck — used only if needed
    for (let t = 0; t <= 2; t++) {
      for (const o of shuffle(group.filter((o) => tier(o) === t))) {
        (prevDeck.has(o.id) ? repeats : fresh).push(o);
      }
    }
    ordered.push(...fresh, ...repeats);
  }
  return ordered.slice(0, TR_SESSION_LENGTH);
}

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export default function TableReads({ onBack, onOpenGuide }) {
  const [lifetime, setLifetime] = useState(loadTableReadsStats);
  const [deck, setDeck] = useState(() => dealObservations(OBSERVATIONS, loadTableReadsStats()));
  const [index, setIndex] = useState(0);
  const [revealCount, setRevealCount] = useState(reducedMotion() ? Infinity : 1);
  const [picked, setPicked] = useState(null);
  const [results, setResults] = useState([]);
  const [showSummary, setShowSummary] = useState(false);

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

  // Remember the just-dealt deck so the next (chained) session avoids repeats.
  useEffect(() => {
    setLifetime((prev) => {
      const next = { ...prev, lastDeck: deck.map((o) => o.id) };
      saveTableReadsStats(next);
      return next;
    });
  }, [deck]);

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
    const next = {
      ...lifetime,
      attempts: lifetime.attempts + 1,
      correct: lifetime.correct + (correct ? 1 : 0),
      seenIds: lifetime.seenIds.includes(ob.id) ? lifetime.seenIds : [...lifetime.seenIds, ob.id],
      correctIds: (correct && !lifetime.correctIds.includes(ob.id))
        ? [...lifetime.correctIds, ob.id]
        : lifetime.correctIds,
    };
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
    setDeck(dealObservations(OBSERVATIONS, lifetime));
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
          <div className="tr-scored-note">Table Reads is scored separately — it doesn't count toward your streak or skills.</div>
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

      {/* Question up front — the player knows what to watch for from the start.
          Chips still wait for the reveal (closed-book while the hand plays). */}
      {!picked && <div className="tr-question tr-question-lead">Who is Seat 3?</div>}

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
        {!fullyRevealed && <div className="tr-skip-hint">tap to skip ▸</div>}
      </div>

      {fullyRevealed && !picked && (
        <div className="tr-question-block">
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
          {onOpenGuide && (
            <button className="tr-guide-link" onClick={() => onOpenGuide(ARCHETYPE_LABELS[ob.answer])}>
              About the {ARCHETYPE_LABELS[ob.answer]} →
            </button>
          )}
          <button className="tr-next-btn" onClick={handleNext}>
            {index + 1 >= deck.length ? 'See My Reads →' : 'Next Hand →'}
          </button>
        </div>
      )}
    </div>
  );
}
