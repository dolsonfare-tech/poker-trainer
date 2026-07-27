// ─── Situation ticker ───────────────────────────────────────────────────────
// Builds the street-by-street action summary shown on the felt during
// gameplay (replaces the old "Action to you" line in the decision panel).
//
// Honesty rule: derive only what the structured scenario data can prove.
// Middle-street history that lives only in body prose is omitted, never
// guessed. When the sequence this street is unknowable (e.g. check-raise
// spots where toCall says "$X more"), the ticker states the neutral truth
// ("$X more to call") instead of asserting who did what.
//
// Phase 1.6: scenarios may set an authored `actionHistory` field —
//   actionHistory: [{ street: 'PRE'|'FLOP'|'TURN'|'RIVER',
//                     segments: [{ text, you?: true }] }]
// — which overrides derivation entirely.
//
// Inference rules R2/R4/R6 from docs/findings/SCENARIO_AUDIT.md live here (moved from
// ScenarioCard's buildActionTrail, which this supersedes).

const CHECK_RE = /^Checks?d?$/i;
const extractAmt = (str) => String(str ?? '').match(/\$([\d,]+)/)?.[1] ?? null;

// positions array index = seat (UTG..BB); index order = preflop acting order
const POSTFLOP_ORDER = [2, 3, 4, 5, 0, 1];
const STREET_BY_BOARD = { 0: 'PRE', 3: 'FLOP', 4: 'TURN', 5: 'RIVER' };

// All scenarios are authored against a $1/$2 six-max cash game.
export const TICKER_STAKES = '$1/$2 CASH · 6-MAX';
// Effective stacks joined the data model July 20, 2026 (three forcing votes:
// sc_172's all-in had no stack field, the M10 implied-odds dispute was
// unevaluable without depth, and the Expert tier is defined by it). One
// display site only (never repeat info): the stakes row.
const stakesFor = (scenario) =>
  scenario?.effectiveStacks
    ? `${TICKER_STAKES} · $${scenario.effectiveStacks} EFFECTIVE`
    : TICKER_STAKES;

const basePos = (label) => String(label ?? '').split(' ')[0];

// Preflop verbs only — bet/check/overbet actions on postflop scenarios are
// current-street, not preflop context, and are handled separately below.
function preflopSegment(p, isHero) {
  const a = p.action;
  if (!a || a === '???' || a === 'Active' || /^Folds?$/i.test(a)) return null;
  const amt = extractAmt(a);
  const pos = basePos(p.label);
  // Amountless raise/3-bet actions render without "to $X" — never "$null"
  const to = amt != null ? ` to $${amt}` : '';
  if (/^Limps?\b/i.test(a))   return { text: isHero ? 'you limp' : `${pos} limps`, you: isHero, order: 0 };
  if (/^3.Bets?\b/i.test(a))  return { text: isHero ? `you 3-bet${to}` : `${pos} 3-bets${to}`, you: isHero, order: 2 + Number(amt ?? 0) / 1e6 };
  if (/^Raises?d?\b/i.test(a)) return { text: isHero ? `you raise${to}` : `${pos} raises${to}`, you: isHero, order: 1 + Number(amt ?? 0) / 1e6 };
  if (/^Call(s|ed)?\b/i.test(a)) return { text: isHero ? 'you call' : `${pos} calls`, you: isHero, order: 3 };
  return null; // current-street verb (Bets/Checks/Overbets) or unrecognized
}

const POSITION_NAMES = {
  UTG: 'Under the Gun', HJ: 'Hijack', CO: 'Cutoff',
  BTN: 'Button', SB: 'Small Blind', BB: 'Big Blind',
};

/**
 * Villain identity + position relation, for the table bubble / tell strip.
 * Returns { label, monogram, pos, posName, actsAfter, actsAfterPost, isPostflop }
 * or null. `actsAfter` is the CURRENT street's relation: preflop order is the
 * positions-array index order (blinds act last), postflop order is
 * POSTFLOP_ORDER (blinds act first) — the two can disagree, which is exactly
 * the positional fact the relation line must not blur.
 */
