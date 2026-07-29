# Profile Card Restructure (C″) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the Player Profile card to two bands — identity, then one coach surface (label + headline + watch-for + notebook) — and move the remediation queue count onto the Deal Me In button.

**Architecture:** Display-only restructure. The Recent form strip (`RecentForm.jsx` + `deriveRecentForm`) is deleted; `LastSessionRead.jsx` renders a subset of the already-stored read; `Dashboard.jsx` computes queue depth directly from `remediationQueueDepth(scenarioHistory)`. No engine, schema, API, or prompt changes — **no live eval owed** (the eval:coach law binds prompt/model changes only).

**Tech Stack:** React (CRA), jest + @testing-library/react (run via `CI=true npm test -- <path>`), Playwright e2e (`npm run e2e:build && npm run e2e`), `npm run check:invariants`.

**Spec:** `docs/superpowers/specs/2026-07-29-profile-card-restructure-design.md`

## Global Constraints

- `Dashboard.jsx` must stay ≤ 250 lines; modules under `dashboard/` ≤ 160 (invariants rules 21–22).
- Every module under `dashboard/` keeps a co-located `*.test.js` (rule 22) — deleting a module deletes its test with it.
- CSS classes must not go dead: removing JSX that was a class's only user requires removing the CSS in the same commit (dead-layout guard).
- Button text stays exactly `Deal Me In`. Chip copy: `N missed hands waiting` (singular: `1 missed hand waiting`).
- The read label is exactly `Coach's Read` — no date, no scope qualifier.
- Never weaken a gate to get green; jest tests pinning dates must freeze the clock (rule 23) — none of the tests below assert dates, deliberately.
- Run `npm run gates` after each task lands (it is fast enough and it is the law of the repo).

---

### Task 1: LastSessionRead renders the C″ subset

**Files:**
- Modify: `src/components/dashboard/LastSessionRead.jsx`
- Test: `src/components/dashboard/LastSessionRead.test.js`

**Interfaces:**
- Consumes: `parseCoachRead(body)` → `{ structured: {headline, evidence[], watchFor} | null, legacy: string | null }` (unchanged, from `src/utils/coachRead.js`).
- Produces: same component signature `LastSessionRead({ coachNote, coachReads, guest })`. Dashboard integration unchanged.

- [ ] **Step 1: Rewrite the affected tests (write failing tests first)**

In `src/components/dashboard/LastSessionRead.test.js`:

REPLACE the test at ~line 27 (`'a structured read renders headline, evidence rows, watch-for and focus'`) with:

```js
test('a structured read renders the headline and watch-for — evidence stays in the notebook', () => {
  render(<LastSessionRead coachNote={note} coachReads={history(1)} />);
  expect(screen.getByText('You over-fold to river bets')).toBeInTheDocument();
  expect(screen.getByText(/Believe passive raisers/)).toBeInTheDocument();
  // Evidence bullets read as stat-dumps on the card (founder call, 2026-07-29
  // spec). The full read, bullets included, still lives in Past Reads.
  expect(screen.queryByText('Folded top pair to the nit')).not.toBeInTheDocument();
  expect(document.querySelector('.db-profile-read-evidence')).toBeNull();
  expect(document.querySelector('.db-profile-read-focus')).toBeNull();
});
```

REPLACE the two tests at ~lines 71–82 (`'the read is labelled as a recent-form read…'` and `'the focus chip is framed as ongoing…'`) with:

```js
// C″ (2026-07-29): the label carries no scope claim at all — which also means
// it can never overclaim scope for a stored legacy per-session read.
test("the label is exactly Coach's Read — no scope claim", () => {
  render(<LastSessionRead coachNote={{ body: note.body, focus: 'bluffing' }} coachReads={[]} guest={false} />);
  expect(screen.queryByText(/Last Session's Read/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/last 10 sessions/i)).not.toBeInTheDocument();
  expect(document.querySelector('.db-profile-read-label')).toHaveTextContent(/^Coach's Read$/);
});
```

REPLACE the two dating tests at ~lines 84–101 (`'the read is dated so staleness is visible'` and `'with no dated history the label carries no date…'`) with:

```js
// DELIBERATE REVERSAL of the 2026-07-29 "date the read" pin: the founder cut
// the date from the card in the C″ spec (Decisions §2). Staleness is now
// visible only through the dated entries in Past Reads. If stale-read
// confusion shows up in feedback channels, this is the decision to revisit.
test('the card label carries no date — dates live in Past Reads', () => {
  render(
    <LastSessionRead
      coachNote={{ body: note.body, focus: 'bluffing' }}
      coachReads={[{ date: '2026-07-24', body: note.body }]}
      guest={false}
    />,
  );
  expect(screen.queryByText(/as of/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Jul 24/)).not.toBeInTheDocument();
});
```

