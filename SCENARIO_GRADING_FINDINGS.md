# Scenario Grading Audit — Findings (July 5, 2026)

Full strategic review of all 83 scenarios: is the graded-correct action actually the best line, are partial/incorrect assignments sane, does feedback contradict the grading or contain math/hand-reading errors, and does the undisplayed `question` field hide context that changes the answer (the sc_012 failure mode).

**Companion to `scenario-review.csv` (`npm run export:review`)** — hand this file to the SME with the CSV. Findings are severity-ranked. HIGH = the scenario teaches wrong poker as written. MEDIUM = displayed text is factually wrong or internally contradictory, but the graded answer survives. LOW = polish / SME-confirm.

## ⚡ Status (July 5, 2026 — after founder review)

**FIXED in scenarios.js (founder-approved July 5):** all four HIGH items — H1 sc_024 (board → K♠9♦3♦, flush draw now real) · H2 sc_054 (hand → 8♦7♦, a real bluff-catcher) · H3 sc_056 (feedback rewritten with real combos, $85 aligned) · H4 sc_064 (regraded: call correct, fold partial; AJ error fixed) — plus the mechanical text corrections: M1, M5, M6, M7, M8, M9, L1, L4 (math part), L5, L6, L7, L8, L9, L10, L11, L12.

**STILL OPEN for the SME** (grading-judgment calls, not applied): **M2** (sc_025 — should fold be partial/correct for a gutshot at 3:1?) · **M3** (sc_043 — raise vs call with top set on KQJ; note/feedback contradiction) · **M4** (sc_057 — scenario logic references a check that hasn't happened; needs redesign) · **L2** (sc_009 — fold AJo vs nit as partial?) · **L3** (sc_023 — confirm monotone-bluff lesson intended) · **M10** (sc_098 — first live `scenario_feedback` dispute, July 19, 2026: should the Button call with QJs vs the nit's UTG open be *partial* instead of incorrect?). The sections below are the full original findings for context.

Scope notes: pot arithmetic was verified separately (potpre audit rule, fixed July 5). The 11 explicit "X:1" odds claims in question/body all check out. This review found **zero problems in 58 of 83 scenarios** — the core grading logic is largely sound; the errors cluster in draw/out-counting and river feedback text.

---

## HIGH — grading or correct-answer feedback teaches wrong poker (4)

### H1 · sc_024 — the "nut flush draw" doesn't exist
Hand A♦5♦ on **K♠9♥3♦** (one diamond). The correct-answer feedback says "You have the nut flush draw… when called you have 9 outs to the nuts." There is no flush draw — hero has ace-high with backdoor draws only. The c-bet itself is still standard for the 3-bettor, but the feedback teaches a player to see 9 outs that aren't there.
**Fix options:** (a) change board to K♠9♦3♦ so the feedback becomes true (minimal edit, keeps the lesson), or (b) rewrite feedback around a range-based c-bet with backdoor equity.

### H2 · sc_054 — bluff-catching with ten-high
T♥9♥ (no pair, no draw) on K♦8♣2♠3♥Q♣, maniac shoves river, 60% bluff rate. CALL graded correct: "T9 beats his bluffs… mathematically mandatory." **Ten-high does not beat a bluffing range** — his busted draws and air include A-high, Q-high, J-high, most of which beat T9 at showdown. The 31%-needed math only works if you actually win against the bluffs. As written it teaches the classic station error dressed up as math.
**Fix options:** (a) give hero an actual bluff-catcher (e.g. 8♦7♦ = pair of eights on this board) and keep everything else, or (b) keep T9 and regrade fold correct with feedback explaining *why* the math doesn't apply ("your 'bluff-catcher' must beat the bluffs") — arguably the stronger lesson.

### H3 · sc_056 — feedback invents impossible hands
QQ (top set) on **Q T 4 3 J** (unpaired board) facing a passive player's river raise. Fold-feedback: "he can raise with KJ, JJ (full house) that you beat with the higher full house" — **no full house is possible on an unpaired board**, and JJ is a set, not a boat. Call-feedback: "you still beat 9-high draws that turned into straights" — you **lose** to any completed straight (AK, K9, 98 all get there). The call at ~3.7:1 is defensible; both feedback paragraphs need a rewrite. Also: body says he raises to $85, question field says $100.

