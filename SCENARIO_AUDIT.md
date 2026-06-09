# Scenario Audit Log

> Living document. Log every scenario issue here — what went wrong, what the fix was, and what rule it teaches. The goal is to build an agent that can audit all 83 scenarios automatically against these rules.

---

## Agent Rules

Rules derived from real issues found in production review. Each rule has: a detection heuristic, the correct fix pattern, and the issue that taught it.

---

### R1 — `toCall` must match the call button label amount

**Problem:** `toCall` is used by the action trail to show "Villain bets $X". If it's wrong, users see a bet amount that doesn't match the button they're pressing.

**Detection:**
1. Find the option with `cls: 'call'` and a label matching `/^Call\s*\$(\d+)/`
2. Extract the dollar amount from the call button label
3. Extract the dollar amount from `toCall`
4. If both exist and don't match, flag it

**Correct pattern:**
- If villain raised to $80 and hero already put in $25: `toCall: "$55"` (or `"$55 more"`) and call button `"Call $55"`
- `toCall` = the additional chips hero must put in, matching exactly what the call button says

**Note:** `"$X more"` and `"$X"` are both valid formats. Strip `"more"` before comparing amounts.

**Taught by:** sc_033 — `toCall: "$35"` but villain raised to $80 (SB bet $25 → call is $55 more). Call button correctly said `"Call $55"`. Fixed: changed `toCall` to `"$55"`.

---

### R2 — `positions.action` only stores one action per seat — it cannot represent multi-street history

**Problem:** For postflop scenarios, the `positions.action` field often contains the villain's *preflop* raise (e.g., `"Raises $6"`), not their current-street action. The action trail logic tries to detect whether a stored action is the current threat or stale preflop context, using amount-comparison between `villain.action` and `toCall`. When amounts differ, it falls back to `toCall`.

**Detection:**
- Scenario has `board` (postflop) AND villain `action` matches a threat pattern (Bets/Raises/etc.)
- Extract dollar amount from `villain.action` and from `toCall`
- If amounts differ → villain's stored action is stale preflop context
- If `toCall` is null → hero acts first this street, trail should be hidden (no prior threat)

**Affected scenarios (fixed in logic, not data):** sc_053, sc_054, sc_057, sc_060, sc_068, sc_069, sc_076, sc_077, sc_083

**Correct pattern for scenario authors:**
- For postflop scenarios where the villain bet the *current street*: set `villain.action` to the current street bet (e.g., `"Bets $22"`) and `toCall` to match
- For postflop scenarios where hero acts first: set `villain.action` to `"Active"` and `toCall` to `null`
- Reserve preflop action strings (e.g., `"Raises $6"`) only for preflop scenarios

**Long-term fix:** Split `positions.action` into `preflopAction` and `streetAction` fields so multi-street context is unambiguous. Defer to Phase 2 schema.

---

### R3 — Button CSS class (`cls`) ≠ button action semantics in postflop scenarios

**Problem:** `cls` values (`fold`, `call`, `raise`) control button color and were also used to attach generic sublabels ("Give up the hand", "Match the bet", "Apply pressure"). In postflop scenarios, the `fold` cls is often used for check/passive options — not actual folds — so the generic sublabels were actively misleading.

**Example:** A scenario where options are check/bet/bet uses `cls: fold/call/raise` for styling, but the `fold` button says "Bet $14". The sublabel "Give up the hand" appeared under a bet.

**Fix applied:** Removed generic sublabel fallback entirely. Button sublabels now only appear when explicitly written as a parenthetical in the button label (e.g., `"Bet $20 (pot)"` → sublabel shows "pot"). This is always scenario-specific and accurate.

**Rule for scenario authors:** Parentheticals in button labels are surfaced as sublabels. Use them for sizing context: `"Bet $20 (pot)"`, `"Call $4 more"`, `"Raise to $60 (2.5×)"`.

