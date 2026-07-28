# Coach's Read — scope, cadence, and the recent-form strip

> **Status:** design approved by the founder 2026-07-28. Not yet implemented.
> **Supersedes:** the per-session Coach's Read as the product's primary AI surface.
> **Related:** ROADMAP "Triage — Tester Feedback" items 2 and 4; the periodic
> meta-read in the feature backlog; item 7 (direction-tally decay).

---

## The problem

The Coach's Read fires once per completed session — one Claude call per five
hands. Three defects follow from that cadence.

**It reads as a gate.** The read does not actually block: `setShowSummary(true)`
runs before `handleFetchCoachRead()`, and "Deal Next Session →" is rendered and
enabled throughout. But the read sits *above* the chain button with a "Reading
your session…" spinner in it, so the player looks at a spinner sitting between
them and the next hand. People wait out of politeness to a spinner.

**Its evidence is too thin for what it says.** Five hands cannot support a
pattern claim. The July 22 reframe handled this honestly by forbidding identity
language in the prompt, but the honest fix for weak evidence is more evidence,
not more careful phrasing.

**Its hard limit hits exactly the wrong users.** `DAILY_LIMIT = 5` means a
player chaining a sixth session in one day is told they are out of reads. The
most engaged players are the only ones who ever see it.

Founder judgement (2026-07-28): the per-session read is "more annoying" than
useful, and the `evidence` bullets in particular are of questionable value.

---

## The decision

Move the AI voice off the session summary and onto the dashboard, over a
trailing window large enough to justify what it says. Replace the per-session
moment with a deterministic strip that costs nothing and updates every session.

**Numbers report movement. Prose interprets evidence.**

| Surface | Owns | Cadence | Source |
|---|---|---|---|
| Per-hand feedback | why *this* decision was wrong | every hand | static, unchanged |
| Session summary | results, IQ delta, streak, skill ledger | every session | deterministic — **no AI, nothing to wait for** |
| Recent-form strip | what moved lately | **every session** | deterministic, free |
| Meta-read | what the pattern means | **every 5 sessions, over trailing 10** | one Claude call |
| Schema card | lifetime identity | lifetime | deterministic, unchanged |
| Notebook | archive of past meta-reads | — | derived |

### Why this does not violate F1

`RESEARCH_LEARNING_SCIENCE.md` F1 says immediate elaborated per-hand feedback
plus a delayed pattern-level summary is the evidence-optimal structure and
should not be restructured. This preserves that structure. It does not remove
the pattern-level layer; it makes it *more* delayed and *more* pattern-level.
What would violate F1 is deleting pattern-level feedback altogether. That is not
what this does.

F5 additionally states the read must "never restate per-hand results the player
already saw" — which is precisely what the current `evidence` bullets do at a
five-hand window. See "Fields" below.

### Why two different windows

The strip's value is its *comparison* ("19 of 30, up from 16"); a bare count
means nothing to a player. A comparison needs two windows of history, so a
10-session strip would show no direction until session 20, while a 6-session
strip starts working at session 12.

The read's value is the strength of its claim. Ten sessions is ~50 hands, so a
skill averages ~6 attempts and usually clears `MIN_RATED_ATTEMPTS`; at six
sessions it averages under four and usually does not.

**The windows differ on purpose. Do not unify them.**

---

## The recent-form strip

### Sample-size discipline

Six sessions is 30 hands across 8 skills — under 4 attempts per skill, against a
product-wide `MIN_RATED_ATTEMPTS` of 5 that the skill ledger already enforces.
A strip claiming "your bluffing is slipping" off that window would break the
evidence bar the rest of the product holds.

Three lines, the middle one conditional:

1. **Always** — trailing-6 accuracy with direction against the previous 6.
   Thirty hands against thirty is a fair comparison needing no caveat.
   *"Last 6 sessions · 19 of 30 · up from 16"*
2. **Only when earned** — a named skill, and only if that skill cleared
   **≥5 attempts inside the window**. Reuse `MIN_RATED_ATTEMPTS` rather than
   introducing a second bar, so the strip and the ledger can never disagree.
   When nothing clears it this line is **absent**, not hedged.
   **Which skill:** of those clearing the bar, the one whose in-window accuracy
   differs most from its lifetime accuracy — the thing that actually *moved* —
   tie-broken by attempt count, then alphabetically so the result is
   deterministic and testable. Report movement in either direction; a skill that
   jumped is as true as one that slipped, and only reporting slips would make
   the strip read as nagging rather than informational (M4).
