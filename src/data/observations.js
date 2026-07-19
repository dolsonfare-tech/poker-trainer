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

  // ── Batch 2 (July 20, 2026) — 12 intermediate hands on the four confusable
  // fault lines, authored per the TABLE_READS_DESIGN.md checklist. Mostly
  // no-showdown (the difficulty dial); showdown kept only where hiding it
  // leaves two defensible answers. One tell per hand.

  mkObservation({
    id: 'ob_011',
    difficulty: 'intermediate',
    answer: 'aggressive',
    distractors: ['maniac', 'loose', 'tight'],
    context: 'Seat 3 has been raising steadily but selectively all night — and winning small pots nobody contests.',
    replay: [
      { street: 'PRE', segments: [{ text: 'Seat 3 (BTN) raises to $6' }, { text: 'BB calls' }] },
      { street: 'FLOP', board: 'Q♠ 8♦ 3♣', segments: [{ text: 'BB checks' }, { text: 'Seat 3 bets $8' }, { text: 'BB calls' }] },
      { street: 'TURN', board: 'A♦', segments: [{ text: 'BB checks' }, { text: 'Seat 3 bets $24' }, { text: 'BB calls' }] },
      { street: 'RIVER', board: '6♥', segments: [{ text: 'BB checks' }, { text: 'Seat 3 checks back' }] },
    ],
    tell: 'Read the story he was telling: small on the dry flop, big on the ace — the card his raising range owns. That barrel had a thesis: fold out the queens. When the call came anyway and the river changed nothing, the story was over, and he stopped paying to tell it. Pressure with a target, and a budget, is the aggressive regular\'s signature.',
    whyNot: {
      'maniac': 'A maniac fires the third bullet every time — the pot is the point, not the plan. The river check-back is the exact moment a maniac doesn\'t possess.',
      'loose': 'Loose recreationals call wide, but they don\'t construct two-street stories with sizes that read the board. The turn bet tripling on the scare card is range logic, not looseness.',
      'tight': 'A tight player with a real ace bets that river for value. Checking back after barreling the ace is what a thesis without a hand looks like — tight players don\'t barrel without one.',
    },
  }),

  mkObservation({
    id: 'ob_012',
    difficulty: 'intermediate',
    answer: 'passive',
    distractors: ['calling-station', 'tight', 'loose'],
    context: 'Seat 3 sees plenty of flops and rarely raises. Tonight he has quietly called down two players — and folded two rivers.',
    replay: [
      { street: 'PRE', segments: [{ text: 'CO raises to $6' }, { text: 'Seat 3 (BB) calls' }] },
      { street: 'FLOP', board: 'J♥ 7♦ 2♠', segments: [{ text: 'Seat 3 checks' }, { text: 'CO bets $6' }, { text: 'Seat 3 calls' }] },
      { street: 'TURN', board: '9♣', segments: [{ text: 'Seat 3 checks' }, { text: 'CO bets $15' }, { text: 'Seat 3 calls' }] },
      { street: 'RIVER', board: 'K♠', segments: [{ text: 'Seat 3 checks' }, { text: 'CO bets $50' }, { text: 'Seat 3 thinks for a while and folds' }] },
    ],
    tell: 'He called $6, he called $15, and when the bet grew teeth he let the hand go. That is the line that separates passive from station: a passive player\'s calls thin out as the price climbs. He will pay a little to see your hand — he will not pay a lot. The long think before the fold was the sound of a made hand losing an argument with a price.',
    whyNot: {
      'calling-station': 'The river fold is disqualifying. A station\'s calls are price-blind — $50 into $55 gets called with the same shrug as $6. Passive players fold rivers; stations see them.',
      'tight': 'A tight player is out of this hand on the flop — no pair, no plan, no $6 call from a defended big blind. Two streets of peeling is too sticky for tight.',
      'loose': 'Loose describes what he shows up with, not how he responds to pressure. And a loose rec\'s fit-or-fold instinct usually ends this hand earlier — the slow, reluctant call-down is the passive fingerprint.',
    },
  }),

  mkObservation({
    id: 'ob_013',
    difficulty: 'intermediate',
    answer: 'calling-station',
    distractors: ['passive', 'loose', 'tight'],
    context: 'Seat 3 has seen nine rivers this session and won two of them. The table has stopped bluffing him — mostly.',
    replay: [
      { street: 'PRE', segments: [{ text: 'HJ raises to $6' }, { text: 'Seat 3 (BTN) calls' }] },
      { street: 'FLOP', board: 'T♣ 6♥ 2♦', segments: [{ text: 'HJ bets $9' }, { text: 'Seat 3 calls' }] },
      { street: 'TURN', board: 'Q♦', segments: [{ text: 'HJ bets $25' }, { text: 'Seat 3 calls' }] },
      { street: 'RIVER', board: 'Q♠', segments: [{ text: 'HJ bets $80' }, { text: 'Seat 3 calls' }] },
    ],
    tell: 'Nine rivers seen is the tell before the hand even starts — then watch the sizes: $9, $25, $80, each one a louder question, each answered with the same flat call. The river pairs the turn card, the bet is nearly the pot, and none of it registers. Stations aren\'t reading you; they\'ve decided not to be moved, and price is not part of the decision.',
    whyNot: {
      'passive': 'The closest neighbor — but a passive player\'s calls shrink from the $80 river. Nine rivers a session is not "plays carefully and calls sometimes"; it is a policy.',
      'loose': 'Loose is about the cards he arrives with. This diagnosis is about what happens after: a loose rec\'s wide range still folds when the board pairs and the bet triples.',
      'tight': 'A tight player is not on nine rivers a night from the wrong side of the bet. The context line alone retires this one.',
    },
  }),

  mkObservation({
    id: 'ob_014',
    difficulty: 'intermediate',
    answer: 'nit',
    distractors: ['tight', 'passive', 'aggressive'],
    context: 'Seat 3 has open-raised exactly twice in three hours. Both times, the table folded and he flashed a big pair anyway — as if to apologize.',
    replay: [
      { street: 'PRE', segments: [
        { text: 'Seat 3 (UTG) raises to $6' },
        { text: 'MP 3-bets to $20' },
        { text: 'action folds back' },
        { text: 'Seat 3 4-bets to $55 without a pause' },
      ] },
    ],
    tell: 'Two opens in three hours is a range you can count on one hand — and when the 3-bet came, there was no decision to make, because a range that small doesn\'t contain decisions. The instant 4-bet from the session\'s tightest seat is the least bluff-like action in poker. The frequency told you the range; the speed told you there was nothing marginal in it.',
    whyNot: {
      'tight': 'A tight recreational opens more than twice in three hours, and his 4-bets include hands that have to think first — the big ace, the medium pair. The zero-hesitation 4-bet on top of that entry frequency is the stricter religion.',
      'passive': 'Passive players don\'t 4-bet — pressure is not in the vocabulary. Two raises and a re-raise in one hand disqualifies it, however quiet the seat has been.',
      'aggressive': 'An aggressive regular generates this action with a range, plural. The context line is the refutation: regs don\'t sit on their hands for three hours waiting for aces.',
    },
  }),

  mkObservation({
    id: 'ob_015',
    difficulty: 'intermediate',
    answer: 'tight',
    distractors: ['nit', 'passive', 'loose'],
    context: 'Seat 3 plays maybe two hands an orbit, and plays them straightforwardly. This is his first open in a while.',
    replay: [
      { street: 'PRE', segments: [
        { text: 'Seat 3 (CO) raises to $6' },
        { text: 'BTN 3-bets to $20' },
        { text: 'blinds fold' },
        { text: 'Seat 3 thinks, then calls' },
      ] },
      { street: 'FLOP', board: 'K♠ 7♣ 2♥', segments: [{ text: 'Seat 3 checks' }, { text: 'BTN bets $22' }, { text: 'Seat 3 folds' }] },
    ],
    tell: 'The 3-bet call is the hinge: a genuinely narrow player still has hands worth continuing with — the queens, the ace-king — and position or price can talk him into seeing a flop with them. Then the flop missed, and the discipline showed: no float, no fight, done. Selective entry, honest continuation, clean exit — that is tight, working as intended.',
    whyNot: {
      'nit': 'A nit\'s continuing range against a 3-bet is 4-bet-or-fold — there is nothing in it that calls to "see what happens." The flat call is the tell that his range has a middle.',
      'passive': 'The fold ends it — but the open started it. Passive players rarely arrive in pots by raising; the shape of this hand is initiative, then discipline, which is a different animal.',
      'loose': 'Two hands an orbit is the opposite of loose before any street is dealt. The context line does the work here.',
    },
  }),

  mkObservation({
    id: 'ob_016',
    difficulty: 'intermediate',
    answer: 'maniac',
    distractors: ['aggressive', 'loose', 'tight'],
    context: 'Four players to the flop. The two callers in the middle have not folded a river between them all night.',
    replay: [
      { street: 'PRE', segments: [{ text: 'UTG limps' }, { text: 'MP limps' }, { text: 'Seat 3 (BTN) raises to $12' }, { text: 'both limpers call' }] },
      { street: 'FLOP', board: 'A♠ K♦ Q♦', segments: [{ text: 'checks to Seat 3' }, { text: 'Seat 3 bets $30' }, { text: 'both call' }] },
      { street: 'TURN', board: '4♣', segments: [{ text: 'checks to Seat 3' }, { text: 'Seat 3 moves all in for $150' }, { text: 'UTG calls' }, { text: 'MP calls' }] },
    ],
    tell: 'Look at the audience before you judge the performance: two players who haven\'t folded a river all night, on the one flop that smashes everyone\'s calling range, and Seat 3 chose maximum pressure into both of them. An aggressive player asks "who can fold?" before betting. This bet never asked. Pressure that ignores whether pressure can work is the maniac\'s whole engine.',
    whyNot: {
      'aggressive': 'The board and the opponents are the refutation: no thinking aggressor picks THIS flop, against THESE two, for a two-barrel jam. Regs perform for audiences that can fold; this room can\'t.',
      'loose': 'Loose players call too much — they don\'t manufacture $150 turn jams into a field. The verbs are all wrong.',
      'tight': 'A tight player holding the hand this line claims (aces up, a set, the straight) exists — but tight players bet it in sizes that keep the callers in. The overjam into two stations is money-repellent, and tight players don\'t repel money with value.',
    },
  }),

  mkObservation({
    id: 'ob_017',
    difficulty: 'intermediate',
    answer: 'aggressive',
    distractors: ['maniac', 'tight', 'passive'],
    context: 'Seat 3 wins a lot of pots that never see a showdown. Nobody at the table can remember what his cards looked like.',
    replay: [
      { street: 'PRE', segments: [{ text: 'Seat 3 (CO) raises to $6' }, { text: 'BB calls' }] },
      { street: 'FLOP', board: 'T♠ 6♣ 2♥', segments: [{ text: 'BB checks' }, { text: 'Seat 3 bets $4' }, { text: 'BB calls' }] },
      { street: 'TURN', board: '9♠', segments: [{ text: 'BB checks' }, { text: 'Seat 3 bets $11' }, { text: 'BB calls' }] },
      { street: 'RIVER', board: 'Q♥', segments: [{ text: 'BB checks' }, { text: 'Seat 3 bets $38' }] },
    ],
    tell: 'The sizes are doing the reading for you: a third of the pot on the static flop, half on the blank turn — cheap, mounting pressure while nothing changed — then the queen arrives, the one card that beats every ten the caller holds, and the bet triples into it. Each size is priced to its street\'s job. That is a player betting a PLAN, and the plan is the tell: sizing that tracks the board belongs to the aggressive regular.',
    whyNot: {
      'maniac': 'A maniac\'s sizes track his mood, not the board — big early, bigger later, with no relationship to the card that fell. Three sizes, each with a reason, is too much bookkeeping for chaos.',
      'tight': 'The win-without-showdown context is the wrong shape for tight: tight players show up with the goods and get called. A no-showdown lifestyle is built on bets like these, not on hands.',
      'passive': 'Three bets on three streets, escalating. There is no passive reading of this hand at any speed.',
    },
  }),

  mkObservation({
    id: 'ob_018',
    difficulty: 'intermediate',
    answer: 'loose',
    distractors: ['calling-station', 'passive', 'maniac'],
    context: 'Seat 3 has limped into eight of the last twelve pots. He does fold — just never before the flop.',
    replay: [
      { street: 'PRE', segments: [{ text: 'Seat 3 (HJ) limps' }, { text: 'CO raises to $8' }, { text: 'action folds' }, { text: 'Seat 3 calls' }] },
      { street: 'FLOP', board: 'A♥ 9♦ 5♣', segments: [{ text: 'Seat 3 checks' }, { text: 'CO bets $10' }, { text: 'Seat 3 folds' }] },
    ],
    tell: 'The door is wide open and the exit is fast: eight limps in twelve hands is a preflop range with no bouncer, but the moment the flop missed, the hand went in the muck at the first bet. Loose recreationals are curious, not stubborn — they pay to arrive, then play fit-or-fold once they\'re there. The frequency is the entry tell; the quick surrender is the confirmation.',
    whyNot: {
      'calling-station': 'A station\'s whole identity is the call he makes AFTER missing. One bet folding out a station on an ace-high flop doesn\'t happen — the flop fold is the dividing line between the two.',
      'passive': 'Passive players avoid pots; this player collects them. Eight limps in twelve hands is a volume habit, not a caution habit — the confusion dissolves at the context line.',
      'maniac': 'Limping eight times is the least maniac statistic in poker. Maniacs arrive raising or not at all.',
    },
  }),

  mkObservation({
    id: 'ob_019',
    difficulty: 'intermediate',
    answer: 'passive',
    distractors: ['calling-station', 'tight', 'aggressive'],
    context: 'Seat 3 has been at the table two hours and has not raised once — preflop or after.',
    replay: [
      { street: 'PRE', segments: [{ text: 'BTN raises to $6' }, { text: 'Seat 3 (BB) calls' }] },
      { street: 'FLOP', board: '8♠ 7♠ 6♦', segments: [{ text: 'Seat 3 checks' }, { text: 'BTN bets $8' }, { text: 'Seat 3 calls' }] },
      { street: 'TURN', board: '2♣', segments: [{ text: 'Seat 3 checks' }, { text: 'BTN bets $20' }, { text: 'Seat 3 calls' }] },
      { street: 'RIVER', board: 'K♦', segments: [{ text: 'Seat 3 checks' }, { text: 'BTN bets $40' }, { text: 'Seat 3 calls' }] },
    ],
    showdown: 'Seat 3 tables T♦9♦ — he flopped the straight, the best hand on every street, and never put in a raise.',
    tell: 'The station calls with nothing; the passive player fails to raise with EVERYTHING. He flopped the current nuts on a board screaming for protection, three chances to grow the pot came and went, and every one became a call. The tell isn\'t that he called — it\'s the raises that never happened. Two hours without one is the context; the flopped straight played like a bluff-catcher is the proof.',
    whyNot: {
      'calling-station': 'The station diagnosis needs weak hands calling big bets. This was the strongest hand at the table declining to bet itself — same verbs, opposite disease.',
      'tight': 'Entering with ten-nine suited from the blind is fine for tight — but tight players raise the nuts, because value is the entire reason they play. The missing raises rule it out.',
      'aggressive': 'Nothing here was aggressive at any point — the label with the least evidence in a four-street hand.',
    },
  }),

  mkObservation({
    id: 'ob_020',
    difficulty: 'intermediate',
    answer: 'maniac',
    distractors: ['aggressive', 'loose', 'calling-station'],
    context: 'Seat 3 has shown down three stone bluffs this hour. Each time, he re-bought the smile along with the chips.',
    replay: [
      { street: 'PRE', segments: [{ text: 'MP raises to $6' }, { text: 'Seat 3 (SB) 3-bets to $24' }, { text: 'MP calls' }] },
      { street: 'FLOP', board: 'K♥ K♦ 4♠', segments: [{ text: 'Seat 3 bets $30' }, { text: 'MP calls' }] },
      { street: 'TURN', board: '8♣', segments: [{ text: 'Seat 3 moves all in for $160' }] },
    ],
    tell: 'The paired king board is the trap he refuses to see: when a caller continues on King-King-four, his range is a king or a big pair — the two things that never fold. The jam answers a question nobody asked. Add the context — three shown bluffs this hour — and the pattern is frequency without feedback: a maniac doesn\'t adjust to being caught, because getting caught is part of the show.',
    whyNot: {
      'aggressive': 'An aggressive reg who has been caught three times TIGHTENS — the whole point of a table image is to cash it in, not to keep spending it. Bluffing more after being caught is anti-strategy.',
      'loose': 'Loose players show down bad calls, not stone bluffs. The three bluff showdowns in the context line are the wrong exhibit for the loose museum.',
      'calling-station': 'He 3-bet, led the flop, and jammed the turn. There is not one call in the hand.',
    },
  }),

  mkObservation({
    id: 'ob_021',
    difficulty: 'intermediate',
    answer: 'tight',
    distractors: ['aggressive', 'nit', 'passive'],
    context: 'When Seat 3 bets big, players fold and he shows the goods. His bets have been two-thirds pot all night, like a metronome.',
    replay: [
      { street: 'PRE', segments: [{ text: 'Seat 3 (HJ) raises to $6' }, { text: 'BTN calls' }] },
      { street: 'FLOP', board: 'K♦ Q♣ 4♥', segments: [{ text: 'Seat 3 bets $9' }, { text: 'BTN calls' }] },
      { street: 'TURN', board: '3♠', segments: [{ text: 'Seat 3 bets $22' }, { text: 'BTN calls' }] },
      { street: 'RIVER', board: 'Q♥', segments: [{ text: 'Seat 3 checks' }, { text: 'BTN checks back' }] },
    ],
    tell: 'Two confident streets at the metronome size, then the river pairs the queen — the exact card that turns his one-pair hands into the second-best hand — and the metronome stops. Tight aggression has a ceiling: it bets what it can value, and the moment the board outgrows the hand, it stops paying. The bet NOT made on the paired river is the read.',
    whyNot: {
      'aggressive': 'That river is an aggressive reg\'s favorite card to bet — the queen scares the caller\'s kings-and-draws range, and the check surrenders exactly the pressure a reg would apply. The stop is the wrong verb for the reg.',
      'nit': 'A nit didn\'t open this often or barrel this willingly all night. The metronome of two-thirds-pot value bets is a wider, healthier game than the nit plays.',
      'passive': 'He raised preflop and bet two streets unprompted. The river check is discipline at the end of an aggressive line, not a passive hand.',
    },
  }),

  mkObservation({
    id: 'ob_022',
    difficulty: 'intermediate',
    answer: 'loose',
    distractors: ['passive', 'calling-station', 'maniac'],
    context: 'Seat 3 is in a lot of pots and cheerful about all of them. His stack drifts down, then spikes, then drifts again.',
    replay: [
      { street: 'PRE', segments: [{ text: 'UTG raises to $6' }, { text: 'Seat 3 (BTN) calls' }, { text: 'BB calls' }] },
      { street: 'FLOP', board: 'J♣ 8♥ 3♦', segments: [{ text: 'checks to UTG' }, { text: 'UTG bets $12' }, { text: 'BB folds' }, { text: 'Seat 3 calls' }] },
      { street: 'TURN', board: '4♦', segments: [{ text: 'UTG bets $30' }, { text: 'Seat 3 calls' }] },
      { street: 'RIVER', board: '8♦', segments: [{ text: 'UTG checks' }, { text: 'Seat 3 checks back' }] },
    ],
    showdown: 'Seat 3 tables J♠8♠ — flopped top two pair, rivered a full house... and never raised, because he was never sure.',
    tell: 'The cards are the tell: jack-eight suited, cold-calling an under-the-gun raise on the button. That hand in that spot is the loose recreational\'s membership card — pretty, connected, and nowhere near the raising range it ran into. Note what he is NOT: the calls all had a real piece (top two!), so this is not a station; the passivity came from uncertainty, not policy. Loose is a range disease first — the postflop symptoms vary.',
    whyNot: {
      'passive': 'Genuinely close — the missing raises are passive-shaped. But the diagnosis starts a street earlier: passive describes verbs, and this is about the CARDS. Jack-eight suited against a UTG raise is an entry no discipline explains; the range is the primary symptom.',
      'calling-station': 'Every call in this hand had top two pair or better behind it. Stations call without the goods; calling WITH the goods is just poker, played timidly.',
      'maniac': 'He never raised once, with the second nuts at the end. The maniac reading has no evidence anywhere in the hand.',
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
