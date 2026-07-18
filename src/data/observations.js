// ─── Table Reads — observation hands ────────────────────────────────────────
// The inverse of the core trainer: the player watches a replay and names the
// villain archetype. Authored content lives in TABLE_READS_DESIGN.md; this
// file is its code form. Same world as scenarios.js: $1/$2 six-max, $6 open,
// suit symbols only. The villain is always "Seat 3" in replay text.
//
// Answer/distractor values key into VILLAIN_LABELS in scenarios.js (never
// 'unknown'). Exactly 3 distractors per hand — the distractor set IS the
// lesson (each one gets a specific `whyNot`). Showdown is the difficulty
// dial: beginner hands keep it, intermediate hands may drop it.
//
// Replay rows use the authored-actionHistory shape from ticker.js
// ({ street, segments: [{ text }] }) plus an optional `board` string the
// Table Reads renderer shows on the street header.

export const ARCHETYPE_LABELS = {
  'aggressive':      'Aggressive Regular',
  'passive':         'Passive Player',
  'tight':           'Tight Recreational',
  'loose':           'Loose Recreational',
  'calling-station': 'Calling Station',
  'maniac':          'Maniac',
  'nit':             'Tight Nit',
};

function mkObservation({ id, difficulty, answer, distractors, context, replay, showdown, tell, whyNot }) {
  return { id, difficulty, answer, distractors, context, replay, showdown: showdown ?? null, tell, whyNot };
}