### H4 · sc_064 — the villain note argues against its own grading
Top two pair (AK) on A♠K♣8♥J♦, loose rec leads turn $22. FOLD graded correct via "the slow-play tell." Two problems: (1) fold-feedback lists "AJ (better two pair)" among the hands that beat you — **AK beats AJ** (aces-and-kings over aces-and-jacks); (2) the note says he "slow-plays sets and two pair frequently, rarely bets strong hands immediately" — which logically means his sudden *lead* is **less** likely to be a slow-played monster, not more. And folding top two to one turn bet at 2.5:1 vs a *loose* rec is extremely tight regardless.
**Fix options:** (a) regrade call correct / fold partial and fix the AJ error, or (b) keep fold but rewrite the note so his lead genuinely signals strength (e.g. "he leads only when a draw comes in or he has two pair beat").

---

## MEDIUM — displayed text factually wrong or contradictory; graded answer survives (9)

### M1 · sc_003 — dirty outs counted as clean
KQ on A♠J♥3♦: "10 outs (4 to the nut straight, 6 overcard outs)" — while the same scenario says his bet "likely means a strong hand" (an ace). Hitting a K or Q makes second pair that loses to any ace. Real clean outs ≈ 4 (nut gutshot). Call still justifiable via implied odds; the out-counting teaches double-counting.

### M2 · sc_025 — wrong break-even math, thin grading
76♥ gutshot getting 3:1, fold graded *incorrect*. Feedback: "you'd need closer to 4:1" — a 4-out gutshot needs ~10:1 direct (4:1 is the requirement for ~9 outs). Implied-odds justification needs ~$67 extra when you hit a $9 call, and the feedback itself admits villains slow down when the obvious 4 lands. SME: consider fold = partial (or even correct); at minimum fix the 4:1 claim.

### M3 · sc_043 — note says his leads are strong; feedback says they're weak
Top set KQJ vs passive donk-lead. Villain note: "when he leads, it almost always means a strong hand." Raise-option feedback: "Raising might fold out the weak donk-bets that make up most of his range." Both can't be true. If his lead is strong, raising top set for value on the wettest board in poker is arguably better than the graded slow-call. SME review grading + reconcile note.

### M4 · sc_057 — the tell references an action that hasn't happened
K♠7♠ on K839, hero first to act on the turn. Correct answer "Lead $18" is justified by "His turn check … is a capped range signal" — but he hasn't checked; the note describes what it means *when he checks behind*, which can only happen after hero checks. The scenario's logic is circular, and leading TPWK into an aggressive two-barreler also contradicts the check-call lesson sc_040/sc_014 teach. Needs a rework (either make it a check-decision scenario, or change the read).

### M5 · sc_052 — phantom pair in the body text
A♦4♦ on K♠Q♣7♦2♥5♣: body says "you're left with ace-high **and a pair of 4s**" — there is no 4 on the board. Hero has ace-high, period. (Bluff grading fine.)

### M6 · sc_069 — phantom gutshot, inflated outs
J♣5♣ on T♣8♣2♦ described as "flush draw plus gutshot (potentially 12 outs)" — no single card makes J5 a straight (a 9 only gives a four-card draw). Real outs: 9 flush. Call still correct at 2.56:1 with 9 outs + implied; fix body/question/feedback counts.

### M7 · sc_075 — the "semi-bluff" has no draw
Q♣9♣ on A♥T♦4♣2♠ **turn**, described as "gutshot + backdoor flush draw." Neither exists: no single card completes a straight for Q9 here, and a backdoor flush is impossible with one card to come (3 clubs total). The barrel is a pure bluff vs a capped range — likely still fine, but body + the "overcommits on a draw" feedback describe equity hero doesn't have.