export function villainSummary(scenario) {
  const positions = scenario.positions ?? [];
  const heroIdx = positions.findIndex((p) => p.state === 'hero');
  const villainIdx = positions.findIndex((p) => p.state === 'active');
  if (villainIdx === -1) return null;
  const label = scenario.villain?.label ?? 'Unknown';
  const monogram = label.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const pos = basePos(positions[villainIdx].label);
  const isPostflop = (scenario.board?.length ?? 0) > 0;
  const actsAfterPost = heroIdx !== -1 &&
    POSTFLOP_ORDER[villainIdx] > POSTFLOP_ORDER[heroIdx];
  const actsAfterPre = heroIdx !== -1 && villainIdx > heroIdx;
  return {
    label, monogram, pos, posName: POSITION_NAMES[pos] ?? pos,
    actsAfter: isPostflop ? actsAfterPost : actsAfterPre,
    actsAfterPost, isPostflop,
  };
}

/**
 * One-line rendering of a villainSummary's positional relation, for the table
 * bubble and the mobile villain strip. Lives beside villainSummary (its only
 * input) rather than in either component — Wave 2 split TableCanvas and
 * CanvasLayout apart and both render this line, so a component-owned copy
 * would have to be imported sideways.
 */
export function relationLine(v) {
  const now = v.actsAfter ? 'after' : 'before';
  // Postflop the relation holds for every remaining street; preflop it can
  // flip once the flop comes (blinds act last pre, first post) — only claim
  // "every street" when it's actually true.
  if (v.isPostflop || v.actsAfter === v.actsAfterPost) {
    return `${v.posName} · acts ${now} you, every street`;
  }
  const post = v.actsAfterPost ? 'after' : 'before';
  return `${v.posName} · acts ${now} you now, ${post} you postflop`;
}

export function buildTicker(scenario) {
  if (Array.isArray(scenario.actionHistory)) {
    return { stakes: stakesFor(scenario), rows: scenario.actionHistory };
  }

  const rows = [];
  const positions = scenario.positions ?? [];
  const heroIdx = positions.findIndex((p) => p.state === 'hero');
  const villainIdx = positions.findIndex((p) => p.state === 'active');
  const villain = positions[villainIdx];
  const villainPos = basePos(villain?.label);
  const boardLen = scenario.board?.length ?? 0;
  const isPostflop = boardLen > 0;

  // ── PRE row: chronological (limps → raises → 3-bets → calls) ──────────
  const pre = positions
    .map((p, i) => preflopSegment(p, i === heroIdx))
    .filter(Boolean)
    .sort((a, b) => a.order - b.order)
    .map(({ text, you }) => ({ text, you }));

  if (pre.length > 0) {
    rows.push({ street: 'PRE', segments: pre });
  } else if (!isPostflop) {
    rows.push({ street: 'PRE', segments: [{ text: 'folds to you' }] });
  }

  // ── Current street row (postflop only) ────────────────────────────────
  if (isPostflop && villain) {
    const heroFirst = heroIdx !== -1 &&
      POSTFLOP_ORDER[heroIdx] < POSTFLOP_ORDER[villainIdx];
    const vAmt = extractAmt(villain.action);
    const toCallAmt = extractAmt(scenario.toCall);
    const callOpt = scenario.options?.find(
      (o) => o.cls === 'call' && /^Call\s*\$/.test(o.label)
    );
    const callBtnAmt = extractAmt(callOpt?.label);
    const owed = toCallAmt ?? callBtnAmt;
    const heroInvestedThisStreet = /more/i.test(scenario.toCall ?? '');

    const segments = [];
    if (villain.action && CHECK_RE.test(villain.action)) {
      // Villain explicitly checked this street
      if (heroFirst) segments.push({ text: 'you check', you: true });
      segments.push({ text: `${villainPos} checks` });
    } else if (owed != null && heroInvestedThisStreet) {
      // Hero already has chips in this street (check-raise class) — the
      // exact sequence isn't derivable, so state only what's certain.
      segments.push({ text: `$${owed} more to call` });
    } else if (owed != null) {
      // A live bet this street. If the stored action is the current bet,
      // use its own verb (bets/overbets); stale preflop context (R2)
      // derives a plain "bets".
      const verb = vAmt === owed && /^Overbets?/i.test(villain.action ?? '')
        ? 'overbets' : 'bets';
      if (heroFirst) segments.push({ text: 'you check', you: true });
      segments.push({ text: `${villainPos} ${verb} $${owed}` });
    } else if (heroFirst) {
      segments.push({ text: "you're first to act", you: true });
    } else {
      // No bet and villain acts first → villain checked (R6 inference)
      segments.push({ text: `${villainPos} checks` });
    }
    rows.push({ street: STREET_BY_BOARD[boardLen] ?? 'NOW', segments });
  }

  return { stakes: stakesFor(scenario), rows };
}