const OBSERVATIONS = [
  mkObservation({
    id: 'ob_001',
    difficulty: 'beginner',
    answer: 'nit',
    distractors: ['tight', 'passive', 'calling-station'],
    context: 'Seat 3 has folded 47 of the last 50 hands. This is his first raise in over an hour.',
    replay: [
      { street: 'PRE', segments: [
        { text: 'Seat 3 (UTG) raises to $6' },
        { text: 'BTN 3-bets to $20' },
        { text: 'blinds fold' },
        { text: 'Seat 3 folds instantly' },
      ] },
    ],
    showdown: 'He flashes A♠Q♠ face-up as he mucks — "can\'t call a 3-bet with that."',
    tell: 'An hour of folding, then an open — and AQ suited, a top-5% hand, hits the muck the moment anyone plays back. Only one player type has a continuing range that tight: the nit\'s world is AA–KK and nothing else survives pressure. The open frequency told you half; the instant fold told you the rest.',
    whyNot: {
      'tight': 'A tight rec opens A♠Q♠ too, but he continues with it against a 3-bet at least sometimes. Folding it face-up, proudly, is a stricter religion than "tight."',
      'passive': 'Passive describes how he bets, not what he enters with. A passive player limps and calls too much; this player barely enters at all.',
      'calling-station': 'Stations don\'t fold — not preflop, not ever with a hand this pretty. Everything about this hand is folding.',
    },
  }),

  mkObservation({
    id: 'ob_002',
    difficulty: 'beginner',
    answer: 'calling-station',
    distractors: ['passive', 'loose', 'tight'],
    context: 'Seat 3 bought in an hour ago and hasn\'t raised once. He has, however, seen a lot of rivers.',
    replay: [
      { street: 'PRE', segments: [{ text: 'CO raises to $6' }, { text: 'Seat 3 (BB) calls' }] },
      { street: 'FLOP', board: 'K♦ 9♠ 4♠', segments: [{ text: 'Seat 3 checks' }, { text: 'CO bets $8' }, { text: 'Seat 3 calls' }] },
      { street: 'TURN', board: '2♥', segments: [{ text: 'Seat 3 checks' }, { text: 'CO bets $20' }, { text: 'Seat 3 calls' }] },
      { street: 'RIVER', board: '7♦', segments: [{ text: 'Seat 3 checks' }, { text: 'CO bets $45' }, { text: 'Seat 3 calls' }] },
    ],
    showdown: 'Seat 3 turns over 9♥3♥ — second pair, no kicker — and loses to A♠K♠.',
    tell: 'Three streets, escalating sizes, and a hand that beats almost nothing that bets three times — called anyway. The station\'s signature isn\'t calling; it\'s calling regardless of price or pressure with hands that only beat bluffs. The $45 river call with second-pair-no-kicker is the museum piece.',
    whyNot: {
      'passive': 'Close cousin — but a passive player\'s calls thin out as the bets grow; he folds second pair to the big river bet. The station\'s don\'t-fold reflex is price-blind.',
      'loose': 'Loose describes his preflop door — it\'s wide open, sure. But a loose rec plays fit-or-fold after the flop; 9-3 with no kicker doesn\'t survive the turn, let alone the river.',
      'tight': 'He defended 9♥3♥ from the BB and called three streets with it. There is no definition of tight that survives this hand.',
    },
  }),

  mkObservation({
    id: 'ob_003',
    difficulty: 'beginner',
    answer: 'maniac',
    distractors: ['aggressive', 'loose', 'tight'],
    context: 'Seat 3 has 3-bet four times this orbit. The table has started calling him down lighter and lighter.',
    replay: [
      { street: 'PRE', segments: [{ text: 'SB raises to $6' }, { text: 'Seat 3 (BB) 3-bets to $20' }, { text: 'SB calls' }] },
      { street: 'FLOP', board: 'K♠ 7♣ 2♦', segments: [{ text: 'SB checks' }, { text: 'Seat 3 bets $22' }, { text: 'SB calls' }] },
      { street: 'TURN', board: '4♥', segments: [{ text: 'SB checks' }, { text: 'Seat 3 bets $55' }, { text: 'SB calls' }] },
      { street: 'RIVER', board: '9♣', segments: [{ text: 'SB checks' }, { text: 'Seat 3 moves all in' }, { text: 'SB calls' }] },
    ],
    showdown: 'Seat 3 shows 8♦3♦ — eight-high, no pair, no draw at any point.',
    tell: 'Every chip went in with no hand, no draw, and no story the board would back up — into a player who had already called three times. Aggression that ignores whether the bluff can work is the maniac\'s core: he isn\'t executing pressure, he IS pressure. The fourth 3-bet of the orbit was the preflop version of the same tell.',
    whyNot: {
      'aggressive': 'An aggressive reg\'s barrels have a thesis — range advantage, scare cards, a fold-out target. Barreling a station-mode caller with 8-high past the point anyone folds is aggression without an audience, and regs don\'t perform without one.',
      'loose': 'Loose gets you into the 3-bet with 8♦3♦. It doesn\'t get you three more streets of stackable bluffing. The postflop violence is the tell, not the entry.',
      'tight': 'A tight player\'s rare bluffs are picked, credible, and small. Nothing here was rare, credible, or small.',
    },
  }),

  mkObservation({
    id: 'ob_004',
    difficulty: 'intermediate',
    answer: 'aggressive',
    distractors: ['maniac', 'tight', 'loose'],
    context: 'Seat 3 has been active all night — lots of raises, but you notice his big pots keep ending with the other player folding.',
    replay: [
      { street: 'PRE', segments: [{ text: 'CO raises to $6' }, { text: 'Seat 3 (BTN) 3-bets to $20' }, { text: 'CO calls' }] },
      { street: 'FLOP', board: 'A♦ 8♠ 4♠', segments: [{ text: 'CO checks' }, { text: 'Seat 3 bets $18' }, { text: 'CO calls' }] },
      { street: 'TURN', board: 'Q♥', segments: [{ text: 'CO checks' }, { text: 'Seat 3 bets $45' }, { text: 'CO calls' }] },
      { street: 'RIVER', board: '6♣', segments: [{ text: 'CO checks' }, { text: 'Seat 3 checks back' }] },
    ],
    showdown: null,
    tell: 'Position 3-bet, c-bet on the board that smashes a 3-betting range, second barrel on the queen — every bet had a story and a target. Then the discipline tell: called twice, no showdown value, scare cards spent — he stopped. The maniac\'s engine has no brakes; the aggressive reg\'s does. You identify this player by the bet he didn\'t make.',
    whyNot: {
      'maniac': 'The maniac fires the third barrel precisely because he can\'t not. A checked-back river after two called barrels is a calculation, and maniacs don\'t calculate.',
      'tight': 'Tight players don\'t 3-bet light or double-barrel scare cards. The first four actions rule it out before the river ever confuses you.',
      'loose': 'Loose is about entering pots wide, not weaponized, positioned aggression that knows when to quit. His entries are raises with a plan, not calls with a shrug.',
    },
  }),

  mkObservation({
    id: 'ob_005',
    difficulty: 'intermediate',
    answer: 'passive',
    distractors: ['calling-station', 'nit', 'tight'],
    context: 'Seat 3 limps a lot and never seems to raise. Pleasant guy. Always apologizes when he wins.',
    replay: [
      { street: 'PRE', segments: [{ text: 'Seat 3 (HJ) limps' }, { text: 'BTN raises to $8' }, { text: 'Seat 3 calls' }] },
      { street: 'FLOP', board: 'Q♥ 9♥ 3♣', segments: [{ text: 'Seat 3 checks' }, { text: 'BTN bets $10' }, { text: 'Seat 3 calls' }] },
      { street: 'TURN', board: '6♥', segments: [{ text: 'Seat 3 checks' }, { text: 'BTN bets $22' }, { text: 'Seat 3 calls' }] },
      { street: 'RIVER', board: '2♦', segments: [{ text: 'Seat 3 checks' }, { text: 'BTN checks back' }] },
    ],
    showdown: 'Seat 3 turns over A♥J♥ — the nut flush, made on the turn. He never bet or raised at any point.',
    tell: 'The station\'s disease is calling with bad hands; the passive player\'s disease is only calling with good ones. He made the stone nuts on the turn and check-called, then check-checked the river — value left on every street. When a player\'s monsters and his mediocre hands play identically (check, call), you\'ve found the passive player.',
    whyNot: {
      'calling-station': 'The calls themselves fit — but flip the evidence: he wasn\'t calling with junk that should fold, he was failing to raise a monster that should bet. Same verbs, opposite leak.',
      'nit': 'Nits are passive-ish, but they don\'t limp-call raised pots with suited aces — they\'re not in the hand at all. Entry range rules it out.',
      'tight': 'A♥J♥ limped from the HJ is fine-ish tight-rec territory, but a tight rec bets the nuts on the river when checked to. This player physically couldn\'t.',
    },
  }),

  mkObservation({
    id: 'ob_006',
    difficulty: 'beginner',
    answer: 'loose',
    distractors: ['calling-station', 'maniac', 'passive'],
    context: 'Seat 3 has seen the flop in five of the last six hands, from every position.',
    replay: [
      { street: 'PRE', segments: [{ text: 'UTG raises to $6' }, { text: 'Seat 3 (SB) calls as the table sighs' }] },
      { street: 'FLOP', board: 'K♠ 8♦ 4♦', segments: [{ text: 'Seat 3 checks' }, { text: 'UTG bets $8' }, { text: 'Seat 3 folds' }] },
    ],
    showdown: 'He shows T♥7♥ with a shrug as he folds: "had to look."',
    tell: 'Two tells, one hand: T♥7♥ called a raise from the small blind — an entry no disciplined range explains — and then folded the moment it missed, without a fight. That combination is the loose rec\'s whole biography: any two cards to the flop, honest surrender after. The leak is the door, not the exits.',
    whyNot: {
      'calling-station': 'A station who calls T♥7♥ preflop also peels that flop (backdoor draws! overcards-ish! hope!). The clean, instant fold is what separates loose-but-honest from can\'t-fold.',
      'maniac': 'Maniacs enter wide too — but raising, not calling. Five limp/calls in six hands with zero aggression is the wrong flavor of undisciplined.',
      'passive': 'Tempting — he did check-fold. But passive is a postflop diagnosis of a player with normal entries. Nothing about T♥7♥ cold-calling from the SB is normal; the preflop tell outranks the postflop one.',
    },
  }),

  mkObservation({
    id: 'ob_007',
    difficulty: 'intermediate',
    answer: 'tight',
    distractors: ['nit', 'passive', 'aggressive'],
    context: 'Seat 3 folds a lot, but not absurdly — maybe two hands an orbit. His raises have all come from late position.',
    replay: [
      { street: 'PRE', segments: [{ text: 'folds to Seat 3 (CO), who raises to $6' }, { text: 'BB calls' }] },
      { street: 'FLOP', board: 'K♦ 7♣ 2♠', segments: [{ text: 'BB checks' }, { text: 'Seat 3 bets $6' }, { text: 'BB calls' }] },
      { street: 'TURN', board: '5♥', segments: [{ text: 'BB checks' }, { text: 'Seat 3 checks back' }] },
      { street: 'RIVER', board: 'J♣', segments: [{ text: 'BB bets $12' }, { text: 'Seat 3 calls' }] },
    ],
    showdown: 'Seat 3 shows A♠J♠ — rivered second pair; his one c-bet came, his second barrel never did.',
    tell: 'The range is the giveaway: A♠J♠ opened from the CO is a hand a nit never plays and a loose player under-values — it\'s the exact middle of the honest-tight book. Then the honest rhythm: one standard c-bet, no barrel without a pair, a call (not a raise) when he made one. Everything by the book, nothing beyond it.',
    whyNot: {
      'nit': 'Two hands an orbit and A♠J♠ opens is 3–4x too wide for a nit — and a nit facing the river bet with second pair folds it, having assumed the worst since preflop.',
      'passive': 'He open-raised and c-bet — initiative a passive player doesn\'t take. Passive isn\'t "quiet"; it\'s never leading.',
      'aggressive': 'One c-bet then a checked-back turn is where the aggressive-reg hypothesis dies; regs barrel that 5♥ with air often enough that the check reads honest.',
    },
  }),

  mkObservation({
    id: 'ob_008',
    difficulty: 'intermediate',
    answer: 'maniac',
    distractors: ['aggressive', 'calling-station', 'loose'],
    context: 'Seat 3 just check-raised for the third time this orbit. The last two, everyone folded.',
    replay: [
      { street: 'PRE', segments: [{ text: 'BTN raises to $6' }, { text: 'Seat 3 (BB) calls' }] },
      { street: 'FLOP', board: 'A♣ J♥ 9♣', segments: [{ text: 'Seat 3 checks' }, { text: 'BTN bets $8' }, { text: 'Seat 3 check-raises to $30' }, { text: 'BTN calls' }] },
      { street: 'TURN', board: '3♦', segments: [{ text: 'Seat 3 bets $40' }, { text: 'BTN calls' }] },
      { street: 'RIVER', board: '4♠', segments: [{ text: 'Seat 3 moves all in for $140 into $153' }, { text: 'BTN tank-calls' }] },
    ],
    showdown: 'The dealer pushes the pot to BTN; Seat 3 flings his cards to the muck before anyone sees them.',
    tell: 'Read the board, not the cards you never saw: A-J-9 with two clubs smashes the Button\'s raising range — it\'s one of the worst boards in poker to check-raise bluff, and the worst board of all to triple-barrel one. A player who bombs three streets into the one range that can\'t fold, for the third time this orbit, isn\'t reading anything — he\'s producing action for its own sake. Frequency + board-blindness = maniac, no showdown required.',
    whyNot: {
      'aggressive': 'The aggressive reg check-raises boards that favor HIS range (low, coordinated, blind-defense boards) — not ace-high Button boards. Target selection is the entire difference between the two, and this target selection is anti-poker.',
      'calling-station': 'He raised and shoved. That\'s the opposite species.',
      'loose': 'Loose explains the preflop call; nothing about loose predicts $210 of unprovoked postflop violence.',
    },
  }),

  mkObservation({
    id: 'ob_009',
    difficulty: 'intermediate',
    answer: 'nit',
    distractors: ['tight', 'passive', 'maniac'],
    context: 'Seat 3\'s value bets have been half-pot all night, like a metronome. Watch this one.',
    replay: [
      { street: 'PRE', segments: [{ text: 'Seat 3 (UTG) raises to $6 — his first open in ages' }, { text: 'BB calls' }] },
      { street: 'FLOP', board: 'J♦ 8♦ 3♠', segments: [{ text: 'BB checks' }, { text: 'Seat 3 bets $6 (half pot)' }, { text: 'BB calls' }] },
      { street: 'TURN', board: '8♣', segments: [{ text: 'BB checks' }, { text: 'Seat 3 bets $12 (half pot)' }, { text: 'BB calls' }] },
      { street: 'RIVER', board: '2♥', segments: [{ text: 'BB checks' }, { text: 'Seat 3 bets $49 — full pot' }, { text: 'BB folds J♥T♥ face-up' }] },
    ],
    showdown: null,
    tell: 'Rare UTG open, metronome half-pot, half-pot… then the machine breaks pattern and pots the river on a paired, drawless runout. Players deviate from their own baseline for a reason, and a nit\'s reason is never a bluff — the sizing jump is him finally letting an overpair or better cash out. The BB read it perfectly; your job was to read the same thing.',
    whyNot: {
      'tight': 'Legitimately close — the discriminator is the open itself ("first in ages") plus who makes pattern-break value bets that scary: the tight rec\'s river value bet stays polite; the nit\'s whole session was a setup for exactly one big honest bet.',
      'passive': 'He open-raised UTG and bet all three streets — led every street, in fact. Passivity is not available as an explanation.',
      'maniac': 'A maniac pots rivers too — but not after two metronome half-pots, and not once an hour. The baseline is the alibi.',
    },
  }),

  mkObservation({
    id: 'ob_010',
    difficulty: 'intermediate',
    answer: 'calling-station',
    distractors: ['loose', 'passive', 'aggressive'],
    context: 'Seat 3 says his favorite phrase again: "I have to keep you honest."',
    replay: [
      { street: 'PRE', segments: [{ text: 'BTN raises to $6' }, { text: 'Seat 3 (BB) calls' }] },
      { street: 'FLOP', board: 'K♣ 9♠ 5♦', segments: [{ text: 'Seat 3 checks' }, { text: 'BTN bets $9' }, { text: 'Seat 3 calls' }] },
      { street: 'TURN', board: '5♠', segments: [{ text: 'Seat 3 checks' }, { text: 'BTN bets $24' }, { text: 'Seat 3 calls' }] },
      { street: 'RIVER', board: 'A♦', segments: [{ text: 'Seat 3 checks' }, { text: 'BTN bets $60' }, { text: 'Seat 3 calls' }] },
    ],
    showdown: 'Seat 3 tables Q♥T♥ — queen-high. No pair. The gutshot missed on the turn and he called the river anyway, with the ace overcarding his whole hand.',
    tell: 'The flop call was a loose peel (a gutshot to the jack, cards over the middle of the board — defensible!). The turn call was thin. The river call — queen-high, draw dead, on the card that improves every hand the Button bets — beat literally nothing but a smaller bluff with worse high cards. Each street stripped away an alternative explanation, and by the river only one player type was left standing. "Keeping you honest" is the station\'s motto for a reason.',
    whyNot: {
      'loose': 'Loose fully explains streets one and maybe two — the mode\'s hardest lesson is that archetypes are diagnosed at the margins. The river call is the margin, and loose recs don\'t make it.',
      'passive': 'Passive players call too, but with made hands they under-play — not with no hand at all. Check WHAT was called with, always.',
      'aggressive': 'He never once bet or raised across four streets. Disqualified at the verb level.',
    },
  }),
];

// Same startup guard discipline as scenarios.js — catch authoring slips loudly
// in dev; the audit script enforces the same rules as a hard gate.
for (const ob of OBSERVATIONS) {
  if (!ARCHETYPE_LABELS[ob.answer]) console.warn(`Observation ${ob.id}: unknown answer '${ob.answer}'`);
  if (ob.distractors.length !== 3) console.warn(`Observation ${ob.id}: needs exactly 3 distractors`);
  for (const d of ob.distractors) {
    if (!ARCHETYPE_LABELS[d]) console.warn(`Observation ${ob.id}: unknown distractor '${d}'`);
    if (!ob.whyNot[d]) console.warn(`Observation ${ob.id}: missing whyNot for '${d}'`);
  }
}

export default OBSERVATIONS;
