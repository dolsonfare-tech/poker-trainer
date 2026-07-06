# Table Reads Mode — Design + Authored Content

*Drafted July 6, 2026 (Fable session). Status: backlog feature, founders endorse concept, timing TBD (Phase 1.6 or Pro tier). This doc captures the design AND the judgment-heavy content — 10 fully authored observation hands — so building the mode later is mostly engineering, not authoring.*

---

## Concept

The inverse of the core trainer. Regular scenarios **give** you the read ("he's a maniac") and grade your decision. Table Reads shows you a hand's action **replay** and asks you to **form** the read: *which of the villain archetypes is this player?* Feedback explains the tells. Trains the Reads/Opponent skills from the other direction — the direction real poker demands, since nobody at a live table hands you an archetype label.

## Why it fits the moat

Opponent modeling is one of the four moat pillars. Every competitor teaches "vs a nit, do X"; none teach *recognizing* the nit. The authoring unit is also cheaper than a decision scenario (no gradings to balance, no pot-odds math to verify — one right answer, one tell explanation).

## Infrastructure reuse

- **Replay rendering**: observation hands use the exact `actionHistory` row shape (`{ street, segments: [{ text, you? }] }`) — `SituationTicker` renders them as-is. A "replay" is just a ticker with more rows and no `you` flags (the player is an observer, not the hero). Optionally animate rows appearing street by street (a `setInterval` reveal — no new infra).
- **Archetypes**: answers key into the existing `VILLAIN_LABELS` in scenarios.js (exclude `unknown`). The VillainGuide modal is the study reference — it already documents every archetype.
- **Answer chips**: the four-option chip row from `FeedbackPanel`'s disagree box / ScenarioCard's action buttons is the interaction pattern. Nothing new.

## Proposed data model

```js
// src/data/observations.js — new file, same helper discipline as scenarios.js
mkObservation({
  id: 'ob_001',
  difficulty: 'beginner' | 'intermediate',
  answer: 'nit',                       // key into VILLAIN_LABELS (never 'unknown')
  distractors: ['tight', 'passive', 'calling-station'],  // exactly 3 → 4 chips, shuffled at render
  context: 'Seat 3 has folded 47 of the last 50 hands.',  // the table-history line shown above the replay
  replay: [ /* actionHistory-shaped rows; villain is "Seat 3", other players by position */ ],
  showdown: 'He turns over A♠A♥.' | null,   // null = line-reading only (harder)
  tell: '…',                           // correct-answer explanation (the lesson)
  whyNot: { tight: '…', passive: '…', 'calling-station': '…' },  // per-distractor feedback — shown when the player picks wrong
})
```

Design choices worth locking early:
- **4 chips, not 7.** Authored distractors make each hand a *lesson about a confusion* (nit-vs-tight, maniac-vs-aggressive). A 7-way lineup is a memory test; a 4-way with crafted near-misses is teaching. 25% guess floor also keeps scoring honest.
- **`whyNot` per distractor** is the secret weapon: picking "tight" when the answer is "nit" gets feedback about *that specific confusion*, not a generic wrong-buzzer. This is where the mode out-teaches a quiz.
- **Showdown is the difficulty dial.** With a showdown, the hand is confirmable (beginner). Without one, the player reads the line alone (intermediate+). Same replay, remove one row, harder hand.

## Scoring (recommendation, founders to confirm)

