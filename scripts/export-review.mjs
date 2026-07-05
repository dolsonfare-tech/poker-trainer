// SME review export — one row per scenario with everything a reviewer needs
// to judge the gradings, plus empty verdict/notes columns for markup.
//
// Run:  npm run export:review   →  scenario-review.csv (open in Excel/Sheets)
import { writeFileSync } from 'fs';
import SCENARIOS from '../src/data/scenarios.js';
import { buildTicker } from '../src/utils/ticker.js';

const esc = (v) => {
  const s = String(v ?? '').replace(/\r?\n/g, ' ');
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const header = [
  'id', 'difficulty', 'skill', 'villain', 'villain_notes',
  'hero_seat', 'villain_seat', 'hand', 'board', 'pot', 'to_call',
  'action_history', 'situation',
  'option_1', 'grade_1', 'feedback_1',
  'option_2', 'grade_2', 'feedback_2',
  'option_3', 'grade_3', 'feedback_3',
  'correct_answer', 'REVIEWER_VERDICT', 'REVIEWER_NOTES',
];

const rows = SCENARIOS.map((s) => {
  const hero = s.positions.find((p) => p.state === 'hero');
  const vill = s.positions.find((p) => p.state === 'active');
  const ticker = buildTicker(s).rows
    .map((r) => `${r.street}: ${r.segments.map((x) => x.text).join(' · ')}`)
    .join('  |  ');
  const opts = [0, 1, 2].flatMap((i) => {
    const o = s.options[i];
    if (!o) return ['', '', ''];
    const g = s.grading[o.val];
    return [o.label, g?.g ?? '', s.feedback[g?.g] ?? ''];
  });
  const correct = s.options.find((o) => o.val === s.correct)?.label ?? s.correct;
  return [
    s.id, s.difficulty, s.skill, s.villain?.label, s.villain?.notes,
    hero?.label, vill?.label,
    s.hand.map((c) => c.r + c.s).join(' '),
    (s.board ?? []).join(' '),
    s.pot, s.toCall ?? '',
    ticker, s.body,
    ...opts,
    correct, '', '',
  ].map(esc).join(',');
});

// BOM so Excel renders the suit symbols (♠♥♦♣) correctly
writeFileSync('scenario-review.csv', '﻿' + [header.join(','), ...rows].join('\n'));
console.log(`scenario-review.csv written — ${rows.length} scenarios`);
