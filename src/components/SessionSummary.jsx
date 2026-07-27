import { SKILL_NAMES, RATING_ORDER, applyHandToSkill, DIFFICULTY_LABELS, GUEST_GATE_CTA } from '../data/constants';
import { derivePokerScore, milestoneProximity, parseCoachRead, MILESTONE_NAMES } from '../utils/userStorage';
import { activeDaysLine } from '../copy';
import AdSlot from './AdSlot';

const RESULT_COLOR = { correct: '#56c878', partial: '#e89028', incorrect: '#e25555' };

// Mirrors DAILY_LIMIT in api/coach-read.js — display only; the cap is
// enforced server-side.
const COACH_DAILY_LIMIT = 5;

function personalizeBody(scenario) {
  if (!scenario.body) return null;
  // Bodies already written to the player ("You called BTN's open…") must be
  // shown verbatim — blind token replacement mangles them ("You raised You").
  if (/\bYou\b/.test(scenario.body)) return scenario.body;
  const heroPos    = scenario.positions?.find(p => p.state === 'hero');
  const villainPos = scenario.positions?.find(p => p.state === 'active');
  const heroBase    = heroPos?.label?.split(' ')[0];
  const villainBase = villainPos?.label?.split(' ')[0];
  let text = scenario.body;
  if (villainBase) text = text.replace(new RegExp(`\\b${villainBase}\\b`, 'g'), 'Villain');
  if (heroBase) {
    text = text.replace(new RegExp(`\\b${heroBase} has\\b`, 'g'), 'You have');
    text = text.replace(new RegExp(`\\b${heroBase}\\b`, 'g'), 'You');
  }
  // Fix verb agreement after substitution: "You bets $25" → "You bet $25"
  text = text.replace(/\bYou (bet|check|call|raise|fold|shove|jam|limp|lead|donk)s\b/g, 'You $1');
  return text;
}