3. **Always** — remediation queue depth, the count of scenarios currently
   awaiting a spaced re-test (the `remediating` entries in the history rebuilt
   by `spacedrep.js`). *"4 hands waiting to resurface."* Mechanical, honest, and
   the most natural nudge to play again.

Below 6 sessions the strip labels itself by the real count ("Last 3 sessions")
and never pads the window.

M4 (informational rewards support intrinsic motivation, controlling ones
undermine it) is why line 3 is a count of real work outstanding and not a points
balance.

### Data

Everything needed is in `sessions.hands[]`, which already carries `skill`,
`result`, `choiceVal` and `decisionMs` per hand. What is missing is session
*boundaries*: `recentHands` is a flat 200-entry list with no session structure.

Derive a compact `recentSessions` array — the last 12 sessions as
`{ date, correct, total, hands }` — in the same places `coachReads` is already
derived: `assembleUser` (`db.js`) for Supabase and `applySessionResults`
(`session.js`) for localStorage. Twelve because trailing-6 plus previous-6 is
what line 1 needs. No schema change; the derived-state law is preserved.

### Components

- `src/utils/recentForm.js` — pure derivation and the ≥5-attempt gate, unit
  tested against fixtures. The gate is a **rule**, not a rendering detail, so it
  must be testable without a component.
- `src/components/dashboard/RecentForm.jsx` — presentational, ≤160 lines, with
  its co-located `RecentForm.test.js` (invariants 21 and 22).
- `Dashboard.jsx` gains an import and a render. It is at 219/250 lines; this
  costs roughly 6.

---

## The meta-read

### Trigger

**Fire when the database holds ≥6 sessions AND ≥5 sessions have been recorded
since the last row that actually stored a read.**

When no read has ever been stored, the second condition is satisfied by
definition — the first read fires on the ≥6 check alone. State this explicitly
in the implementation; "sessions since the last read" is otherwise undefined for
a new player and is the obvious place for an off-by-one or a null to hide.

Derived from the append-only log, exactly like every other piece of state. This
self-heals: if a call fails, that row stores no read and the next session
retries, rather than the player waiting another five. It also cannot desync
across devices, because there is no counter to keep in sync.

**Do not implement this as a modulus on `sessionsCompleted`.** A modulus (fire
at 6, 11, 16…) silently skips five sessions after any failure.

### Append-only constraint — read this before implementing

`submitSession` awaits `fetchCoachRead` and passes the result into
`recordSession` at **INSERT** time. The read and the session are written in one
row, once. Appending a read later would require an UPDATE, which breaks the
append-only law that the whole derived-state architecture rests on.

Therefore: **the read is fetched before the session row exists, so the server's
window is the sessions already in the database.** The read written on session N
describes the ten sessions *before* N. This is honest — it is your read as of
the moment it was written — and needs no update. It also means trigger
arithmetic counts rows in the database, not `sessionsCompleted` (which includes
the session being submitted).

First read therefore lands when the database already holds 6 sessions.

### Fire at session end, not on dashboard mount

The call goes out fire-and-forget on session completion when the trigger is
satisfied, like the existing remote writes. By the time the player reaches the
dashboard it is usually already there. Triggering on dashboard mount would avoid
the occasional unseen read but puts a spinner back on a screen the player is
looking at, which defeats the purpose of the change. At one call per five
sessions, paying for an unread read occasionally is noise.

Four sessions in five now skip the API await entirely before persisting, so
session writes get faster for most sessions.

### The server builds its own window

The handler already verifies a Bearer token via `admin.auth.getUser(token)` and
holds a service-role Supabase client for the `coach_usage` cap. It can therefore
query the last 10 sessions for that `uid` itself.

**`decisionsPlayed` leaves the request body.** The client can no longer inflate
the window or fabricate hands. This closes the forgery surface without waiting
on the CA-001 trust-boundary project, because the plumbing already exists. One
extra query per call, against 80% fewer calls — total database load falls.

