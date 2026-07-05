// Scenario auditor — implements the Agent Rules + Audit Checklist from
// SCENARIO_AUDIT.md against all scenarios in src/data/scenarios.js.
//
// Run:  node scripts/audit-scenarios.mjs
// Exit code 1 if any ERROR-level findings (safe for CI).

import SCENARIOS from '../src/data/scenarios.js';

const findings = [];
const flag = (sev, id, rule, msg) => findings.push({ sev, id, rule, msg });

const amt = (str) => {
  const m = String(str ?? '').match(/\$([\d,]+(?:\.\d+)?)/);
  return m ? parseFloat(m[1].replace(/,/g, '')) : null;
};
const THREAT_RE = /^(Bets?|Raises?|Check.Raises?|3.Bets?|4.Bets?|Donks?|All.?[Ii]n)/i;
const CHECK_RE = /^Checks?d?$/i;

for (const s of SCENARIOS) {
  const id = String(s.id).startsWith('sc_') ? String(s.id) : `sc_${String(s.id).padStart(3, '0')}`;
  const hero = s.positions.find(p => p.state === 'hero');
  const villain = s.positions.find(p => p.state === 'active');
  const callOpt = s.options.find(o => o.cls === 'call');
  const callAmt = callOpt ? amt(callOpt.label) : null;
  const toCallAmt = amt(s.toCall);
  const potAmt = amt(s.pot);
  const isPostflop = Array.isArray(s.board) && s.board.length > 0;

  // ── Structural sanity ────────────────────────────────────────────────
  // Non-folded seats must carry a real position label (the UI derives seat
  // names, the you-chip, and the villain bubble from the label's prefix)
  const SEATS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  for (const p of s.positions) {
    if (p.state === 'folded') continue;
    const base = String(p.label ?? '').split(' ')[0];
    if (!SEATS.includes(base))
      flag('ERROR', id, 'label', `seat label '${p.label}' does not start with a real position (${p.state} seat)`);
  }
  if (!hero) flag('ERROR', id, 'struct', 'no hero seat');
  if (!villain) flag('WARN', id, 'struct', 'no active villain seat');
  if (s.positions.filter(p => p.state === 'hero').length > 1)
    flag('ERROR', id, 'struct', 'multiple hero seats');
  if (s.board != null && ![3, 4, 5].includes(s.board.length))
    flag('ERROR', id, 'struct', `board has ${s.board.length} cards`);

  const vals = s.options.map(o => o.val);
  if (new Set(vals).size !== vals.length)
    flag('ERROR', id, 'struct', `duplicate option vals: ${vals}`);
  if (!vals.includes(s.correct))
    flag('ERROR', id, 'struct', `correct '${s.correct}' not among options`);
  const corrects = Object.values(s.grading).filter(g => g.g === 'correct').length;
  if (corrects !== 1)
    flag('ERROR', id, 'struct', `${corrects} options graded 'correct' (want exactly 1)`);

  // ── Card collisions (hole cards vs board, duplicates) ────────────────
  const holeCards = s.hand.map(c => c.r + c.s);
  const allCards = [...holeCards, ...(s.board ?? [])];
  if (new Set(allCards).size !== allCards.length)
    flag('ERROR', id, 'cards', `duplicate card among hand+board: ${allCards}`);

  // ── R1: toCall matches call button amount ────────────────────────────
  if (toCallAmt != null && callAmt != null && toCallAmt !== callAmt)
    flag('ERROR', id, 'R1', `toCall ${s.toCall} ≠ call button '${callOpt.label}'`);

  // ── R2: stale preflop action stored on postflop scenario ─────────────
  if (isPostflop && villain?.action && THREAT_RE.test(villain.action)) {
    const va = amt(villain.action);
    if (va != null && toCallAmt != null && va !== toCallAmt)
      flag('WARN', id, 'R2', `villain.action '${villain.action}' is stale preflop context (toCall ${s.toCall}) — UI derives around it; fix data eventually`);
  }

  // ── R4/open question: toCall null but a genuine call exists ──────────
  if (s.toCall == null && callAmt != null && /^Call\s*\$/.test(callOpt.label))
    flag('ERROR', id, 'R4', `toCall is null but call button is '${callOpt.label}' — missing toCall`);

  // ── Preflop: a live raise must be recorded on a seat, not hidden ─────
  // (Taught by sc_009/sc_010: villain stored as 'Active' → ticker showed
  // "folds to you" while the player faced a $6 call.)
  if (!isPostflop) {
    // "Facing a bet" = toCall is set, or the call button literally says "Call $X".
    // (Limp/complete/open options are hero opening an unopened pot — not a bet faced.)
    const owed = toCallAmt ??
      (callOpt && /^Call\s*\$/.test(callOpt.label) ? callAmt : null);
    const anyRaise = s.positions.some(p => /(Raises?d?|3.Bets?|Bets?)\s*\$/i.test(p.action ?? ''));
    if (owed != null && !anyRaise)
      flag('ERROR', id, 'pre', `facing $${owed} to call but no seat action records the raise (stored as 'Active'?)`);
  }

  // ── Preflop call math (blinds $1/$2) ─────────────────────────────────
  if (!isPostflop && villain?.action && /Raises/i.test(villain.action)) {
    const raise = amt(villain.action);
    const heroLabel = hero?.label ?? '';
    const invested = /\bBB\b/.test(heroLabel) ? 2 : /\bSB\b/.test(heroLabel) ? 1 : 0;
    if (raise != null && toCallAmt != null && toCallAmt !== raise - invested)
      flag('ERROR', id, 'math', `preflop: raise to $${raise}, hero invested $${invested}, expected toCall $${raise - invested}, got ${s.toCall}`);
  }

  // ── Pot claims in body vs pot field ──────────────────────────────────
  const bodyPot = String(s.body ?? '').match(/[Pp]ot(?:\s+\w+){0,2}\s+(?:is\s+|of\s+|at\s+)?\$([\d,]+)/);
  if (bodyPot && potAmt != null && parseFloat(bodyPot[1].replace(/,/g, '')) !== potAmt)
    flag('ERROR', id, 'pot', `body says pot $${bodyPot[1]} but pot field is ${s.pot}`);

  // ── Board cards mentioned in body must match board field ─────────────
  if (isPostflop && s.body) {
    const bodyCards = s.body.match(/(?:[AKQJT2-9]|10)[♠♥♦♣]/g) ?? [];
    for (const c of bodyCards) {
      if (!allCards.includes(c) && !holeCards.includes(c))
        flag('ERROR', id, 'cards', `body mentions ${c} — not in hand or board`);
    }
  }

  // ── Pot-odds claims in question/body vs actual numbers ───────────────
  const oddsClaim = `${s.question ?? ''} ${s.body ?? ''}`.match(/([\d.]+)\s*:\s*1/);
  if (oddsClaim && potAmt != null && toCallAmt != null && toCallAmt > 0) {
    const claimed = parseFloat(oddsClaim[1]);
    const potIncludesBet = (potAmt + toCallAmt) / toCallAmt;   // pot field = before villain's bet
    const potIsCurrent = potAmt / toCallAmt;                   // pot field = at decision time
    const near = (x) => Math.abs(x - claimed) <= 0.25;
    if (!near(potIncludesBet) && !near(potIsCurrent))
      flag('ERROR', id, 'odds', `claims ${claimed}:1 but pot ${s.pot} / call ${s.toCall} gives ${potIsCurrent.toFixed(1)}:1 (or ${potIncludesBet.toFixed(1)}:1 incl. bet)`);
  }

  // ── Authored actionHistory validation ────────────────────────────────
  if (Array.isArray(s.actionHistory)) {
    const ORDER = ['PRE', 'FLOP', 'TURN', 'RIVER'];
    const current = { 0: 'PRE', 3: 'FLOP', 4: 'TURN', 5: 'RIVER' }[s.board?.length ?? 0];
    let prev = -1;
    for (const r of s.actionHistory) {
      const oi = ORDER.indexOf(r?.street);
      if (oi === -1) { flag('ERROR', id, 'hist', `bad street '${r?.street}'`); continue; }
      if (oi <= prev) flag('ERROR', id, 'hist', `streets out of order at '${r.street}'`);
      prev = oi;
      if (oi > ORDER.indexOf(current))
        flag('ERROR', id, 'hist', `row '${r.street}' is beyond the current street (${current})`);
      if (!Array.isArray(r.segments) || r.segments.length === 0 ||
          r.segments.some(x => typeof x?.text !== 'string' || !x.text))
        flag('ERROR', id, 'hist', `empty/malformed segments on ${r.street}`);
    }
    const last = s.actionHistory[s.actionHistory.length - 1];
    if (last?.street !== current)
      flag('ERROR', id, 'hist', `history ends on ${last?.street}; current street is ${current}`);
    // The live bet must appear in the final row. Skipped when the hero has
    // chips invested this street ('more' labels, or a raise-over-bet row —
    // there the row shows the raise-to amount, not the difference owed).
    if (toCallAmt != null && !/more/i.test(callOpt?.label ?? '')) {
      const txt = (last?.segments ?? []).map(x => x.text).join(' ');
      if (!txt.includes(`$${toCallAmt}`) && !/raises to/i.test(txt))
        flag('WARN', id, 'hist', `toCall $${toCallAmt} missing from final history row`);
    }
  }

  // ── "checks to you" prose requires the villain to act first ──────────
  if (isPostflop && /checks? to you/i.test(s.body ?? '')) {
    const POSTFLOP_ORDER = [2, 3, 4, 5, 0, 1];
    const hIdx = s.positions.findIndex(p => p.state === 'hero');
    const vIdx = s.positions.findIndex(p => p.state === 'active');
    if (hIdx !== -1 && vIdx !== -1 && POSTFLOP_ORDER[vIdx] > POSTFLOP_ORDER[hIdx])
      flag('ERROR', id, 'order', `body says villain "checks to you" but ${s.positions[vIdx].label} acts AFTER ${s.positions[hIdx].label}`);
  }

  // ── Positional claims in body/question vs actual seat order ──────────
  // Postflop acting order by seat index: SB→BB→UTG→HJ→CO→BTN
  if (isPostflop) {
    const POSTFLOP_ORDER = [2, 3, 4, 5, 0, 1];
    const heroIdx = s.positions.findIndex(p => p.state === 'hero');
    const vilIdx = s.positions.findIndex(p => p.state === 'active');
    if (heroIdx !== -1 && vilIdx !== -1) {
      const heroIP = POSTFLOP_ORDER[heroIdx] > POSTFLOP_ORDER[vilIdx];
      const txt = `${s.body ?? ''} ${s.question ?? ''}`;
      const claimsOOP = /out of position|\bOOP\b/i.test(txt);
      const claimsIP = !claimsOOP && /\bin position\b|\bIP\b/.test(txt);
      if (claimsIP && !heroIP)
        flag('ERROR', id, 'position', `body/question claims hero is in position but ${s.positions[heroIdx].label} acts before ${s.positions[vilIdx].label} postflop`);
      if (claimsOOP && heroIP)
        flag('ERROR', id, 'position', `body/question claims OOP but ${s.positions[heroIdx].label} acts after ${s.positions[vilIdx].label} postflop`);
    }
  }

  // ── Street language in body vs board length ──────────────────────────
  if (s.body) {
    const streets = { flop: 3, turn: 4, river: 5 };
    for (const [word, len] of Object.entries(streets)) {
      const re = new RegExp(`(?:on|to|at)\\s+the\\s+${word}\\b|\\b${word}\\s+(?:comes?|brings?|is|falls?)\\b`, 'i');
      if (re.test(s.body) && (s.board?.length ?? 0) < len)
        flag('WARN', id, 'street', `body references the ${word} but board has ${s.board?.length ?? 0} cards`);
    }
  }
}

// ── Report ──────────────────────────────────────────────────────────────
const bySev = { ERROR: [], WARN: [] };
for (const f of findings) bySev[f.sev].push(f);

for (const sev of ['ERROR', 'WARN']) {
  if (!bySev[sev].length) continue;
  console.log(`\n${sev === 'ERROR' ? '🔴' : '🟡'} ${sev} (${bySev[sev].length})`);
  for (const f of bySev[sev]) console.log(`  ${f.id} [${f.rule}] ${f.msg}`);
}
console.log(`\n${SCENARIOS.length} scenarios audited · ${bySev.ERROR.length} errors · ${bySev.WARN.length} warnings`);
process.exit(bySev.ERROR.length ? 1 : 0);