**Taught by:** Scenario with `cls: 'fold'` on "Bet $14" button showed "GIVE UP THE HAND" as the sublabel.

---

### R5 — `VillainHistory` strip must not show stale preflop context on postflop scenarios

**Problem:** The "Villain This Hand" strip on the table reads from `positions.action`. On postflop scenarios, this often contains a preflop call ("Called $4") or preflop raise ("Raises $6") — neither of which is current-street information. Users see irrelevant data and can't make sense of it.

**Detection:** Scenario has `board` (postflop) AND villain action is NOT (a) an explicit check OR (b) a bet/raise whose amount matches `toCall`.

**Fix:** For postflop scenarios, only render VillainHistory when:
1. `villain.action` matches `CHECK_RE` (villain explicitly checked this street), OR
2. `villain.action` matches `THREAT_RE` AND `extractAmt(villain.action) === extractAmt(toCall)` (current-street bet confirmed by matching amounts)

**Taught by:** Screenshot of river scenario where "Villain This Hand: Called $4" appeared. The preflop call was stored in positions.action and surfaced as if it were current information.

---

### R6 — Action trail must infer villain check from positional acting order

**Problem:** When villain checked this street, `positions.action` often contains stale preflop data rather than "Checks". The trail has no explicit signal to show "BB checks." Without this, postflop check-to-hero scenarios show no action context at all.

**Detection:** Postflop scenario where `toCall` is null, no call button with dollar amount exists, AND villain's seat acts before hero's seat in postflop order.

**Postflop acting order** (by seat index in positions array):
- SB (idx 4) → order 0 (acts first)
- BB (idx 5) → order 1
- UTG (idx 0) → order 2
- HJ (idx 1) → order 3
- CO (idx 2) → order 4
- BTN (idx 3) → order 5 (acts last)

`POSTFLOP_ORDER = [2, 3, 4, 5, 0, 1]`

**Fix:** If `POSTFLOP_ORDER[villainIdx] < POSTFLOP_ORDER[heroIdx]` AND no current bet → infer `{ pos, action: 'checks' }`.

**Validation result (83 scenarios):**
- 8 explicit raises (preflop)
- 29 postflop bets derived correctly
- 26 check inferences (villain checks to IP hero) — all verified correct
- 20 hero-acts-first (no trail shown) — all verified correct

**Taught by:** River scenario with CO hero, BB villain (Tight Recreational) showing no action context. BB acts before CO postflop → BB checked to CO → "BB checks" should appear.

---

### R4 — `action trail` hides when hero has no call to make (hero acts first)

**Problem:** Some postflop scenarios have `toCall: null` and the villain's stored action is a preflop raise. The action trail must not show stale preflop context. The correct behavior is to show nothing (trail hidden) so the UI doesn't mislead.

**Detection:** `board` exists (postflop) AND villain `action` matches threat pattern AND `toCall` is null AND no call button label starts with "Call $X"

**Correct behavior:** Trail renders nothing. Hero acts first — there's no "action to you" to show.

**Exception:** If the call button label starts with `"Call $X"` (a genuine call exists despite `toCall` being null), derive the villain's bet from the button amount. Taught by sc_077: `toCall: null` but call button was `"Call $9"` (villain c-bet $9, missing from toCall field).

---

## Issue Log

