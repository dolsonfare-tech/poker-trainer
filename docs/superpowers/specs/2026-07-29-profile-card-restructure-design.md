# Player Profile card restructure (C″) — design

**Date:** 2026-07-29 · **Status:** approved in conversation (founder-user), pending spec review
**Mockup:** claude.ai artifact "Player Profile card — C″ restructure mockup" (round 2, both variants; C″ chosen)

## Context

Phase B shipped the trend read (trailing 10 sessions, refreshed every 5) to the
dashboard on 2026-07-29. That left the Player Profile card with three bands:
identity (archetype + skill chips), the Phase A "Recent form" stat strip, and
the read panel. The strip was judged failing on all four axes (cryptic numbers,
redundant with the trend read below it, not actionable, engine vocabulary), and
the read panel's evidence bullets read as stat-dumps even in genuine trend
reads. The card restructures to two bands: identity, then one coach surface.

## Decisions (each confirmed explicitly)

1. **Delete the Recent form strip** — all three cells (`12/30 ▲ was 9`,
   biggest-mover skill, `hands to resurface`). No replacement band.
2. **Read panel renders exactly three things:** the `Coach's Read` label
   (no date, no scope qualifier), the read's **headline**, and the
   **Watch for** line. The evidence bullets and the Focus chip no longer
   render on the card. The full read (bullets included) remains visible in
   the Past Reads notebook, which is unchanged.
   - The headline stays by design: watch-for alone is advice with no reason
     attached; headline → watch-for is diagnosis → prescription (F1:
     explanation-of-why is the highest-effect-size lever).
   - Dropping the "last 10 sessions" scope from the label also closes the
     honest-labeling gap for stored legacy reads — the label no longer claims
     a scope the body may not have.
3. **No freshness line, no cadence countdown.** Between reads the panel is
   static; silence until there is something to report. (A "since this read"
   line was designed, mocked, and rejected.)
4. **Queue depth moves to the CTA:** the `Deal Me In` button gains a chip —
   `33 missed hands waiting` (count from `remediationQueueDepth`). Chip is
   absent at zero and for guests (recent form was never computed for guests;
   parity preserved). Button text stays `Deal Me In`.
5. **Identity band untouched.** Schema/archetype card and skill chips keep
   their exact current markup and CSS.

## Changes by file

| File | Change |
|---|---|
| `src/components/dashboard/RecentForm.jsx` + test | **Deleted.** |
| `src/components/Dashboard.jsx` | Stop importing/rendering RecentForm; pass queue depth to the CTA area; chip markup on the Deal Me In button. Stays ≤ 250 lines (rule 21). |
| `src/utils/recentForm.js` + test | `deriveRecentForm` (window/prev/moved logic) deleted; **`appendRecentSession` stays** — `session.js` imports it. Queue depth: Dashboard calls `remediationQueueDepth(scenarioHistory)` directly (import from `spacedrep.js`). |
| `src/components/dashboard/LastSessionRead.jsx` + test | Render label (`Coach's Read`), `parsed.structured.headline`, watch-for, notebook. Remove: date suffix, evidence `<ul>`, Focus chip. Legacy prose reads (parse fallback) keep rendering as clamped prose — they have no headline/watchFor fields. |
| `src/App.css` | Remove `.db-form-*` rules (dead-layout guard, invariants rule: unused classes fail); add `.db-cta-queue-chip` for the button chip. |
| e2e | Update any spec touching the strip or read panel geometry; run full suite (gate 6 — dashboard). |

## What does NOT change

- The rating engine, spaced-rep engine, `sessions` log, and all derived state.
  `coachNote.focus` and evidence are still generated and stored — this is a
  display subset, not a data change.
- `api/coach-read.js` — zero prompt/model/text changes ⇒ **no live eval owed**.
- CoachNotebook (Past Reads) — unchanged, still the archive with dates.
- Schema panel, skill ledger, top stat row, streak line.

## Edge states

- **No coachNote, notebook ≥ 1:** unchanged behavior — notebook renders alone.
- **No coachNote, no reads:** panel absent (existing `return null`).
- **Legacy prose read stored:** prose fallback renders under the label
  (existing `parsed.legacy` path), no watch-for available — acceptable,
  self-heals at the player's next read.
- **Queue = 0 or guest:** no chip; button identical to today.

## Test plan

- `LastSessionRead.test.js`: pins for — evidence/date/focus absent, headline +
  watch-for present for structured reads, prose fallback intact, notebook
  unchanged.
- `Dashboard` tests: RecentForm gone; queue chip present iff signed-in and
  depth > 0 (both directions pinned).
- Deleting `RecentForm.jsx` removes its co-located test with it (rule 22
  satisfied by deletion).
- Full gates + e2e before merge (dashboard = gate 6 territory).

## Out of scope (recorded, not planned)

- Cadence countdown / "next read in N sessions" (rejected this round).
- Evidence-row links to replayable hands (depends on unscored replay mode).
- Any prompt-side change to stop generating evidence (evidence still feeds
  the notebook and the eval).
