# Authoring Observations (Table Reads)

Read this when adding or editing anything in `src/data/observations.js`.

---

## What an observation is

An observation hand shows a villain's action replay and asks the player to
name the archetype. The mode trains *forming* reads — the direction real poker
demands — rather than applying a handed-to-you label. Each hand teaches one
identification tell and one set of confusable near-misses.

---

## Data model

```js
mkObservation({
  id:          'ob_011',
  difficulty:  'beginner' | 'intermediate',
  answer:      'nit',          // key into ARCHETYPE_LABELS — never 'unknown'
  distractors: ['tight', 'passive', 'calling-station'],  // exactly 3
  context:     'Seat 3 has folded 47 of the last 50 hands.',
  replay:      [ /* actionHistory-shaped rows */ ],
  showdown:    'He turns over A♠A♥.' | null,
  tell:        '…',            // correct-answer explanation — the lesson
  whyNot:      { tight: '…', passive: '…', 'calling-station': '…' },
})
```

---

## Rule O1 — structural integrity

- **id** must match `/^ob_\d{3}$/` and must be unique across the pool.
- **difficulty** must be `'beginner'` or `'intermediate'`.
- Both **context** and **tell** must be non-empty strings.

---

## Rule O2 — answer and distractor discipline

- **answer** must be a key in `ARCHETYPE_LABELS`. `'unknown'` is excluded —
  the mode teaches named identification; unknown is not a teachable tell.
- **distractors** must be an array of exactly **3** distinct archetype keys,
  none equal to the answer, each covered by a `whyNot` entry.
- `whyNot` keys that are not in `distractors` are dead text (WARN).

The distractor set *is* the lesson. Pick the 3 archetypes the replay almost
supports. Never pad with obviously-wrong types — a player who picks wrong
gets feedback specific to their confusion, and that specificity is what the
mode does that a quiz doesn't.

```js
// CORRECT — each distractor is a real confusion the replay invites
distractors: ['tight', 'passive', 'calling-station'],
whyNot: {
  tight:            'A tight rec continues with AQs against a 3-bet at least sometimes…',
  passive:          'Passive describes how he bets, not what he enters with…',
  'calling-station': 'Stations don\'t fold — not preflop, not ever with a hand this pretty.',
}

// WRONG — padding with easy eliminations
distractors: ['maniac', 'loose', 'calling-station'],
```

---

## Rule O3 — replay integrity

The `replay` array uses the exact `actionHistory` row shape from the main
trainer (`{ street, segments: [{ text }] }`). The villain is always **Seat 3**
in the text; other players are referenced by position (BTN, CO, etc.).

Enforced:

- Streets must be in order: `PRE → FLOP → TURN → RIVER`.
- `PRE` rows must not carry a `board` field.
- Every postflop row (`FLOP`, `TURN`, `RIVER`) must carry a `board` field.
- `FLOP` board = exactly 3 cards. `TURN` and `RIVER` boards = exactly 1 card
  each.
- Board cards must match the pattern `[rank][suit]` with suit symbols.
- Every row must have at least one segment with non-empty `text`.
- A WARN fires when `Seat 3` is absent from a postflop street — villain
  absence should be intentional (e.g. the stop-tell street where he checks
  back).

Verify pot sizes street-to-street and that stated draws exist on the printed
board. The auditor does not recompute postflop pots — this is a manual check.
The ob_010 gutshot (QT needs a J on K95) is the canonical example of an error
the auditor would not catch.

---

## Rule O4 — showdown is the difficulty dial

**Beginner hands must include a `showdown`** (ERROR if absent).

Author the hand with the showdown, then ask: does hiding it leave exactly one
defensible answer? If no, keep the showdown — it is a beginner hand. If yes,
set `showdown: null` and mark it `difficulty: 'intermediate'`.

Same replay, one fewer row — the mechanic is that simple. The showdown is the
training wheel; removing it is what makes a hand intermediate.

---

## Rule O5 — suit symbols everywhere

Use ♠ ♥ ♦ ♣ in all text fields: `context`, `tell`, `showdown`, `whyNot`
values, and every replay segment. Never use shorthand notation (AQs, 98d,
T♠h). The auditor exits 1 on any `SHORTHAND_RE` match.

---

## Rule O6 — frequency-evidence must be carried in context

Coaches form archetype reads over 30–100+ observed hands. A tell that leans on
session-frequency claims about Seat 3 ("this orbit", "an hour of folding",
"N of the last M", "keeps calling", "hasn't raised once") cannot be supported
by a single replayed hand. If the `tell` text makes such a claim, the
`context` or `showdown` must state that frequency evidence too.

```js
// CORRECT — context carries the frequency evidence the tell cites
context: 'Seat 3 has 3-bet four times this orbit.',
tell:    'Four 3-bets in one orbit, barreling into a caller — frequency + board-blindness = maniac.',

// WRONG — tell asserts session frequency the context doesn't ground
context: 'Seat 3 has been active.',
tell:    'He has 3-bet four times this orbit and keeps barreling regardless…',
```

The auditor matches a `SESSION_FREQ_RE` pattern in `tell`; if matched and the
same pattern is absent from `context + showdown`, it issues a WARN. All 22
hands in the current pool pass; a synthetic violation trips the rule.

---

## Tell taxonomy — one tell per hand

Each hand must teach exactly one primary tell type. Don't stack multiple
independent tells — name the one thing the player should be able to repeat at
a real table.

| Tell type | What it is | Example hands |
|-----------|-----------|---------------|
| **Frequency** | How often he enters / aggresses | ob_001 (hour of folding), ob_003 (4 × 3-bets/orbit) |
| **Range** | What cards entered (entry range) | ob_006 (T♥7♥ cold-call) |
| **Verb** | Raise vs call vs check (initiative) | ob_002 (no raises, lots of rivers) |
| **Sizing** | Baseline deviation | ob_009 (metronome half-pot → full-pot break) |
| **Stop** | The bet that wasn't made | ob_004 (river check-back after two barrels) |

---

## The confusable pairs — the curriculum

Every intermediate hand must sit on one of these fault lines:

| Confusion | Discriminator |
|-----------|--------------|
| **nit ↔ tight** | Continuation range: nit folds AQs to a 3-bet; tight rec calls at least sometimes |
| **passive ↔ station** | What was called with: station calls bad hands; passive under-raises good ones |
| **maniac ↔ aggressive reg** | Target selection: reg boards match his range; maniac ignores board texture |
| **loose ↔ station** | Post-flop exits: loose folds when he misses; station calls regardless of price |

Beginner hands may teach the easy end of a confusion (ob_001 nit vs tight is
beginner with a showdown). Intermediate hands teach the same confusion without
the showdown confirmation.

---

## Archetype spread

Aim for reasonable coverage across all seven named archetypes over the pool.
Current pool (22 hands): maniac 4, all others 3. Adding more than two
consecutive hands of the same archetype without a confusable-pair pairing
reduces the discriminative value of the mode.

---

## Authoring workflow

1. Add the observation using `mkObservation` (or its equivalent helper if one
   exists).
2. **`npm run audit:observations`** — fix every ERROR. Review every WARN.
3. **`CI=true npm test`** — includes `TableReads.test.js` data-contract checks.
4. Play through the full hand in the real UI with the difficulty you chose:
   confirm the reveal cadence, the chip shuffle, and both the correct-answer
   and wrong-answer feedback paths.
5. Check that `Seat 3` appears by name in the relevant replay rows so the UI
   can highlight him.