// `move`: 'up' | 'down' when this hand's skill changed rating this session —
// shown on the skill chip so the hand connects to its rating move without a
// separate skill list (the old rows + slide-over double-listed hands and
// only covered changed skills; founders found it confusing, July 8).
function HandReview({ entry, move = null }) {
  const { scenario, choiceVal, result } = entry;
  const userOption    = scenario.options.find(o => o.val === choiceVal);
  const correctOption = scenario.options.find(o => o.val === scenario.correct);
  const handStr       = scenario.hand.map(c => c.r + c.s).join(' ');
  const boardStr      = scenario.board ? scenario.board.join(' ') : ''; // preflop scenarios have board: null
  const showCorrect = choiceVal !== scenario.correct;

  return (
    <div className="ss-hand-review">
      <div className="ss-hr-cards">
        <span className="ss-hr-hand">{handStr}</span>
        {boardStr && <><span className="ss-hr-divider">·</span><span className="ss-hr-board">{boardStr}</span></>}
        <span className="ss-hr-skill">
          {SKILL_NAMES[scenario.skill]}
          {move && (
            <span className="ss-hr-skill-move" data-dir={move}>
              {move === 'up' ? ' ↑' : ' ↓'}
            </span>
          )}
        </span>
      </div>
      <div className="ss-hr-context">
        {scenario.body && (
          <span className="ss-hr-situation">{personalizeBody(scenario)}</span>
        )}
        {/* The gold READ line renders at decision time (comprehension audit
            C1) — ~10 scenarios grade on it, so the review card must carry it
            too or the player reviews a grading justified by invisible info. */}
        {scenario.tableContext && (
          <span className="ss-hr-read">
            <span className="ss-hr-ctx-label">Read: </span>
            {scenario.tableContext}
          </span>
        )}
        {scenario.pot && (
          <span className="ss-hr-pot">
            <span className="ss-hr-ctx-label">Pot: </span>
            {scenario.pot}
            {scenario.toCall && <> · To call: {scenario.toCall}</>}
          </span>
        )}
      </div>
      <div className="ss-hr-plays">
        <div className="ss-hr-play">
          <span className="ss-hr-play-label">You played</span>
          <span className="ss-hr-play-name" style={{ color: RESULT_COLOR[result] }}>
            {choiceVal ? (userOption?.label ?? choiceVal) : 'Action passed you by'}
          </span>
        </div>
        {showCorrect && (
          <div className="ss-hr-play">
            {/* "Recommended", not "Correct" — honest-labeling pass, July 2026 */}
            <span className="ss-hr-play-label">Recommended</span>
            <span className="ss-hr-play-name" style={{ color: '#56c878' }}>
              {correctOption?.label ?? scenario.correct}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SessionSummary({ sessionHistory = [], coachRead, coachLoading, coachLimited = false, difficulty, userSkills = {}, recentHands = [], streakSecured = null, rebuyUsed = false, streakBroken = false, activeDaysLast30 = null, prevBest = null, guest = false, onGuestSignIn, onPlayAgain, onRestart }) {
  // Replay this session's hands through the rating engine to get post-session
  // ratings — same math as userStorage.applySessionResults.
  const afterSkills = (() => {
    const sim = Object.fromEntries(
      Object.entries(userSkills).map(([k, d]) => [k, { ...d }])
    );
    for (const h of sessionHistory) {
      const key = h.scenario.skill;
      if (sim[key]) sim[key] = applyHandToSkill(sim[key], h.result);
    }
    return sim;
  })();

  // Use sessionHistory for accurate totals — skillResults dedupes by skill key
  const correctCount = sessionHistory.filter(h => h.result === 'correct').length;
  const totalHands   = sessionHistory.length;

  // The REAL Poker IQ move — same derivation the dashboard displays, not an
  // invented per-session delta (honest-numbers rule, July 2026). Recency-
  // weighted (F3): before = the pre-session recent-hands buffer; after = the
  // same buffer with this session's hands folded in, matching applySessionResults.
  const sessionHands = sessionHistory.map(h => ({ skill: h.scenario.skill, result: h.result }));
  const iqBefore = derivePokerScore(userSkills, recentHands);
  const iqAfter  = derivePokerScore(afterSkills, [...(recentHands ?? []), ...sessionHands]);
  const iqDir    = iqAfter > iqBefore ? 'up' : iqAfter < iqBefore ? 'down' : 'flat';

  const perfect = totalHands >= 5 && correctCount === totalHands;
  const newBest = prevBest != null && correctCount > prevBest;

  // Rating moves per skill — rendered as an arrow on each review card's
  // skill chip, not as a separate list (the old skill rows + slide-over
  // double-listed hands and only covered changed skills; confusing).
  const skillMoves = {};
  for (const key of Object.keys(SKILL_NAMES)) {
    const before = userSkills[key]?.rating ?? 'gray';
    const after  = afterSkills[key]?.rating ?? before;
    if (before === after) continue;
    const baseForCompare = before === 'gray' ? 'red' : before;
    skillMoves[key] = RATING_ORDER.indexOf(after) > RATING_ORDER.indexOf(baseForCompare) ? 'up' : 'down';
  }

  const missedHands = sessionHistory.filter(h => h.result !== 'correct');

  return (
    <div className="summary-card">
      <div className="summary-title">Session Complete</div>
      {difficulty && (
        <div className="ss-difficulty-chip">{DIFFICULTY_LABELS[difficulty]}</div>
      )}

      <div className={`ss-score-line${perfect ? ' ss-score-perfect' : ''}`}>
        <span className="ss-score-correct">{correctCount}</span>
        <span className="ss-score-sep"> / </span>
        <span className="ss-score-total">{totalHands}</span>
        {/* Scores say "correct" (founder, July 8); per-hand grading labels
            keep "Recommended" per the honest-labeling rule */}
        <span className="ss-score-label"> correct</span>
      </div>

      {/* Earned moments, quiet-gold register (founder decision July 8) */}
      {perfect && <div className="ss-perfect-flourish">★ Perfect Session ★</div>}
      {newBest && !perfect && <div className="ss-newbest">🏆 New personal best</div>}

      {/* Streak mechanics (M1–M3). A broken streak never renders as a bare
          reset (M2): pair it with the consistency record + the always-present
          "Deal Next Session" restart below. Otherwise the secured line gains
          milestone-proximity copy (M3) and a Rebuy-used note (M1). */}
      {streakBroken ? (
        <div className="ss-streak-broken">
          <div className="ss-streak-broken-title">Streak reset — start a new run</div>
          <div className="ss-streak-broken-note">
            {activeDaysLine(activeDaysLast30, { surface: 'summary' })}
          </div>
        </div>
      ) : streakSecured != null && (
        <div className="ss-streak-line">
          {/* Milestone wording shared with the dashboard via MILESTONE_NAMES —
              the moment the day is earned is the right place to acknowledge it */}
          🔥 Day {streakSecured} secured{MILESTONE_NAMES[streakSecured] ? ` — ${MILESTONE_NAMES[streakSecured]}` : ''}
          {(() => {
            const prox = milestoneProximity(streakSecured);
            return prox
              ? <span className="ss-streak-proximity"> · {prox.remaining} more to {prox.name} ★</span>
              : null;
          })()}
        </div>
      )}
      {rebuyUsed && (
        <div className="ss-rebuy-line">🛟 Rebuy used — streak intact</div>
      )}

      <div className="ss-coach-read">
        <div className="ss-coach-label">🧠 Coach's Read</div>
        {guest ? (
          <div className="ss-coach-text ss-coach-guest">
            Your Coach's Read — a personalized pattern analysis of your session — comes with a free account. Sign in and these results carry over.
          </div>
        ) : coachLoading ? (
          <div className="thinking">Reading your session…</div>
        ) : coachLimited ? (
          <div className="ss-coach-text ss-coach-limit">
            You've used today's {COACH_DAILY_LIMIT} Coach's Reads — they refresh tomorrow.
          </div>
        ) : (
          (() => {
            // Structured reads render as headline + evidence rows + a closing
            // watch-for line; legacy/prose reads (pre-restructure DB rows, or the
            // graceful-degradation fallback) render as the italic paragraph.
            const parsed = parseCoachRead(coachRead);
            if (parsed?.structured) {
              const { headline, evidence, watchFor } = parsed.structured;
              return (
                <div className="ss-coach-structured">
                  <div className="ss-coach-headline">{headline}</div>
                  {evidence.length > 0 && (
                    <ul className="ss-coach-evidence">
                      {evidence.map((e, i) => <li key={i} className="ss-coach-evidence-row">{e}</li>)}
                    </ul>
                  )}
                  {watchFor && (
                    <div className="ss-coach-watchfor">
                      <span className="ss-coach-watchfor-label">Watch for</span>
                      <span className="ss-coach-watchfor-text">{watchFor}</span>
                    </div>
                  )}
                </div>
              );
            }
            return <div className="ss-coach-text">{parsed?.legacy || 'No pattern identified yet.'}</div>;
          })()
        )}
      </div>

      <div className="summary-sub" style={{ marginBottom: '12px' }}>Session Impact</div>
      <div className="ss-impact-list">

        <div className="ss-impact-row ss-impact-row-iq">
          <span className="ss-impact-name">Poker IQ</span>
          <div className="ss-impact-right">
            {iqAfter == null ? (
              <span className="ss-iq-locked">Unlocks as skills get rated</span>
            ) : iqBefore == null ? (
              <span className="ss-iq-delta" data-dir="up">Unlocked · {iqAfter}</span>
            ) : (
              <span className="ss-iq-delta" data-dir={iqDir}>{iqBefore} → {iqAfter}</span>
            )}
          </div>
        </div>

      </div>

      {missedHands.length > 0 && (
        <div className="ss-missed-section">
          <div className="summary-sub" style={{ marginBottom: '12px' }}>
            Hands to Review ({missedHands.length})
          </div>
          <div className="ss-missed-list">
            {missedHands.map((entry, i) => (
              <HandReview key={i} entry={entry} move={skillMoves[entry.scenario.skill] ?? null} />
            ))}
          </div>
        </div>
      )}

      {/* One-tap chaining is the primary action — the "one more session"
          impulse shouldn't die across three screens. Dashboard is the quiet
          exit (and where the skill-ledger animation plays). Guests hit the
          gate here instead: sign in (free) to keep playing. */}
      {guest ? (
        <button className="restart-btn" onClick={() => onGuestSignIn('summary')}>
          {GUEST_GATE_CTA} →
        </button>
      ) : (
        <button className="restart-btn" onClick={onPlayAgain}>Deal Next Session →</button>
      )}
      <button className="ss-dash-link" onClick={onRestart}>Back to dashboard</button>

      <AdSlot placement="summary" />
    </div>
  );
}