| ID | Status | Rule | Description | Fix |
|----|--------|------|-------------|-----|
| sc_033 | ✅ Fixed | R1 | `toCall: "$35"` but BTN raised to $80 over SB's $25 c-bet. Call costs $55. | Changed `toCall` to `"$55"` |
| sc_053 | ✅ Fixed (logic) | R2 | Postflop flop scenario. Villain stored as `"Raises $6"` (preflop). `toCall: "$10"` is the actual c-bet. | Logic derives `"BTN bets $10"` from toCall |
| sc_054 | ✅ Fixed (logic) | R2 | River scenario. Villain stored as `"Raises $6"` (preflop). `toCall: "$40"` is river bet. | Logic derives from toCall |
| sc_060 | ✅ Fixed (logic) | R2 | Flop scenario. Villain stored as `"Raised $6"` (preflop). `toCall: "$10"`. | Logic derives from toCall |
| sc_069 | ✅ Fixed (logic) | R2 | Flop scenario. Villain stored as `"Raises $6"` (preflop). `toCall: "$9"`. | Logic derives from toCall |
| sc_076 | ✅ Fixed (logic) | R2 | Flop scenario. Villain stored as `"Raises $6"` (preflop). `toCall: "$10"`. | Logic derives from toCall |
| sc_083 | ✅ Fixed (logic) | R2 | River scenario. Villain stored as `"Raises $6"` (preflop). `toCall: "$55"`. | Logic derives from toCall |
| sc_040 | ✅ Fixed (logic) | R2, R4 | Flop scenario. Villain `"Raised $6"` (preflop). `toCall: null`. Hero acts first. | Trail hidden (correct) |
| sc_057 | ✅ Fixed (logic) | R2, R4 | Turn scenario. Villain `"Raises $6"` (preflop). `toCall: null`. Hero leads. | Trail hidden |
| sc_068 | ✅ Fixed (logic) | R2, R4 | River scenario. Villain `"Raises $6"` (preflop). `toCall: null`. Hero bluffs. | Trail hidden |
| sc_077 | ✅ Fixed (logic) | R2, R4 | Flop scenario. Villain `"Raises $6"` (preflop). `toCall: null`. But call button = `"Call $9"`. | Logic derives `"BTN bets $9"` from call button label |
| generic sublabels | ✅ Removed | R3 | `ACTION_SUBLABELS` map attached "Give up the hand" to any `cls: fold` button, regardless of what the button did. | Removed fallback. Only parenthetical sublabels remain. |
| VillainHistory stale | ✅ Fixed | R5 | "Villain This Hand: Called $4" on river scenarios — preflop call surfacing as current info. | VillainHistory now filters to only current-street actions on postflop scenarios. |
| Missing check trail | ✅ Fixed | R6 | 26 scenarios where villain checked to IP hero showed no action context. | Trail infers "checks" from positional acting order when toCall=null and villain acts before hero. |

---

## Passed Checks

| Check | Result |
|-------|--------|
| Card collision (hole cards vs board) | ✅ Clean — all 83 scenarios |

---

## Open Questions

- **R2 data fix:** The 8 R2 scenarios above are "fixed in logic" — the UI derives correctly from `toCall`. But the root cause is stale preflop data in `positions.action`. These should eventually be corrected in `scenarios.js` to store current-street actions. Blocked on: confirming the exact street action for each affected scenario against the body text.

- **`toCall: null` for scenarios with genuine calls:** sc_077 taught us some scenarios have a real call to make but `toCall` is null. An agent should scan for any scenario where `toCall` is null but a call button label contains a dollar amount — those are candidates for missing `toCall` data.

- **Pot display accuracy:** `pot` in several postflop scenarios appears to be the preflop pot, not the pot at the moment of decision. This could make the displayed pot on the oval table misleading. Not yet audited.

---

## Audit Checklist (run against each scenario)

```
[ ] toCall amount matches call button label amount (R1)
[ ] If postflop: villain.action is NOT a preflop raise amount (R2)
[ ] If postflop + toCall null: hero genuinely acts first (no hidden call) (R4)
[ ] Button labels with '(...)' parentheticals are accurate sizing context (R3)
[ ] pot value reflects the pot at decision time, not preflop (open question)
[ ] body text is consistent with positions, board, pot, and toCall
[ ] correct answer is unambiguous given the scenario context shown to the user
```

---

## How to Add an Issue

```markdown
| sc_XXX | 🔴 Open | R? | One-line description of what's wrong | Proposed fix |
```

Then add a rule entry under `## Agent Rules` if the issue reveals a new pattern not already covered.
