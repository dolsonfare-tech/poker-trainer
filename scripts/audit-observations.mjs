// Observation auditor — content gate for Table Reads hands
// (src/data/observations.js), per the authoring checklist in
// TABLE_READS_DESIGN.md. Ships WITH the mode, not after it.
//
// Run:  node scripts/audit-observations.mjs
// Exit code 1 if any ERROR-level findings (safe for CI).

import OBSERVATIONS, { ARCHETYPE_LABELS } from '../src/data/observations.js';

const findings = [];
const flag = (sev, id, rule, msg) => findings.push({ sev, id, rule, msg });

const STREETS = ['PRE', 'FLOP', 'TURN', 'RIVER'];
// Shorthand card notation (KQs, 98d) is banned repo-wide — suit symbols only.
const SHORTHAND_RE = /\b[AKQJT2-9]{2,3}[shdc]\b/;

const seenIds = new Set();
for (const ob of OBSERVATIONS) {
  const { id } = ob;

  // O1 — structural integrity
  if (seenIds.has(id)) flag('ERROR', id, 'O1', 'duplicate id');
  seenIds.add(id);
  if (!/^ob_\d{3}$/.test(id)) flag('ERROR', id, 'O1', 'id must be ob_NNN');
  if (!['beginner', 'intermediate'].includes(ob.difficulty)) flag('ERROR', id, 'O1', `bad difficulty '${ob.difficulty}'`);
  if (!ob.context || !ob.tell) flag('ERROR', id, 'O1', 'missing context or tell');

  // O2 — answer/distractor discipline: valid keys, never 'unknown', exactly
  // 3 distractors, none equal to the answer, every one covered by whyNot
  if (!ARCHETYPE_LABELS[ob.answer]) flag('ERROR', id, 'O2', `answer '${ob.answer}' not a playable archetype`);
  if (!Array.isArray(ob.distractors) || ob.distractors.length !== 3) {
    flag('ERROR', id, 'O2', 'must have exactly 3 distractors');
  } else {
    for (const d of ob.distractors) {
      if (!ARCHETYPE_LABELS[d]) flag('ERROR', id, 'O2', `distractor '${d}' not a playable archetype`);
      if (d === ob.answer) flag('ERROR', id, 'O2', 'distractor equals the answer');
      if (!ob.whyNot?.[d]) flag('ERROR', id, 'O2', `no whyNot for distractor '${d}'`);
    }
    if (new Set(ob.distractors).size !== 3) flag('ERROR', id, 'O2', 'duplicate distractors');
  }
  for (const key of Object.keys(ob.whyNot ?? {})) {
    if (!ob.distractors.includes(key)) flag('WARN', id, 'O2', `whyNot for '${key}' is not in the distractor set (dead text)`);
  }

  // O3 — replay integrity: rows in street order, each with segments, boards
  // only on postflop rows, flop = 3 cards / turn & river = 1
  if (!Array.isArray(ob.replay) || ob.replay.length === 0) {
    flag('ERROR', id, 'O3', 'empty replay');
  } else {
    let lastStreet = -1;
    for (const row of ob.replay) {
      const si = STREETS.indexOf(row.street);
      if (si === -1) { flag('ERROR', id, 'O3', `bad street '${row.street}'`); continue; }
      if (si <= lastStreet) flag('ERROR', id, 'O3', `street ${row.street} out of order`);
      lastStreet = si;
      if (!Array.isArray(row.segments) || row.segments.length === 0 || row.segments.some(sg => !sg.text)) {
        flag('ERROR', id, 'O3', `${row.street}: empty or textless segments`);
      }
      if (row.street === 'PRE' && row.board) flag('ERROR', id, 'O3', 'PRE row must not carry a board');
      if (row.street !== 'PRE' && !row.board) flag('ERROR', id, 'O3', `${row.street}: postflop row needs a board`);
      if (row.board) {
        const cards = row.board.trim().split(/\s+/);
        const want = row.street === 'FLOP' ? 3 : 1;
        if (cards.length !== want) flag('ERROR', id, 'O3', `${row.street}: expected ${want} board card(s), got ${cards.length}`);
        for (const c of cards) {
          if (!/^[AKQJT2-9]{1,2}[♠♥♦♣]$/.test(c)) flag('ERROR', id, 'O3', `${row.street}: malformed card '${c}'`);
        }
      }
      if (!row.segments?.some(sg => /Seat 3/.test(sg.text)) && row.street !== 'PRE') {
        flag('WARN', id, 'O3', `${row.street}: villain (Seat 3) absent from the street`);
      }
    }
  }

  // O4 — showdown is the difficulty dial: beginner hands must keep it
  if (ob.difficulty === 'beginner' && !ob.showdown) {
    flag('ERROR', id, 'O4', 'beginner observation without a showdown');
  }

  // O5 — notation: suit symbols only, anywhere text lives
  const texts = [ob.context, ob.tell, ob.showdown ?? '', ...Object.values(ob.whyNot ?? {}),
    ...ob.replay.flatMap(r => (r.segments ?? []).map(sg => sg.text))];
  for (const t of texts) {
    if (SHORTHAND_RE.test(t)) flag('ERROR', id, 'O5', `shorthand card notation in: "${t.slice(0, 60)}…"`);
  }
}

// ── Report ──────────────────────────────────────────────────────────────
const errors = findings.filter(f => f.sev === 'ERROR');
const warns = findings.filter(f => f.sev === 'WARN');
for (const f of findings) console.log(`${f.sev}  ${f.id}  [${f.rule}]  ${f.msg}`);
console.log(`\n${OBSERVATIONS.length} observations audited — ${errors.length} error(s), ${warns.length} warning(s)`);
process.exit(errors.length > 0 ? 1 : 0);
