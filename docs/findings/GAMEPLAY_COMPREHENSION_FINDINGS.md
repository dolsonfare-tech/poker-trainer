# Gameplay Comprehension Audit — Findings (July 19, 2026)

**Question (founder):** is the decision screen as good as it could be at conveying the scenario, its context, the question at hand, and the options — fast?

**Method:** code-level inventory of what actually renders at decision time vs. what the scenario data contains and the grading assumes; pattern-scan of all 172 scenario bodies for decision-relevant information; instrumentation review. No layout redesign proposed — the canvas has four founder-approved iterations behind it, and the audit's job is to find where *information*, not aesthetics, fails the player.

**What renders at decision time:** skill tag · street rail · felt (pot + board) · villain bubble (archetype name + seat + acts-before/after — behavior notes are behind the ⓘ tap) · hero cards + hand name · "The Hand So Far" ticker (this hand's actions only) · replay chip when applicable · option buttons with prices · timer.

---

## C1 · HIGH — ~1 in 8 scenarios grades on information the player cannot see

> **FIXED July 19, 2026 (Fable, same day):** the ticker's "Hand So Far" box now renders `tableContext` as a gold-labeled **READ** line (label was FILE until July 20 — "FILE His file:" read redundantly; the authored prefixes are stripped too) (SituationTicker + `st-tablefile` CSS; test-pinned both ways). Content pass: 10 new table files authored — the 8 planned (id 6, sc_120/123/125/139/145/152/167) **plus sc_154 and sc_160, which the new audit rule caught on its first run** ("his file" reads the manual scan's regex missed). 4 flagged bodies judged clean (sc_135/149/153/163 — this-hand narrative, already in the ticker). The `context` WARN rule in audit-scenarios.mjs is the standing drift-guard: session-history phrases in a body with no tableContext get flagged at authoring time. Verified in the real UI: sc_167 now shows "READ · Folded top pair to a check-raise twice tonight" at decision time — the check-raise is finally justifiable from the screen.**

Two overlapping classes, ~20 scenarios total (~12% of the pool):

1. **`tableContext` never renders.** 8 scenarios carry a session-level read in `tableContext` ("Your table image is shot: two bluffs picked off this session, both shown" — sc_121; multi-way limper context — sc_035/065/079/097/100; "zero reads" — sc_155). Its only consumer is the coach-read payload (`claude.js`). No gameplay component references it.
2. **Session-history reads live only in `body` — which renders only in post-session review.** 14 scenario bodies contain reads of the form "he's folded top pair to check-raises **twice tonight**" (sc_167), "the station called both barrels **twice**" (sc_120/121/123/135/139/149/153/163…), "the nit has shown…" (sc_145, sc_152). `scenario.body` is displayed **only** in SessionSummary review cards.

The worst cases invert the visible answer: in sc_167 the on-screen math (2:1 on a 4:1 draw) makes fold textbook-correct, and the graded-correct check-raise is justified *entirely* by the invisible "he's folded top pair to check-raises twice tonight." A player who reasons perfectly from what's on screen gets it wrong, then reads the review card and learns the game withheld the premise. That's the exact failure mode the honest-labeling culture exists to prevent.

**Recommended fix (two parts, founder call):**
- **UI (small):** render `tableContext` when present as a labeled line in the "The Hand So Far" box — e.g. a second row labeled `TABLE FILE` (or `YOUR READ`) in the same mono register. One conditional in ScenarioCard + CSS; ticker derivation untouched.
- **Content (the real work):** migrate the read sentence from the 14 bodies into `tableContext` (dedup with the 8 existing), so the read is on screen at decision time and the body remains the fuller narrative for review. Auditable: add an audit **WARN** rule flagging read-pattern phrases (`tonight / all session / twice / has shown / he's folded…`) in a body whose scenario has no `tableContext` — that's the drift-guard for future authoring.

## C2 · MEDIUM, deliberate — villain behavior is a tap away

The bubble names the archetype; what a Calling Station *does* requires either internalized knowledge or the ⓘ tap to the guide. This is arguably the product working as designed — recalling reads IS the training — but it's the top candidate if beginner comprehension data comes back poor. **Recommendation: keep, and let C4's heatmap decide.** If station/maniac-tagged scenarios show elevated decision times specifically for low-session players, revisit a one-line tendency in the bubble.

## C3 · LOW, deliberate — no pot-odds ratio on screen

Pot and price are displayed; the ratio is left to the player. That's the pot-odds skill being trained, not a comprehension gap. No change.

## C4 · Instrumentation — the heatmap that makes this audit continuous ✅ SHIPPED WITH THIS AUDIT

`decision_made` now carries `decision_ms` (it already carried `scenario_id`/`result`/`timed_out`/`replay`). Post-launch PostHog query: **p50 decision time and timeout rate per scenario** = a ranked list of exactly where players can't parse the situation, replacing taste debates with data. The founders' own play seeds this immediately.

## C5 · Observation — the "question at hand" is implicit

The decision is inferred from ticker + options; the retired `question` field was judged redundant (founders, July 2026). No change recommended now — if C1's fix lands and the heatmap still shows broad slow-downs on first-exposure scenarios, a one-line framing above the options is the next candidate experiment.

---

**Priority:** C1 is the only real defect and it's content-shaped: the UI half is an hour, the content half is a ~20-scenario editing pass with an audit rule to keep it fixed. C4 shipped with this audit. C2/C3/C5 are deliberate designs now equipped with the instrument to overturn them if real players disagree.