In the prose-fallback test at ~line 36, KEEP everything (the `.db-profile-read-focus` null assertion now holds universally — fine).

- [ ] **Step 2: Run the test file, verify the new tests fail**

Run: `CI=true npm test -- src/components/dashboard/LastSessionRead.test.js`
Expected: 3 failures — evidence text still found, `last 10 sessions` still found, `Jul 24` still found. The untouched notebook/guest/prose tests must still pass.

- [ ] **Step 3: Cut the component down**

In `src/components/dashboard/LastSessionRead.jsx`, replace the `coachNote && (…)` block (lines 26–58) with:

```jsx
      {coachNote && (
        <>
          <div className="db-profile-read-label">Coach's Read</div>
          {parsed?.structured ? (
            <>
              <div className="db-profile-read-headline">{parsed.structured.headline}</div>
              {parsed.structured.watchFor && (
                <div className="db-profile-read-watchfor">
                  <span className="db-profile-read-wf-label">Watch for</span>
                  <span className="db-profile-read-wf-text">{parsed.structured.watchFor}</span>
                </div>
              )}
            </>
          ) : (
            <p className="db-profile-read-prose">{parsed?.legacy}</p>
          )}
        </>
      )}
```

(Removes: the date suffix and its `formatShortDate` import, the evidence `<ul>`, the Focus chip block.) Update the header comment (lines 5–17): the card shows the diagnosis (headline) and prescription (watch-for) only; evidence and dates live in the notebook; C″ spec 2026-07-29. Keep the notebook paragraph of the comment as-is.

- [ ] **Step 4: Run the test file, verify all pass**

Run: `CI=true npm test -- src/components/dashboard/LastSessionRead.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Remove the dead CSS in the same commit**

In `src/App.css`, delete the rule blocks for `.db-profile-read-evidence`, `.db-profile-read-evidence-row`, `.db-profile-read-focus`, `.db-profile-read-focus-label`, `.db-profile-read-focus-skill` (grep App.css for `db-profile-read-` and remove exactly the selectors no longer rendered). Keep `-label`, `-headline`, `-watchfor`, `-wf-label`, `-wf-text`, `-prose`.

- [ ] **Step 6: Gates, then commit**

Run: `npm run check:invariants && CI=true npm test`
Expected: exit 0 both.

```bash
git add src/components/dashboard/LastSessionRead.jsx src/components/dashboard/LastSessionRead.test.js src/App.css
git commit -m "feat(dashboard): the read card speaks twice — diagnosis and prescription