Correct identification credits the **Opponent** skill (forming the model); the **Reads** skill stays owned by the main trainer (using betting patterns in-decision). One credit/attempt through the existing `applyHandToSkill`, result `correct`/`incorrect` (no partial — you named the player or you didn't). Alternative if founders want the mode self-contained pre-Pro: mode-local score only, no skill writes — cleaner for a paid-tier gate later.

## Session shape

5 observations per session (matches SESSION_LENGTH muscle memory). Beginner deck = showdown hands; intermediate = no-showdown + confusable pairs. No timer at beginner (consistent with main trainer).

---

# The 10 authored observation hands

Conventions: $1/$2 six-max cash, $6 standard open — same world as the scenario pool. The villain is always **Seat 3** in the replay text (the UI can highlight him at the table). Each hand teaches one identification tell, and each distractor set is chosen to be *plausibly confusable*, with the disambiguation in `whyNot`.

---

### ob_001 · Answer: **Tight Nit** · beginner (showdown)
**Confusion taught:** nit vs tight rec vs passive
**Context:** "Seat 3 has folded 47 of the last 50 hands. This is his first raise in over an hour."
**Replay:**
- PRE — Seat 3 (UTG) raises to $6 · BTN 3-bets to $20 · blinds fold · Seat 3 folds instantly
**Showdown:** He flashes A♠Q♠ face-up as he mucks — "can't call a 3-bet with that."
**Tell:** An hour of folding, then an open — and AQ suited, a top-5% hand, hits the muck the moment anyone plays back. Only one player type has a *continuing* range that tight: the nit's world is AA-KK and nothing else survives pressure. The open frequency told you half; the instant fold told you the rest.
**whyNot — tight:** A tight rec opens AQs too, but he *continues* with it against a 3-bet at least sometimes. Folding it face-up, proudly, is a stricter religion than "tight."
**whyNot — passive:** Passive describes how he bets, not what he enters with. A passive player limps and calls too much; this player barely enters at all.
**whyNot — calling-station:** Stations don't fold — not preflop, not ever with a hand this pretty. Everything about this hand is folding.

---

### ob_002 · Answer: **Calling Station** · beginner (showdown)
**Confusion taught:** station vs passive vs loose
**Context:** "Seat 3 bought in an hour ago and hasn't raised once. He has, however, seen a lot of rivers."
**Replay:**
- PRE — CO raises to $6 · Seat 3 (BB) calls
- FLOP K♦9♠4♠ — Seat 3 checks · CO bets $8 · Seat 3 calls
- TURN 2♥ — Seat 3 checks · CO bets $20 · Seat 3 calls
- RIVER 7♦ — Seat 3 checks · CO bets $45 · Seat 3 calls
**Showdown:** Seat 3 turns over 9♥3♥ — second pair, no kicker — and loses to AK.
**Tell:** Three streets, escalating sizes, and a hand that beats almost nothing that bets three times — called anyway. The station's signature isn't calling; it's calling *regardless of price or pressure* with hands that only beat bluffs. The $45 river call with second-pair-no-kicker is the museum piece.
**whyNot — passive:** Close cousin — but a passive player's calls thin out as the bets grow; he folds second pair to the big river bet. The station's don't-fold reflex is price-blind.
**whyNot — loose:** Loose describes his *preflop* door — it's wide open, sure. But a loose rec plays fit-or-fold after the flop; 9-3 with no kicker doesn't survive the turn, let alone the river.
**whyNot — tight:** He defended 9♥3♥ from the BB and called three streets with it. There is no definition of tight that survives this hand.

---

### ob_003 · Answer: **Maniac** · beginner (showdown)
**Confusion taught:** maniac vs aggressive reg
**Context:** "Seat 3 has 3-bet four times this orbit. The table has started calling him down lighter and lighter."
**Replay:**
- PRE — SB raises to $6 · Seat 3 (BB) 3-bets to $20 · SB calls
- FLOP K♠7♣2♦ — SB checks · Seat 3 bets $22 · SB calls
- TURN 4♥ — SB checks · Seat 3 bets $55 · SB calls
- RIVER 9♣ — SB checks · Seat 3 moves all in · SB calls
**Showdown:** Seat 3 shows 8♦3♦ — eight-high, no pair, no draw at any point.
**Tell:** Every chip went in with no hand, no draw, and no story the board would back up — into a player who had already called three times. Aggression that ignores *whether the bluff can work* is the maniac's core: he isn't executing pressure, he IS pressure. The fourth 3-bet of the orbit was the preflop version of the same tell.
**whyNot — aggressive:** An aggressive reg's barrels have a thesis — range advantage, scare cards, a fold-out target. Barreling a station-mode caller with 8-high past the point anyone folds is aggression without an audience, and regs don't perform without one.
**whyNot — loose:** Loose gets you into the 3-bet with 83s. It doesn't get you three more streets of stackable bluffing. The postflop violence is the tell, not the entry.
**whyNot — bluffing-happy tight? (use 'tight'):** A tight player's rare bluffs are picked, credible, and small. Nothing here was rare, credible, or small.

---

### ob_004 · Answer: **Aggressive Regular** · intermediate (no showdown)
**Confusion taught:** aggressive reg vs maniac — the one the whole mode exists for
**Context:** "Seat 3 has been active all night — lots of raises, but you notice his big pots keep ending with the other player folding."
**Replay:**
- PRE — CO raises to $6 · Seat 3 (BTN) 3-bets to $20 · CO calls
- FLOP A♦8♠4♠ — CO checks · Seat 3 bets $18 · CO calls
- TURN Q♥ — CO checks · Seat 3 bets $45 · CO calls
- RIVER 6♣ — CO checks · **Seat 3 checks back**
**Showdown:** none — CO's king-high wins; Seat 3 mucks unseen.
**Tell:** Position 3-bet, c-bet on the board that smashes a 3-betting range, second barrel on the queen — every bet had a story and a target. Then the discipline tell: called twice, no showdown value, scare cards spent — he *stopped*. The maniac's engine has no brakes; the aggressive reg's does. You identify this player by the bet he didn't make.
**whyNot — maniac:** Rewind to ob_003: the maniac fires the third barrel precisely because he can't not. A checked-back river after two called barrels is a calculation, and maniacs don't calculate.
**whyNot — tight:** Tight players don't 3-bet light or double-barrel scare cards. The first four actions rule it out before the river ever confuses you.
**whyNot — bluffing:** (if distractor set uses 'loose') Loose is about entering pots wide, not about weaponized, positioned aggression that knows when to quit.

---

### ob_005 · Answer: **Passive Player** · intermediate (showdown)
**Confusion taught:** passive vs station — they look identical until you check WHAT was called with
**Context:** "Seat 3 limps a lot and never seems to raise. Pleasant guy. Always apologizes when he wins."
**Replay:**
- PRE — Seat 3 (HJ) limps · BTN raises to $8 · Seat 3 calls
- FLOP Q♥9♥3♣ — Seat 3 checks · BTN bets $10 · Seat 3 calls
- TURN 6♥ — Seat 3 checks · BTN bets $22 · Seat 3 calls
- RIVER 2♦ — Seat 3 checks · BTN checks back
**Showdown:** Seat 3 turns over **A♥J♥ — the nut flush**, made on the turn. He never bet or raised at any point.
**Tell:** The station's disease is calling with bad hands; the passive player's disease is *only* calling with good ones. He made the stone nuts on the turn and check-called, then check-checked the river — value left on every street. When a player's monsters and his mediocre hands play identically (check, call), you've found the passive player.
**whyNot — calling-station:** The calls themselves fit — but flip the evidence: he wasn't calling with junk that should fold, he was failing to raise a monster that should bet. Same verbs, opposite leak.
**whyNot — nit:** Nits are passive-ish, but they don't limp-call raised pots with suited aces — they're not in the hand at all. Entry range rules it out.
**whyNot — tight:** AJs limped from the HJ is fine-ish tight-rec territory, but a tight rec bets the nuts on the river when checked to. This player physically couldn't.

---

### ob_006 · Answer: **Loose Recreational** · beginner (showdown)
**Confusion taught:** loose vs station — wide door, but honest exits
**Context:** "Seat 3 has seen the flop in five of the last six hands, from every position."
**Replay:**
- PRE — UTG raises to $6 · Seat 3 (SB) calls with the table sighing
- FLOP K♠8♦4♦ — Seat 3 checks · UTG bets $8 · Seat 3 folds — and shows T♥7♥ with a shrug: "had to look."
**Tell:** Two tells, one hand: T7 suited *called a raise from the small blind* — an entry no disciplined range explains — and then folded the moment it missed, without a fight. That combination is the loose rec's whole biography: any two cards to the flop, honest surrender after. The leak is the door, not the exits.
**whyNot — calling-station:** A station who calls T7s preflop also peels that flop (backdoor draws! overcards-ish! hope!). The clean, instant fold is what separates loose-but-honest from can't-fold.
**whyNot — maniac:** Maniacs enter wide too — but raising, not calling. Five limp/calls in six hands with zero aggression is the wrong flavor of undisciplined.
**whyNot — passive:** Tempting — he did check-fold. But passive is a postflop diagnosis of a player with *normal* entries. Nothing about T7s cold-calling from the SB is normal; the preflop tell outranks the postflop one.

---

### ob_007 · Answer: **Tight Recreational** · intermediate (showdown)
**Confusion taught:** tight rec vs nit — the confusion beginners have most
**Context:** "Seat 3 folds a lot, but not absurdly — maybe two hands an orbit. His raises have all come from late position."
**Replay:**
- PRE — folds to Seat 3 (CO), raises to $6 · BB calls
- FLOP K♦7♣2♠ — BB checks · Seat 3 bets $6 · BB calls
- TURN 5♥ — BB checks · **Seat 3 checks back**
- RIVER J♣ — BB bets $12 · Seat 3 calls
**Showdown:** Seat 3 shows A♠J♠ — rivered second pair; his one c-bet came, his second barrel never did.
**Tell:** The range is the giveaway: AJs opened from the CO is a hand a nit never plays and a loose player under-values — it's the exact middle of the honest-tight book. Then the honest rhythm: one standard c-bet, no barrel without a pair, a call (not a raise) when he made one. Everything by the book, nothing beyond it.
**whyNot — nit:** Two hands an orbit and AJs opens is 3-4x too wide for a nit — and a nit facing the river bet with second pair folds it, having assumed the worst since preflop.
**whyNot — passive:** He open-raised and c-bet — initiative a passive player doesn't take. Passive isn't "quiet"; it's *never leading*.
**whyNot — aggressive:** One c-bet then a checked-back turn is where the aggressive-reg hypothesis dies; regs barrel that 5♥ with air often enough that the check reads honest.

---

### ob_008 · Answer: **Maniac** · intermediate (no showdown)
**Confusion taught:** maniac vs aggressive, without the showdown to save you
**Context:** "Seat 3 just check-raised for the third time this orbit. The last two, everyone folded."
**Replay:**
- PRE — BTN raises to $6 · Seat 3 (BB) calls
- FLOP A♣J♥9♣ — Seat 3 checks · BTN bets $8 · Seat 3 check-raises to $30 · BTN calls
- TURN 3♦ — Seat 3 bets $40 · BTN calls
- RIVER 4♠ — **Seat 3 moves all in for $140 into $153** · BTN tank-calls
**Showdown:** dealer pushes the pot to BTN; Seat 3 flings his cards to the muck before anyone sees them.
**Tell:** Read the board, not the cards you never saw: A-J-9 with two clubs *smashes* the Button's raising range — it's one of the worst boards in poker to check-raise bluff, and the worst board of all to triple-barrel one. A player who bombs three streets into the one range that can't fold, for the third time this orbit, isn't reading anything — he's producing action for its own sake. Frequency + board-blindness = maniac, no showdown required.
**whyNot — aggressive:** The aggressive reg check-raises boards that favor HIS range (low, coordinated, blind-defense boards) — not ace-high Button boards. Target selection is the entire difference between the two, and this target selection is anti-poker.
**whyNot — calling-station:** He raised and shoved. That's the opposite species.
**whyNot — loose:** Loose explains the preflop call; nothing about loose predicts $210 of unprovoked postflop violence.

---

### ob_009 · Answer: **Tight Nit** · intermediate (no showdown)
**Confusion taught:** the sizing-jump tell (this is sc_116's lesson, taught from the observer's seat)
**Context:** "Seat 3's value bets have been half-pot all night, like a metronome. Watch this one."
**Replay:**
- PRE — Seat 3 (UTG) raises to $6 — his first open in ages · BB calls
- FLOP J♦8♦3♠ — BB checks · Seat 3 bets $6 (half pot) · BB calls
- TURN 8♣ — BB checks · Seat 3 bets $12 (half pot) · BB calls
- RIVER 2♥ — BB checks · **Seat 3 bets $49 — full pot** · BB folds top pair face-up (J♥T♥)
**Showdown:** none — but note what folded: top pair, correctly.
**Tell:** Rare UTG open, metronome half-pot, half-pot… then the machine breaks pattern and pots the river on a paired, drawless runout. Players deviate from their own baseline for a reason, and a nit's reason is never a bluff — the sizing jump is him finally letting an overpair or better cash out. The BB read it perfectly; your job was to read the same thing.
**whyNot — tight:** Legitimately close — the discriminator is the open itself ("first in ages") plus who *makes* pattern-break value bets that scary: the tight rec's river value bet stays polite; the nit's whole session was a setup for exactly one big honest bet.
**whyNot — passive:** He open-raised UTG and bet all three streets — led every street, in fact. Passivity is not available as an explanation.
**whyNot — maniac:** A maniac pots rivers too — but not after two metronome half-pots, and not once an hour. The baseline is the alibi.

---

### ob_010 · Answer: **Calling Station** · intermediate (showdown)
**Confusion taught:** station vs loose, harder version of ob_002 (the call gets worse as the hand gets better-defined)
**Context:** "Seat 3 says his favorite phrase again: 'I have to keep you honest.'"
**Replay:**
- PRE — BTN raises to $6 · Seat 3 (BB) calls
- FLOP K♣9♠5♦ — Seat 3 checks · BTN bets $9 · Seat 3 calls
- TURN 5♠ — Seat 3 checks · BTN bets $24 · Seat 3 calls
- RIVER A♦ — Seat 3 checks · BTN bets $60 · Seat 3 calls
**Showdown:** Seat 3 tables **Q♥T♥ — queen-high**. No pair. The gutshot missed on the turn and he called the river anyway, with the ace overcarding his whole hand.
**Tell:** The flop call was a loose peel (a gutshot to the jack, cards over the middle of the board — defensible!). The turn call was thin. The river call — queen-high, draw dead, on the card that improves every hand the Button bets — beat *literally nothing but a smaller bluff with worse high cards*. Each street stripped away an alternative explanation, and by the river only one player type was left standing. "Keeping you honest" is the station's motto for a reason.
**whyNot — loose:** Loose fully explains streets one and maybe two — the mode's hardest lesson is that archetypes are diagnosed at the *margins*. The river call is the margin, and loose recs don't make it.
**whyNot — passive:** Passive players call too, but with made hands they under-play — not with no hand at all. Check WHAT was called with, always.
**whyNot — reads-proof aggressive?** (if set uses 'aggressive') He never once bet or raised across four streets. Disqualified at the verb level.

---

## Authoring checklist for future observation hands

Learned from writing these ten (and from the July 5 scenario audit — same failure modes apply):

1. **Verify the replay's poker.** Pot sizes street to street, board cards vs claimed draws (ob_010's gutshot: QT on K95 needs a J — check it the way the auditor checks scenarios). An `audit-observations.mjs` with the pot-recompute rule should ship WITH the mode, not after.
2. **The distractor set is the lesson.** Pick the 3 distractors the replay *almost* supports; write `whyNot` to kill each one specifically. Never pad with obviously-wrong types.
3. **One tell per hand.** Frequency tells (context line), range tells (what entered), verb tells (raise vs call), sizing tells (baseline breaks), and stop tells (the bet not made). Don't stack three tells — the player should be able to name what they learned.
4. **Showdown = difficulty dial.** Author the hand with the showdown, then decide whether hiding it still leaves exactly one defensible answer. If it doesn't, it's a beginner hand — keep the showdown.
5. **The confusable pairs are the curriculum:** nit↔tight, passive↔station, maniac↔aggressive, loose↔station. Every intermediate hand should sit on one of these fault lines. (Notice the pool maps 7 archetypes onto 4 confusions — that's the whole syllabus.)
