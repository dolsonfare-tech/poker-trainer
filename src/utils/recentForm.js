// ─── Recent form ───────────────────────────────────────────────────────────
// The deterministic half of the dashboard's feedback (Phase A, July 2026). The
// AI read speaks over a 10-session window because a skill needs ~5 attempts
// before it can be named; this strip speaks over SIX because its value is the
// comparison ("19 of 30, up from 16") and a comparison needs two windows of
// history — a 10-session strip would show no direction until session 20.
//
// The two windows differ ON PURPOSE. Do not unify them.

import { MIN_RATED_ATTEMPTS, RESULT_CREDIT } from '../data/constants';
import { remediationQueueDepth } from './spacedrep';

// Trailing-6 plus previous-6 is the most the strip ever reads.
export const RECENT_SESSIONS_CAP = 12;
export const RECENT_FORM_WINDOW = 6;

// Newest first, same ordering as coachReads. Cap drops the oldest.
export function appendRecentSession(recentSessions, session) {
  const prior = Array.isArray(recentSessions) ? recentSessions : [];
  return [session, ...prior].slice(0, RECENT_SESSIONS_CAP);
}

const strictCorrect = (hands) => hands.filter(h => h.result === 'correct').length;

// Credit-weighted accuracy (partial = 0.5), matching deriveRating and the skill
// ledger — so the strip and the ledger can never disagree about the same skill.
const creditAccuracy = (hands) =>
  hands.reduce((s, h) => s + (RESULT_CREDIT[h.result] ?? 0), 0) / hands.length;

/**
 * The dashboard's deterministic recent-form read.
 *
 * `moved` is the heart of it: of the skills that cleared MIN_RATED_ATTEMPTS
 * INSIDE the window, the one whose window accuracy differs most from its
 * lifetime accuracy — the thing that actually moved. Below that bar the strip
 * says NOTHING: six sessions is ~30 hands across 8 skills, and naming a skill
 * off ~4 attempts would break the same evidence bar the skill ledger enforces.
 *
 * Movement is reported in BOTH directions. A strip that only ever reports slips
 * reads as nagging rather than informational, which is the failure mode M4
 * warns about.
 */
export function deriveRecentForm({ recentSessions, skills, scenarioHistory }) {
  const all = Array.isArray(recentSessions) ? recentSessions : [];
  const window = all.slice(0, RECENT_FORM_WINDOW);
  const previous = all.slice(RECENT_FORM_WINDOW, RECENT_FORM_WINDOW * 2);
  const windowHands = window.flatMap(s => s.hands ?? []);
  const prevHands = previous.flatMap(s => s.hands ?? []);

  // Per-skill attempts inside the window, so the gate is measured on the window
  // and never on the lifetime ledger.
  const bySkill = {};
  for (const h of windowHands) (bySkill[h.skill] ??= []).push(h);

  let moved = null;
  // Starting bestGap at 0 means a skill that clears the attempts gate with an
  // EXACTLY zero accuracy gap (window == lifetime) is deliberately never
  // reported: there's no movement to report, and `dir` has no "unchanged" value.
  let bestGap = 0;
  for (const key of Object.keys(bySkill).sort()) {   // alphabetical = deterministic tie-break
    const hands = bySkill[key];
    if (hands.length < MIN_RATED_ATTEMPTS) continue;
    const lifetime = skills?.[key];
    if (!lifetime || !lifetime.attempts) continue;
    const windowPct = creditAccuracy(hands);
    const lifetimePct = lifetime.correct / lifetime.attempts;
    const gap = Math.abs(windowPct - lifetimePct);
    // Strictly greater keeps the first winner on a tie; because we iterate
    // alphabetically, attempts then break remaining ties below.
    if (gap > bestGap || (gap === bestGap && moved && hands.length > bySkill[moved.skill].length)) {
      bestGap = gap;
      moved = { skill: key, dir: windowPct >= lifetimePct ? 'up' : 'down' };
    }
  }

  return {
    windowSize: window.length,
    correct: strictCorrect(windowHands),
    total: windowHands.length,
    prev: previous.length > 0
      ? { correct: strictCorrect(prevHands), total: prevHands.length }
      : null,
    moved,
    queueDepth: remediationQueueDepth(scenarioHistory),
  };
}