Evidence bullets, the date, and the Focus chip come off the card (C″ spec,
2026-07-29). The full read keeps living in Past Reads. The scope-free label
also closes the legacy-read overclaim gap."
```

---

### Task 2: Delete the Recent form strip everywhere it lives

**Files:**
- Delete: `src/components/dashboard/RecentForm.jsx`, `src/components/dashboard/RecentForm.test.js`
- Modify: `src/components/Dashboard.jsx` (imports at lines 12 and 16, computation at ~line 65, render at ~line 204)
- Modify: `src/utils/recentForm.js` + `src/utils/recentForm.test.js` (remove `deriveRecentForm`; **keep `appendRecentSession`** — `session.js` imports it)
- Modify: `src/App.css` (all `.db-form-*` rules, ~lines 1365–1405+)
- Modify: `e2e/mobilefold.spec.mjs` (~lines 41–54), `e2e/helpers.mjs` (comment at line 19)

**Interfaces:**
- Consumes: nothing new.
- Produces: `Dashboard.jsx` no longer passes/renders any form data; `recentForm.js` exports only `appendRecentSession` (and its cap constant if one exists there).

- [ ] **Step 1: Write the failing Dashboard test**

Add to `src/components/Dashboard.test.js` (after the streak tests, using the existing `dash` helper at line 27):

```js
// ── C″ restructure (2026-07-29): the stat strip is gone ────────────────────
test('the recent-form strip no longer renders', () => {
  dash({ user: { ...createUser('Stripless'), sessionsCompleted: 12,
    recentSessions: [{ date: '2026-07-28', correct: 3, total: 5, hands: [] }] } });
  expect(document.querySelector('.db-form')).toBeNull();
  expect(screen.queryByText(/to resurface/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `CI=true npm test -- src/components/Dashboard.test.js`
Expected: FAIL — `.db-form` is found (the strip renders for a signed-in user with recentSessions).

- [ ] **Step 3: Remove the strip from Dashboard.jsx**

- Delete line 12 `import RecentForm from './dashboard/RecentForm';`
- Delete line 16 `import { deriveRecentForm } from '../utils/recentForm';`
- Delete the `const recentForm = guest ? null : deriveRecentForm({ … });` block at ~line 65.
- Delete the render at ~line 204 `{recentForm && <RecentForm form={recentForm} />}` **and** the comment block above it (which documents the strip's mobile-fold behavior — that duty transfers to the read panel; see Step 6).

- [ ] **Step 4: Delete the component and prune the derivation**

```bash
git rm src/components/dashboard/RecentForm.jsx src/components/dashboard/RecentForm.test.js
```

In `src/utils/recentForm.js`: delete the `deriveRecentForm` export and every private helper/constant used only by it (the window/prev slicing and biggest-mover logic), and the now-unused `remediationQueueDepth` import from `./spacedrep`. Keep `appendRecentSession` and whatever it uses. Update the file header comment to say the module owns the recent-sessions buffer only (the strip it fed was removed 2026-07-29).

In `src/utils/recentForm.test.js`: delete the `deriveRecentForm` tests; keep the `appendRecentSession` tests.

Verify nothing dangles: `grep -rn 'deriveRecentForm\|db-form' src e2e` → expected: only `e2e/helpers.mjs:19` (comment, fixed in Step 6) and `e2e/mobilefold.spec.mjs` (fixed in Step 6).

- [ ] **Step 5: Delete the strip's CSS**

In `src/App.css` remove every rule whose selector starts with `.db-form` (the block at ~1365–1405: `.db-form`, `.db-form-row`, `.db-form-cell`, `.db-form-num`, `.db-form-num-word`, `.db-form-den`, `.db-form-delta[...]`, `.db-form-divider`, `.db-form-moved`, `.db-form-queue`, `.db-form-cell-label`).

- [ ] **Step 6: Retarget the mobile-fold e2e guard**

The strip was the last element in the profile card, so `e2e/mobilefold.spec.mjs` asserted IT was genuinely visible above the CTA (occlusion guard, CA-038). The read panel inherits that position and the duty. In `e2e/mobilefold.spec.mjs` (~lines 41–54): replace the `.db-form` bounding-box assertion with `.db-profile-read`, and delete the `.db-form-moved` / `.db-form-queue` count checks:

```js
  const read = await page.locator('.db-profile-read').boundingBox();
  expect(read, 'read panel must have a real bounding box').toBeTruthy();
```

…keeping the spec's existing "genuinely visible after scrolling, not merely present" assertion pattern, pointed at `.db-profile-read`. In `e2e/helpers.mjs` line 19, update the comment (the seeded 6+6 window no longer feeds a strip; the seed data itself is still fine for streak/read assertions — do not change the data).

- [ ] **Step 7: Run the affected jest files, verify green**

Run: `CI=true npm test -- src/components/Dashboard.test.js src/utils/recentForm.test.js`
Expected: PASS, including Step 1's test.

- [ ] **Step 8: Gates + e2e, then commit**

Run: `npm run gates` (invariants' dead-layout guard proves the CSS went with the JSX), then `npm run e2e:build && npm run e2e`.
Expected: all green.

```bash
git add -A
git commit -m "feat(dashboard): delete the recent-form strip — the card is identity, then coach

Cryptic at a glance, redundant under the trend read, and speaking engine
vocabulary (C″ spec, 2026-07-29). appendRecentSession stays — the session
buffer feeds recentSessions; only the strip's derivation dies. The mobile-fold
occlusion guard retargets to the read panel, which inherits last position."
```

---

### Task 3: Queue chip on the Deal Me In button

**Files:**
- Modify: `src/components/Dashboard.jsx` (CTA block, ~line 211)
- Modify: `src/App.css` (new `.db-cta-queue-chip` rule)
- Test: `src/components/Dashboard.test.js`

**Interfaces:**
- Consumes: `remediationQueueDepth(history)` from `src/utils/spacedrep.js` — counts entries where `remediating ?? lastResult === 'incorrect'`.
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing tests**

Add to `src/components/Dashboard.test.js`:

```js
test('the Deal Me In button carries the remediation queue as its reason-to-play', () => {
  dash({ user: { ...createUser('Grinder'), sessionsCompleted: 12,
    scenarioHistory: { sc_001: { remediating: true }, sc_002: { remediating: true } } } });
  expect(screen.getByText(/2 missed hands waiting/)).toBeInTheDocument();
});

test('an empty queue shows no chip — silence, never a hedge', () => {
  dash({ user: { ...createUser('CleanSlate'), sessionsCompleted: 12 } });
  expect(screen.queryByText(/missed hand/i)).not.toBeInTheDocument();
});

test('a single queued hand reads in the singular', () => {
  dash({ user: { ...createUser('One'), sessionsCompleted: 12,
    scenarioHistory: { sc_001: { remediating: true } } } });
  expect(screen.getByText(/1 missed hand waiting/)).toBeInTheDocument();
});

test('guests get no queue chip', () => {
  dash({ user: { ...createUser('Guesty'),
    scenarioHistory: { sc_001: { remediating: true } } }, guest: true, onGuestSignIn: () => {} });
  expect(screen.queryByText(/missed hand/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run them, verify all four fail (first, third) / pass-vacuously check**

Run: `CI=true npm test -- src/components/Dashboard.test.js`
Expected: tests 1 and 3 FAIL (`missed hands waiting` not found); tests 2 and 4 pass already — they are the negative controls and must STILL pass after implementation.

- [ ] **Step 3: Implement the chip**

In `src/components/Dashboard.jsx`:

- Add import: `import { remediationQueueDepth } from '../utils/spacedrep';`
- Where `recentForm` was computed (~line 65), add:

```js
  // The remediation queue moved from the deleted stat strip to the CTA: on the
  // button it is a reason to play, not a stat to decode (C″ spec, 2026-07-29).
  const queueDepth = guest ? 0 : remediationQueueDepth(user.scenarioHistory ?? {});
```

- In the CTA button (~line 214), after the arrow span:

```jsx
          {guestGated ? GUEST_GATE_CTA : 'Deal Me In'}
          <span className="db-cta-arrow">→</span>
          {!guestGated && queueDepth > 0 && (
            <span className="db-cta-queue-chip">
              {queueDepth} missed hand{queueDepth === 1 ? '' : 's'} waiting
            </span>
          )}
```

- In `src/App.css`, next to the `.db-cta-btn` rules:

```css
.db-cta-queue-chip {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  background: rgba(20, 32, 15, 0.18);
  border-radius: 999px;
  padding: 3px 10px;
  margin-left: 10px;
}
```

- [ ] **Step 4: Run the Dashboard tests, verify all pass**

Run: `CI=true npm test -- src/components/Dashboard.test.js`
Expected: PASS — including the two negative controls.

- [ ] **Step 5: Check the line budget, then commit**

Run: `npm run check:invariants` (Dashboard.jsx must still be ≤ 250 lines — the task nets negative lines; if it somehow exceeds, extract the CTA block to `dashboard/` rather than trimming comments).

```bash
git add src/components/Dashboard.jsx src/components/Dashboard.test.js src/App.css
git commit -m "feat(dashboard): the queue rides the Deal Me In button

'33 hands to resurface' was engine vocabulary describing future work; on the
CTA it becomes the reason to press it. Absent at zero and for guests."
```

---

### Task 4: Full verification + tap-target guard

**Files:**
- Possibly modify: `e2e/taptargets.spec.mjs` (only if the chip shrinks the button's hit area below 44px — it should not)
- Modify: `docs/product/ROADMAP.md` (one line under Phase B status: the C″ card restructure landed, spec link)

- [ ] **Step 1: Full gates**

Run: `npm run gates`
Expected: exit 0 — invariants (incl. dead-layout + line budgets), both audits, full jest, schemas, personas, build, bundle.

- [ ] **Step 2: Full e2e**

Run: `npm run e2e:build && npm run e2e`
Expected: all specs green — mobilefold (retargeted in Task 2), taptargets (the CTA with chip must still clear the ≥44px tap-target guard), smoke, streaks, context.

- [ ] **Step 3: Screenshot-level sanity (dashboard changed, not the sc2 canvas — no geometry law triggered, but look once)**

Run the localStorage-mode build already produced by e2e:build (`npx serve -s build` or the repo's harness per `docs/operations/TOOLING.md`), load the dashboard with a seeded user, and eyeball: two-band card, chip on the button. No screenshot artifact required; this is the human-eyes step.

- [ ] **Step 4: ROADMAP note + commit**

Add one line to `docs/product/ROADMAP.md` under Phase B status: `2026-07-29 (later): C″ card restructure — strip deleted, read panel reduced to headline + watch-for, queue on the CTA. Spec: docs/superpowers/specs/2026-07-29-profile-card-restructure-design.md.`

```bash
git add docs/product/ROADMAP.md e2e
git commit -m "docs: record the C″ card restructure; e2e follows the card it guards"
```

Push only on explicit go (the push is the deploy; deploy-checklist applies — no SQL, no prompt change this time).