### Payload: aggregates, not hands

Do **not** raise `MAX_DECISIONS` to 50 and pass raw hands. That is 10× the
prompt tokens and the wrong input for a pattern-level claim. The server
aggregates first and sends approximately:

- per-skill attempts and correct counts over the window; skills with no attempts
  omitted
- the direction tally (too passive / too aggressive / too loose), already
  computed by `schema.js`
- confident misses — fast **and** wrong — with villain and scenario context
  (F2's "diagnosis moat"; far stronger across 50 hands than 5)
- scenarios missed more than once in the window (genuine repeat offenders)
- window accuracy against the previous window

~15 lines rather than 50. Cheaper than today's per-session payload, and it hands
the model exactly the evidence F5 says the read exists to interpret.

### Fields

`headline`, 1–2 pattern lines, `watchFor`.

The founder's instinct that the bullets are weak was correct, but the cause was
the **window**, not the field. "Fired a bluff into the station on Q94r" restates
a hand the player read ninety seconds ago. "Bluffing: 3 of 11 across ten
sessions, twice into a station" is an aggregate they have never seen and cannot
compute themselves. Same field, opposite value. Cap it at two.

### Honest labeling — temporal, not identity

Fifty hands still does not support "you are a Conflict Avoider." That is the
schema card's job, and it has severity bars and `simulate:schemas` behind it.

**The schema card says who you are. The meta-read says what you have been doing
lately.** The read speaks temporally — "over the last ten sessions", "lately" —
and never in identity. This division is deliberate and should not be
re-litigated per-surface.

### Storage

Reuse `sessions.coach_read`. `coachReadsFromSessions` in `db.js` already skips
null rows when rebuilding, so writing on every fifth session produces a sparse
list automatically. No new table, no migration, **gate 5 does not apply**, and
the Notebook keeps working unchanged.

Legacy per-session reads already in the database stay and render alongside new
meta-reads, unlabelled. Founder call: there are not enough users for the mixed
list to matter, and they age out of the trailing cap on their own. A migration
or a permanent label for a transitional artifact would both cost more than the
problem.

`COACH_READS_CAP` drops **30 → 12**. At one read per five sessions, 30 would
mean 150 sessions of history; 12 covers roughly 60. This closes ROADMAP triage
item 2 as a side effect. Note `db.test.js:188` builds a 40-row fixture — lowering
the cap is safe, raising it above 40 would silently stop testing truncation.

---

## Degradation and failure

- **Guests** — neither surface, as today.
- **localStorage-only mode** — no authenticated user, so no meta-read at all.
  The strip still works, because it derives locally. The free deterministic
  layer survives everywhere; the AI layer requires an account.
- **Call fails (network, 429, 500)** — invisible. The read is off the critical
  path, the previous read stays on screen, and the trigger retries next session.
- **Staleness** — show the read's date ("as of Jul 28"). If reads are failing,
  the player can see the read is old rather than believing it is current.
- **Two devices** — both may fire; `coach_usage` counts both. Harmless.

`DAILY_LIMIT = 5` stays untouched. At one read per five sessions it now permits
25 sessions of play per day, so no real player meets it, but it remains the
abuse ceiling and is the natural hook for post-beta paid limits.

---

## Ratchets (gate 7)

The failure mode this design is most exposed to is **silent reversion** —
someone reintroduces a blocking call on the summary and no test fails.

- **e2e negative control:** the session summary must contain no coach block and
  no `.thinking` spinner, and the chain button must be interactive on arrival.
  `e2e/smoke.spec.mjs:40` currently asserts the opposite (`structured coach read
  renders`) and must be **inverted**, not deleted.
- **Both directions on the ≥5-attempt gate:** a skill named when it clears, and
  *nothing rendered* when it does not.
- **Trigger self-healing:** fires at 6, not at 5; after a failed read fires at
  the **next** session, not five later.
- **Frozen clock** anywhere dates are asserted (invariants rule 23).
- **`aggregate()` unit tested on fixtures** — this is also the seam that keeps
  `scripts/eval-coach.mjs` exercising the real prompt.

### The eval:coach law fires

This is a prompt rewrite, so `CLAUDE_API_KEY=... npm run eval:coach` must be run
**live** and judged against the F5 bar before deploy.

`scripts/eval-coach.mjs` currently builds payloads itself. The code needs a seam
— `aggregate(sessions)` and `buildPrompt(summary)` as separate functions — so
the harness can call them on fixtures. This preserves the existing law that the
harness exercises the real prompt rather than a drifting copy.

---

## Build it in two phases

This is more than one plan's worth of work, and it splits cleanly along the line
where risk changes character. **Phase A carries no AI risk and delivers the
founder's actual complaint. Phase B carries all of it.**

### Phase A — remove the friction (no API change at all)

- Delete the coach block from `SessionSummary.jsx`; invert the
  `smoke.spec.mjs:40` assertion into the negative control.
- Build `utils/recentForm.js` and `dashboard/RecentForm.jsx`; derive
  `recentSessions`; render the strip.
- **Reads keep being written exactly as they are today**, once per session, and
  keep landing on the dashboard through the existing `LastSessionRead`. Nothing
  about the prompt, the window, the payload, or the cadence changes.

Result: the spinner between the player and the next hand is gone, the summary is
instant, and the dashboard gains a surface that updates every session. The
`DAILY_LIMIT` wall stops being *visible* (a 429 simply leaves the previous read
in place) though it still exists. No prompt change, so **the eval:coach law does
not fire** and this ships on ordinary gates.

### Phase B — re-scope the read

- Server-side window query and `aggregate()`; `decisionsPlayed` leaves the body.
- Trigger, new prompt, field changes, `COACH_READS_CAP` 30 → 12,
  `LastSessionRead` re-scoped and relabelled, `eval-coach.mjs` seam.
- **The eval:coach law fires**, live, before deploy.

Phase A is independently shippable and independently valuable. If Phase B slips,
the product is still strictly better than it is today.

---

## Files this touches

| File | Change |
|---|---|
| `api/coach-read.js` | server-side window query; `aggregate()`; new prompt; `decisionsPlayed` removed from body |
| `src/utils/claude.js` | stops building the payload; just posts |
| `src/utils/session.js` | read fetch becomes conditional on the trigger |
| `src/utils/db.js` | derive `recentSessions`; window query support |
| `src/utils/coachRead.js` | `COACH_READS_CAP` 30 → 12 |
| `src/utils/recentForm.js` | **new** — derivation + ≥5-attempt gate |
| `src/hooks/useSessionRun.js` | no read on the summary path |
| `src/components/SessionSummary.jsx` | coach block removed |
| `src/components/dashboard/LastSessionRead.jsx` | re-scoped to the meta-read; label and focus-chip copy |
| `src/components/dashboard/RecentForm.jsx` | **new** |
| `src/components/Dashboard.jsx` | render the strip (~6 of 31 remaining lines) |
| `scripts/eval-coach.mjs` | build fixtures through the new seam |
| `e2e/smoke.spec.mjs` | invert the coach-read assertion |

---

## Out of scope

- **Manual refresh button.** Founder is open to it, backlogged with these
  constraints: once per day, show a session countdown to the next auto-refresh,
  a manual refresh restarts the countdown, and it needs security controls
  against exploitation. Note the server-side window above already removes the
  main forgery surface such a button would expose.
- **Paid limits / tokens vs subscription.** Non-issue until out of beta.
  Dependencies: establish a user base, legal and banking setup, then code.
  `DAILY_LIMIT` is the existing hook.
- **Session length / "25 scenarios a day, stop when you like."** A separate
  decision. `LADDER_SESSIONS = [2, 5, 13]` counts *sessions* and was chosen to
  approximate "the 1/3/8-day rhythm for a daily player" (R1). Today a player
  doing five short sessions in an evening compresses that ladder; if a session
  became one sitting, `sessions` would track days, which is what the ladder was
  always a proxy for. So the idea may fix a real flaw — but it also touches the
  schema unlock, the streak, and both simulation harnesses. Worth research
  (optimal session boundaries and stopping rules for self-paced practice) and
  worth doing on its own.
- **Item 7 (direction-tally decay).** Interacts — a cross-session read is worth
  less if the diagnosis beneath it cannot move as a player improves — but it is
  gated on giving `simulate-schemas.mjs` a time axis first.
