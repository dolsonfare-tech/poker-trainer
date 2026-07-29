# Coach's Read Prompt v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trajectory-tier headline + trigger-action watchFor + the pre-registered cap tune, validated by one dry run now and one founder-run live eval before deploy.

**Architecture:** All prompt text and constants live in `api/coach-read.js` (the only Claude-calling file); the eval harness imports the same constants (single-sourcing, invariants rule 31). No schema/API/client/UI changes.

**Tech Stack:** Node (CommonJS serverless fn), `scripts/eval-coach.mjs` harness, `npm run gates`.

**Spec:** `docs/superpowers/specs/2026-07-29-coach-read-prompt-v2-design.md`

## Global Constraints

- Headline cap stays 12; evidence 20→24; watchFor 18→20 — pre-registered in the spec, never moved again to make a run green.
- `HEADLINE_RULE` text is untouched and stays top priority (tier 1).
- Tier 2 fires ONLY when: no confident errors listed AND a previous stretch is given AND this stretch's accuracy improved on it.
- Every number in any read is copied, never derived — unchanged law.
- The harness's new mechanical check keys off the SUMMARY's own conditions, never a persona's plan (the finding-3 lesson, already encoded in checkRead).
- `npm run gates` after every task; the live eval is the founder's step, not this plan's.

---

### Task 1: Prompt constants + instruction text (`api/coach-read.js`)

**Files:** Modify `api/coach-read.js` (~lines 281-299 constants, ~361-363 instructions, module.exports)

**Interfaces produced:** `TRAJECTORY_RULE` (string const, exported), `WORD_CAPS = { headline: 12, evidence: 24, watchFor: 20, evidenceItems: [1, 2] }`.

- [ ] **Step 1:** After the `HEADLINE_RULE` block, add:

```js
// Tier 2 of the headline precedence (prompt v2, July 29 2026): when the window
// has NO confident errors but DOES show measured improvement over the previous
// stretch, the improvement IS the encouragement — the only kind honest labeling
// permits, because it is copied from the data rather than manufactured. Tier 1
// (HEADLINE_RULE) always wins; this fires only in its absence. Exported and
// imported by scripts/eval-coach.mjs for the same single-sourcing reason as
// HEADLINE_RULE.
const TRAJECTORY_RULE = 'open the headline with that improvement, copying both correct-counts as written above, then name the clearest remaining pattern in the same sentence';
```

- [ ] **Step 2:** Update `WORD_CAPS` to `{ headline: 12, evidence: 24, watchFor: 20, evidenceItems: [1, 2] }` and REPLACE the "watchFor stays at 18 deliberately" paragraph of its comment with the pre-registration record: evidence 24 / watchFor 20 were re-tuned on July 29 2026 as part of prompt v2 (spec 2026-07-29-coach-read-prompt-v2-design.md), the moment ROADMAP path 1 promised ("re-tune when the prompt is next touched"); measured basis: evidence items at 21w/22w and four watchFors at exactly 19w in the July 29 live runs; caps are never moved to green a failing run.

- [ ] **Step 3:** In `buildPrompt`, replace the headline instruction sentence ending `If confident errors are listed above, the ${HEADLINE_RULE}.` with:

```
If confident errors are listed above, the ${HEADLINE_RULE}. If there are NO confident errors listed and the stretch-before comparison is given and this stretch improved on it, ${TRAJECTORY_RULE}. Otherwise name the clearest pattern as above.
```

(Keep the existing first sentence about ONE sentence / cap / DOING-not-identity unchanged.)

- [ ] **Step 4:** Replace the watchFor instruction line with:

```
- watchFor: ONE sentence, ${WORD_CAPS.watchFor} words or fewer, phrased as a trigger-action plan for their next session: name the situation cue, then the action ("Next time a raise crosses your mind, make it"). Cite one number from above only if it sharpens the instruction, copied as written. Count the words before you answer; ${WORD_CAPS.watchFor} is a hard limit, not a target.
```

- [ ] **Step 5:** Add `TRAJECTORY_RULE` to `module.exports` beside `HEADLINE_RULE`.

- [ ] **Step 6:** Run `npm run check:invariants && CI=true npm test` — expect green (rule 31 checks the harness against the REAL prompt module, so it stays green through both tasks; the harness picks up the new caps automatically via its `WORD_CAPS` import).

- [ ] **Step 7:** Commit: `feat(coach): prompt v2 — trajectory tier and trigger-action watchFor, caps pre-registered`