### M8 · sc_053 — pot arithmetic (postflop, so the potpre rule missed it)
HU: BTN raises $6, BB calls, SB folds → pot $13. Field/body say $15 ("bets $10 into a $15 pot", "2.5:1"). Should be $13 and 2.3:1.

### M9 · sc_072 — multi-street plan on the river
Top set on A K 9 3 T **river**; correct-answer feedback: "Three streets of $35 extracts more than one street of $130" — there is one street left. The sizing logic (medium beats overbet vs this villain) survives; the feedback needs to be about this street.

---

### M10 · sc_098 — call graded incorrect; disputed via the in-app "Disagree?" box (first live intake, July 19, 2026)
BTN Q♠J♠ vs a nit's UTG open ($6 into $9 — the price needs ~28.6%, QJs has ~30-31% raw vs the stated {QQ+, AK}-shaped range). The dispute is legitimate: in position against a face-up range, QJs plays as a pure drawing hand (pairs are disciplined folds BECAUSE the range is known; wins come from straights/flushes/two-pair with excellent implied odds against overpairs that pay). Counter-case, and why the grading was left standing pending SME: the implied-odds defense requires deep effective stacks, which the data model doesn't carry or display (Phase 1.6 gap) — on displayed information, domination doctrine governs; the blinds still act behind the flat (squeeze risk); and this is a position-skill hand whose lesson IS "tighten hard vs early-seat opens" — partial credit would blunt the trained lesson for an audience that already over-calls here. Mirror-image of the L2/sc_009 question. SME: should call be partial? If yes, note the fb text (which argues domination well) still fits a partial grade unchanged.

## LOW — polish, terminology, SME-confirm (12)

| # | Scenario | Issue |
|---|---|---|
| L1 | sc_001 | "getting nearly 3:1" — actual 2.25:1 (9:4). Standardize the odds convention used in feedback text. |
| L2 | sc_009 | Folding AJo vs a top-10% nit graded flatly incorrect; defensible fold for many coaches — consider partial. |
| L3 | sc_023 | Bluffing 5♦4♦ (no spade) into a nit whose CO range smashes AKQ♠ monotone — the stated read makes it coherent, but SME should confirm the intended lesson (players may over-apply "bluff monotone boards"). |
| L4 | sc_031 | "need roughly 16:1" for a 2-out call — actual ~22:1. Question field says "bets after your check" but he donk-led. |
| L5 | sc_045 | "if he check-raises, you 3-bet" — hero acts first; villain can only raise. |
| L6 | sc_049 | T9's straight called "nut straight" (KT beats it); "you riveted a straight" typo; the straight actually completed on the turn Q, not the river. |
| L7 | sc_050 | J♦T♦ on A♣K♠6♦2♥ called "gutshot + two overs" — J and T are not overcards on an A/K-high board. |
| L8 | sc_051 | "you backdoored the nut straight" — it was a direct gutshot that hit the river; not backdoor. Nut-straight claim is correct here. |
| L9 | sc_061 | AT on A74 called "TPTK" in displayed feedback — kicker T is not top kicker. |
| L10 | sc_068 | Check-option title "Checking Has Showdown Value" contradicts its own feedback ("no showdown value"); feedback says "called three streets" (it was two). |
| L11 | sc_080 | OESD "needs Q or 8" — the 8 is on the board; should be "needs Q or 7." |
| L12 | sc_083 | River K makes QT second pair; body/question still say "top pair." Call grading unaffected. |

---

## Pattern summary for the SME

- **Draw/out-counting is the weak spot** (H1, M1, M2, M6, M7, L7, L11): five scenarios describe draws or outs that don't exist on the printed board. Recommend the SME re-verify every scenario whose text names an out count or draw type against the actual cards.
- **River feedback text** is the second cluster (H3, M9, L6, L8): street confusion and impossible-hand claims.
- **Villain note vs grading contradictions** (H4, M3, M4): three scenarios where the printed read argues against the graded answer.
- **The `question` field** (undisplayed) hid the sc_012 tournament context; this pass found two more question/body mismatches (H3, L4) — keep checking it in review.