---

### Task 2: Harness follows the contract (`scripts/eval-coach.mjs`)

**Files:** Modify `scripts/eval-coach.mjs` (import at ~39, header doc ~6, checkRead ~340-390, persona `expect` strings)

**Interfaces consumed:** `TRAJECTORY_RULE`, `WORD_CAPS` from the coach module.

- [ ] **Step 1:** Add `TRAJECTORY_RULE` to the destructured import at line ~39.

- [ ] **Step 2:** In `checkRead`, after the existing confident-error headline check (keyed off the summary, not the persona), add the tier-2 mechanical check with the same keying discipline:

```js
  // Tier 2 (prompt v2): trajectory headline. Keyed off the summary's own
  // conditions, mirroring the confident-error check above: fires only when the
  // prompt's own condition fires. "Opens with the improvement" is verified by
  // both copied correct-counts appearing in the headline — the same copy-only
  // law every number lives under.
  const improved = summary.previous
    && (summary.accuracy.correct / summary.accuracy.total)
       > (summary.previous.correct / summary.previous.total);
  const hasConfident = (summary.confidentByVillain ?? []).length > 0;
  if (!hasConfident && improved) {
    const h = read.headline ?? '';
    const ok = h.includes(String(summary.accuracy.correct))
      && h.includes(String(summary.previous.correct));
    cov.trajectoryChecked = (cov.trajectoryChecked ?? 0) + 1;
    if (!ok) cov.trajectoryMissed = (cov.trajectoryMissed ?? 0) + 1;
    lines.push(`- ${ok ? '✓' : '✗'} trajectory headline (no confident errors + improved stretch: ${TRAJECTORY_RULE})`);
  }
```

(Adapt variable names to checkRead's actual locals — `lines`/`cov` per the existing checks; if checkRead receives the summary under a different name, follow the file. Add the two new cov fields to the coverage totals that print under the doc, following how existing cov fields are reported.)

- [ ] **Step 3:** Update the `expect` strings of the improving personas WITHOUT confident errors (Passive ~186, loose-caller ~210, villain-ignorer ~239, well-playing ~289) — append to each: `Headline opens with the copied improvement counts (tier 2), then the leak.` Leave the confident-misser persona's expect untouched (tier 1 unchanged). Update the header doc's F5 criteria line (~6) to mention: watchFor must be cue→action shaped; tier-2 trajectory openings where the window improved without confident errors.

- [ ] **Step 4:** Any persona with `fast` plan steps AND improvement keeps tier-1 expectations — verify by grep that no expect now claims both tiers.

- [ ] **Step 5:** Run the dry run from the repo root: `node scripts/eval-coach.mjs --dry` — read `coach-eval-dry-prompts.md` and verify: the new watchFor instruction text present, the tier-2 sentence present, caps interpolated as 12/24/20, and the assembled data blocks unchanged.

- [ ] **Step 6:** `npm run gates` — green.

- [ ] **Step 7:** Commit: `feat(eval): the harness expects prompt v2 — trajectory check keyed off the summary, improving personas re-expected`

---

### Task 3: Docs — the open decision closes

**Files:** Modify `docs/product/ROADMAP.md` ("THE ONE OPEN DECISION — word caps" section), `CLAUDE.md` (the eval:coach law's "Open, undecided" sentence)

- [ ] **Step 1:** ROADMAP: replace the open-decision section body with a short closure note: caps re-tuned (evidence 24, watchFor 20, headline unchanged) as part of prompt v2 on July 29 2026, per the spec; the pre-registration language; pending the validating live run.
- [ ] **Step 2:** CLAUDE.md: update the eval-law sentence that describes the open cap breaches to state the caps were re-tuned in prompt v2 (spec link) and a live run is REQUIRED and pending — the law's "re-run LIVE after ANY prompt change" sentence stays. Keep CLAUDE.md's line count neutral or smaller (rule: line budget).
- [ ] **Step 3:** `npm run check:invariants` (CLAUDE.md budget + triage-doc rules) — green. Commit: `docs: the word-cap decision closes into prompt v2; live run pending`

---

### Task 4: Hand-off gate (no deploy)

- [ ] **Step 1:** Full `npm run gates` at HEAD — green.
- [ ] **Step 2:** Do NOT push. Report to the founder: the exact live-eval command (`CLAUDE_API_KEY=sk-ant-... npm run eval:coach`), what to judge (the spec's acceptance section), and that deploy = push only after the run passes their judgment.
