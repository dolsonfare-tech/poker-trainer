// ─── helpers ─────────────────────────────────────────────────────────────────

const SUIT_COLOR = { '♠': 'black', '♣': 'black', '♥': 'red', '♦': 'red' };

/** Build a hand array from [rank, suit] pairs. Color is derived automatically. */
const mkHand = (...pairs) =>
  pairs.map(([r, s]) => ({ r, s, c: SUIT_COLOR[s] }));

/**
 * Build a 6-seat positions array.
 * `seats` is an object keyed by 0-based seat index (0=UTG … 5=BB).
 * Any seat not listed defaults to folded.
 * Default labels: UTG, HJ, CO, BTN, SB, BB — override by passing `label`.
 */
const DEFAULT_LABELS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const mkPositions = (seats) =>
  DEFAULT_LABELS.map((defaultLabel, i) =>
    seats[i]
      ? { label: seats[i].label ?? defaultLabel, action: seats[i].action, state: seats[i].state }
      : { label: defaultLabel, action: 'Folds', state: 'folded' }
  );

/**
 * Assemble a full scenario from a compact definition.
 *
 * `choices` is an array of:
 *   {
 *     val:   string,   // key used in grading, feedback, options.val — must match `correct`
 *     label: string,   // button label shown to user
 *     icon:  string,   // emoji
 *     cls:   string,   // CSS class ('fold' | 'call' | 'raise')
 *     grade: 'correct' | 'partial' | 'incorrect',
 *     title: string,   // grading title shown after answer
 *     emoji: string,   // grading emoji
 *     fb:    string,   // feedback text for this grade bucket
 *   }
 *
 * `correct` must exactly match one `val` in `choices`.
 * Feedback is grade-level (correct/partial/incorrect), not per-val.
 * Where two choices share a grade, last-write wins — consistent with original file.
 */
const mkScenario = ({ choices, ...rest }) => {
  if (!choices.find(c => c.val === rest.correct))
    console.warn(`Scenario ${rest.id}: correct '${rest.correct}' not found in choices`);

  const options  = choices.map(({ val, label, icon, cls }) => ({ label, icon, cls, val }));
  const grading  = Object.fromEntries(
    choices.map(({ val, grade: g, title, emoji }) => [val, { g, title, emoji }])
  );
  const feedback = Object.fromEntries(
    choices.map(({ grade, fb }) => [grade, fb])
  );
  if (!VILLAIN_LABELS[rest.villain?.type])
    console.warn(`Scenario ${rest.id}: unknown villain type '${rest.villain?.type}'`);
  if (!SKILL_TAGS[rest.skill])
    console.warn(`Scenario ${rest.id}: unknown skill '${rest.skill}'`);
  const tag = SKILL_TAGS[rest.skill];
  const villain = { ...rest.villain, label: VILLAIN_LABELS[rest.villain?.type] };
  return { options, grading, feedback, ...rest, tag, villain };
};
// ─── Villain label lookup ─────────────────────────────────────────────────

// Exported so the VillainGuide derives its archetype list from the same map
// the dealer uses — the guide can never drift from what the game deals
// (same pattern as skills/schemas living in constants.js).
export const VILLAIN_LABELS = {
  'aggressive':      'Aggressive Regular',
  'passive':         'Passive Player',
  'tight':           'Tight Recreational',
  'loose':           'Loose Recreational',
  'calling-station': 'Calling Station',
  'maniac':          'Maniac',
  'nit':             'Tight Nit',
  'unknown':         'Unknown',
};

// ─── Skill tag lookup ─────────────────────────────────────────────────────

const SKILL_TAGS = {
  'preflop':   'Preflop Hand Selection',
  'position':  'Position Awareness',
  'aggression':'Aggression & Bluffing',
  'betsize':   'Bet Sizing',
  'bluffing':  'Bluff Frequency',
  'potodds':   'Pot Odds / Calling',
  'reads':     'Reading Betting Patterns',
  'opponent':  'Opponent Modeling',
};



// ─── scenarios ───────────────────────────────────────────────────────────────

const SCENARIOS = [

  // ── Original 8 Scenarios ──────────────────────────────────────────────────

  mkScenario({
    id: 1,
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Opens wide, 3-bets frequently, applies pressure on all streets',
    },
    positions: mkPositions({
      2: { label: 'CO',       action: 'Raises $6', state: 'active' },
      5: { label: 'BB (You)', action: '???',        state: 'hero'   },
    }),
    hand: mkHand(['J','♥'], ['8','♥']),
    board: null,
    pot: '$9',
    toCall: '$4 more',
    body: "6-player cash game, $1/$2 blinds. You're in the Big Blind with J♥8♥. The Cutoff is an aggressive regular who opens wide and applies pressure on all streets. He raises to $6. Everyone else folds to you.",
    question: 'What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Too Tight Here', emoji: '❌',
        fb: "Folding J8 suited in the BB against a wide opener is leaving money on the table. You're getting better than 2:1 to close the action and the hand has real playability — suited connectors thrive in exactly these spots.",
      },
      {
        val: 'call', label: 'Call $4 more', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Well Played', emoji: '✅',
        fb: "J8 suited in the BB is a clear defend against an aggressive regular who opens wide. You're getting great odds and the hand plays well postflop — connected, suited, and hard to read.",
      },
      {
        val: 'raise', label: '3-Bet to $20', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Aggressive, But Risky', emoji: '⚠️',
        fb: "3-betting J8s against an aggressive regular who 3-bets back frequently puts you in a tough spot. The hand has value, but it's better used as a call and outplay postflop than as a 3-bet bluff.",
      },
    ],
  }),

  mkScenario({
    id: 2,
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Calls too wide preflop and postflop, rarely folds to aggression, does not bluff',
    },
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',    state: 'hero'   },
      4: { label: 'SB',        action: 'Active', state: 'active' },
      5: { label: 'BB',        action: 'Active', state: 'active' },
    }),
    hand: mkHand(['A','♠'], ['7','♦']),
    board: null,
    pot: '$3',
    toCall: null,
    body: "You're on the Button in a 6-max game. Everyone folds to you. You hold A♠7♦. The Small Blind is a calling station who plays too many hands and rarely folds. The Big Blind is a solid regular.",
    question: 'What do you do from the Button?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Way Too Tight', emoji: '❌',
        fb: "Folding A7 offsuit on the button with two players left is far too tight. You have position, a decent hand, and a calling station in the blinds who will pay you off when you connect.",
      },
      {
        val: 'call', label: 'Limp ($2)', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Limping Gives Up Edge', emoji: '⚠️',
        fb: "Limping with A7 offsuit on the button surrenders the initiative and lets the blinds see a cheap flop. Against a calling station you want to build a pot with your stronger hands, not sneak in cheaply.",
      },
      {
        val: 'raise', label: 'Raise to $5', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Perfect Button Play', emoji: '✅',
        fb: "A7 offsuit on the button is a standard open. You have position for the whole hand, and the calling station in the SB means you'll get paid when you hit — they won't fold a worse ace.",
      },
    ],
  }),

  mkScenario({
    id: 3,
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Bets for value only, rarely bluffs, folds to large raises when holding marginal hands',
    },
    positions: mkPositions({
      3: { label: 'BTN (PP)', action: 'Bets $15', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked',  state: 'hero'   },
    }),
    hand: mkHand(['K','♣'], ['Q','♦']),
    board: ['A♠', 'J♥', '3♦'],
    pot: '$40',
    toCall: '$15',
    body: "Heads-up on the flop: A♠ J♥ 3♦. Pot is $40. You hold K♣Q♦ — a gutshot straight draw with two overcards. You checked. The villain is a passive regular who bets when he has it — this bet likely means a strong hand.",
    question: "You're getting 3.6:1 pot odds with 4 clean outs to the nut straight. What's your play?",
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding Equity Left Behind', emoji: '❌',
        fb: "You have 4 clean outs to the nut straight and you're getting 3.6:1 with real implied odds — folding gives up too much. Against a passive player who isn't likely to barrel future streets, this is a cheap look at a card that wins you his stack.",
      },
      {
        val: 'call', label: 'Call $15', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Solid Pot Odds Decision', emoji: '✅',
        fb: "Calling is right — 4 clean outs to the nut straight at 3.6:1, with implied odds when the ten hits. Be careful counting your K and Q as outs: against the strong hand his bet represents, pairing them often makes the second-best hand. A passive regular won't fold to a raise, so take the good price.",
      },
      {
        val: 'raise', label: 'Check-Raise to $45', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Bold Bluff vs Wrong Villain', emoji: '⚠️',
        fb: "Check-raising a passive player who bets for value is expensive. He's not folding top pair or two pair to your raise — you're turning a profitable call into a costly bluff against the wrong opponent.",
      },
    ],
  }),

  mkScenario({
    id: 4,
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'Only plays premium hands, folds to any aggression without top pair or better, almost never bluffs',
    },
    positions: mkPositions({
      0: { label: 'UTG (Nit)', action: 'Raises $6', state: 'active' },
      3: { label: 'BTN (You)', action: '???',        state: 'hero'   },
    }),
    hand: mkHand(['J','♦'], ['J','♣']),
    board: null,
    pot: '$9',
    toCall: '$6',
    body: "UTG raises to $6. This player is a well-known nit — he has been sitting for 3 hours and this is only his second raise. He plays exclusively premium hands from early position. You're on the Button with J♦J♣.",
    question: 'The nit raises UTG. What do you do with pocket Jacks?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Too Much Equity to Fold', emoji: '❌',
        fb: "JJ against a nit still has plenty of equity. You're not dominated preflop — just call, keep the pot controlled, and fold if the board comes A, K, or Q and he continues firing.",
      },
      {
        val: 'call', label: 'Call $6', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Smart Play vs a Nit', emoji: '✅',
        fb: "JJ is too strong to fold but the nit's UTG range — AA, KK, QQ, AK — dominates you badly when an overcard hits. Calling keeps the pot small and lets you fold cleanly on A, K, or Q boards.",
      },
      {
        val: 'raise', label: '3-Bet to $20', icon: '⚡', cls: 'raise',
        grade: 'partial', title: '3-Bet Sets Up a Tough Spot', emoji: '⚠️',
        fb: "3-betting a nit UTG with JJ puts you in a nightmare spot. He's 4-betting AA/KK every time and calling with QQ/AK — you're flipping at best and crushed at worst, then out of position postflop.",
      },
    ],
  }),

  mkScenario({
    id: 5,
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Calls down with any pair or draw, never folds to aggression, does not respond to bluffs',
    },
    positions: mkPositions({
      2: { label: 'CO (You)', action: '???',        state: 'hero'   },
      5: { label: 'BB (CS)',  action: 'Called $6', state: 'active' },
    }),
    hand: mkHand(['A','♥'], ['K','♥']),
    board: ['A♣', '7♦', '2♠'],
    pot: '$15',
    toCall: null,
    body: "You raised to $6 preflop with A♥K♥. The Big Blind — a calling station who never folds — called. Flop comes A♣ 7♦ 2♠. You flopped top pair top kicker. The BB checks to you.",
    question: 'You have top pair top kicker vs a calling station. What do you do?',
    correct: 'bet_large',
    choices: [
      {
        val: 'check', label: 'Check Behind', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Never Slow Play a Station', emoji: '❌',
        fb: "Checking top pair top kicker against a calling station is a major leak. They will call any bet with any piece of this board — you need to build the pot now while you're comfortably ahead.",
      },
      {
        val: 'bet_small', label: 'Bet $8 (small)', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Bet More — They Always Call', emoji: '⚠️',
        fb: "A small bet works but you're underselling your hand. Calling stations don't fold to any size, so a pot bet extracts the same call at twice the price. Always size up against players who won't fold.",
      },
      {
        val: 'bet_large', label: 'Bet $15 (pot)', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Max Value vs a Station', emoji: '✅',
        fb: "Pot-sized bet is correct here. A calling station will call this with any pair, any ace, any draw — your job is to charge them the maximum for the privilege. Don't let them see free cards.",
      },
    ],
  }),

  mkScenario({
    id: 6,
    effectiveStacks: 200,
    tableContext: 'Caught bluffing three times this session.',
    skill: 'opponent',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: 'Raises and re-raises constantly, bluffs at very high frequency, hard to put on a hand',
    },
    positions: mkPositions({
      1: { label: 'HJ (You)',     action: 'Raised $6', state: 'hero'   },
      3: { label: 'BTN (Maniac)', action: '3-Bet $20', state: 'active' },
    }),
    hand: mkHand(['Q','♠'], ['Q','♥']),
    board: null,
    pot: '$29',
    toCall: '$14 more',
    body: "You raised to $6 from the HJ with Q♠Q♥. The Button — a maniac who 3-bets over 30% of the time — raises to $20. He's been caught bluffing three times this session alone.",
    question: 'A maniac 3-bets you. What do you do with pocket Queens?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Never Fold QQ to a Maniac', emoji: '❌',
        fb: "Folding QQ to a player who 3-bets 30% of hands is a serious mistake. His range is full of bluffs and weak hands — your queens are a massive favorite and you're surrendering a pot you should be building.",
      },
      {
        val: 'call', label: 'Call $14 more', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Calling Lets Him Bluff Again', emoji: '⚠️',
        fb: "Calling is fine but you're giving a maniac exactly what he wants — a chance to outplay you postflop with any two cards. 4-betting forces him to put in money as a big underdog or fold his air.",
      },
      {
        val: 'raise', label: '4-Bet to $55', icon: '⚡', cls: 'raise',
        grade: 'correct', title: '4-Bet and Extract Value', emoji: '✅',
        fb: "4-betting a maniac with QQ is exactly right. His 3-bet range is so wide that your queens are a massive favorite — re-raising denies him the chance to realize equity with garbage hands and builds a pot you're likely to win.",
      },
    ],
  }),

  mkScenario({
    id: 7,
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'Only continues postflop with strong made hands, folds to large bets on scary boards, never bluffs',
    },
    positions: mkPositions({
      2: { label: 'CO (You)',  action: 'Raised $6', state: 'hero'   },
      3: { label: 'BTN (Nit)', action: 'Called $6', state: 'active' },
    }),
    hand: mkHand(['9','♠'], ['8','♠']),
    board: ['K♠', '7♠', '2♥'],
    pot: '$15',
    toCall: null,
    body: "You raised CO with 9♠8♠ and the Nit called on the Button. Flop: K♠ 7♠ 2♥. You missed but picked up a flush draw. You're first to act. The nit only continues with strong hands — a King or better.",
    question: 'You have a flush draw on a King-high board vs a nit. What do you do?',
    correct: 'bet_small',
    choices: [
      {
        val: 'check', label: 'Check', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Give Up Too Early', emoji: '❌',
        fb: "Checking surrenders your fold equity entirely. A nit who missed this board has no reason to bluff — you need to bet to win the pot.",
      },
      {
        val: 'bet_small', label: 'Bet $8', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Semi-Bluff at the Right Price', emoji: '✅',
        fb: "Half-pot is correct here. A nit folds the same weak hands to $8 as to $15, so your fold equity is the same — but when called, you've paid less to see your flush draw on the turn. No reason to charge yourself more.",
      },
      {
        val: 'bet_large', label: 'Bet $15 (pot)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Too Much to Pay for a Draw', emoji: '⚠️',
        fb: "Betting is right, but pot-sized costs you more when called without improving your fold equity. A nit folds the same range to $8 — betting $15 just means you've invested more if you need to hit the flush on the turn.",
      },
    ],
  }),

  mkScenario({
    id: 8,
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Will call any bet size with any pair, draw, or gut shot — bluffing is completely ineffective',
    },
    positions: mkPositions({
      3: { label: 'BTN (You)', action: 'Raised $6', state: 'hero'   },
      5: { label: 'BB (CS)',   action: 'Called $6', state: 'active' },
    }),
    hand: mkHand(['7','♣'], ['6','♣']),
    board: ['K♥', 'Q♦', '5♠'],
    pot: '$15',
    toCall: null,
    body: "You raised BTN with 7♣6♣. The calling station in the BB called. Flop: K♥ Q♦ 5♠. You completely missed — no pair, no draw. The calling station checks to you.",
    question: 'You have nothing vs a calling station who never folds. What do you do?',
    correct: 'check',
    choices: [
      {
        val: 'check', label: 'Check Behind', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Never Bluff a Station', emoji: '✅',
        fb: "Checking back is the only play here. You have no equity and no fold equity — a calling station will call with any king, any queen, and probably any pair. Take the free card and hope to pick up a draw on the turn.",
      },
      {
        val: 'bet_small', label: 'Bet $8', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Burning Money', emoji: '❌',
        fb: "Betting into a calling station with no hand and no draw is just donating chips. They cannot be bluffed — every bet you make without equity is a pure loss. Check and reassess on the turn.",
      },
      {
        val: 'bet_large', label: 'Bet $15 (pot)', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Expensive Lesson', emoji: '❌',
        fb: "This is one of the most expensive mistakes in poker — bluffing a player who never folds. You have no equity and no fold equity. Check it back, take the free card, and find a better spot.",
      },
    ],
  }),

  // ── Partner Scenarios (25) ────────────────────────────────────────────────

  mkScenario({
    id: 9,
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'Only opens top 10% of hands, rarely bluffs.',
    },
    positions: mkPositions({
      2: { label: 'CO',        action: 'Raises $6', state: 'active' },
      3: { label: 'BTN (You)', action: '???',       state: 'hero'   },
    }),
    hand: mkHand(['A','♠'], ['J','♦']),
    board: null,
    pot: '$9',
    toCall: '$6',
    body: 'CO tight nit raises to $6. Folds to you on BTN.',
    question: 'AJ offsuit on BTN vs a tight nit CO raise. What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Too Tight Here', emoji: '❌',
        fb: "AJ offsuit on the button is a comfortable call against any open. You have position, a decent hand, and the nit's range is capped enough that you can outplay him postflop on ace-high boards.",
      },
      {
        val: 'call', label: 'Call $6', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Well Played', emoji: '✅',
        fb: "AJ offsuit is strong enough to call a nit's CO open but not strong enough to 3-bet for value — his continuing range after a 3-bet is AK, AQ, and big pairs that all crush you. Call and play your position.",
      },
      {
        val: 'raise', label: '3-Bet to $20', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Ambitious vs a Nit', emoji: '⚠️',
        fb: "3-betting AJ offsuit into a nit's CO range is risky. He folds his weak opens but 4-bets or calls with AK, AQ, and big pairs — hands that dominate you badly. The hand plays better as a call.",
      },
    ],
  }),

  mkScenario({
    id: 10,
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Calls everything, rarely raises, limped wide here.',
    },
    positions: mkPositions({
      0: { label: 'UTG',      action: 'Limps',     state: 'active' },
      2: { label: 'CO',       action: 'Raises $8', state: 'active' },
      5: { label: 'BB (You)', action: '???',       state: 'hero'   },
    }),
    hand: mkHand(['7','♥'], ['7','♣']),
    board: null,
    pot: '$13',
    toCall: '$6',
    body: 'UTG calling station limps. CO tight regular raises to $8. BTN folds. SB folds. You are in BB.',
    question: '77 in BB. CO raised to $8 and UTG calling station will likely call. What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Tossing Implied Odds', emoji: '❌',
        fb: "Folding 77 for 6 more with a calling station already in the pot is a clear mistake. You have great implied odds — the station will pay you off handsomely when you hit your set.",
      },
      {
        val: 'call', label: 'Call $6', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Smart Set Mine', emoji: '✅',
        fb: "Calling with 77 multiway is textbook set-mining. You're getting good odds, the calling station will inflate the pot when you hit, and small pairs play terribly in 3-bet pots out of position.",
      },
      {
        val: 'raise', label: '3-Bet to $28', icon: '⚡', cls: 'raise',
        grade: 'partial', title: '3-Bet Bloats Pot', emoji: '⚠️',
        fb: "3-betting 77 bloats the pot with a hand that wants to flop a set cheaply. You'll often face a call from CO and the station, then be out of position with a hand that misses most flops.",
      },
    ],
  }),

  mkScenario({
    id: 11,
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: '3-bets wide from BTN, folds to 4-bets frequently.',
    },
    positions: mkPositions({
      2: { label: 'CO (You)', action: '???',    state: 'hero'   },
      3: { label: 'BTN',      action: 'Active', state: 'active' },
    }),
    hand: mkHand(['K','♠'], ['Q','♠']),
    board: null,
    pot: '$3',
    toCall: null,
    body: 'Folds to you in CO. BTN is an aggressive regular.',
    question: 'K♠Q♠ in CO with an aggressive regular behind on BTN. What do you do?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'K♠Q♠ is Too Good to Fold', emoji: '❌',
        fb: "Folding K♠Q♠ CO is a significant error. It's in the top 10% of hands and plays well in 3-bet pots. An aggressive BTN should make you want to open more, not less — you have a hand to fight back with.",
      },
      {
        val: 'raise', label: 'Open raise to $6', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Open and Re-evaluate', emoji: '✅',
        fb: "K♠Q♠ is a mandatory open from CO. If the aggressive regular 3-bets wide and folds to 4-bets, you actually have a great 4-bet candidate — K♠Q♠ plays well as both a value hand and a bluff.",
      },
      {
        val: 'limp', label: 'Limp', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Never Limp from CO', emoji: '❌',
        fb: "Limping K♠Q♠ from CO hands the initiative to the aggressive BTN for free. He'll iso-raise you constantly and you'll be out of position with a hand strong enough to fight back. Always open this hand.",
      },
    ],
  }),

  mkScenario({
    id: 12,
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'Tight recs defend blinds too narrow — they fold to steals far too often.',
    },
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',    state: 'hero'   },
      4: { label: 'SB',        action: 'Active', state: 'active' },
      5: { label: 'BB',        action: 'Active', state: 'active' },
    }),
    hand: mkHand(['K','♦'], ['9','♦']),
    board: null,
    pot: '$3',
    toCall: null,
    body: 'Folds to you on BTN. SB and BB are both tight recreational players who defend their blinds too narrow.',
    question: 'K♦9♦ on BTN, folded to you, tight recreationals in the blinds. What do you do?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Too Tight on the Button', emoji: '❌',
        fb: "Both extremes miss this spot. K9s on the Button against two tight recreationals is a standard, profitable steal — folding surrenders it, and open-shoving risks your entire stack to win $3. Raise a normal size: they fold too often, and when called you're in position with a playable hand.",
      },
      {
        val: 'shove', label: 'Shove all-in', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Risking It All to Win $3', emoji: '❌',
        fb: "Both extremes miss this spot. K9s on the Button against two tight recreationals is a standard, profitable steal — folding surrenders it, and open-shoving risks your entire stack to win $3. Raise a normal size: they fold too often, and when called you're in position with a playable hand.",
      },
      {
        val: 'raise', label: 'Raise to $6', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Standard Button Steal', emoji: '✅',
        fb: "K9s on the Button is a clear open, and tight blinds who defend too narrow make it even more profitable. You win the blinds outright most of the time, and when called you have position and a hand that flops well. No need to risk more than a normal raise.",
      },
    ],
  }),

  mkScenario({
    id: 13,
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Checks and calls, rarely raises, almost never bluffs.',
    },
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',    state: 'hero'   },
      5: { label: 'BB',        action: 'Active', state: 'active' },
    }),
    hand: mkHand(['T','♣'], ['9','♣']),
    board: ['J♥', '8♦', '3♠'],
    pot: '$22',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: "you raise", you: true }, { text: "BB calls" }] },
      { street: 'FLOP', segments: [{ text: "BB checks" }] },
    ],
    body: 'You raised preflop. BB passive player called. Flop J♥8♦3♠. BB checks to you.',
    question: "T♣9♣ on J83 rainbow — you have an open-ended straight draw. In position. Passive BB checks. What do you do?",
    correct: 'bet_medium',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Leaving Fold Equity Behind', emoji: '⚠️',
        fb: "Checking back surrenders fold equity against a passive player who will check-call with weak pairs and draws. You have a strong semi-bluff hand — use it. The 2/3 bet wins the pot outright often enough to be profitable.",
      },
      {
        val: 'bet_medium', label: 'Bet $14 (2/3 pot)', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Semi-Bluff in Position', emoji: '✅',
        fb: "2/3 pot is the perfect size here — enough to fold out his weak holdings while keeping the pot manageable if called. You have 8 outs to the nuts and position, which means you can continue applying pressure on the turn.",
      },
      {
        val: 'bet_large', label: 'Bet $22 (pot)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Too Large for a Draw', emoji: '⚠️',
        fb: "Pot-sized bets on draws bloat the pot unnecessarily and make it harder to fold the turn if called. A 2/3 bet achieves the same fold equity at lower risk — size down and keep your options open.",
      },
    ],
  }),

  mkScenario({
    id: 14,
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: 'Bets and raises constantly, bluffs frequently, unpredictable.',
    },
    positions: mkPositions({
      4: { label: 'SB (You)', action: '???',    state: 'hero'   },
      5: { label: 'BB',       action: 'Active', state: 'active' },
    }),
    hand: mkHand(['A','♣'], ['Q','♦']),
    board: ['A♠', '7♦', '2♣'],
    pot: '$20',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: "you raise", you: true }, { text: "BB calls" }] },
      { street: 'FLOP', segments: [{ text: "you're first to act", you: true }] },
    ],
    body: "SB raised, BB maniac called. Flop A♠7♦2♣ rainbow. You're OOP with top pair.",
    question: 'AQ on A72 rainbow OOP vs maniac. What do you do?',
    correct: 'check',
    choices: [
      {
        val: 'bet', label: 'Bet $14', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Betting Into Maniac', emoji: '⚠️',
        fb: "Betting into a maniac isn't terrible but it gives up a key advantage. He'll raise wide and put you in uncomfortable spots. Check-calling or check-raising extracts more value from his bluffing tendencies.",
      },
      {
        val: 'check', label: 'Check — let him bluff', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Check to Induce Bluffs', emoji: '✅',
        fb: "Checking top pair OOP against a maniac is the highest EV line. He will bet his entire range into you — air, draws, weak pairs. Let him build the pot, then check-raise or call down depending on board texture.",
      },
      {
        val: 'bet_large', label: 'Bet $20 (pot)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Pot Bet Invites Bluff-Raise', emoji: '⚠️',
        fb: "Pot-betting a maniac OOP invites a bluff-raise you can't comfortably call or fold. Check instead — let him do the betting, then trap him with a check-raise or call down as the board develops.",
      },
    ],
  }),

  mkScenario({
    id: 15,
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'C-bets 75% of flops, barrels many turns — understands board texture.',
    },
    positions: mkPositions({
      3: { label: 'BTN',      action: 'Active', state: 'active' },
      5: { label: 'BB (You)', action: '???',    state: 'hero'   },
    }),
    hand: mkHand(['Q','♠'], ['J','♦']),
    board: ['Q♣', '8♦', '3♥'],
    pot: '$30',
    toCall: '$20',
    actionHistory: [
      { street: 'PRE', segments: [{ text: "BTN raises" }, { text: "you call", you: true }] },
      { street: 'FLOP', segments: [{ text: "you check", you: true }, { text: "BTN bets $20" }] },
    ],
    body: "BTN aggressive regular raised preflop. BB called. Flop Q♣8♦3♥. BB checks. BTN c-bets $20.",
    question: "QJ (top pair, weak kicker) OOP on Q83 rainbow vs aggressive regular's c-bet. Check-call, check-raise, or fold?",
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Top Pair is Not a Fold', emoji: '❌',
        fb: "Folding top pair to a c-bet from an aggressive regular who fires 75% of flops is a major over-fold. He's betting with his entire range here — call and re-evaluate once you see his turn action.",
      },
      {
        val: 'call', label: 'Check-call $20', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Call and Evaluate Turn', emoji: '✅',
        fb: "Check-calling is correct with QJ on Q83 OOP. You have top pair but a weak kicker — check-raising bloats the pot when you're beat by QK/QA and folds out his bluffs you beat anyway. Call and reassess the turn.",
      },
      {
        val: 'raise', label: 'Check-raise to $65', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Check-Raise Targets Bluffs', emoji: '⚠️',
        fb: "Check-raising is not bad in theory but against an aggressive regular who c-bets wide, you're likely folding out his bluffs and getting called by better kickers. The call is safer and keeps more hands in his range.",
      },
    ],
  }),

  mkScenario({
    id: 16,
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Never folds a pair, calls any bet size, never bluffs.',
    },
    positions: mkPositions({
      2: { label: 'CO (You)', action: '???',    state: 'hero'   },
      5: { label: 'BB',       action: 'Active', state: 'active' },
    }),
    hand: mkHand(['K','♥'], ['K','♦']),
    board: ['J♠', '7♣', '2♥'],
    pot: '$20',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: "you raise", you: true }, { text: "BB calls" }] },
      { street: 'FLOP', segments: [{ text: "BB checks" }] },
    ],
    body: 'CO raised preflop. BB calling station called. Flop J♠7♣2♥. BB checks.',
    question: 'KK on J72 rainbow. Calling station checks to you. What do you do?',
    correct: 'bet_large',
    choices: [
      {
        val: 'check', label: 'Check (slow play)', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Never Slow Play vs a Station', emoji: '❌',
        fb: "Slow playing KK against a calling station is leaving chips on the table. They will call any bet with any jack or any pair — there's nothing to fear from betting large on this dry board.",
      },
      {
        val: 'bet_small', label: 'Bet $10 (small)', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Leaves Value on the Table', emoji: '⚠️',
        fb: "A small bet works but undersells your hand. Calling stations don't adjust to bet size — they call because they have something, not because the price is right. Bet bigger and get paid more.",
      },
      {
        val: 'bet_large', label: 'Bet $18 (large)', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Max Value vs Station', emoji: '✅',
        fb: "Large bet is correct against a calling station — they'll call with any jack, any pair, any draw. Size up to extract maximum value. The only mistake with KK on this board is not betting big enough.",
      },
    ],
  }),

  mkScenario({
    id: 17,
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Donk-bets as a probe with weak top pairs, draws, and occasionally strong hands.',
    },
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',    state: 'hero'   },
      5: { label: 'BB',        action: 'Active', state: 'active' },
    }),
    hand: mkHand(['A','♦'], ['A','♠']),
    board: ['K♦', '9♠', '3♦'],
    pot: '$25',
    toCall: '$15',
    actionHistory: [
      { street: 'PRE', segments: [{ text: "you raise", you: true }, { text: "BB calls" }] },
      { street: 'FLOP', segments: [{ text: "BB leads $15" }] },
    ],
    body: "BTN raised preflop. BB aggressive regular called. Flop K♦9♠3♦. BB bets $15 (donk-bet).",
    question: "AA on K93 two-tone. Aggressive BB donk-bets $15. You're in position. What do you do?",
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'AA Never Folds Here', emoji: '❌',
        fb: "AA never folds to a donk-bet on K93. An aggressive regular is donking here with a wide range including draws and weak top pairs. You have the overpair — raise and find out where you stand.",
      },
      {
        val: 'call', label: 'Call $15', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Calling Gives Free Cards', emoji: '⚠️',
        fb: "Calling lets him see a free turn card with all his draws and weak kings. Against an aggressive player who donk-bets as a probe, raising clarifies your hand strength and puts him to an immediate decision.",
      },
      {
        val: 'raise', label: 'Raise to $45', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Raise to Deny Equity', emoji: '✅',
        fb: "Raising is correct. An aggressive regular donk-bets wide here — weak kings, draws, probe bets. You have the overpair and a flush draw on the board. Raise to protect your equity and deny his draws a free card.",
      },
    ],
  }),

  mkScenario({
    id: 18,
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'Only bets flops with top pair or better — rarely has draws in his range here.',
    },
    positions: mkPositions({
      3: { label: 'BTN',      action: 'Active', state: 'active' },
      4: { label: 'SB (You)', action: '???',    state: 'hero'   },
    }),
    hand: mkHand(['J','♥'], ['J','♠']),
    board: ['A♣', 'K♦', '7♠'],
    pot: '$40',
    toCall: '$25',
    actionHistory: [
      { street: 'PRE', segments: [{ text: "you raise", you: true }, { text: "BTN calls" }] },
      { street: 'FLOP', segments: [{ text: "you check", you: true }, { text: "BTN bets $25" }] },
    ],
    body: 'SB raised preflop, BTN tight nit called. Flop A♣K♦7♠ rainbow. SB checks. BTN bets $25.',
    question: 'JJ on AK7 rainbow OOP. Tight nit bets after your check. Fold, call, or check-raise?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: "Reading a Nit's Range", emoji: '✅',
        fb: "Folding is correct. A tight nit bets the flop on AK7 rainbow with a very narrow range — AK, AQ, KK, AA, A7 — all of which have JJ drawing nearly dead. This is a disciplined fold that good players make.",
      },
      {
        val: 'call', label: 'Call $25', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Calling with Almost No Equity', emoji: '⚠️',
        fb: "Calling with JJ on AK7 against a nit who only bets strong hands is burning money. You're drawing to 2 outs at best and he's not folding the turn. Take the information and fold.",
      },
      {
        val: 'raise', label: 'Check-raise to $80', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Bluffing Into a Nit', emoji: '❌',
        fb: "Check-raising a nit on AK7 is a bluff into a very strong range. He's not folding AK or a big pair here — you're turning your hand into a bluff with almost no equity. Fold and save your chips.",
      },
    ],
  }),

  mkScenario({
    id: 19,
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Plays too many hands, will call big bets with weak aces and any pair.',
    },
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',    state: 'hero'   },
      5: { label: 'BB',        action: 'Active', state: 'active' },
    }),
    hand: mkHand(['A','♠'], ['K','♣']),
    board: ['A♥', '6♣', '2♦'],
    pot: '$18',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: "you raise", you: true }, { text: "BB calls" }] },
      { street: 'FLOP', segments: [{ text: "BB checks" }] },
    ],
    body: 'BTN raised preflop. BB loose recreational called. Flop A♥6♣2♦. BB checks.',
    question: 'TPTK on A62 rainbow. Loose rec BB checks. What bet size maximizes value?',
    correct: 'bet_large',
    choices: [
      {
        val: 'check', label: 'Check (slow play)', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: "He's Not Slow Playing Against You", emoji: '❌',
        fb: "Slow playing TPTK against a loose recreational is a mistake. They'll happily call big bets with weak aces and second pairs — you're not protecting your hand with a slow play, you're just making less money.",
      },
      {
        val: 'bet_small', label: 'Bet $7 (small, keep him in)', icon: '📞', cls: 'call',
        grade: 'partial', title: 'He Calls Bigger — Bet More', emoji: '⚠️',
        fb: "Small bets against loose recreationals leave money behind. They're not folding to larger sizes — they call because they have something, not because the price is right. Bet $14 and get paid.",
      },
      {
        val: 'bet_large', label: 'Bet $14 (large)', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Correct Exploitative Size', emoji: '✅',
        fb: "Large bet is correct. Loose recreationals call big with weak aces, middle pairs, and draws. You don't need to keep him in — he's staying regardless. Maximize value while you're clearly ahead.",
      },
    ],
  }),

  mkScenario({
    id: 20,
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Calls medium c-bets but folds to large ones with air; raises light occasionally.',
    },
    positions: mkPositions({
      2: { label: 'CO (You)', action: '???',    state: 'hero'   },
      3: { label: 'BTN',      action: 'Active', state: 'active' },
    }),
    hand: mkHand(['9','♦'], ['8','♦']),
    board: ['T♠', '7♥', '2♣'],
    pot: '$20',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: "you raise", you: true }, { text: "BTN calls" }] },
      { street: 'FLOP', segments: [{ text: "you're first to act", you: true }] },
    ],
    body: 'You raised preflop from CO. BTN aggressive regular called. Flop T♠7♥2♣. You act first with an open-ended straight draw.',
    question: '9♦8♦ — open-ended straight draw on T72 rainbow. Aggressive BTN called preflop. What sizing for your semi-bluff c-bet?',
    correct: 'bet_large',
    choices: [
      {
        val: 'check', label: 'Check (give up)', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: "Don't Abandon 8 Outs", emoji: '❌',
        fb: "Checking with an open-ended straight draw out of position surrenders fold equity and gives a free card to a hand that might actually be ahead. Semi-bluff large and put him to a real decision.",
      },
      {
        val: 'bet_small', label: 'Bet $8 (small, see what happens)', icon: '📞', cls: 'call',
        grade: 'partial', title: "Too Small — He Floats Wide", emoji: '⚠️',
        fb: "A small bet into an aggressive regular with a draw is the worst of both worlds — he floats with his entire range and you haven't made any profit. Either check or bet big enough to have fold equity.",
      },
      {
        val: 'bet_large', label: 'Bet $16 (large, fold equity)', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Size for Fold Equity', emoji: '✅',
        fb: "Large c-bet is correct with a semi-bluff against an aggressive regular who floats small bets. Go big, represent top pair, and deny him the cheap float he wants. You win now or have equity when called.",
      },
    ],
  }),

  mkScenario({
    id: 21,
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Calls medium bets with top pair, check-folds to very large bets with marginal hands.',
    },
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',    state: 'hero'   },
      5: { label: 'BB',        action: 'Active', state: 'active' },
    }),
    hand: mkHand(['Q','♥'], ['Q','♦']),
    board: ['Q♠', '8♣', '3♦'],
    pot: '$50',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: "you raise", you: true }, { text: "BB calls" }] },
      { street: 'FLOP', segments: [{ text: "BB checks" }] },
    ],
    body: 'BTN raised preflop. BB passive player called. Flop Q♠8♣3♦. BB checks.',
    question: 'Top set on Q83 rainbow vs passive BB. What sizing extracts maximum value over multiple streets?',
    correct: 'bet_medium',
    choices: [
      {
        val: 'bet_large', label: 'Bet $40 (large, build now)', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Large May Fold His Medium Pairs', emoji: '⚠️',
        fb: "Large bets fold out the passive player's medium pairs and weak top pairs — exactly the hands you want to keep in. Size down so he calls three streets instead of folding on the first.",
      },
      {
        val: 'bet_medium', label: 'Bet $20 (medium)', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Medium Sizing Over 3 Streets', emoji: '✅',
        fb: "Medium sizing is the play. A passive player calls medium bets with top pair and check-folds to large ones — three streets of $20 gets you $60 more. A pot bet might fold out the hands paying you off.",
      },
      {
        val: 'check', label: 'Check (slow play)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Slow Play Risks Bad Turn Cards', emoji: '⚠️',
        fb: "Slow playing sets on wet-ish boards is dangerous. Turn an 8 or a flush draw and he'll fold anyway. Bet medium now, build the pot, and let him call three times with his worse queens and pairs.",
      },
    ],
  }),

  mkScenario({
    id: 22,
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Calls every flop bet, will not fold any pair or overcards.',
    },
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',    state: 'hero'   },
      5: { label: 'BB',        action: 'Active', state: 'active' },
    }),
    hand: mkHand(['K','♦'], ['Q','♣']),
    board: ['A♠', '8♥', '2♣'],
    pot: '$16',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: "you raise", you: true }, { text: "BB calls" }] },
      { street: 'FLOP', segments: [{ text: "BB checks" }] },
    ],
    body: 'BTN raised preflop. BB calling station called. Flop A♠8♥2♣ rainbow. BB checks.',
    question: 'KQ with no pair on A82. Calling station checks. What do you do?',
    correct: 'check',
    choices: [
      {
        val: 'bluff', label: 'Bet $10 (bluff)', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Bluffing Never Works Here', emoji: '❌',
        fb: "Bluffing a calling station with any sizing is the same mistake at different price points. They cannot be bluffed — save your chips and check back to take a free card with your two overcards.",
      },
      {
        val: 'check', label: 'Check back', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Never Bluff a Calling Station', emoji: '✅',
        fb: "Checking back is correct. KQ has no equity on A82 and a calling station will not fold anything. Take the free card, hope to pick up a draw or hit a pair on the turn, and find a better spot to apply pressure.",
      },
      {
        val: 'bet_large', label: 'Bet $16 (pot, pressure)', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Burning Money', emoji: '❌',
        fb: "Pot-betting a calling station with no hand is one of the most expensive leaks in poker. Every chip you bet without equity is a pure loss. They are calling with ace-high, any pair, any draw. Check it back.",
      },
    ],
  }),

  mkScenario({
    id: 23,
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: "Folds to c-bets without a made hand, doesn't call without top pair or a flush.",
    },
    positions: mkPositions({
      2: { label: 'CO (Nit)',  action: 'Raises', state: 'active' },
      3: { label: 'BTN (You)', action: 'Called', state: 'hero'   },
    }),
    hand: mkHand(['5','♦'], ['4','♦']),
    board: ['A♠', 'K♠', 'Q♠'],
    pot: '$22',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: "CO raises" }, { text: "you call", you: true }] },
      { street: 'FLOP', segments: [{ text: "CO checks" }] },
    ],
    body: 'The tight nit raised from the CO, you called on the BTN with 5♦4♦. Flop A♠K♠Q♠ monotone — he skips his c-bet and checks.',
    question: '5♦4♦ on A♠K♠Q♠ monotone board. Tight nit BTN checks. Bluff or check?',
    correct: 'bluff',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Free Card but Missed EV', emoji: '⚠️',
        fb: "Checking gives a free card on a board where your bluff had real merit. A nit who checks AKQ monotone is scared — a 2/3 pot bet picks this up most of the time. Don't surrender free equity.",
      },
      {
        val: 'bluff', label: 'Bet $15 (bluff the scary board)', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Represent the Flush', emoji: '✅',
        fb: "Betting 2/3 pot is the play. This board is terrifying and a tight nit checks hands that can't continue here. Your bet represents the flush or a strong made hand — he folds everything without a spade.",
      },
      {
        val: 'bet_large', label: 'Bet $22 (pot)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Too Much — Just 2/3 Works', emoji: '⚠️',
        fb: "Pot-sized bet is slightly too large on this board. A 2/3 bet accomplishes the same fold against a nit while risking fewer chips if he has a spade. Size down and get the same result more efficiently.",
      },
    ],
  }),

  mkScenario({
    id: 24,
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Calls c-bets with wide range, check-raises draws and strong hands, rarely gives up.',
    },
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',    state: 'hero'   },
      5: { label: 'BB',        action: 'Active', state: 'active' },
    }),
    hand: mkHand(['A','♦'], ['5','♦']),
    board: ['K♠', '9♦', '3♦'],
    pot: '$40',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: "BB raises" }, { text: "you 3-bet", you: true }, { text: "BB calls" }] },
      { street: 'FLOP', segments: [{ text: "BB checks" }] },
    ],
    body: 'BTN 3-bet preflop. BB aggressive regular called. Flop K♠9♦3♦. BB checks.',
    question: 'A♦5♦ — nut flush draw + overcard on K93 two-diamond. As the 3-bettor, aggressive BB checks. C-bet or check?',
    correct: 'semi_bluff',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Missing Fold Equity with Strong Draw', emoji: '⚠️',
        fb: "Checking back gives up fold equity with a hand that has real equity when called. As the 3-bettor you should be c-betting on this board — check back only dilutes your range and lets him realize equity for free.",
      },
      {
        val: 'semi_bluff', label: 'Bet $22 (half pot — semi-bluff)', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Semi-Bluff the Nut Draw', emoji: '✅',
        fb: "Half-pot semi-bluff is correct. You have the nut flush draw, an overcard, and the 3-bet initiative. A half-pot bet folds out his weak holdings, and when called you have 9 outs to the nuts.",
      },
      {
        val: 'bet_large', label: 'Bet $40 (pot)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Pot Risks Check-Raise', emoji: '⚠️',
        fb: "Pot-sizing risks a check-raise from an aggressive regular who check-raises wide. Half-pot achieves the same fold and keeps the pot manageable if called — you can continue applying pressure on the turn.",
      },
    ],
  }),

  mkScenario({
    id: 25,
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Bets made hands, rarely bluffs — his bet almost always means a real hand.',
    },
    positions: mkPositions({
      3: { label: 'BTN',      action: 'Active', state: 'active' },
      5: { label: 'BB (You)', action: '???',    state: 'hero'   },
    }),
    hand: mkHand(['7','♥'], ['6','♥']),
    board: ['K♠', '5♦', '3♣'],
    pot: '$18',
    toCall: '$9',
    body: "BTN bets $9 into $18 pot on K♠5♦3♣. You're in BB with 7♥6♥ — a gutshot straight draw (needs a 4).",
    question: '7♥6♥ on K53 — gutshot (4 outs). Getting 3:1 pot odds ($9 to win $27). What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: '4 Outs With Strong Implied Odds', emoji: '❌',
        fb: "With 4 outs you're not getting the direct odds to fold — but against a passive player who pays off straights, the implied odds make this a profitable call. Don't fold a draw when the villain's tendencies make hitting it highly profitable.",
      },
      {
        val: 'call', label: 'Call $9', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Easy Call for the Draw', emoji: '✅',
        fb: "4 outs at 3:1 isn't enough on direct odds alone — you'd need closer to 4:1. But a passive player who bets made hands and pays off draws gives you the implied odds to justify the call. When you hit, you get paid. Note: when a 4 puts the straight on the board, passive villains slow down with one pair — but the implied odds from sets and two pair make this call profitable over time.",
      },
      {
        val: 'raise', label: 'Check-raise to $30', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Check-Raise Kills Implied Odds', emoji: '❌',
        fb: "Check-raising with 4 outs kills your implied odds entirely. A passive player who bets for value won't fold — you lose the very edge that makes this call profitable. Take the price and play for the implied odds.",
      },
    ],
  }),

  mkScenario({
    id: 26,
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Bets wide on this board — has draws, top pairs, and bluffs.',
    },
    positions: mkPositions({
      3: { label: 'BTN',      action: 'Active', state: 'active' },
      5: { label: 'BB (You)', action: '???',    state: 'hero'   },
    }),
    hand: mkHand(['Q','♦'], ['J','♦']),
    board: ['T♠', '9♣', '2♦'],
    pot: '$24',
    toCall: '$16',
    body: "BTN bets $16 into $24 pot on T♠9♣2♦. You're in BB with Q♦J♦ — OESD plus backdoor flush draw.",
    question: 'Q♦J♦ on T92 with OESD + backdoor flush draw (8 outs). Getting 2.5:1. Call, raise, or fold?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: '8 Outs Plus Fold Equity', emoji: '❌',
        fb: "Folding 8 outs getting 2.5:1 is a significant error. You have a real draw with fold equity available — this hand has enough equity to semi-raise, let alone call. Don't fold a strong draw to an aggressive regular who bets wide.",
      },
      {
        val: 'call', label: 'Call $16', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Calling Undersells Your Equity', emoji: '⚠️',
        fb: "Calling is not wrong but undersells your hand. Against an aggressive regular who bets wide, you have real fold equity here — calling throws that away entirely. Check-raising wins the pot immediately when he folds, and builds a bigger pot when he calls and you hit your draw. Calling leaves you out of position on every future street with no initiative and nothing gained.",
      },
      {
        val: 'raise', label: 'Check-raise to $55', icon: '⚡', cls: 'raise',
        grade: 'correct', title: "Semi-Raise — You're a Slight Favorite", emoji: '✅',
        fb: "With 8 outs (~32% by the river) plus fold equity against an aggressive regular who bets wide, check-raising is correct. You don't need coin-flip equity to justify a semi-raise — fold equity plus 32% when called is enough. Students often think semi-bluffs need 50% equity; the real bar is much lower when you have real fold equity.",
      },
    ],
  }),

  mkScenario({
    id: 27,
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'Never bets this board without a strong flush — J-high or better. His range here is essentially the top of the spade distribution.',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: '???',    state: 'hero'   },
      3: { label: 'BTN',      action: 'Active', state: 'active' },
    }),
    hand: mkHand(['8','♠'], ['7','♠']),
    board: ['A♠', 'K♠', 'Q♠'],
    pot: '$60',
    toCall: '$40',
    body: "CO vs BTN heads-up. Flop comes A♠K♠Q♠ — a monotone board. You hold 8♠7♠, giving you an 8-high flush. The BTN is a tight nit who bets $40 into the $60 pot.",
    question: '8-high flush on AKQ all spades. Tight nit bets $40. Getting 2.5:1. Call or fold?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: "Reading a Nit's Flush Range", emoji: '✅',
        fb: "Clear fold. A nit betting AKQ monotone has a J-high flush or better — your 8-high flush is almost never good. The pot odds are irrelevant when your outs are dead.",
      },
      {
        val: 'call', label: 'Call $40', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Made Hand, Dead Equity', emoji: '⚠️',
        fb: "Having a flush doesn't mean you're ahead. A nit only bets this board with a stronger flush — you're likely drawing dead to 2 outs at best. Fold and save the $40.",
      },
      {
        val: 'raise', label: 'Raise to $120', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Raising Into the Nuts', emoji: '❌',
        fb: "Raising an 8-high flush into a nit on a monotone ace-high board is lighting money on fire. He has you crushed and is not folding. This is the definition of dead equity.",
      },
    ],
  }),

  mkScenario({
    id: 28,
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Checks and calls every street — has never bet the river in this session.',
    },
    positions: mkPositions({
      4: { label: 'SB',        action: 'Active', state: 'active' },
      5: { label: 'BB (You)',  action: '???',    state: 'hero'   },
    }),
    hand: mkHand(['T','♠'], ['T','♦']),
    board: ['7♣', '5♦', '2♠', '3♦', 'J♥'],
    pot: '$20',
    toCall: '$14',
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'you raise', you: true }, { text: 'SB calls' }] },
      { street: 'FLOP', segments: [{ text: 'SB checks' }, { text: 'you check', you: true }] },
      { street: 'TURN', segments: [{ text: 'SB checks' }, { text: 'you check', you: true }] },
      { street: 'RIVER', segments: [{ text: 'SB bets $14' }] },
    ],
    body: 'BB raised preflop. SB passive player called. Flop 7♣5♦2♠. BB checks. SB checks. Turn is 3♦. SB checks. River J♥. SB suddenly bets $14.',
    question: 'TT on 7532J. Passive player who never bets the river suddenly fires $14 on the river. Call or fold?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Reading the Pattern', emoji: '✅',
        fb: "Folding is correct. A passive player who checks and calls all session and then bets the river for the first time almost always has the goods. His range is full of hands that beat you — rivered top pair with a Jack, a slowplayed set, or a turned straight with 4♠6♠. Trust the pattern.",
      },
      {
        val: 'call', label: 'Call $14', icon: '📞', cls: 'call',
        grade: 'partial', title: 'He Could Have Bluffed Once', emoji: '⚠️',
        fb: "Calling is defensible but the pattern here is clear. A player who has never bet the river suddenly betting is a major tell. His range on this river is heavily weighted toward strong hands — the fold has better EV.",
      },
      {
        val: 'raise', label: 'Raise to $45', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Never Raise Into This Spot', emoji: '❌',
        fb: "Raising into a passive player who just made his first river bet of the session is putting money in when you're very likely behind. He found the courage to bet because he has something strong — fold or call, never raise.",
      },
    ],
  }),

  mkScenario({
    id: 29,
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: 'Raises 60%+ of flops, almost never check-folds, fires multiple streets as bluffs.',
    },
    positions: mkPositions({
      2: { label: 'CO (You)', action: '???',    state: 'hero'   },
      3: { label: 'BTN',      action: 'Active', state: 'active' },
    }),
    hand: mkHand(['K','♠'], ['Q','♠']),
    board: ['K♥', '9♦', '4♣'],
    pot: '$22',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: "you raise", you: true }, { text: "BTN calls" }] },
      { street: 'FLOP', segments: [{ text: "you're first to act", you: true }] },
    ],
    body: 'You raised preflop from CO. BTN maniac called. Flop K♥9♦4♣. You act first with top pair.',
    question: 'KQ (top pair, 2nd kicker) on K94 rainbow. You act first vs a maniac BTN. Bet out or check to set up a check-raise?',
    correct: 'check_raise',
    choices: [
      {
        val: 'check', label: 'Check (let him bluff)', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Checking Once Is Good', emoji: '⚠️',
        fb: "Checking once is fine but you need a plan. If you check and call, you're not extracting full value. Check with intent to check-raise — that's what maximizes your EV against a player who bets too often.",
      },
      {
        val: 'bet', label: 'Bet $14 (2/3 pot)', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Betting Stops the Action', emoji: '⚠️',
        fb: "Betting out against a maniac shuts down his bluffing range. He only continues with better hands. Check instead, let him fire his air, then check-raise and get maximum value from a player who can't stop betting.",
      },
      {
        val: 'check_raise', label: 'Check, then check-raise if he bets', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Check-Raise to Stack Him', emoji: '✅',
        fb: "Check-raise is the highest EV line against a maniac. He raises 60% of flops — check to him, let him bet his air, then check-raise and build a massive pot. Betting out stops his bluffing range from putting money in.",
      },
    ],
  }),

  mkScenario({
    id: 30,
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Donk-bets this board with strong hands AND as a probe with medium holdings — hard to read.',
    },
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',    state: 'hero'   },
      4: { label: 'SB',        action: 'Active', state: 'active' },
    }),
    hand: mkHand(['A','♦'], ['K','♦']),
    board: ['A♠', 'J♣', '7♦'],
    pot: '$50',
    toCall: '$35',
    actionHistory: [
      { street: 'PRE', segments: [{ text: "you raise", you: true }, { text: "SB calls" }] },
      { street: 'FLOP', segments: [{ text: "SB leads $35" }] },
    ],
    body: "SB aggressive regular leads $35 on A♠J♣7♦ after calling BTN's preflop raise. BTN has TPTK.",
    question: 'TPTK (AK) on AJ7 rainbow. Aggressive SB donk-bets $35. Getting 2.4:1. Fold, call, or raise?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'TPTK is Too Strong to Fold', emoji: '❌',
        fb: "Folding TPTK on AJ7 to an aggressive regular is a massive over-fold. His donk-bet range here includes weak aces, draws, and probes — you're way ahead of much of his range. Call and see what he does on the turn.",
      },
      {
        val: 'call', label: 'Call $35', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Call and Gather More Info', emoji: '✅',
        fb: "Calling is correct. Against an aggressive regular who donk-bets wide, TPTK has plenty of equity — but raising risks bloating a pot against the part of his range that has you beat (AJ, 77). Call and re-evaluate the turn.",
      },
      {
        val: 'raise', label: 'Raise to $100', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Raising Bloats Pot vs Unknown', emoji: '⚠️',
        fb: "Raising TPTK against a polarized donk-bettor commits you against his strong hands while folding out his bluffs. Calling keeps all his weaker holdings in and lets you navigate future streets with more information.",
      },
    ],
  }),

  mkScenario({
    id: 31,
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'Only bets when he has top pair or better. Never bluffs on dry boards.',
    },
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',    state: 'hero'   },
      5: { label: 'BB',        action: 'Active', state: 'active' },
    }),
    hand: mkHand(['9','♣'], ['9','♠']),
    board: ['K♠', '8♦', '3♥'],
    pot: '$20',
    toCall: '$14',
    actionHistory: [
      { street: 'PRE', segments: [{ text: "you raise", you: true }, { text: "BB calls" }] },
      { street: 'FLOP', segments: [{ text: "BB leads $14" }] },
    ],
    body: 'BTN raised preflop. BB tight nit called. Flop K♠8♦3♥ — the nit leads $14 into you.',
    question: '99 on K83 rainbow. Tight nit leads into you. What do you do?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: "Nit's Range Destroys 99", emoji: '✅',
        fb: "Folding 99 is correct. A tight nit bets K83 rainbow only when he has a King — his range here is exactly KX. You have 2 outs to a set and are drawing nearly dead. Disciplined folds against nits save significant money.",
      },
      {
        val: 'call', label: 'Call $14', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Calling with 2 Outs', emoji: '⚠️',
        fb: "Calling with 99 on K83 against a nit who only bets with top pair is drawing to 2 outs. You need better than 20:1 pot odds to call profitably — you're getting less than 3:1. Fold and move on.",
      },
      {
        val: 'raise', label: 'Raise to $45', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: "Raising Into a Nit's Strength", emoji: '❌',
        fb: "Raising 99 into a nit's KX range on K83 is a pure bluff into a strong hand. He's not folding top pair — he'll call or re-raise, and you're drawing nearly dead. Fold and save the chips.",
      },
    ],
  }),

  mkScenario({
    id: 32,
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Donk-bets with any ace, any pair, any draw — will call any raise and never folds.',
    },
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises', state: 'hero'   },
      5: { label: 'BB (CS)',  action: 'Called', state: 'active' },
    }),
    hand: mkHand(['A','♠'], ['8','♠']),
    board: ['A♦', '9♣', '3♠'],
    pot: '$18',
    toCall: '$12',
    actionHistory: [
      { street: 'PRE', segments: [{ text: "you raise", you: true }, { text: "BB calls" }] },
      { street: 'FLOP', segments: [{ text: "BB leads $12" }] },
    ],
    body: "CO raised preflop. The calling station in the BB called. Flop A♦9♣3♠ — he leads $12 into you (donk-bet).",
    question: "Top pair (A8) vs calling station's donk-bet on A93. Raise or call?",
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'A8 is Strong Here', emoji: '❌',
        fb: "Folding top pair to a calling station's donk-bet is giving up a strong hand. His donk-betting range here is extremely wide — weak aces, pairs, draws. You're ahead of most of it. Raise and build the pot.",
      },
      {
        val: 'call', label: 'Call $12', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Calling Undersells Your Hand', emoji: '⚠️',
        fb: "Calling lets the station see a free turn card with all his draws and weaker aces. He will call a raise just as readily — raise to build the pot and charge his weaker holdings for the privilege of continuing.",
      },
      {
        val: 'raise', label: 'Raise to $40', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Build the Pot vs Station', emoji: '✅',
        fb: "Raising is correct. A calling station donk-bets with any ace, any pair, any draw — and will call your raise with all of them. Build the pot now while you're ahead with top pair, they're not folding.",
      },
    ],
  }),

  mkScenario({
    id: 33,
    effectiveStacks: 300, // deep — the $220 3-bet line commits ~$251; ~150bb spot
    skill: 'opponent',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: "Raises with top pair or better AND draws, gambles, doesn't fold two pair, bluffs occasionally.",
    },
    positions: mkPositions({
      3: { label: 'BTN',      action: 'Active', state: 'active' },
      4: { label: 'SB (You)', action: '???',    state: 'hero'   },
    }),
    hand: mkHand(['J','♠'], ['T','♠']),
    board: ['J♥', 'T♣', '4♦'],
    pot: '$55',
    toCall: '$55',
    actionHistory: [
      { street: 'PRE', segments: [{ text: "you raise", you: true }, { text: "BTN calls" }] },
      { street: 'FLOP', segments: [{ text: "you bet $25", you: true }, { text: "BTN raises to $80" }] },
    ],
    body: 'SB raised preflop. BTN loose recreational called. Flop J♥T♣4♦. SB bets $25. BTN raises to $80.',
    question: 'Two pair (JT on JT4). Loose rec raises your c-bet to $80. 3-bet or call?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'You Have Two Pair!', emoji: '❌',
        fb: "Folding two pair to a loose recreational's raise is a massive mistake. Their raising range is top pair, draws, and occasional bluffs — you're comfortably ahead of almost all of it. 3-bet and get the money in.",
      },
      {
        val: 'call', label: 'Call $55', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Calling is Passive with Two Pair', emoji: '⚠️',
        fb: "Calling with two pair is passive. A loose recreational raises wide here and will call your 3-bet with all the hands you're beating. Build the pot now — if they have a set, that's a cooler, but your two pair is a monster.",
      },
      {
        val: 'raise', label: '3-Bet to $220', icon: '⚡', cls: 'raise',
        grade: 'correct', title: '3-Bet for Value vs Loose Range', emoji: '✅',
        fb: "3-betting is correct. A loose recreational raises here with top pair, draws, and even bluffs — all of which you're crushing with two pair. Get the money in now before the board changes and charge them maximum.",
      },
    ],
  }),

  // ── sc_034 through sc_083 ─────────────────────────────────────────────────

  mkScenario({
    id: 'sc_034',
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: '3-bets over 25% from any position, folds to 4-bets less than 30% of the time',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises $6', state: 'hero'   },
      3: { label: 'BTN (M)',  action: '3-Bet $20', state: 'active' },
    }),
    hand: mkHand(['A','♣'], ['J','♣']),
    board: null,
    pot: '$29',
    toCall: '$14 more',
    body: "You open to $6 from CO with A♣J♣. The Button — a maniac who 3-bets over 25% of hands and rarely folds to 4-bets — squeezes to $20.",
    question: 'A♣J♣ vs a maniac 3-bet. What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'AJs is Too Strong to Fold', emoji: '❌',
        fb: "Folding AJs suited to a 25%+ 3-bettor is leaving serious value on the table. His range is full of garbage — calling $14 with a premium suited hand is straightforward.",
      },
      {
        val: 'call', label: 'Call $14 more', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Call and Outplay Postflop', emoji: '✅',
        fb: "AJs is a call here — strong enough to continue but not strong enough to 4-bet a maniac who calls 4-bets wide and puts you in a bloated pot OOP. Take the good price and use your hand's playability.",
      },
      {
        val: 'raise', label: '4-Bet to $55', icon: '⚡', cls: 'raise',
        grade: 'partial', title: '4-Bet Risks a Call You Hate', emoji: '⚠️',
        fb: "4-betting a maniac who calls 4-bets 70% of the time means you're often playing a huge pot OOP with a hand that isn't the nuts. AJs is a caller here, not a 4-bet bluff candidate.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_035',
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Limps wide from any position, calls raises with dominated aces and any pair',
    },
    tableContext: "Two loose recreationals have already limped — the pot is multi-way and likely to be called by at least one.",
    positions: mkPositions({
      0: { label: 'UTG (R)',  action: 'Limps',  state: 'active' },
      1: { label: 'HJ (R)',   action: 'Limps',  state: 'active' },
      2: { label: 'CO (You)', action: '???',    state: 'hero'   },
      5: { label: 'BB',       action: 'Active', state: 'active' },
    }),
    hand: mkHand(['K','♦'], ['T','♦']),
    board: null,
    pot: '$7',
    toCall: null,
    body: "Two loose recreationals limp in front of you in CO. You hold K♦T♦.",
    question: 'K♦T♦ in CO with two limpers. What do you do?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'K♦T♦ is Well Above Fold Threshold', emoji: '❌',
        fb: "K♦T♦ in position against two loose limpers is a strong iso-raise spot. Their calling ranges are full of dominated holdings — fold is only for the bottom of your range, not a top 15% hand.",
      },
      {
        val: 'call', label: 'Limp along', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Limping Gives Up Initiative', emoji: '⚠️',
        fb: "Limping in with two recreationals turns this into a multiway mess where your hand's edge shrinks. Raise to define the pot, get heads-up, and make them pay to see a flop.",
      },
      {
        val: 'raise', label: 'Raise to $14', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'ISO-Raise and Dominate the Pot', emoji: '✅',
        fb: "Iso-raising to $14 is correct. Loose recreationals call raises with dominated kings and any suited hand — you're in great shape postflop with position and a hand that crushes their calling range.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_036',
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: '4-bets a polarized range — AA/KK for value and A5s/76s as bluffs; folds QQ/JJ to 4-bets',
    },
    tableContext: null,
    positions: mkPositions({
      1: { label: 'HJ (You)', action: 'Raises $6', state: 'hero'   },
      3: { label: 'BTN (AR)', action: '3-Bet $20', state: 'active' },
    }),
    hand: mkHand(['A','♥'], ['Q','♠']),
    board: null,
    pot: '$29',
    toCall: '$14 more',
    body: "You open HJ to $6 with A♥Q♠. The Button — an aggressive regular who 4-bets polarized (AA/KK and bluffs) and folds QQ/JJ to 4-bets — 3-bets to $20.",
    question: 'AQ offsuit in HJ vs a polarized 3-bettor. What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'AQ offsuit is Not a Fold vs Polarized 3-Bets', emoji: '❌',
        fb: "AQ offsuit is in great shape against a wide 3-bet range. Calling $14 in position with a strong hand is exactly right — folding surrenders too much to an aggressive player exploiting your early position range.",
      },
      {
        val: 'call', label: 'Call $14 more', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Call and Navigate Postflop', emoji: '✅',
        fb: "Calling is correct. AQ offsuit is too strong to fold but dangerous to 4-bet — his 4-bet-calling range is exactly AA/KK, both of which crush you. Call, see the flop, and fold cleanly on ace-high if he barrels.",
      },
      {
        val: 'raise', label: '4-Bet to $55', icon: '⚡', cls: 'raise',
        grade: 'partial', title: '4-Bet Gets It in Bad vs AA/KK', emoji: '⚠️',
        fb: "4-betting AQ offsuit into a polarized range means you're getting it in against AA/KK and folding out all his bluffs. Your equity collapses — flat and use the playability of position.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_037',
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Calls preflop raises but almost never 3-bets; plays very straightforwardly postflop',
    },
    tableContext: null,
    positions: mkPositions({
      4: { label: 'SB (You)', action: '???',    state: 'hero'   },
      5: { label: 'BB (P)',   action: 'Active', state: 'active' },
    }),
    hand: mkHand(['6','♦'], ['5','♦']),
    board: null,
    pot: '$3',
    toCall: null,
    body: "Everyone folds to you in the SB with 6♦5♦. The BB is a passive player who calls raises but almost never 3-bets.",
    question: '6♦5♦ in the SB heads-up vs a passive BB. What do you do?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Never Fold 65s Heads-Up in the SB', emoji: '❌',
        fb: "65s suited in the SB heads-up is way too strong to fold. It has great playability and a passive opponent who never 3-bets means you're raising into near-zero resistance.",
      },
      {
        val: 'call', label: 'Limp ($1)', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Limping Gives Up Initiative', emoji: '⚠️',
        fb: "Limping 65s gives a passive BB a free look and surrenders initiative. Against a player who never 3-bets, a small raise is almost risk-free and takes down the blinds a large percentage of the time.",
      },
      {
        val: 'raise', label: 'Raise to $6', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Open and Take Control', emoji: '✅',
        fb: "Raising 65s from the SB heads-up is correct. A passive player who never 3-bets lets you steal often, and when called you have a playable suited connector with position on every postflop street.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_038',
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'Defends BB with only top 15% of hands; folds to 3-bets from any position with less than TT/AQ',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: 'Raises $5', state: 'hero'   },
      5: { label: 'BB (TR)',   action: '3-Bet $16', state: 'active' },
    }),
    hand: mkHand(['T','♣'], ['8','♣']),
    board: null,
    pot: '$22',
    toCall: '$11 more',
    body: "You raise BTN to $5 with T♣8♣. The BB — a tight recreational who defends only his best hands and 3-bets a very narrow range — re-raises to $16.",
    question: 'T♣8♣ on BTN vs a tight BB 3-bet. What do you do?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Respect the Tight Rec 3-Bet', emoji: '✅',
        fb: "When a tight recreational 3-bets from the BB, his range is exactly QQ+/AK — T♣8♣ is drawing thin and OOP. This is a disciplined fold that saves chips you'll need in better spots.",
      },
      {
        val: 'call', label: 'Call $11 more', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Calling OOP vs a Strong Range', emoji: '⚠️',
        fb: "Calling T♣8♣ in a 3-bet pot OOP against a tight player who 3-bets only his best hands puts you in an unwinnable position on most flops. The fold is cleaner than leaking chips postflop.",
      },
      {
        val: 'raise', label: '4-Bet to $45', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: '4-Betting Air Into the Nuts', emoji: '❌',
        fb: "4-betting a tight recreational's 3-bet with T♣8♣ is a bluff into QQ+/AK. He's not folding those hands — you're committing a large portion of your stack as a significant underdog.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_039',
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Check-calls with any pair, rarely raises, never bluffs on the river',
    },
    tableContext: null,
    positions: mkPositions({
      4: { label: 'SB (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (P)',   action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['K','♥'], ['J','♣']),
    board: ['K♠', '7♦', '2♣', '4♥'],
    pot: '$14',
    toCall: null,
    body: "You raised from the SB, the passive BB called. Turn K♠7♦2♣4♥. You have top pair. You're first to act, out of position.",
    question: 'KJ on K742 OOP vs passive player who check-calls. Bet or check?',
    correct: 'bet',
    choices: [
      {
        val: 'bet', label: 'Bet $10', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Bet for Value OOP', emoji: '✅',
        fb: "Bet $10 OOP on a dry board — a passive player check-calls with any pair and a weak king, so charge them now while the board is safe. Being OOP means you need to extract value while you can.",
      },
      {
        val: 'check', label: 'Check', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Checking Gives a Free Card', emoji: '⚠️',
        fb: "Checking OOP with top pair against a passive player gives him a free card and surrender initiative. He won't bet into you with his check-calling range — you have to be the aggressor.",
      },
      {
        val: 'pot', label: 'Bet $14 (pot)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Pot Bet Folds His Weak Pairs', emoji: '⚠️',
        fb: "Pot-betting OOP against a passive player folds out all his weak pairs and middle pairs. Size down to $10 to keep his check-calling range in the pot and get paid across multiple streets.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_040',
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Fires two barrels frequently, probes turns aggressively when checked to',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (AR)', action: 'Raised $6', state: 'active' },
      5: { label: 'BB (You)', action: 'Called $4', state: 'hero'   },
    }),
    hand: mkHand(['9','♥'], ['9','♦']),
    board: ['T♣', '6♠', '2♥', '3♦'],
    pot: '$31',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check', you: true }, { text: 'BTN bets $9' }, { text: 'you call', you: true }] },
      { street: 'TURN', segments: [{ text: "you're first to act", you: true }] },
    ],
    body: "You called BTN's open from BB with 9♥9♦. Flop T♣6♠2♥. You check. BTN bets $9. You call. Turn is 3♦. You're first to act.",
    question: "99 OOP on T632 — you called the flop. You're first to act on the turn. Bet or check?",
    correct: 'check',
    choices: [
      {
        val: 'donk', label: 'Donk-bet $12', icon: '🃏', cls: 'fold',
        grade: 'partial', title: "Donk-Betting Kills Your Range", emoji: '⚠️',
        fb: "Donk-betting OOP with a bluff-catcher against an aggressive player doesn't accomplish anything — you're not folding him out and you're not growing the pot efficiently. Just check and call.",
      },
      {
        val: 'check', label: 'Check — let him bet', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Check and Let Him Barrel', emoji: '✅',
        fb: "Check and call the turn. Against an aggressive regular who probes turns, your 99 is a solid bluff-catcher — check to him, let him bet his entire range, and call. You're ahead of most of it.",
      },
      {
        val: 'check_raise', label: 'Check-raise if he bets', icon: '⚡', cls: 'raise',
        grade: 'partial', title: "Check-Raising Loses His Air", emoji: '⚠️',
        fb: "Check-raising 99 OOP on this board risks folding out his air while committing more chips against his value range. Check-call is the line that extracts the most EV from his two-barrel frequency.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_041',
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Calls wide on flop and turn, gives up on rivers with missed draws, bets big when he makes a hand',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (LR)',  action: 'Called $6', state: 'active' },
      3: { label: 'BTN (You)', action: 'Raises $6', state: 'hero'  },
    }),
    hand: mkHand(['A','♠'], ['9','♠']),
    board: ['A♦', '8♣', '5♠', '2♦'],
    pot: '$15',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'CO limps' }, { text: 'you raise to $6', you: true }, { text: 'CO calls' }] },
      { street: 'FLOP', segments: [{ text: 'CO checks' }, { text: 'you check', you: true }] },
      { street: 'TURN', segments: [{ text: 'CO checks' }] },
    ],
    body: "The loose recreational limps in the CO. You raise to $6 on the Button and he calls. Flop A♦8♣5♠ — he checks, you check back. Turn 2♦ — he checks again. You have top pair, in position.",
    question: 'A♠9♠ (top pair, turn) in position vs a loose rec after the flop checks through. What now?',
    correct: 'bet_medium',
    choices: [
      {
        val: 'check', label: 'Check back — pot control', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Checking Surrenders Value', emoji: '⚠️',
        fb: "Checking back top pair in position against a loose player who calls wide is passive and incorrect. He's calling one more bet with all his weaker holdings — don't give him a free card.",
      },
      {
        val: 'bet_medium', label: 'Bet $10', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Bet for Value in Position', emoji: '✅',
        fb: "Bet $10 in position on the turn. A loose recreational calls flops and turns wide — any ace, any pair, any draw. You're ahead of most of it and position lets you control the river regardless.",
      },
      {
        val: 'bet_large', label: 'Bet $15 (pot)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Pot May Fold His Draws', emoji: '⚠️',
        fb: "Pot-betting might fold out his draws and weaker aces who would call $10 easily. Keep him in with a medium bet — a loose rec who likes his hand is not folding a reasonable turn bet.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_042',
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'Check-folds turns with less than top pair; barrels only the top of his range',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (Nit)',  action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['T','♣'], ['8','♣']),
    board: ['J♦', '9♥', '2♣', 'K♠'],
    pot: '$20',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }, { text: 'you c-bet', you: true }, { text: 'BB calls' }] },
      { street: 'TURN', segments: [{ text: 'BB checks' }] },
    ],
    body: "BTN vs BB nit. Flop J♦9♥2♣ — you c-bet, he called. Turn K♠. Nit checks to you. You have T♣8♣ — an open-ended straight draw (needs Q or 7).",
    question: 'T♣8♣ (OESD, 8 outs) in position on J92K — nit check-calls flop and checks turn. Bet or check?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Check back — take the free river', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Free Card But Missed Fold Equity', emoji: '⚠️',
        fb: "Taking a free river is fine in theory but you're surrendering significant fold equity. This nit has already shown weakness by checking twice — a pot bet folds his entire weak range and you have 8 outs when called.",
      },
      {
        val: 'call', label: 'Bet $12 (semi-bluff)', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Good Semi-Bluff, Wrong Size', emoji: '⚠️',
        fb: "A small bet doesn't apply enough pressure to a nit who barely survived the flop. The King is a range-advantage card for the preflop raiser — go pot and take it down before the river.",
      },
      {
        val: 'raise', label: 'Bet $20 (pot, maximum pressure)', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Pot-Sized Pressure Folds Nits', emoji: '✅',
        fb: "Pot-sized bet here. A nit who check-called one street with less than top pair is already uncomfortable — the King is a great scare card and a pot bet represents exactly the range that smashed this board. He folds everything but top pair.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_043',
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Rarely donk-bets; when he leads, it almost always means a strong hand',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (P)',   action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['K','♦'], ['K','♠']),
    board: ['K♣', 'Q♥', 'J♠'],
    pot: '$14',
    toCall: '$10',
    body: "You raised CO, passive BB called. Flop K♣Q♥J♠. The passive player — who almost never leads — donk-bets $10 into you.",
    question: 'Top set on KQJ. Passive player leads $10. What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Never Fold Top Set', emoji: '❌',
        fb: "Folding top set to a passive player is impossible. Even if he has the straight, you have redraws. Call, keep his range wide, and build the pot over multiple streets.",
      },
      {
        val: 'call', label: 'Call $10', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Call and Keep His Range Wide', emoji: '✅',
        fb: "Call and keep his entire leading range in — a passive player who donk-bets this coordinated board has two pair, a straight draw, maybe a pair-plus-draw. Raising folds everything but his best hands.",
      },
      {
        val: 'raise', label: 'Raise to $35', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Raise Folds His Weak Leads', emoji: '⚠️',
        fb: "Raising might fold out the weak donk-bets that make up most of his range. You have the nuts — call and give him rope to barrel himself on the turn with his draws and two-pair hands.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_044',
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Calls all three streets with any pair, never raises, checks back rivers with missed draws',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (CS)',  action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['8','♦'], ['7','♦']),
    board: ['8♣', '5♠', '2♥', 'J♦', '3♦'],
    pot: '$36',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB check-calls your bet' }] },
      { street: 'TURN', segments: [{ text: 'BB check-calls your bet' }] },
      { street: 'RIVER', segments: [{ text: 'BB checks' }] },
    ],
    body: "You raised from the CO, the calling station in the BB called. You bet flop and turn for value with middle pair — he called both streets. River 3♦. He checks.",
    question: '8♦7♦ (middle pair) on 852J river. Station called flop and turn. He checks river. What do you do?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Check Back Against a Station', emoji: '✅',
        fb: "Check back middle pair on the river against a calling station who called two streets. His range is full of better made hands that called your flop and turn bets — you're rarely value-betting here.",
      },
      {
        val: 'call', label: 'Bet $18 (value)', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Value Bet, But By What?', emoji: '⚠️',
        fb: "Betting middle pair for value on the river vs a station who called twice means his range crushes yours. A jack hit on the turn — he called flop and turn likely has you beat at a high frequency.",
      },
      {
        val: 'raise', label: 'Bet $36 (pot)', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Who Are You Beating?', emoji: '❌',
        fb: "Pot-betting middle pair on the river against a player who called two streets is spewing chips. His three-street calling range beats 87 the vast majority of the time — check it back.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_045',
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Check-raises flops at high frequency on wet boards; folds to re-raises with draws only',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises $6', state: 'hero'   },
      3: { label: 'BTN (AR)', action: 'Called $6', state: 'active' },
    }),
    hand: mkHand(['A','♥'], ['A','♣']),
    board: ['J♠', '9♦', '8♠'],
    pot: '$15',
    toCall: null,
    body: "CO vs BTN aggressive regular. Flop J♠9♦8♠ — a very wet, connected board. You have AA. You're first to act.",
    question: 'AA on J98 two-tone vs an aggressive regular who check-raises wet boards frequently. Lead or check?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Check — induce his check-raise', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Checking Risks a Brutal Turn Card', emoji: '⚠️',
        fb: "Checking AA on J98 two-tone risks a free card that completes a straight or flush, or hands the initiative to an aggressive player who'll fire every draw. Lead pot and protect your equity.",
      },
      {
        val: 'call', label: 'Bet $10', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Bet But Size Up', emoji: '⚠️',
        fb: "A small bet doesn't adequately protect your overpair on this board. Draws are getting good odds to call $10 — size up to pot to deny equity and deny his check-raising range a cheap flop.",
      },
      {
        val: 'raise', label: 'Bet $15 (pot)', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Protect and Charge on Wet Boards', emoji: '✅',
        fb: "Pot-sized bet with AA on J98 two-tone. This board is too dangerous to play coy — every turn card threatens your overpair. Charge him full price to draw, and if he raises, you re-raise and get it in with the best hand.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_046',
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'Folds any bet when he has no pair or weak draw; calls small bets with top pair but folds large bets with second pair',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (Nit)',  action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['A','♣'], ['A','♦']),
    board: ['A♥', 'T♣', '4♦'],
    pot: '$14',
    toCall: null,
    body: "BTN vs BB nit. Flop A♥T♣4♦. Nit checks. You have top set.",
    question: 'Top set on A-T-4 rainbow vs a tight nit. What size extracts the most value?',
    correct: 'bet_small',
    choices: [
      {
        val: 'bet_small', label: 'Bet $5 (small, keep him in)', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Small Bet Keeps Him In', emoji: '✅',
        fb: "Small bet is correct against a nit. He's calling with his tens and folds to large bets with second pair — keep the pot small on the flop, let him improve on the turn, and extract three streets of value.",
      },
      {
        val: 'bet_medium', label: 'Bet $9 (medium)', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Medium is Fine, Small is Best', emoji: '⚠️',
        fb: "Medium works but you're leaving value behind. A nit who calls $9 with a ten probably folds to $14 — sizing down to $5 keeps his entire calling range in and sets up bigger bets on later streets.",
      },
      {
        val: 'bet_large', label: 'Bet $14 (pot, maximize now)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Pot Bet Folds His Weak Tens', emoji: '⚠️',
        fb: "Pot-betting AA on A-T-4 folds out all his second pairs and weak draws. A nit isn't calling a pot bet without top pair — slow the sizing down so he can call three streets instead of one.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_047',
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: 'Raises any bet size with draws; calls huge bets with top pair; never folds river',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (M)',   action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['K','♠'], ['K','♦']),
    board: ['K♥', '8♦', '3♣', '2♠', 'J♥'],
    pot: '$90',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB check-calls your bet' }] },
      { street: 'TURN', segments: [{ text: 'BB check-calls your bet' }] },
      { street: 'RIVER', segments: [{ text: 'BB checks' }] },
    ],
    body: "You've bet flop and turn for value with top set vs maniac BB. River J♥. He checks. Pot is $90 and you have the best hand almost always.",
    question: 'KK (top set) on K832J river vs maniac who called two streets. He checks. What size on the river?',
    correct: 'overbet',
    choices: [
      {
        val: 'bet_medium', label: 'Bet $40 (under half pot)', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Too Small vs a Never-Fold Villain', emoji: '⚠️',
        fb: "Under-betting against a maniac who won't fold is the most common value leak at the table. He's calling anything — size up aggressively and get paid for the whole stack.",
      },
      {
        val: 'bet_large', label: 'Bet $70 (¾ pot)', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Good, But Overbet is Optimal', emoji: '⚠️',
        fb: "¾ pot is good but undersells the situation. A maniac who called two streets has a jack, a pair, maybe a draw he chased — he's calling $120 just as readily as $40 and you're leaving $80 on the table otherwise.",
      },
      {
        val: 'overbet', label: 'Bet $120 (overbet)', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Overbet the Station-Maniac River', emoji: '✅',
        fb: "Overbet the river. A maniac who called two streets has a jack, a pair, maybe a draw he chased — he's calling $120 just as readily as $40 and you're leaving $80 on the table otherwise.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_048',
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'Calls 33% pot bets with any pair; folds to 75%+ pot bets with second pair or worse',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (TR)',  action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['5','♣'], ['4','♣']),
    board: ['A♠', 'K♦', '7♣'],
    pot: '$14',
    toCall: null,
    body: "CO raised, tight recreational BB called. Flop A♠K♦7♣ — you missed completely. He checks to you.",
    question: '5♣4♣ (pure air) on AK7 rainbow vs tight rec. What sizing is most efficient for a bluff?',
    correct: 'bet_small',
    choices: [
      {
        val: 'bet_small', label: 'Bet $5 (33% pot)', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Cheap Bluff, Maximum Fold Equity', emoji: '✅',
        fb: "33% pot is the most efficient bluff size against a tight recreational who folds second pair and worse to any bet. You achieve the same fold with $5 as you do with $14 — risk less, get the same result.",
      },
      {
        val: 'bet_medium', label: 'Bet $10 (66% pot)', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Works But Risks More Than Needed', emoji: '⚠️',
        fb: "66% works but you're over-investing. A tight rec folds weak hands to any bet — the small size accomplishes the same goal at less than half the cost. Save the bigger sizing for value hands.",
      },
      {
        val: 'bet_large', label: 'Bet $14 (pot)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Same Folds for More Chips Lost', emoji: '⚠️',
        fb: "Pot-betting as a bluff against a tight player is burning chips unnecessarily. He folds his weak hands to $5 just as readily as $14 — use the minimum effective size and preserve your stack.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_049',
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Re-raises polarized hands on the river; calls medium bets with bluff-catchers; folds draws to overbets',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (AR)',   action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['T','♦'], ['9','♦']),
    board: ['J♣', '8♦', '2♠', 'Q♠', '7♦'],
    pot: '$60',
    toCall: null,
    body: "BTN vs BB aggressive regular. You have T♦9♦ — the turn Q completed your straight (8-9-T-J-Q). River 7♦ changes nothing. He checks.",
    question: 'Turned straight (second nuts — only KT beats you) on J8Q27 vs aggressive regular who re-raises polarized. What size?',
    correct: 'small',
    choices: [
      {
        val: 'small', label: 'Bet $25 (40% pot, induce raise)', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Induce the Raise with a Small Bet', emoji: '✅',
        fb: "Small bet is the highest EV play. An aggressive regular who re-raises polarized will see a small bet as a bluff and raise with his entire bluffing range — you snap-call and extract his stack instead of just your bet.",
      },
      {
        val: 'medium', label: 'Bet $45 (75% pot)', icon: '📞', cls: 'call',
        grade: 'partial', title: '75% is Standard But Misses Value', emoji: '⚠️',
        fb: "75% is fine but misses the opportunity to induce a raise. Against an aggressive player who re-raises bluffs on the river, sizing down to look weak and inducing the bluff-raise is worth more than the extra bet size.",
      },
      {
        val: 'large', label: 'Bet $90 (overbet)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: "Overbet Folds His Bluff-Catchers", emoji: '⚠️',
        fb: "Overbetting folds all his bluff-catchers and bluffs. Against an aggressive player who raises polarized, you want him to re-raise — a small bet that looks weak is the trap that gets you his whole stack.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_050',
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'Bets only top pair or better; folds any hand without a made pair to two barrels',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (Nit)', action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['J','♦'], ['T','♦']),
    board: ['A♣', 'K♠', '6♦', '2♥'],
    pot: '$28',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }, { text: 'you c-bet', you: true }, { text: 'BB calls' }] },
      { street: 'TURN', segments: [{ text: 'BB checks' }] },
    ],
    body: "You c-bet the flop with J♦T♦ (gutshot to the nut straight) and the nit called. Turn is 2♥ — a blank. He checks to you.",
    question: 'J♦T♦ on AK62 vs nit who called the flop. Blank turn. Barrel or give up?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Check — give up', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Giving Up Too Early vs a Nit', emoji: '⚠️',
        fb: "Checking gives up the hand entirely on a board that heavily favors your preflop raising range. Nits fold to two barrels at a very high frequency — take the pot now with a second bullet.",
      },
      {
        val: 'call', label: 'Bet $18 (second barrel)', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Fire the Second Barrel', emoji: '✅',
        fb: "Barrel the turn. A nit who called the flop on AK-high without a pair is increasingly uncomfortable — a second bet on a blank turn forces him to fold his missed broadway hands and pocket pairs below the board.",
      },
      {
        val: 'raise', label: 'Bet $28 (pot, max pressure)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Second Barrel is Right, Pot is OK', emoji: '⚠️',
        fb: "Pot-sized second barrel is fine but a $18 bet accomplishes the same fold at lower cost. The key insight is firing again, not the exact size — a nit's range is already very weak after calling AK-high.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_051',
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Check-calls with any pair on the flop and turn; folds to river bets without a strong hand',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (P)',    action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['K','♣'], ['Q','♣']),
    board: ['J♦', '9♠', '4♣', '2♥', 'T♠'],
    pot: '$60',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB check-calls your bet' }] },
      { street: 'TURN', segments: [{ text: 'BB check-calls your bet' }] },
      { street: 'RIVER', segments: [{ text: 'BB checks' }] },
    ],
    body: "BTN vs BB passive player. You bet flop and turn with K♣Q♣ (gutshot + two overs). River T♠ — your gutshot got there: the nut straight. He checks to you.",
    question: 'You rivered the nut straight on J942T. Passive player checks. What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Check — he has nothing', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Checking the Nuts is a Major Mistake', emoji: '❌',
        fb: "Checking the nut straight on the river is losing significant value. He called two streets with some hand — even a small river bet gets called by his pairs. Never check the nuts when your opponent has any calling range.",
      },
      {
        val: 'call', label: 'Bet $30 (half pot)', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Value Bet the River', emoji: '✅',
        fb: "Half-pot bet is correct. A passive player who called flop and turn has some pair — he's checking the river because he's not strong enough to bet. A half-pot bet extracts value from his weak pairs that fold to a pot bet.",
      },
      {
        val: 'raise', label: 'Bet $60 (pot, max value)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Pot May Fold His Pairs', emoji: '⚠️',
        fb: "Pot-sizing might fold out all the hands that survived two streets of betting. Size down to half-pot to get called by his pairs and thin value hands.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_052',
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'Gives up rivers with one pair when facing big bets; never bluffs rivers himself',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (TR)',   action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['A','♦'], ['4','♦']),
    board: ['K♠', 'Q♣', '7♦', '2♥', '5♣'],
    pot: '$55',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB check-calls your bet' }] },
      { street: 'TURN', segments: [{ text: 'BB check-calls your bet' }] },
      { street: 'RIVER', segments: [{ text: 'BB checks' }] },
    ],
    body: "BTN vs BB tight recreational. You barreled flop and turn representing a strong range with A♦4♦ (backdoor nut flush draw — needs running diamonds). River bricks 5♣ — the flush never materialized and you're left with just ace-high. He checks.",
    question: 'A♦4♦ — backdoor flush draw never got there on K♠Q♣7♦2♥5♣. Left with ace-high. Tight rec checks. What do you do?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Surrendering with Real Fold Equity', emoji: '⚠️',
        fb: "You've barreled two streets representing a strong range — a tight recreational knows you could easily have AK, AQ, or a set here. He's not calling a pot-sized river bet with one pair. The fold equity is too good to surrender.",
      },
      {
        val: 'call', label: 'Bet $25 (half-pot bluff)', icon: '📞', cls: 'call',
        grade: 'partial', title: "Half-Pot Won't Move a Tight Rec", emoji: '⚠️',
        fb: "Half-pot looks like a blocker bet, not a flush — a tight rec can call that with kings or queens. You need a real commitment to represent the flush you were credibly drawing to all along.",
      },
      {
        val: 'raise', label: 'Bet $55 (pot, polarized bluff)', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Polarized Bluff on the Brick River', emoji: '✅',
        fb: "Pot-sized bluff is correct. You barreled two streets credibly representing a strong range — a tight recreational with one pair is folding to a polarized river bet at high frequency on this runout, even without a completed flush in your range.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_053',
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Rarely bluffs; when he bets the flop it usually means a real pair or draw',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (P)',  action: 'Raises $6', state: 'active' },
      5: { label: 'BB (You)', action: '???',        state: 'hero'   },
    }),
    hand: mkHand(['A','♠'], ['5','♣']),
    board: ['A♦', '7♥', '3♣'],
    pot: '$13',
    toCall: '$10',
    body: "Passive BTN bets $10 into a $13 pot on A♦7♥3♣. You're in BB with A♠5♣ — top pair, weak kicker.",
    question: 'Top pair weak kicker on A73 rainbow. Passive villain bets $10. Getting 2.3:1. What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Top Pair is Not a Fold', emoji: '❌',
        fb: "Folding top pair getting 2.3:1 on the flop is massively over-folding. You're well within profitable calling territory — A5 beats his draws and many worse aces that a passive player might bet with.",
      },
      {
        val: 'call', label: 'Call $10', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Call and Control the Pot', emoji: '✅',
        fb: "Call and keep the pot manageable. You have top pair but a weak kicker — against a passive player whose bet means something, you're likely ahead of his draws and worse aces. Don't raise but don't fold.",
      },
      {
        val: 'raise', label: 'Check-raise to $35', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Raising Bloats the Pot Too Much', emoji: '⚠️',
        fb: "Check-raising top pair weak kicker into a passive player's bet bloats the pot when you're only marginally ahead. His range includes AK, AQ, A7 — hands that have you beat. Call and see the turn.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_054',
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: 'Triple-barrels missed draws and air at very high frequency; river bet is a bluff 60% of the time',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (M)',  action: 'Raises $6', state: 'active' },
      5: { label: 'BB (You)', action: 'Called $4', state: 'hero'   },
    }),
    hand: mkHand(['8','♦'], ['7','♦']),
    board: ['K♦', '8♣', '2♠', '3♥', 'Q♣'],
    pot: '$50',
    toCall: '$40',
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check-call his bet', you: true }] },
      { street: 'TURN', segments: [{ text: 'you check-call his bet', you: true }] },
      { street: 'RIVER', segments: [{ text: 'you check', you: true }, { text: 'BTN shoves $40' }] },
    ],
    body: "Maniac BTN fires three streets on K823Q. River Q♣. He shoves $40 into $50. You have 8♦7♦ — a pair of eights, a pure bluff-catcher that beats every busted draw.",
    question: '8♦7♦ (pair of eights, bluff-catcher) on K823Q. Maniac shoves river, 60% bluff frequency. Getting 2.25:1. What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Math Says Call', emoji: '❌',
        fb: "Folding here is a math error. You need 31% equity to call at 2.25:1, and the maniac's bluff frequency is 60%. Your pair of eights beats every busted draw and air-ball he shoves — a profitable call. Trust the math.",
      },
      {
        val: 'call', label: 'Call $40', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Bluff-Catch at the Right Frequency', emoji: '✅',
        fb: "Call. At 2.25:1 you need to be right 31% of the time — and the maniac bluffs 60% of rivers. A pair of eights is a true bluff-catcher here: it loses to his value hands but beats all his bluffs, which is exactly the math that makes this call mandatory.",
      },
      {
        val: 'raise', label: 'Raise', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: "Never Raise Into a Polarized Range", emoji: '❌',
        fb: "Raising into a polarized river range accomplishes nothing — his value hands call and his bluffs fold. You want to call, not raise, to capture the value of his bluffing frequency.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_055',
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'River bets are exclusively value — he has never been caught bluffing in this session',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (Nit)',  action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['A','♠'], ['K','♦']),
    board: ['A♦', 'J♣', '5♠', '4♥', '2♣'],
    pot: '$80',
    toCall: '$60',
    body: "BTN vs BB nit. River 2♣ on A♦J♣5♠4♥2♣. Nit — who has never bluffed — leads $60 into $80.",
    question: 'AK (top pair top kicker) on AJ542. Nit leads $60 on the river. Getting 2.33:1. Fold, call, or raise?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: "Fold TPTK to a Nit's River Lead", emoji: '✅',
        fb: "Fold. The pot odds are irrelevant when the villain's bluff frequency is essentially zero. A nit who has never bluffed leading the river on AJ542 has exactly A2, A5, A4, AJ, or a set — all beat TPTK.",
      },
      {
        val: 'call', label: 'Call $60', icon: '📞', cls: 'call',
        grade: 'partial', title: '2.33:1 is Irrelevant vs 0% Bluffs', emoji: '⚠️',
        fb: "The 2.33:1 offer is tempting but meaningless. Pot odds only matter when there's bluff frequency to account for. Against a nit with a 0% river bluff rate, you need near-certain equity to call — which you don't have.",
      },
      {
        val: 'raise', label: 'Raise to $180', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Raising Into the Nuts', emoji: '❌',
        fb: "Raising into a nit's river lead when he never bluffs is the worst possible play. He has the hand he represents — fold and keep the chips.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_056',
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Check-calls flop and turn passively, but raises river only with strong hands',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (P)',    action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['Q','♦'], ['Q','♠']),
    board: ['Q♣', 'T♥', '4♦', '3♠', 'J♣'],
    pot: '$65',
    toCall: '$50',
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB check-calls your bet' }] },
      { street: 'TURN', segments: [{ text: 'BB check-calls your bet' }] },
      { street: 'RIVER', segments: [{ text: 'BB checks' }, { text: 'you bet $35', you: true }, { text: 'BB raises to $85' }] },
    ],
    body: "BTN vs BB passive player. You bet flop and turn for value with QQ (top set). River J♣. You bet $35. Passive player — who called both previous streets without raising — now RAISES to $85.",
    question: 'QQ (top set) on QT43J. You bet river $35. Passive player raises to $85 for the first time all hand. What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Folding is Defensible', emoji: '⚠️',
        fb: "Folding is tempting but too tight at this price. You're getting about 3.7:1 — you only need to win one time in five. His raising range is headed by AK and K9 straights, but it still contains slow-played lower sets (JJ, TT), two pair like QJ or JT, and the occasional overplayed top pair — all of which top set beats.",
      },
      {
        val: 'call', label: 'Call $50 more', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Call — The Price Makes It Right', emoji: '✅',
        fb: "Call. A passive player raising the river on QT43J often has the straight — AK or K9 — but at 3.7:1 you only need to be good 21% of the time, and his range still includes slow-played lower sets, two pair, and overplayed one-pair hands that top set crushes. Call and accept being shown a straight sometimes.",
      },
      {
        val: 'raise', label: 'Re-raise all-in', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Never Re-Raise Into This Line', emoji: '❌',
        fb: "Re-raising into a passive player's first raise of the hand is putting in the maximum against the tightest possible range. He's not raising here without a very strong hand — call, don't re-raise.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_057',
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Bets flop and turn aggressively, but when he checks the turn after betting the flop, it usually signals a capped range',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (AR)', action: 'Raises $6', state: 'active' },
      5: { label: 'BB (You)', action: 'Called $4', state: 'hero'   },
    }),
    hand: mkHand(['K','♠'], ['7','♠']),
    board: ['K♥', '8♦', '3♠', '9♣'],
    pot: '$30',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check', you: true }, { text: 'BTN c-bets' }, { text: 'you call', you: true }] },
      { street: 'TURN', segments: [{ text: "you're first to act", you: true }] },
    ],
    body: "BTN aggressive regular raised. You called BB with K♠7♠. Flop K♥8♦3♠ — he c-bets, you call. Turn 9♣ — you're first to act. When this player checks back the turn after c-betting, his range is usually capped.",
    question: 'K♠7♠ (top pair weak kicker) on K839. Aggressive regular checks the turn after c-betting. Lead or check?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Check — let him bet', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Checking Loses Potential Value', emoji: '⚠️',
        fb: "Checking surrenders the information advantage you've gained. His turn check is a weakness tell — take the initiative and bet for value before he gets to realize equity for free.",
      },
      {
        val: 'call', label: 'Lead $18 (value/protection)', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Lead When He Shows Weakness', emoji: '✅',
        fb: "Lead $18. His turn check on K839 after a flop c-bet is a capped range signal — he's probably got second pair, a gutshot, or floated with air. Exploit his shown weakness by donking out with top pair.",
      },
      {
        val: 'raise', label: 'Lead $30 (pot)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: "Pot-Bet Folds His Weak Pairs", emoji: '⚠️',
        fb: "Pot-bet folds out all the weak pairs and draws you want to charge. Size down to 60% pot to extract value from his check-calling range while still applying meaningful pressure.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_058',
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: "Fires three barrels indiscriminately; when he suddenly checks the turn, he almost always has a strong made hand he's trapping with",
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises $6', state: 'hero'   },
      3: { label: 'BTN (M)',  action: 'Called $6', state: 'active' },
    }),
    hand: mkHand(['A','♥'], ['Q','♥']),
    board: ['A♣', 'J♦', '7♠', '8♦'],
    pot: '$22',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'you raise to $6', you: true }, { text: 'BTN calls' }] },
      { street: 'FLOP', segments: [{ text: 'you c-bet', you: true }, { text: 'BTN calls' }] },
      { street: 'TURN', segments: [{ text: 'you check', you: true }, { text: 'BTN checks' }] },
    ],
    body: "CO vs BTN maniac. Flop A♣J♦7♠ — you c-bet, maniac called (unusual for him not to raise). Turn 8♦. You check. Maniac — who fires 90% of turns — also checks. This is a major red flag.",
    question: 'AQ (TPTK) on AJ78. You check turn. Maniac — who fires 90% of turns — also checks. What does this mean and what do you do on the river?',
    correct: 'check_fold',
    choices: [
      {
        val: 'bet', label: 'Bet river big for value', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: "He Has a Monster — Don't Bet", emoji: '❌',
        fb: "Betting into a maniac who just broke his 90% turn-barreling habit is walking into a trap. His turn check is the tell — he has a monster. Check and be prepared to fold to aggression on the river.",
      },
      {
        val: 'check_call', label: 'Check river and call a bet', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Calling is Okay But Risky', emoji: '⚠️',
        fb: "Calling a river bet from a maniac who showed turn weakness is defensible with TPTK, but his pattern (called flop, checked back a high-action turn) screams a strong hand he's disguising. Proceed cautiously.",
      },
      {
        val: 'check_fold', label: 'Check river and fold to a big bet', icon: '⚡', cls: 'raise',
        grade: 'correct', title: "Read the Check — He's Trapping", emoji: '✅',
        fb: "Check river and fold to a big bet. A maniac who checks the turn after calling a flop c-bet has flopped a monster — sets, two pair, maybe a disguised straight draw that got there. His check is a trap, not weakness.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_059',
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Plays any two suited cards; chases all draws to the river regardless of price; rarely bluffs',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (LR)',  action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['A','♦'], ['K','♠']),
    board: ['A♣', '9♥', '8♦', '7♦'],
    pot: '$30',
    toCall: null,
    body: "You raised CO, loose recreational BB called. Turn A♣9♥8♦7♦. You have top pair top kicker. He checks.",
    question: 'AK on A987 — a connected board. Loose rec checks. What size do you bet for value and protection?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Check — too dangerous', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Never Check TPTK on Wet Boards', emoji: '❌',
        fb: "Checking TPTK on A987 wet against a player who chases every draw is an enormous mistake. He has draws that beat you — make him pay full price or take the pot now.",
      },
      {
        val: 'call', label: 'Bet $15 (half pot)', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Half-Pot Gives Draws Cheap Odds', emoji: '⚠️',
        fb: "Half-pot gives the loose rec exactly what he wants — cheap odds to chase his diamond flush draw and straight draws. Size up to deny him the profitable call he's been waiting for.",
      },
      {
        val: 'raise', label: 'Bet $30 (pot)', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Charge the Draw Machine', emoji: '✅',
        fb: "Pot-bet is correct. A loose recreational chases every draw regardless of price — on A987 with a diamond draw, he has multiple draws to the nuts. Charge the maximum to deny him equity cheaply.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_060',
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: 'Continuation-bets 95% of flops regardless of texture; folds to check-raises with air about 50% of the time',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (M)',   action: 'Raises $6', state: 'active' },
      5: { label: 'BB (You)', action: 'Called $4', state: 'hero'   },
    }),
    hand: mkHand(['J','♥'], ['J','♣']),
    board: ['J♦', '6♠', '2♥'],
    pot: '$13',
    toCall: '$10',
    body: "The maniac raises to $6 from the CO. You call from the Big Blind. Flop J♦6♠2♥ — you flopped top set. You check, he c-bets $10 (as he does 95% of flops). You're OOP.",
    question: 'Top set on J62 rainbow. Maniac c-bets as expected. What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Never Fold Top Set', emoji: '❌',
        fb: "Folding top set is impossible. Call the maniac's c-bet, check the turn, let him bet into you again, and build the pot the right way against a player who can't stop firing.",
      },
      {
        val: 'call', label: 'Call $10', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Call and Let Him Barrel', emoji: '✅',
        fb: "Call and let the maniac barrel. He c-bets 95% of flops and will fire the turn with his entire range — you have the nuts, let him build the pot for you. Check-raising shuts down his bluffing frequency.",
      },
      {
        val: 'raise', label: 'Check-raise to $35', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Raising Might Slow the Action', emoji: '⚠️',
        fb: "Check-raising isn't terrible but risks slowing the maniac down. He fires indiscriminately — calling keeps all his air and bluffs in the pot so you can trap him across multiple streets.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_061',
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Rarely raises; when he check-raises the flop, he has two pair or better — almost no bluffs',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (P)',    action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['A','♠'], ['T','♠']),
    board: ['A♣', '7♥', '4♣'],
    pot: '$14',
    toCall: '$16 more',
    body: "BTN vs BB passive player. Flop A♣7♥4♣. You c-bet $9. Passive player — who almost never raises — check-raises to $25.",
    question: 'AT (top pair, good kicker) on A74 two-tone. Passive player check-raises your c-bet. Fold, call, or re-raise?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Passive Check-Raise = Strong', emoji: '✅',
        fb: "Fold top pair. A passive player who almost never raises check-raises you with two pair or better — A7/A4/77/44 are all in his range and all have you crushed. Disciplined fold.",
      },
      {
        val: 'call', label: 'Call $16 more', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Calling Puts You in Trouble', emoji: '⚠️',
        fb: "Calling is not terrible but you're drawing to at most 5 outs against a passive player who has shown he has a strong hand. The fold saves significant chips over the long run.",
      },
      {
        val: 'raise', label: 'Re-raise to $65', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Re-Raising into Two Pair or Sets', emoji: '❌',
        fb: "Re-raising a passive player's check-raise — his first raise of the hand — commits your stack against the top of his range. His check-raise range here is nearly 100% value.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_062',
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Calls every flop and turn bet; only folds on rivers when he missed completely — never folds a made hand',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (CS)',  action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['K','♣'], ['J','♦']),
    board: ['K♦', 'T♠', '3♥', '9♣', '2♥'],
    pot: '$44',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB check-calls your bet' }] },
      { street: 'TURN', segments: [{ text: 'BB check-calls your bet' }] },
      { street: 'RIVER', segments: [{ text: 'BB checks' }] },
    ],
    body: "CO vs BB calling station. You've bet flop and turn with KJ (top pair, second kicker) — he called both bets. River 2♥. He checks.",
    question: 'KJ (top pair) on KT39 river vs calling station who called two streets. He checks. What do you do?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Check Back — His Range Has You', emoji: '✅',
        fb: "Check back. A calling station who called flop and turn on KT39 has you beat at high frequency — a ten, a nine, QJ (straight), or two pair. Your river bet extracts value from fewer hands than it loses to.",
      },
      {
        val: 'call', label: 'Bet $20 (value)', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Thin Value Against Two Streets', emoji: '⚠️',
        fb: "Thin value betting top pair on a board that completed multiple draws is marginal at best. His two-street calling range has too many hands that beat KJ — checking is safer than risking a call from a better hand.",
      },
      {
        val: 'raise', label: 'Bet $44 (pot)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Pot Is Definitely Wrong Here', emoji: '⚠️',
        fb: "Pot-betting into a calling station who called two streets on K-T-3-9 is over-valuing top pair. This board completed a straight and many two-pair combinations — his calling range has you in bad shape.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_063',
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'Only defends 3-bets with AA, KK, QQ, AK — folds everything else including JJ and AQ',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (Nit)', action: '3-Bet $20', state: 'active' },
    }),
    hand: mkHand(['A','♠'], ['5','♠']),
    board: null,
    pot: '$27',
    toCall: '$14 more',
    body: "You open CO to $6 with A♠5♠. The BB — a nit who only 3-bets AA, KK, QQ, AK — squeezes to $20.",
    question: 'A♠5♠ vs a nit BB 3-bet who only has AA/KK/QQ/AK. What do you do?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Folding Misses the 4-Bet Bluff Spot', emoji: '⚠️',
        fb: "Folding is fine but misses a high-EV opportunity. A nit 3-bets only the top of his range and folds QQ/AK to 4-bets — A♠5♠ has the blocker equity to make this 4-bet profitable.",
      },
      {
        val: 'call', label: 'Call $14 more', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Calling OOP vs Nit is Losing Play', emoji: '⚠️',
        fb: "Calling $14 OOP against a nit's 3-bet puts you in a brutal spot postflop — his range always has you in serious trouble on most boards. 4-bet and either take it preflop or play a big pot with the best of it.",
      },
      {
        val: 'raise', label: '4-Bet to $55', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'A♠5♠ is the Perfect 4-Bet Bluff', emoji: '✅',
        fb: "4-bet bluff with A♠5♠. Against a nit who only 3-bets AA/KK/QQ/AK, you're folding out QQ and AK the vast majority of the time. A♠5♠ is ideal — the ace blocks AA/AK and you have equity even when called.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_064',
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: "Slow-plays sets and two pair frequently to \"trap\"; rarely bets strong hands immediately",
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (LR)',  action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['A','♦'], ['K','♦']),
    board: ['A♠', 'K♣', '8♥', 'J♦'],
    pot: '$33',
    toCall: '$22',
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }, { text: 'you c-bet $10', you: true }, { text: 'BB calls' }] },
      { street: 'TURN', segments: [{ text: 'BB leads $22' }] },
    ],
    body: "CO vs BB loose recreational. You have top two pair. Flop A♠K♣8♥ — you c-bet $10, he called (unusual passive call). Turn J♦ — he leads $22 (first time he's led the hand).",
    question: 'Top two pair (AK) on AK8J. Loose rec — who slow-plays his monsters — suddenly leads the turn. Fold, call, or raise?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Too Tight vs a Wide Lead', emoji: '⚠️',
        fb: "Folding top two pair to a single turn bet at 2.5:1 from a loose recreational is too tight. Remember his profile: he slow-plays his monsters — so a sudden lead skews toward worse two pair, top-pair hands he likes, and pair-plus-draw. QT and sets are only a slice of his wide leading range.",
      },
      {
        val: 'call', label: 'Call $22', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Call — Way Ahead of His Leading Range', emoji: '✅',
        fb: "Call. A loose recreational who slow-plays his monsters isn't leading the turn with them — his lead is worse two pair (AJ, A8, KJ), top pair he's fallen in love with, and draws. Top two pair beats all of it. Call, keep his worse hands in, and re-evaluate the river if a scare card lands.",
      },
      {
        val: 'raise', label: 'Raise to $70', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Raising Folds Out Everything You Beat', emoji: '❌',
        fb: "Raising top two pair here folds out all the worse hands a loose recreational leads with and gets action only from QT and sets — the exact slice that beats you. Calling keeps his wide, weaker range in the pot; raising turns your monster into a bluff-catcher for stacks.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_065',
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Squeezes 3-bets at 15%+ from the BB; folds to 4-bets about 65% of the time',
    },
    tableContext: "CO is an unknown player who limped — the limp is likely a trap or weak hand.",
    positions: mkPositions({
      2: { label: 'CO',       action: 'Limps',      state: 'active' },
      3: { label: 'BTN (You)',action: 'Raises $8',  state: 'hero'   },
      5: { label: 'BB (AR)',  action: '3-Bet $28',  state: 'active' },
    }),
    hand: mkHand(['T','♠'], ['T','♦']),
    board: null,
    pot: '$39',
    toCall: '$20 more',
    body: "You raise BTN to $8 with TT after CO limps. BB aggressive regular squeezes to $28. CO folds. You face $20 more with TT in a 3-bet pot.",
    question: 'TT on BTN in a squeeze 3-bet pot from aggressive BB. Call, 4-bet, or fold?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'TT is Too Strong to Fold', emoji: '❌',
        fb: "Folding TT to an aggressive regular's squeeze bet is too weak. His squeezing range is wide and he folds two-thirds of the time to 4-bets — this is a highly profitable spot to 4-bet and take the pot.",
      },
      {
        val: 'call', label: 'Call $20 more', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Calling is Fine But 4-Bet is Best', emoji: '⚠️',
        fb: "Calling is reasonable but you surrender a huge equity edge. Against a 15%+ squeezer who folds to 4-bets, TT is a strong 4-bet for both value and fold equity. Don't give up the initiative.",
      },
      {
        val: 'raise', label: '4-Bet to $75', icon: '⚡', cls: 'raise',
        grade: 'correct', title: '4-Bet to Exploit His Fold Equity', emoji: '✅',
        fb: "4-bet to $75. An aggressive regular squeezing wide folds to 4-bets 65% of the time — your TT takes the pot immediately most of the time, and when called you're in a flip at worst against his 3-bet-calling range.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_066',
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Calls any size on any street with any pair — never check-raises, never folds a pair',
    },
    tableContext: null,
    positions: mkPositions({
      4: { label: 'SB (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (CS)',  action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['Q','♦'], ['4','♦']),
    board: ['Q♠', '7♣', '3♥'],
    pot: '$14',
    toCall: null,
    body: "SB vs BB calling station. Flop Q♠7♣3♥ — you have top pair weak kicker, OOP.",
    question: 'Q♦4♦ (top pair, terrible kicker) OOP on Q73 rainbow vs calling station. Lead or check?',
    correct: 'bet_medium',
    choices: [
      {
        val: 'check', label: 'Check — pot control OOP', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Checking Gives Free Cards', emoji: '⚠️',
        fb: "Checking top pair OOP against a calling station gives him a free card with his worse pairs and draws. Even OOP, you lead for thin value — the station won't exploit your positional disadvantage.",
      },
      {
        val: 'bet_medium', label: 'Bet $8 (value)', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Bet for Thin Value', emoji: '✅',
        fb: "Bet $8 for thin value. A calling station calls this with any seven, any three, and any queen — you're ahead of most of it despite the weak kicker. Being OOP doesn't change the fact you should be extracting value.",
      },
      {
        val: 'bet_large', label: 'Bet $14 (pot)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Pot-Bet Keeps Too Many Calls', emoji: '⚠️',
        fb: "Pot-betting top pair with a terrible kicker OOP invites calls from better queens and sets. Size down to $8 to extract value from his weaker pairs while keeping the pot manageable.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_067',
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'Folds to any bet without at least top pair; never bluffs; checks any hand below top pair',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (Nit)',  action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['5','♠'], ['5','♥']),
    board: ['A♦', 'K♠', '7♣'],
    pot: '$14',
    toCall: null,
    body: "BTN vs BB nit. Flop A♦K♠7♣ rainbow. Nit checks. You have 55 — no pair on this board.",
    question: '55 on AK7 vs nit who checks. C-bet bluff or check back?',
    correct: 'bet_small',
    choices: [
      {
        val: 'bet_small', label: 'Bet $9 (c-bet bluff)', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'C-Bet the Nit Off His Air', emoji: '✅',
        fb: "C-bet $9. A nit who checks AK7 doesn't have an ace or a king — he'd lead or check-raise with those. His checking range is medium pairs and air, which fold to any bet. Steal the pot cheaply.",
      },
      {
        val: 'check', label: 'Check back', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Checking Up Has Some Merit', emoji: '⚠️',
        fb: "Checking back gives the nit a free card when you could easily take the pot down. His check on AK7 signals weakness — any bet takes this away from him without needing to risk much.",
      },
      {
        val: 'bet_large', label: 'Bet $14 (pot)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Works But Wastes Chips', emoji: '⚠️',
        fb: "Pot-betting as a bluff is fine but wastes chips. A nit folds to $9 or $14 at the same frequency — use the minimum effective size and get the same result for less cost.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_068',
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Fires two barrels frequently on blank turns; gives up rivers with missed draws about 70% of the time',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (AR)',  action: 'Raises $6', state: 'active' },
      3: { label: 'BTN (You)', action: 'Called $6', state: 'hero'  },
    }),
    hand: mkHand(['T','♠'], ['8','♠']),
    board: ['J♥', '9♦', '4♠', 'K♣', '2♥'],
    pot: '$55',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'CO raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'CO bets' }, { text: 'you call', you: true }] },
      { street: 'TURN', segments: [{ text: 'CO bets' }, { text: 'you call', you: true }] },
      { street: 'RIVER', segments: [{ text: 'CO checks' }] },
    ],
    body: "The CO aggressive regular raised, you called on the BTN. He bet flop and turn on J94K — you called with an open-ended straight draw. River 2♥ misses everything, and he checks to you.",
    question: 'T♠8♠ missed draw on J94K2 river. Aggressive regular who gives up rivers 70% of the time checks. Bluff or check?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'No Showdown Value — Missed Bluff', emoji: '⚠️',
        fb: "Checking back misses a clear bluffing opportunity. You have 10-high, no showdown value, and a line that looks strong. The aggressive regular's check is a signal — fire.",
      },
      {
        val: 'call', label: 'Bet $25 (half-pot bluff)', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Represent the Range You Have', emoji: '✅',
        fb: "Half-pot bluff is correct. You called flop and turn so your range looks strong — a river bluff after the aggressive regular checks is credible and he gives up with missed draws 70% of the time. Half-pot is the efficient size.",
      },
      {
        val: 'raise', label: 'Bet $55 (pot, polarized bluff)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Pot is Fine But Half-Pot is Optimal', emoji: '⚠️',
        fb: "Pot-sizing as a bluff is fine but over-invests. Half-pot achieves the same result against a player who folds rivers 70% of the time — save the larger sizing for your value hands.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_069',
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Bets this board texture frequently with both strong hands and semi-bluffs',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (AR)', action: 'Raises $6', state: 'active' },
      5: { label: 'BB (You)', action: 'Called $4', state: 'hero'   },
    }),
    hand: mkHand(['J','♣'], ['5','♣']),
    board: ['T♣', '8♣', '2♦'],
    pot: '$14',
    toCall: '$9',
    body: "BTN aggressive regular bets $9 on T♣8♣2♦. You have J♣5♣ — a flush draw (9 outs).",
    question: 'J♣5♣ (flush draw, 9 outs) on T82 two-tone. Aggressive regular bets $9. Getting 2.56:1. What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: '12 Outs is Not a Fold', emoji: '❌',
        fb: "Folding a 9-out flush draw getting 2.56:1 is a significant error. The direct price is close, and the implied odds when the flush comes in make this a straightforward call.",
      },
      {
        val: 'call', label: 'Call $9', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Call and Realize Draw Equity', emoji: '✅',
        fb: "Call with 9 flush outs at 2.56:1. The direct price is close and the implied odds against an aggressive regular close the gap — hitting the flush on the turn sets up a big pot. Calling preserves maximum implied odds.",
      },
      {
        val: 'raise', label: 'Check-raise to $28', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Raising Has Merit but Loses Implied Odds', emoji: '⚠️',
        fb: "Check-raising turns a profitable call into a semi-bluff that risks your implied odds. Against an aggressive regular who bets wide, calling keeps his entire range in and preserves your potential to win a big pot.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_070',
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Calls everything but has one tell: when he raises, he always has two pair or better',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (CS)',   action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['K','♦'], ['K','♣']),
    board: ['K♥', '9♠', '7♦'],
    pot: '$14',
    toCall: '$21 more',
    body: "BTN vs BB calling station. Flop K♥9♠7♦. You bet $9. Calling station — who calls everything but ALWAYS has two pair or better when he raises — raises to $30.",
    question: 'Top set on K97 rainbow. Calling station raises your bet. He only raises with two pair+. What do you do?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Never Fold the Nuts', emoji: '❌',
        fb: "Folding top set is impossible. His range is exactly what you're crushing — re-raise all-in and get paid.",
      },
      {
        val: 'call', label: 'Call $21 more', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Calling Slows Down the Action', emoji: '⚠️',
        fb: "Calling is fine but you're leaving money behind. He has two pair or a set, he's not folding to a re-raise — ship the chips in now while you have the best hand.",
      },
      {
        val: 'raise', label: 'Re-raise all-in', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Get It All In vs His Two Pair', emoji: '✅',
        fb: "Re-raise all-in. His range is two pair and sets — all of which are crushed by top set. A calling station doesn't fold two pair to a re-raise. Get the money in now.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_071',
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: "Bets small on the river as a blocker when he has a medium-strength hand he's unsure about; bets large when he wants a fold or has the nuts",
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (TR)',  action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['J','♦'], ['T','♣']),
    board: ['J♠', '8♦', '3♣', '2♠', '5♥'],
    pot: '$40',
    toCall: '$8',
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'TURN', segments: [{ text: 'BB checks' }, { text: 'you check', you: true }] },
      { street: 'RIVER', segments: [{ text: 'BB leads $8' }] },
    ],
    body: "CO vs BB tight recreational. You checked back the turn. River 5♥ — the tight rec leads $8 into the $40 pot (20% pot).",
    question: 'JT (top pair) on J8325 river. Tight rec leads $8 (20% pot) — his tell for a medium-strength blocker bet. What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: "He's Blocking, Not Value Betting", emoji: '❌',
        fb: "Folding top pair to a 20% pot blocker bet misses the tell entirely. His small sizing means uncertainty — he doesn't want to put in a big bet but wants to see if you fold. Call and show it down.",
      },
      {
        val: 'call', label: 'Call $8', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Read the Sizing and Call', emoji: '✅',
        fb: "Call $8. A tiny river bet from a tight recreational who uses small sizing as a blocker signals a medium-strength hand he's uncomfortable with. Your top pair beats everything he'd bet small with.",
      },
      {
        val: 'raise', label: 'Raise to $30', icon: '⚡', cls: 'raise',
        grade: 'partial', title: "Raising Folds the Hand He's Unsure About", emoji: '⚠️',
        fb: "Raising folds out exactly the medium hands his small bet represents. He'd call a raise only with his strong hands — you're better off calling $8 and winning at showdown against his marginal holdings.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_072',
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Calls medium bets with top pair; folds to overbets with anything below two pair; never raises without the nuts',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (P)',   action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['A','♠'], ['A','♣']),
    board: ['A♦', 'K♥', '9♠', '3♣', 'T♦'],
    pot: '$80',
    toCall: null,
    body: "CO vs BB passive player. River T♦ on A♦K♥9♠3♣T♦. You have top set. He checks.",
    question: 'Top set (AA) on AK93T river vs passive player who calls medium bets. He checks. What size?',
    correct: 'bet_medium',
    choices: [
      {
        val: 'bet_medium', label: 'Bet $35 (medium)', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Medium Value Extracts Most from Passive Player', emoji: '✅',
        fb: "Medium bet is correct. A passive player calls medium bets with top pair and two pair but folds those same hands to an overbet. A $35 bet gets paid by the wide part of his range — the sure $35 beats a $130 that only the nuts calls.",
      },
      {
        val: 'bet_large', label: 'Bet $80 (pot)', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Pot May Fold His Top Pair', emoji: '⚠️',
        fb: "Pot-sizing folds out a passive player's top pair and marginal holdings. He needs a reason to call a big bet — medium sizing keeps his weaker hands in and maximizes the number of streets he pays you.",
      },
      {
        val: 'overbet', label: 'Bet $130 (overbet)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Overbet Folds Everything But the Nuts', emoji: '⚠️',
        fb: "Overbetting a passive player extracts only from his strongest hands. He's folding KK, top pair, everything below two pair — you're leaving massive value on the table against a player built to call medium bets.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_073',
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Calls wide on flops but tends to give up when checked to on the turn; occasionally fires a big bet with made hands',
    },
    tableContext: null,
    positions: mkPositions({
      4: { label: 'SB (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (LR)',  action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['A','♦'], ['J','♦']),
    board: ['J♠', '7♥', '3♦', 'K♦'],
    pot: '$22',
    toCall: null,
    body: "SB vs BB loose recreational. Turn K♦ on J♠7♥3♦K♦. You have second pair plus the nut flush draw, OOP — you're first to act.",
    question: 'A♦J♦ (second pair + nut flush draw) OOP on J73K with flush draw. He checks turn. Bet or check?',
    correct: 'semi_bluff',
    choices: [
      {
        val: 'check', label: 'Check — pot control OOP', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Checking Gives Him a Free Card', emoji: '⚠️',
        fb: "Checking OOP with 12+ outs and fold equity surrenders too much. A loose rec who gives up when checked to means you're giving him a free card with a potentially losing hand. Semi-bluff for value.",
      },
      {
        val: 'semi_bluff', label: 'Bet $14 (semi-bluff)', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Semi-Bluff With Your Monster Draw', emoji: '✅',
        fb: "Bet $14 OOP with a nut flush draw plus second pair. The King is a strong scare card that represents your preflop raising range — a semi-bluff here folds out his missed floats and charges his pairs.",
      },
      {
        val: 'bet_large', label: 'Bet $22 (pot)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: "Pot-Bet May Fold His Weaker Hands", emoji: '⚠️',
        fb: "Pot-sizing OOP might fold out the hands you want to charge. $14 semi-bluff achieves fold equity from his weaker holdings while keeping pot-control for the river if he calls.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_074',
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'Folds to large river bets with one pair; calls small bets hoping to catch a bluff',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (TR)',  action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['6','♣'], ['5','♣']),
    board: ['A♠', 'K♦', '7♠', '3♣', '2♥'],
    pot: '$50',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB check-calls your bet' }] },
      { street: 'TURN', segments: [{ text: 'BB check-calls your bet' }] },
      { street: 'RIVER', segments: [{ text: 'BB checks' }] },
    ],
    body: "CO vs BB tight recreational. You barreled flop and turn with 6♣5♣ (gutshot that missed). River 2♥ — you have nothing. He checks.",
    question: '6♣5♣ (missed everything) on AK732. Tight rec checked to you on the river. You barreled twice. Third barrel or give up?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: "You've Told a Story — Finish It", emoji: '❌',
        fb: "Giving up after two barrels on a board that heavily favors your range is a mistake. A tight recreational who survived two streets has one pair — he folds to a third barrel at high frequency.",
      },
      {
        val: 'call', label: 'Bet $20 (small river bluff)', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Small Bet Gets Looked Up', emoji: '⚠️',
        fb: "A small river bluff on AK732 after two big barrels looks exactly like a blocking bet from a value hand — a tight rec who calls small bets 'to catch a bluff' will snap you off. Go big or give up.",
      },
      {
        val: 'raise', label: 'Bet $50 (pot, polarized bluff)', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Commit to the Narrative', emoji: '✅',
        fb: "Pot-size river bluff after two barrels. You've represented a strong ace on AK7 all along — a tight recreational folds one pair to a three-barrel. Commit to the story you've been telling.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_075',
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Checks most turns and rivers; occasionally value-bets strong hands small; never bluffs',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (P)',    action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['Q','♣'], ['9','♣']),
    board: ['A♥', 'T♦', '4♣', '2♠'],
    pot: '$20',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }, { text: 'you c-bet', you: true }, { text: 'BB calls' }] },
      { street: 'TURN', segments: [{ text: 'BB checks' }] },
    ],
    body: "BTN vs BB passive player. Flop A♥T♦4♣ — you c-bet, he called. Turn 2♠ — he checks. You have Q♣9♣ — queen-high, no draw, but his range is capped.",
    question: 'Q♣9♣ (queen-high, no made hand) on AT42. Passive player checks turn. Second barrel or give up?',
    correct: 'barrel',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Checking Up Has Some Merit', emoji: '⚠️',
        fb: "Checking back gives up the pot for free. A passive player who check-called the flop has a medium hand or a draw — you can fold both with a turn bet and it only costs $12.",
      },
      {
        val: 'barrel', label: 'Bet $12 (second barrel)', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Fire the Second Barrel', emoji: '✅',
        fb: "Second barrel $12. A passive player who called a c-bet on AT4 doesn't have an ace — he'd bet or check-raise. He called with a ten or a draw; a turn barrel pressures both. Take a low-cost stab.",
      },
      {
        val: 'pot', label: 'Bet $20 (pot, max pressure)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Pot-Bet Overcommits on a Draw', emoji: '⚠️',
        fb: "Pot-betting as a second barrel with no pair and no draw overcommits your chips on a pure bluff. $12 is enough to fold out his medium hands — size down and keep risk manageable.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_076',
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Bets with any pair or any draw on the flop; range is very wide and often weak',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (LR)', action: 'Raises $6', state: 'active' },
      5: { label: 'BB (You)', action: 'Called $4', state: 'hero'   },
    }),
    hand: mkHand(['K','♥'], ['3','♥']),
    board: ['K♠', '8♦', '4♥'],
    pot: '$14',
    toCall: '$10',
    body: "BB vs BTN loose recreational. Flop K♠8♦4♥ rainbow. You check. He bets $10 with a wide range.",
    question: 'K♥3♥ (top pair, terrible kicker) on K84 rainbow. Loose rec bets $10. Getting 2.4:1. What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Top Pair is Not a Fold vs Loose Rec', emoji: '❌',
        fb: "Folding top pair getting 2.4:1 against a loose recreational who bets with any pair or draw is a massive over-fold. His range is too wide for you to be behind very often.",
      },
      {
        val: 'call', label: 'Call $10', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Call and Control the Pot', emoji: '✅',
        fb: "Call. A loose recreational betting with any pair or draw means K3 is ahead of the vast majority of his range. Getting 2.4:1 on top pair, even with a terrible kicker, is a comfortable call.",
      },
      {
        val: 'raise', label: 'Check-raise to $30', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Raising Bloats Pot vs Wide Range', emoji: '⚠️',
        fb: "Check-raising bloats the pot when you're not certain where you stand against a wide range. A loose rec might have you dominated or have two pair — calling is the lower-variance line.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_077',
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Makes continuation bets on 80% of flops; recognizes board textures and slows down on very wet boards',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (AR)', action: 'Raises $6', state: 'active' },
      5: { label: 'BB (You)', action: 'Called $4', state: 'hero'   },
    }),
    hand: mkHand(['T','♦'], ['7','♦']),
    board: ['T♠', '7♥', '3♣'],
    pot: '$14',
    toCall: '$9',
    body: "BTN aggressive regular raised. You called BB with T♦7♦. Flop T♠7♥3♣ — you flopped top two pair. He c-bets $9.",
    question: 'Top two pair (T7) on T73 rainbow vs aggressive regular c-bet. What do you do?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Never Fold Two Pair', emoji: '❌',
        fb: "Folding top two pair on T73 rainbow is impossible. Check-raise and extract maximum value before the board gets dangerous.",
      },
      {
        val: 'call', label: 'Call $9', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Calling is Too Passive', emoji: '⚠️',
        fb: "Calling two pair on T73 gives every overcard and draw a free turn card at a low price. Check-raising builds the pot when you're ahead and protects your equity — don't be passive with a strong made hand.",
      },
      {
        val: 'raise', label: 'Check-raise to $28', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Check-Raise for Value and Protection', emoji: '✅',
        fb: "Check-raise to $28. Top two pair needs protection against an aggressive regular who c-bets 80% and has overcards and draws in his range. Build the pot now while you're ahead and make draws pay.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_078',
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Overbets rivers with both the nuts and complete air; calling requires reading his previous streets carefully',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (LR)',  action: 'Overbets $70', state: 'active' },
    }),
    hand: mkHand(['K','♥'], ['K','♣']),
    board: ['K♦', '8♥', '4♠', '2♣', '9♦'],
    pot: '$60',
    toCall: '$70',
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB check-calls your bet' }] },
      { street: 'TURN', segments: [{ text: 'BB check-calls your bet' }] },
      { street: 'RIVER', segments: [{ text: 'BB overbets $70' }] },
    ],
    body: "CO vs BB loose recreational. You bet flop and turn on K♦8♥4♠. River 9♦. He check-called both streets then suddenly leads $70 (overbet) on the river.",
    question: 'Top set of Kings on K8429 river. Loose rec check-called two streets then overbets $70. What do you do?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: "Top Set Doesn't Fold", emoji: '❌',
        fb: "Folding top set to an overbet is impossible. His polarized bet range includes bluffs — call or re-raise, never fold.",
      },
      {
        val: 'call', label: 'Call $70', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Calling is Fine But Raise for Value', emoji: '⚠️',
        fb: "Calling is fine but leaves value behind. You have top set against a loose player who overbets polarized — re-raise and get called by the rare hand he's doing this with.",
      },
      {
        val: 'raise', label: 'Raise to $160', icon: '⚡', cls: 'raise',
        grade: 'correct', title: "Re-Raise — He's Polarized and Calls", emoji: '✅',
        fb: "Re-raise to $160. You have top set — the loose recreational's overbet is either the nuts or a bluff. Against a player who overbets both, re-raising gets called by his value hands and wins his bluffs.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_079',
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'All three are calling stations: limp wide from any position and call any preflop raise; never fold before the flop',
    },
    tableContext: "Multiple calling stations have limped in — the pot will be multi-way and contested.",
    positions: mkPositions({
      0: { label: 'UTG (CS)',  action: 'Limps', state: 'active' },
      1: { label: 'HJ (CS)',   action: 'Limps', state: 'active' },
      2: { label: 'CO (CS)',   action: 'Limps', state: 'active' },
      3: { label: 'BTN (You)', action: '???',   state: 'hero'   },
      5: { label: 'BB',        action: 'Active',state: 'active' },
    }),
    hand: mkHand(['A','♣'], ['A','♥']),
    board: null,
    pot: '$9',
    toCall: null,
    body: "Three calling stations limp in front of you on BTN. You hold A♣A♥.",
    question: 'AA on BTN with three calling station limpers. What do you do?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Limp along — trap them', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Limping AA is Almost Always a Mistake', emoji: '❌',
        fb: "Limping AA against calling stations is leaving massive value behind. They call any raise — raise large, get them all in, and take down a $75+ pot when the flop is safe.",
      },
      {
        val: 'call', label: 'Raise to $12', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Good But Size Up With Stations', emoji: '⚠️',
        fb: "$12 is fine but undersells against calling stations who will call $25 just as readily. Size up to extract maximum value from players who literally cannot fold preflop.",
      },
      {
        val: 'raise', label: 'Raise to $25', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Large Raise — They ALL Call', emoji: '✅',
        fb: "Raise to $25. Calling stations call any raise preflop — raising large gets all three in the pot for $25 each. Don't slow-play; build the pot now with the best hand preflop.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_080',
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Checks most turns even with strong hands; bets the river for thin value occasionally; never triple-barrels',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (P)',    action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['J','♦'], ['9','♦']),
    board: ['T♠', '8♠', '3♥', 'A♣'],
    pot: '$26',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }, { text: 'you c-bet', you: true }, { text: 'BB calls' }] },
      { street: 'TURN', segments: [{ text: 'BB checks' }] },
    ],
    body: "BTN vs BB passive player. You c-bet flop, he called. Turn A♣. You have J♦9♦ — an open-ended straight draw (needs Q or 7). He checks.",
    question: 'J♦9♦ (OESD, 8 outs) on T83A. Passive player checks the turn after calling the flop. Double barrel or give up?',
    correct: 'bet_medium',
    choices: [
      {
        val: 'check', label: 'Check back — give up', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Checking Up Has Some Merit', emoji: '⚠️',
        fb: "Checking surrenders a clear semi-bluff opportunity. The ace heavily favors your preflop raising range — a passive player who checks twice has a medium hand that folds to a second barrel.",
      },
      {
        val: 'bet_medium', label: 'Bet $16 (second barrel)', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Represent the Ace — Second Barrel', emoji: '✅',
        fb: "Second barrel $16 — the ace is a perfect scare card for the BTN's opening range. A passive player who checked a second time on this board doesn't have an ace. Fire and take the pot.",
      },
      {
        val: 'bet_large', label: 'Bet $26 (pot, all-in with ace)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: "Pot-Bet Is Too Much for a Semi-Bluff", emoji: '⚠️',
        fb: "Pot-betting a second barrel with a semi-bluff over-commits. $16 achieves the same fold from a passive player and preserves chips if called — a smaller bet does the work more efficiently.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_081',
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Calls any bet with a flush draw; will call to the river with any diamond draw',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (LR)',   action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['A','♥'], ['A','♣']),
    board: ['A♦', 'K♦', '5♦'],
    pot: '$14',
    toCall: null,
    body: "BTN vs BB loose recreational. Flop A♦K♦5♦ — a monotone diamond board. You have top set but a diamond flush is possible. He checks.",
    question: 'AA (top set) on AK5 all-diamonds. Loose rec will chase any diamond draw to the river. What size?',
    correct: 'bet_large',
    choices: [
      {
        val: 'bet_small', label: 'Bet $5 (small, let him chase)', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Small Bet Gives Draws Cheap Odds', emoji: '❌',
        fb: "Small bets on a monotone board against a player who chases every draw are dangerous. He's hitting his flush cheaply and cracking your set for pennies — bet pot to charge him the correct price.",
      },
      {
        val: 'bet_medium', label: 'Bet $10 (medium)', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Medium Works But Pot is Better', emoji: '⚠️',
        fb: "Medium bet is reasonable but a flush-chasing loose recreational calls any size. Since you have top set that needs protection and he calls regardless, go pot and maximize value while denying cheap equity.",
      },
      {
        val: 'bet_large', label: 'Bet $14 (pot, deny equity)', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Pot Bet on the Flush Board', emoji: '✅',
        fb: "Pot-bet the monotone board. You need to charge the loose recreational maximum for his diamond draws — small bets give him free odds to hit the flush. Bet big, protect your set, and make him pay.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_082',
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: 'Calls nearly any bet on any street; only folds to overbets when he has complete air',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: 'Raises $6', state: 'hero'   },
      5: { label: 'BB (M)',    action: 'Called $4', state: 'active' },
    }),
    hand: mkHand(['3','♥'], ['2','♥']),
    board: ['A♠', 'K♣', 'Q♦', 'J♠'],
    pot: '$18',
    toCall: null,
    body: "BTN vs BB maniac. Turn A♠K♣Q♦J♠ — a very scary board for most hands. He checks to you. You have 3♥2♥ — complete air.",
    question: '3♥2♥ (pure air) on AKQJ — the scariest possible board. Maniac checks. Bluff or give up?',
    correct: 'check',
    choices: [
      {
        val: 'bluff_small', label: 'Bet $12 (bluff)', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Bluffing a Maniac = Bad', emoji: '❌',
        fb: "Small bluff, big bluff — it doesn't matter against a maniac who calls with air. Check back and take the free river card. There is never a good time to bluff a player who doesn't fold.",
      },
      {
        val: 'check', label: 'Check back', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Never Bluff a Maniac — Check Back', emoji: '✅',
        fb: "Check back. Even on the most terrifying board in poker, bluffing a maniac is a mistake. He calls nearly any bet with any two cards — checking is the only sensible play with nothing.",
      },
      {
        val: 'bluff_large', label: 'Bet $18 (pot)', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Burning Chips vs a Calling Machine', emoji: '❌',
        fb: "Pot-betting a maniac with 3-high is the definition of throwing money away. His calling range here includes garbage — he's not scared of AKQJ, he's hoping to catch you bluffing. Check.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_083',
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Triple-barrels with high frequency; bluffs rivers roughly 40% of the time; bet sizing tells nothing',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (AR)', action: 'Raises $6', state: 'active' },
      5: { label: 'BB (You)', action: 'Called $4', state: 'hero'   },
    }),
    hand: mkHand(['Q','♣'], ['T','♣']),
    board: ['Q♦', '9♠', '4♥', '2♦', 'K♠'],
    pot: '$70',
    toCall: '$55',
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check-call his bet', you: true }] },
      { street: 'TURN', segments: [{ text: 'you check-call his bet', you: true }] },
      { street: 'RIVER', segments: [{ text: 'you check', you: true }, { text: 'BTN bets $55' }] },
    ],
    body: "BB vs BTN aggressive regular. Three streets of betting on Q♦9♠4♥2♦K♠. He fires river $55 into $70. You have QT — second pair after the river King, decent kicker. He bluffs rivers 40% of the time.",
    question: 'QT (second pair after the river K) on Q942K river. Aggressive regular who bluffs rivers 40% fires $55. Getting 2.27:1. What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Math Demands a Call', emoji: '❌',
        fb: "Folding to an aggressive regular with a 40% river bluff frequency while getting 2.27:1 is leaving money on the table. You need 31% equity to call; he's bluffing more often than that.",
      },
      {
        val: 'call', label: 'Call $55', icon: '📞', cls: 'call',
        grade: 'correct', title: "Call — Profitable at His Bluff Rate", emoji: '✅',
        fb: "Call. Getting 2.27:1 you need to be right 31% — and he bluffs 40% of rivers. Your call is mathematically profitable. QT beats all his bluffs and it's an easy call at this price.",
      },
      {
        val: 'raise', label: 'Raise to $150', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: "Raising Folds His Bluffs", emoji: '❌',
        fb: "Raising folds out his bluffs — the exact hands you want to call with. Never raise a polarized river bettor when you're a bluff-catcher. Call and take his chips.",
      },
    ],
  }),

  // ── July 2026 batch (sc_084–sc_107): balancing thin skills per difficulty ──

  mkScenario({
    id: 'sc_084',
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Attacks late-position opens relentlessly; 3-bets the Button close to 15% of the time',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: '???',    state: 'hero'   },
      3: { label: 'BTN (AR)', action: 'Active', state: 'active' },
      4: { label: 'SB',       action: 'Active', state: 'active' },
      5: { label: 'BB',       action: 'Active', state: 'active' },
    }),
    hand: mkHand(['A','♠'], ['7','♦']),
    board: null,
    pot: '$3',
    toCall: null,
    body: "Folded to you in the Cutoff with A♠7♦. The Button is an aggressive regular who attacks late-position opens with 3-bets. The exact same hand is a standard raise one seat later — but you're not on the Button, and three players still act behind you.",
    question: 'A7 offsuit in the Cutoff, folded to you, aggressive 3-bettor on the Button. Open or fold?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'One Seat Too Early', emoji: '✅',
        fb: "A7 offsuit is a Button hand, not a Cutoff hand. With three players behind — one of them an aggressive 3-bettor who will punish your weakest opens — a one-notch-early steal bleeds money slowly. The same cards, one seat later, become a clear raise. That's what position means.",
      },
      {
        val: 'call', label: 'Limp ($2)', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Worst of Both Worlds', emoji: '❌',
        fb: "Limping A7o from the CO invites the aggressive Button to attack with a raise you can't call, and wins nothing when he doesn't. If a hand isn't strong enough to open from your seat, it isn't strong enough to limp either.",
      },
      {
        val: 'raise', label: 'Raise to $6', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Close — But the Button Changes It', emoji: '⚠️',
        fb: "This is nearly a fine open — A7o is right on the CO margin. What tips it: the aggressive 3-bettor with position on you turns every marginal open into a bad spot. Against a passive Button this raise is fine; against this one, fold and open the good stuff.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_085',
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'Solid but unadventurous; defends the big blind honestly and gives up when he misses',
    },
    tableContext: null,
    positions: mkPositions({
      4: { label: 'SB (You)', action: '???',    state: 'hero'   },
      5: { label: 'BB (TR)',  action: 'Active', state: 'active' },
    }),
    hand: mkHand(['K','♣'], ['J','♣']),
    board: null,
    pot: '$3',
    toCall: null,
    body: "Folded to you in the Small Blind with K♣J♣. Only the Big Blind — a tight recreational who plays his cards honestly — is left. You'll be out of position for the whole hand if he comes along.",
    question: 'K♣J♣ in the SB, folded to you, tight rec in the BB. Raise, complete, or fold?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding a Monster Blind Battle Hand', emoji: '❌',
        fb: "KJ suited is one of the strongest hands you'll ever fold if you let go here. Blind-vs-blind, a hand this good is a mandatory raise — folding it surrenders $1 and a hugely profitable spot for no reason.",
      },
      {
        val: 'call', label: 'Complete ($1)', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Completing Invites a Guessing Game', emoji: '⚠️',
        fb: "Completing keeps it cheap, but it plays your strongest blind-battle hand like a weak one — and you'll spend the whole hand out of position with no initiative. Raising lets you win preflop, or arrive on the flop as the aggressor. When you're going to play OOP, you want the betting lead.",
      },
      {
        val: 'raise', label: 'Raise to $6', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Raise — Take the Lead OOP', emoji: '✅',
        fb: "Raise. KJ suited crushes the Big Blind's range in a blind battle, and because you're out of position for the rest of the hand, the betting lead is worth even more — a tight rec folds outright plenty, and check-folds most flops he calls to see. Raising turns a bad seat into a profitable one.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_086',
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Calls down with any pair or decent ace; never raises without two pair; will not bluff at this pot',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (PP)',   action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['A','♠'], ['Q','♠']),
    board: ['A♥', '9♦', '5♣', '2♠', '7♦'],
    pot: '$61',
    toCall: null,
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP',  segments: [{ text: 'BB checks' }, { text: 'you bet $8', you: true }, { text: 'BB calls' }] },
      { street: 'TURN',  segments: [{ text: 'BB checks' }, { text: 'you bet $16', you: true }, { text: 'BB calls' }] },
      { street: 'RIVER', segments: [{ text: 'BB checks' }] },
    ],
    body: "BTN vs BB against a passive player who calls down with any pair. You bet the flop and turn with A♠Q♠ — top pair, queen kicker — and he called both. The river 7♦ changes nothing. He checks a third time.",
    question: 'Top pair queen kicker vs a passive caller who has checked all three streets. Bet the river or check back?',
    correct: 'bet_medium',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Value Left on the Table', emoji: '❌',
        fb: "Checking back top pair queen kicker against a player who calls with ANY pair or worse ace burns the whole point of value betting. He's told you twice he has something he won't fold — the third bet is the most profitable one. Passive players punish you only when you stop betting.",
      },
      {
        val: 'bet_medium', label: 'Bet $30', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Third Street of Value', emoji: '✅',
        fb: "Bet $30. A passive caller who check-called two streets has a worse ace or a middling pair, and he'll call a half-pot bet with most of it. The blank river is exactly when you fire the third barrel for value — this is where aggression makes its money.",
      },
      {
        val: 'bet_large', label: 'Bet $61 (pot)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Sized Past His Calling Range', emoji: '⚠️',
        fb: "The instinct to bet is right; the size is greedy. A full-pot river bet folds out the weak aces and middle pairs a passive player would happily pay $30 with — the hands your value comes from. Size to what worse hands can call, not to what the pot allows.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_087',
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'Folds to c-bets without a pair or better; does not float or fight back with air',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (TR)',   action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['A','♦'], ['K','♣']),
    board: ['9♦', '5♣', '2♠'],
    pot: '$13',
    toCall: null,
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }] },
    ],
    body: "You raised the Button with A♦K♣ and the tight rec in the BB called. The flop comes 9♦5♣2♠ — you missed, but it's dry and disconnected, and he checks to you.",
    question: 'AK unimproved on a dry 952 flop, tight rec checks. Continuation bet or check back?',
    correct: 'bet_small',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Surrendering the Best Spot to Bet', emoji: '❌',
        fb: "Checking back gives a free card in the single best c-bet spot poker offers: dry board, tight opponent, and you hold two overcards when called. A player who folds everything without a pair just checked — take the pot he's offering.",
      },
      {
        val: 'bet_small', label: 'Bet $6', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Small C-Bet, Big Leverage', emoji: '✅',
        fb: "Bet small. A tight rec whiffs this flop most of the time and folds everything without a pair — $6 wins the pot as often as $13 would, at half the price. And when he does call, you still have two overcards to improve. Cheap, relentless pressure on dry boards is where the preflop raiser prints.",
      },
      {
        val: 'bet_large', label: 'Bet $13 (pot)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Right Idea, Paying Double', emoji: '⚠️',
        fb: "Betting is right, but a pot-sized bet folds out the exact same hands a $6 bet folds — a tight rec's decision on 952 is pair-or-fold, not price-sensitive. You're risking twice as much for the same result and losing more the times he has it.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_088',
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'Calls small bets with pocket pairs below top pair; folds to big bets without top pair or better',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (Nit)', action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['K','♠'], ['K','♥']),
    board: ['8♦', '3♣', '2♥'],
    pot: '$13',
    toCall: null,
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }] },
    ],
    body: "You raised the Cutoff with K♠K♥ and the nit in the BB called. Flop 8♦3♣2♥ — bone dry. He checks. His range is mostly pocket pairs and big cards that missed; he calls small bets with the pairs and folds nearly everything to big ones.",
    question: 'Overpair on a bone-dry 832 flop vs a nit. What size gets paid?',
    correct: 'bet_small',
    choices: [
      {
        val: 'check', label: 'Check (trap)', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Trapping a Player Who Bets Nothing', emoji: '❌',
        fb: "Trapping works against players who bluff when checked to — a nit isn't one. Checking wins you nothing extra and hands him a free card; every ace or paint on the turn either scares him silent or beats you. With the best hand on a dry board, start charging.",
      },
      {
        val: 'bet_small', label: 'Bet $5', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Sized for What He Can Call', emoji: '✅',
        fb: "Bet small. On 832 nothing threatens your kings, so the only question is what his range can pay — and a nit's 99, TT, JJ will call $5 on every street while folding to anything that looks scary. Small bets on dry boards keep the second-best hands in. That's the whole art of sizing.",
      },
      {
        val: 'bet_large', label: 'Bet $13 (pot)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Big Bet, Empty Pot', emoji: '⚠️',
        fb: "You have the best hand and betting is right — but pot-sizing into a nit folds out the pocket pairs that would have paid three small bets. Big sizing on a dry board against a scared opponent wins you the minimum. Match the size to his calling range, not your hand strength.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_089',
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Limps a wide range of suited and connected junk; calls raises and plays fit-or-fold after the flop',
    },
    tableContext: null,
    positions: mkPositions({
      0: { label: 'UTG (LR)',  action: 'Limps',  state: 'active' },
      3: { label: 'BTN (You)', action: '???',    state: 'hero'   },
      5: { label: 'BB',        action: 'Active', state: 'active' },
    }),
    hand: mkHand(['A','♠'], ['K','♠']),
    board: null,
    pot: '$5',
    toCall: null,
    body: "The loose recreational limps in from UTG — something he does with any two suited or connected cards. You're on the Button with A♠K♠. The blinds are still to act.",
    question: 'A♠K♠ on the Button over a loose limper. Limp along, standard raise, or size up?',
    correct: 'raise_big',
    choices: [
      {
        val: 'call', label: 'Limp behind ($2)', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Sneaking In With a Sledgehammer', emoji: '❌',
        fb: "Limping behind with AK suited invites the blinds in cheap and plays the best hand at the table like a speculative one. Big cards want a big pot against a limper who calls raises with junk — build it now, while you're the favorite.",
      },
      {
        val: 'raise_std', label: 'Raise to $6', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Standard Size Ignores the Limper', emoji: '⚠️',
        fb: "Raising is right, but $6 is the size for an unopened pot — there's a limper in this one who calls raises wide. Add roughly one open-size per limper: his dead money and loose calls are exactly why you size up with your premiums.",
      },
      {
        val: 'raise_big', label: 'Raise to $10', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Iso-Raise, Sized Up', emoji: '✅',
        fb: "Raise to $10. A loose limper calls almost any size with the junk he limped, so the bigger raise builds a pot in position with the best unpaired hand in poker — and discourages the blinds from tagging along. Standard opens are for unopened pots; limpers buy themselves a surcharge.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_090',
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Check-calls with any pair and refuses to fold once he has connected; never folds the river to one bet',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (CS)',   action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['A','♠'], ['K','♦']),
    board: ['Q♦', '8♣', '6♥', '3♠', '9♣'],
    pot: '$29',
    toCall: null,
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP',  segments: [{ text: 'BB checks' }, { text: 'you bet $8', you: true }, { text: 'BB calls' }] },
      { street: 'TURN',  segments: [{ text: 'BB checks' }, { text: 'you check back', you: true }] },
      { street: 'RIVER', segments: [{ text: 'BB checks' }] },
    ],
    body: "BTN vs BB against a calling station. You c-bet A♠K♦ on the Q♦8♣6♥ flop and he called — with him, that means a pair he isn't folding. The turn and river bricked out. He checks the river.",
    question: 'Ace-king high on the river, station check-called the flop. Is there any bluff here?',
    correct: 'check',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'You Can\'t Bluff a Wall', emoji: '✅',
        fb: "Check. His flop call announced a pair, and a calling station's pairs do not fold to a river bet — any bluff is money set on fire. Ace-king high even wins the checkdown occasionally against his weirder floats. The discipline to not bluff certain players is worth more than any bluff.",
      },
      {
        val: 'bluff_small', label: 'Bet $15 (bluff)', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Bluffing the Unbluffable', emoji: '❌',
        fb: "Any bluff, any size, fails against a calling station holding a pair — and his flop call told you he has one. Bluffs work on players who fold; he is not one of them. Check back and keep the $15.",
      },
      {
        val: 'bluff_large', label: 'Bet $29 (pot)', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Bluffing the Unbluffable', emoji: '❌',
        fb: "Any bluff, any size, fails against a calling station holding a pair — and his flop call told you he has one. Bigger only means losing more. Bluffs work on players who fold; he is not one of them. Check back.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_091',
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'Checks whenever he has nothing and folds to the first sign of pressure; only fights back with a real hand',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (TR)',   action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['6','♠'], ['5','♠']),
    board: ['K♦', 'Q♠', '8♥', '2♣'],
    pot: '$13',
    toCall: null,
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }, { text: 'you check back', you: true }] },
      { street: 'TURN', segments: [{ text: 'BB checks' }] },
    ],
    body: "You raised the Button with 6♠5♠ and the tight rec called from the BB. He checked the K♦Q♠8♥ flop, you checked back. The turn 2♣ changes nothing — and he checks again. Two checks from a player who only fights back with real hands.",
    question: 'Six-high, but he\'s checked twice on K-Q-8-2. Take a stab or keep checking?',
    correct: 'bet_small',
    choices: [
      {
        val: 'check', label: 'Check again', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Six-High Never Wins a Checkdown', emoji: '❌',
        fb: "Your hand has no pair, no draw, and no showdown value — checking again just donates the pot to whoever pairs up. He's checked twice on a board that favors your raising range; this pot is up for grabs, and only a bet can grab it.",
      },
      {
        val: 'bet_small', label: 'Bet $8', icon: '📞', cls: 'call',
        grade: 'correct', title: 'He Told You Twice He Doesn\'t Want It', emoji: '✅',
        fb: "Bet $8. A tight player who checks twice has given up — his range is unpaired junk that folds to a single bet on a king-high board you're supposed to have hit. Six-high can't win any other way. Small, well-timed stabs at abandoned pots are the profitable end of bluffing.",
      },
      {
        val: 'bet_large', label: 'Bet $13 (pot)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Overpaying for an Abandoned Pot', emoji: '⚠️',
        fb: "Right read, wrong price. He's folding his give-ups to $8 just as surely as to $13 — and the rare hand that continues beats you either way. When a bluff targets a player who has already quit the pot, buy it at the discount.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_092',
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Bets small with made hands and shuts down when raised; pays off when draws complete',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (PP)',  action: 'Bets $5', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked', state: 'hero'   },
    }),
    hand: mkHand(['9','♥'], ['8','♥']),
    board: ['A♥', '6♥', '2♣'],
    pot: '$13',
    toCall: '$5',
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'CO raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check', you: true }, { text: 'CO bets $5' }] },
    ],
    body: "You defended the BB with 9♥8♥ against the passive player's Cutoff raise. Flop A♥6♥2♣ gives you a flush draw. You check, he bets a small $5 — you're getting 3.6:1.",
    question: 'Nine hearts to a flush, getting 3.6:1 against a passive bettor. What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding a Draw at a Discount', emoji: '❌',
        fb: "Nine outs, a $5 price, and a passive opponent who will pay you off when the flush arrives — this is the textbook call you build a bankroll on. Folding real draws at generous prices is over-folding, plain and simple.",
      },
      {
        val: 'call', label: 'Call $5', icon: '📞', cls: 'call',
        grade: 'correct', title: 'The Price Is Right', emoji: '✅',
        fb: "Call. Nine flush outs come in about 19% of the time on the turn — roughly 4.3:1 against — so 3.6:1 direct is close to break-even on its own, and his habit of paying off made flushes covers the difference easily. Count outs, compare the price, add what you win when you hit: that's the whole calculation.",
      },
      {
        val: 'raise', label: 'Check-Raise to $20', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Semi-Bluffing the Wrong Target', emoji: '⚠️',
        fb: "A check-raise has real fold equity against many players — but a passive player's bet is a made hand, and his made hands on an ace-high board don't fold to one raise. You're bloating the pot with nine-high when a $5 call sees the same card. Take the cheap draw.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_093',
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'Pot-sized bets mean top pair or better, every time; does not barrel scare cards without a hand',
    },
    tableContext: null,
    positions: mkPositions({
      0: { label: 'UTG (TR)', action: 'Bets $13', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked',  state: 'hero'   },
    }),
    hand: mkHand(['J','♠'], ['T','♠']),
    board: ['K♦', '9♣', '4♥'],
    pot: '$13',
    toCall: '$13',
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'UTG raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check', you: true }, { text: 'UTG bets $13' }] },
    ],
    body: "You defended the BB with J♠T♠ against a tight rec's UTG raise. The flop comes K♦9♣4♥ — you have a gutshot: exactly the four queens make your straight. You check, and he bets the full pot, $13. His pot-sized bets mean top pair or better.",
    question: 'Four outs to the nuts, but he pot-bet — you\'re only getting 2:1. Chase or let it go?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'The Math Says Walk Away', emoji: '✅',
        fb: "Fold. A gutshot is four outs — about 8.5% on the turn, nearly 11:1 against — and he's offering you 2:1. Even the implied money when a queen hits can't rescue a price that wrong, and your J and T make second-best pairs against his top-pair-or-better range. Good folds are just arithmetic.",
      },
      {
        val: 'call', label: 'Call $13', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Chasing at Five Times the Price', emoji: '❌',
        fb: "Four outs need roughly 11:1 to chase profitably and you're getting 2:1 — you'd need to win his whole stack every time you hit just to break even, and tight players don't pay off four-straight boards. This call is where chips quietly leak away.",
      },
      {
        val: 'raise', label: 'Check-Raise to $40', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Bluffing Into Announced Strength', emoji: '❌',
        fb: "He just told you he has top pair or better — a tight player's pot-sized bet is the most honest sentence in poker. Raising four outs into that range folds out nothing you beat and gets called by everything that crushes you. Fold and wait for a real price.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_094',
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Has not raised once in two hours; calls with everything decent, raises only hands that beat top pair',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: '???',          state: 'hero'   },
      5: { label: 'BB (PP)',  action: 'Check-Raises', state: 'active' },
    }),
    hand: mkHand(['A','♠'], ['Q','♦']),
    board: ['Q♥', '7♦', '4♠', '2♣'],
    pot: '$47',
    toCall: '$36 more',
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }, { text: 'you bet $8', you: true }, { text: 'BB calls' }] },
      { street: 'TURN', segments: [{ text: 'BB checks' }, { text: 'you bet $18', you: true }, { text: 'BB check-raises to $54' }] },
    ],
    body: "You've bet A♠Q♦ — top pair, top kicker — on the flop and turn of Q♥7♦4♠2♣, and the passive player called, then check-raised your $18 to $54. He hasn't raised a single pot in two hours. It's $36 more to you.",
    question: 'Top pair top kicker, but the table\'s most passive player just check-raised the turn. What does it mean?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Believe the Story', emoji: '✅',
        fb: "Fold, and be glad you only lost two bets. When a player who calls with everything decent finally raises, he isn't doing it with a queen you beat — his first raise in two hours is two pair or a set, and top pair top kicker is exactly the hand he's targeting. The rarer the action, the louder the read.",
      },
      {
        val: 'call', label: 'Call $36 more', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Paying to Confirm What You Know', emoji: '⚠️',
        fb: "Calling once to \"see what happens\" is understandable with top pair top kicker — but ask what worse hand takes this line. A two-hour passive player check-raising the turn has you beat essentially always, and the river bet that follows will cost even more. The read was the answer; trust it.",
      },
      {
        val: 'raise', label: 'Raise to $120', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Escalating Into the Nuts', emoji: '❌',
        fb: "Re-raising turns top pair into a bluff against the one range that never folds — a passive player's first raise of the night. Every chip that goes in from here is called by two pair or better. This is the most expensive way to ignore a read.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_095',
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: 'Barrels every street the moment he senses weakness; scare cards make him bet MORE, not less',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (M)',  action: 'Bets $45', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked',  state: 'hero'   },
    }),
    hand: mkHand(['A','♦'], ['J','♦']),
    board: ['J♠', '8♦', '4♣', 'Q♥', '2♠'],
    pot: '$69',
    toCall: '$45',
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP',  segments: [{ text: 'you check-call his $8', you: true }] },
      { street: 'TURN',  segments: [{ text: 'you check-call his $20', you: true }] },
      { street: 'RIVER', segments: [{ text: 'you check', you: true }, { text: 'BTN bets $45' }] },
    ],
    body: "You defended the BB with A♦J♦ and flopped top pair on J♠8♦4♣. The maniac barreled the flop and turn — the Q♥ dropped you to second pair — and now he fires $45 into $69 on the 2♠ river. He barrels every street the moment he senses weakness. You're getting 2.5:1.",
    question: 'Second pair, top kicker vs a maniac\'s third barrel at 2.5:1. Does his bet mean anything?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding to Noise', emoji: '❌',
        fb: "Against most players, three barrels means a queen or better and this fold is fine. Against a maniac, three barrels means it's his turn to act. His range is stuffed with busted draws and pure air, you're getting 2.5:1, and pairs like yours are exactly what beats him. Reads change everything.",
      },
      {
        val: 'call', label: 'Call $45', icon: '📞', cls: 'call',
        grade: 'correct', title: 'His Bets Carry No Information', emoji: '✅',
        fb: "Call. A maniac's third barrel tells you nothing except that you checked — he fires at every sign of weakness with any two cards, and the scare-card queen makes him bet MORE with air, not less. At 2.5:1 you need to win 29% of the time; against his anything-range, jacks with an ace kicker does far better than that.",
      },
      {
        val: 'raise', label: 'Raise to $130', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Raising Away Your Own Profit', emoji: '❌',
        fb: "Raising folds his air — the majority of his range and the entire source of your profit — while everything that continues has your second pair beat. Against a barreling maniac, the money is made by calling down with real pairs, not by fighting fire with fire.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_096',
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Opens around 40% of hands from late position; calls 3-bets with dominated aces and worse',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (LR)',   action: 'Raises $6', state: 'active' },
      3: { label: 'BTN (You)', action: '???',       state: 'hero'   },
    }),
    hand: mkHand(['A','♠'], ['Q','♠']),
    board: null,
    pot: '$9',
    toCall: '$6',
    body: "The loose recreational opens to $6 from the Cutoff — he's raising two hands in five from there, and he calls 3-bets with any ace he finds. You're on the Button with A♠Q♠.",
    question: 'A♠Q♠ on the Button facing a 40%-range Cutoff open. Flat or 3-bet?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding a Range-Crusher', emoji: '❌',
        fb: "AQ suited is miles ahead of a 40% opening range — folding it to a single loose raise gives up one of the most profitable preflop spots you'll see all session. This hand wants money in the pot right now.",
      },
      {
        val: 'call', label: 'Call $6', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Flatting Leaves Money Behind', emoji: '⚠️',
        fb: "Calling in position is never terrible, but it lets the blinds in cheap and plays a range-crushing hand as a guessing game. The whole point of AQs against a wide opener is that his dominated aces and queens pay off a 3-bet — value wants a bigger pot, not a sneakier one.",
      },
      {
        val: 'raise', label: '3-Bet to $20', icon: '⚡', cls: 'raise',
        grade: 'correct', title: '3-Bet for Pure Value', emoji: '✅',
        fb: "3-bet to $20. Against a 40% open, AQ suited is a value hand, not a coin flip — and this opponent calls 3-bets with A9, A7, KQ, exactly the hands you dominate. Build the pot in position while you're ahead; that's what 3-betting is for.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_097',
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Opens wide from late position and folds to 3-bets more often than he should; the station behind him calls anything',
    },
    tableContext: 'An aggressive open, a calling station along for the ride — dead money is piling up.',
    positions: mkPositions({
      2: { label: 'CO (AR)',  action: 'Raises $6', state: 'active' },
      3: { label: 'BTN (CS)', action: 'Calls $6',  state: 'active' },
      4: { label: 'SB (You)', action: '???',       state: 'hero'   },
      5: { label: 'BB',       action: 'Active',    state: 'active' },
    }),
    hand: mkHand(['A','♥'], ['K','♥']),
    board: null,
    pot: '$15',
    toCall: '$5 more',
    body: "The aggressive regular opens the Cutoff to $6 and the calling station flats on the Button. You wake up with A♥K♥ in the Small Blind. Flat calling invites a four-way pot out of position; there's already $15 in the middle.",
    question: 'A♥K♥ in the SB behind an open and a call. Flat or squeeze?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding the Best Hand Dealt', emoji: '❌',
        fb: "Folding AK suited preflop because you're out of position throws away one of the strongest starting hands in the game with dead money already sitting in the pot. Position problems are solved by raising, not by surrendering.",
      },
      {
        val: 'call', label: 'Call $5 more', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Flatting Creates the Worst Version', emoji: '⚠️',
        fb: "Calling is cheap, but it builds the worst possible hand-state: a four-way pot, out of position, with a hand that plays best against one opponent and wins most flops unimproved only when the field is thin. AK's strength preflop evaporates in multiway pots — the squeeze is what protects it.",
      },
      {
        val: 'raise', label: '3-Bet to $28', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Squeeze the Dead Money', emoji: '✅',
        fb: "3-bet to $28. This is the classic squeeze: a wide opener who over-folds to 3-bets, a station's dead $6 behind him, and the best unpaired hand in poker in your fist. You either take $15 uncontested or get the pot heads-up with the betting lead — both outcomes beat flatting into a four-way mess.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_098',
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'Opens roughly the top 5% from early position: big pairs and AK, nothing speculative',
    },
    tableContext: null,
    positions: mkPositions({
      0: { label: 'UTG (Nit)', action: 'Raises $6', state: 'active' },
      3: { label: 'BTN (You)', action: '???',       state: 'hero'   },
    }),
    hand: mkHand(['Q','♠'], ['J','♠']),
    board: null,
    pot: '$9',
    toCall: '$6',
    body: "The nit opens to $6 — from UTG, the seat where even loose players tighten up and where his range is almost exclusively big pairs and AK. You have Q♠J♠ on the Button. Pretty cards, great position — and a range problem.",
    question: 'Q♠J♠ on the Button vs a nit\'s under-the-gun open. Does position rescue this hand?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'The Seat He Opened From IS the Information', emoji: '✅',
        fb: "Fold. Position adjustments cut both ways — you widen up against late-position opens, and you tighten hard against early ones. A nit's UTG range is AA–QQ and AK: your queen is dominated by three of those hands and your jack by the fourth. QJs is a fine hand against a Cutoff open; against this seat, it's a trap.",
      },
      {
        val: 'call', label: 'Call $6', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Position Can\'t Fix Domination', emoji: '❌',
        fb: "The Button feels like it justifies a peek, but think about the flops you want: pair a queen and QQ/AK has you crushed; pair a jack and it's worse. Against a top-5% UTG range you're drawing to exactly the straights and flushes — far too rare to pay $6 for. His open told you his seat AND his hand; believe both.",
      },
      {
        val: 'raise', label: '3-Bet to $20', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Bluffing a Range With No Folds', emoji: '❌',
        fb: "3-betting a nit's UTG open is bluffing into the one range on the table with no folding hands in it — he continues with everything he opens, and everything he opens beats QJ. His seat did the range-reading for you; the only winning play is out.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_099',
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Calls small river bets with any pair "to see it"; folds middling pairs the moment the bet looks serious',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (PP)',   action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['A','♥'], ['T','♥']),
    board: ['T♠', '6♦', '2♣', '8♥', '3♦'],
    pot: '$29',
    toCall: null,
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP',  segments: [{ text: 'BB checks' }, { text: 'you bet $8', you: true }, { text: 'BB calls' }] },
      { street: 'TURN',  segments: [{ text: 'BB checks' }, { text: 'you check back', you: true }] },
      { street: 'RIVER', segments: [{ text: 'BB checks' }] },
    ],
    body: "BTN vs BB. You bet top pair on the T♠6♦2♣ flop, checked back the 8♥ turn for pot control, and the river 3♦ bricked. He checks a third time. A♥T♥ is almost certainly good — the question is what a worse hand will pay.",
    question: 'Top pair, ace kicker on a bricked river vs a passive caller. What\'s the right value size?',
    correct: 'bet_small',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Free Showdown, Forfeited Value', emoji: '⚠️',
        fb: "Checking guarantees the showdown, but this river is a value-betting spot you're skipping: a passive caller holds plenty of worse tens, eights, and stubborn small pairs that happily pay a small \"see it\" price. Thin value is still value — it just needs the right size.",
      },
      {
        val: 'bet_small', label: 'Bet $12', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Thin Value Wants a Small Price', emoji: '✅',
        fb: "Bet $12. This is thin value: you beat his worse tens, his eights, his pocket sevens — but only if the price lets him call. A passive player pays a third of the pot \"to see it\" with all of that; make it $29 and the same hands hit the muck. The thinner the value, the smaller the bet.",
      },
      {
        val: 'bet_large', label: 'Bet $29 (pot)', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'A Size Only Better Hands Call', emoji: '❌',
        fb: "Pot-sized bets polarize: they get called by hands that beat top pair weak-ish kicker situations and fold out everything you actually beat. Against this player, $29 folds his eights and small pairs, and the two pairs that DO call have you in trouble. You've sized yourself out of your own value.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_100',
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Calls flop bets with any pair, any draw, and plenty of overcards; the station in the blind is worse',
    },
    tableContext: 'Three to the flop — a loose caller in position behind you and a station in the blind.',
    positions: mkPositions({
      2: { label: 'CO (You)',  action: '???',       state: 'hero'   },
      3: { label: 'BTN (LR)',  action: 'Called $6', state: 'active' },
      5: { label: 'BB (CS)',   action: 'Checked',   state: 'active' },
    }),
    hand: mkHand(['9','♠'], ['9','♦']),
    board: ['9♥', '8♥', '7♣'],
    pot: '$19',
    toCall: null,
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $6', you: true }, { text: 'BTN calls' }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }] },
    ],
    body: "You opened the Cutoff with 9♠9♦ and got two callers. The flop is a flopped gift wrapped in barbed wire: 9♥8♥7♣ — top set on the wettest board imaginable, three-way. The station checks; the loose caller still lurks behind you.",
    question: 'Top set on 9♥8♥7♣, three-way. Every draw in the deck is live. What size?',
    correct: 'bet_large',
    choices: [
      {
        val: 'check', label: 'Check (trap)', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Trapping Yourself, Not Them', emoji: '❌',
        fb: "Checking top set three-way on 987 two-tone gives two loose players free cards on a board where nearly every turn card hurts you — hearts, tens, sixes, fives all complete something. You may even be behind J-T already, which is exactly why the pot needs to grow NOW while your redraws to the full house are live. Slow-playing wet boards is how sets lose stacks instead of winning them.",
      },
      {
        val: 'bet_small', label: 'Bet $8', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Betting a Toll Booth Price on a Highway', emoji: '⚠️',
        fb: "Betting beats checking, but $8 into $19 on THIS board quotes every draw a discount price — flush draws and open-enders call instantly and profitably, three-way. When the board is this wet and your opponents this sticky, protection and value point the same direction: bigger.",
      },
      {
        val: 'bet_large', label: 'Bet $19 (pot)', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Charge the Draws Full Freight', emoji: '✅',
        fb: "Pot it. Three-way on 9♥8♥7♣, loose opponents hold every flush draw, straight draw, and pair-plus-gutter imaginable — and they call big bets with all of it, which is your value AND your protection in one size. If J-T is out there, you find out for the right price with seven immediate outs to fill up — and more on the river. Wet board, sticky players, big hand: bet big.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_101',
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'Calls with top pair while the board stays safe, but folds it when the pressure escalates on scare cards',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (TR)',   action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['8','♥'], ['7','♥']),
    board: ['T♥', '9♥', '2♣', '3♦', 'K♠'],
    pot: '$65',
    toCall: null,
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP',  segments: [{ text: 'BB checks' }, { text: 'you bet $8', you: true }, { text: 'BB calls' }] },
      { street: 'TURN',  segments: [{ text: 'BB checks' }, { text: 'you bet $18', you: true }, { text: 'BB calls' }] },
      { street: 'RIVER', segments: [{ text: 'BB checks' }] },
    ],
    body: "You semi-bluffed 8♥7♥ on T♥9♥2♣ — open-ended plus a flush draw — and barreled the 3♦ turn. The tight rec check-called both. The river K♠ misses everything you were drawing to… and it's the best bluffing card in the deck: he checks, capped at one pair on a board where you always have AK and KQ.",
    question: 'The draws bricked — you hold 8-high. He\'s capped, the K just hit, and he checks. Finish the story?',
    correct: 'bet_large',
    choices: [
      {
        val: 'check', label: 'Check back — give up', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Eight-High Can\'t Win a Checkdown', emoji: '❌',
        fb: "Checking back guarantees a loss — 8-high beats nothing that called two streets. You spent two barrels building a story about a big hand, the perfect final card arrived, and giving up now is paying for a bluff and refusing to fire it. The only way this hand wins is a bet.",
      },
      {
        val: 'bet_small', label: 'Bet $15', icon: '📞', cls: 'call',
        grade: 'partial', title: 'A Bluff Sized Like an Invitation', emoji: '⚠️',
        fb: "Right card, right target, wrong number — $15 into $65 offers his tens better than 5:1, and even a tight player peels one pair at that price out of sheer curiosity. A bluff has to charge what a pair costs to keep. If the story is worth telling, tell it at full volume.",
      },
      {
        val: 'bet_large', label: 'Bet $45', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'The Card Your Whole Line Was About', emoji: '✅',
        fb: "Bet $45. Your two barrels repped exactly the overpairs and AK/KQ that just got there — and a tight rec's check-calls were top pair, now facing a third bet on the worst card in the deck for it. He folds tens here far more often than the 41% you need. Missed draws make the best bluffs because they can never win otherwise; this is bluffing at the right frequency, in the right spot.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_102',
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Defends the big blind with any suited, connected, or gapped cards; check-calls any piece, any draw',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (LR)',   action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['A','♠'], ['K','♠']),
    board: ['8♦', '7♦', '6♣'],
    pot: '$13',
    toCall: null,
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }] },
    ],
    body: "You raised the Button with A♠K♠ and the loose rec defended his BB — which he does with every suited, connected scrap of cardboard. The flop lands 8♦7♦6♣ and he checks. You missed completely — and this board just hugged his entire range.",
    question: 'AK high on 8♦7♦6♣ vs a wide BB defender. Whose board is this — and should you c-bet it?',
    correct: 'check',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Know Whose Board It Is', emoji: '✅',
        fb: "Check. Bluffing at the right frequency starts with recognizing the boards that aren't yours: 876 two-tone smashes a wide BB defense — pairs, straights, two-pair combos, every draw — and a loose rec folds none of it. Your two overcards keep real equity when checked; a c-bet just funds his range. Save the barrels for boards that hit YOUR range.",
      },
      {
        val: 'bluff_small', label: 'Bet $9', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'C-Betting Into the Caller\'s Board', emoji: '❌',
        fb: "Any bet on this board bluffs into strength: a loose defender's range is wall-to-wall pairs, draws, and made straights on 876, and he continues with all of it at any size. Autopilot c-betting is the most common bluffing leak there is — this flop is the textbook page on when to put the brakes on.",
      },
      {
        val: 'bluff_large', label: 'Bet $13 (pot)', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'C-Betting Into the Caller\'s Board', emoji: '❌',
        fb: "Any bet on this board bluffs into strength — and sizing up just raises the stakes on the mistake: a loose defender's range is wall-to-wall pairs, draws, and made straights on 876, and he continues with all of it at any size. This flop is the textbook page on when NOT to c-bet.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_103',
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: 'Check-raises flops constantly — with pairs, draws, and total air; hates surrendering to c-bets',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: '???',          state: 'hero'   },
      5: { label: 'BB (M)',   action: 'Check-Raises', state: 'active' },
    }),
    hand: mkHand(['T','♠'], ['9','♠']),
    board: ['T♦', '8♣', '6♥'],
    pot: '$21',
    toCall: '$16 more',
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }, { text: 'you bet $8', you: true }, { text: 'BB check-raises to $24' }] },
    ],
    body: "You opened the Cutoff with T♠9♠ and c-bet top pair on T♦8♣6♥. The maniac check-raised your $8 to $24 — his favorite move, made with pairs, draws, and nothing at all. It's $16 more to you.",
    question: 'Top pair plus a gutshot facing the table maniac\'s check-raise. Fold, call, or fight back?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Handing the Maniac His Blueprint', emoji: '❌',
        fb: "Folding top pair to a player who check-raises with air is precisely the reaction his whole style farms — you'd be surrendering huge equity against a range full of worse pairs, draws, and bluffs. His raise means far less than a normal player's; your calling threshold has to move with it.",
      },
      {
        val: 'call', label: 'Call $16 more', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Way Ahead of the Range That Raised', emoji: '✅',
        fb: "Call. Against a maniac's check-raise, top pair with a kicker gutshot is a monster: you beat his worse tens, his draws, and his air outright, and the four sevens add a straight when you're behind. Calling in position keeps every bluff in his range barreling into you — the raise changed the price, not the math.",
      },
      {
        val: 'raise', label: '3-Bet to $60', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Winning the Small Pot, Missing the Big One', emoji: '⚠️',
        fb: "3-betting has a real case against a wide raiser — but it folds out exactly the air and weak draws that would have kept paying you, and only the top of his range continues. With position and a hand this far ahead, flatting earns his future bluffs. Let the maniac keep being the maniac.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_104',
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'Has never been seen bluffing a river; his small bets are thin value, never a blocker with air',
    },
    tableContext: null,
    positions: mkPositions({
      0: { label: 'UTG (TR)', action: 'Bets $8', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked', state: 'hero'   },
    }),
    hand: mkHand(['9','♣'], ['8','♣']),
    board: ['A♠', '9♦', '5♥', '2♦', 'Q♣'],
    pot: '$33',
    toCall: '$8',
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'UTG raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP',  segments: [{ text: 'you check', you: true }, { text: 'UTG bets $10' }, { text: 'you call', you: true }] },
      { street: 'TURN',  segments: [{ text: 'you check', you: true }, { text: 'UTG checks back' }] },
      { street: 'RIVER', segments: [{ text: 'you check', you: true }, { text: 'UTG bets $8' }] },
    ],
    body: "You defended the BB with 9♣8♣ and called the tight rec's c-bet on A♠9♦5♥ with second pair. He checked back the turn; the river Q♣ arrived and he bets a tiny $8 into $33. You're getting over 4:1 — a price that looks impossible to refuse.",
    question: 'A pair of nines getting a huge price on a tiny bet — but from a player who has never bluffed a river. Does the discount matter?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Great Price on a Hand That Never Wins', emoji: '✅',
        fb: "Fold, and notice why: the price is irrelevant if your win rate is zero. This player has never bluffed a river — his tiny bet is a weak ace or a queen that got there, and every single hand in that range beats a pair of nines. 4:1 on a call you win almost never is just $8 lit on fire. Pot odds tell you the price; the read tells you whether you're ever winning. Read first, price second.",
      },
      {
        val: 'call', label: 'Call $8', icon: '📞', cls: 'call',
        grade: 'partial', title: 'The Price Argues, The Read Answers', emoji: '⚠️',
        fb: "At 4:1 you only need to win about one time in five, and against most players that math makes this automatic. But run his range: never bluffs, bets flop on an ace-high board, tiny river bet after the Q — that's thin value from Ax and Qx, all of it ahead of your nines. When a specific read says 'never,' the price stops mattering.",
      },
      {
        val: 'raise', label: 'Raise to $30', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Bluff-Raising a Bet That Wants a Call', emoji: '❌',
        fb: "His small bet is thin value from a player who doesn't put money in without a hand — it calls your raise with everything it bet. Turning second pair into a bluff against the table's most honest range is a move borrowed from a different opponent entirely.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_105',
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Calls everything, raises nothing — has not raised a single hand all night until now',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: '???',          state: 'hero'   },
      5: { label: 'BB (CS)',  action: 'Check-Raises', state: 'active' },
    }),
    hand: mkHand(['Q','♠'], ['Q','♥']),
    board: ['8♣', '8♦', '4♥', '2♠'],
    pot: '$47',
    toCall: '$34 more',
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }, { text: 'you bet $8', you: true }, { text: 'BB calls' }] },
      { street: 'TURN', segments: [{ text: 'BB checks' }, { text: 'you bet $18', you: true }, { text: 'BB check-raises to $52' }] },
    ],
    body: "You've value-bet Q♠Q♥ on both streets of the paired 8♣8♦4♥2♠ board, and the calling station — a player who has literally not raised a hand all night — just check-raised your $18 to $52. It's $34 more.",
    question: 'An overpair, but the station just made his first raise of the night on a paired board. What is he telling you?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'The First Raise All Night Is a Siren', emoji: '✅',
        fb: "Fold the overpair. A calling station's entire game is calling — when a player like that finally raises, on a paired board, he isn't experimenting: he has an eight. Your queens are the exact hand he's raising to get paid by. The strongest reads come from the most out-of-character actions, and this one is deafening.",
      },
      {
        val: 'call', label: 'Call $34 more', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Paying Off the Most Honest Raise in Poker', emoji: '❌',
        fb: "Whether you call one street or raise back, the ending is the same: a station's first raise of the night is trips at minimum, and queens are drawing to two outs against it. Every option except folding pays off the one bet this player has made honestly all session. He never bluffs — believe him now.",
      },
      {
        val: 'raise', label: 'Raise to $120', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Paying Off the Most Honest Raise in Poker', emoji: '❌',
        fb: "Re-raising an overpair here compounds the disaster: a station's first raise of the night is trips at minimum, and queens are drawing to two outs against it. He never bluffs, he never raises light — the only information left in this hand is how much you choose to lose. Believe him.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_106',
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: 'Raises the small blind with nearly any two cards; 4-bets light and never folds to 3-bets',
    },
    tableContext: null,
    positions: mkPositions({
      4: { label: 'SB (M)',   action: 'Raises $6', state: 'active' },
      5: { label: 'BB (You)', action: '???',       state: 'hero'   },
    }),
    hand: mkHand(['7','♦'], ['6','♦']),
    board: null,
    pot: '$8',
    toCall: '$4 more',
    body: "The maniac in the Small Blind raises to $6 — his standard move with nearly any two cards. You're in the Big Blind with 7♦6♦: it's $4 more into $8, you're getting 3:1, you close the action, and you'll have position on him for the entire hand.",
    question: '7♦6♦ getting 3:1 to close the action with position, against a nearly-any-two raiser. Defend?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding Away a Perfect Price', emoji: '❌',
        fb: "Everything about this spot argues for defending: 3:1 direct odds, guaranteed last action preflop, position every street after, a hand that flops disguised monsters, and a raiser holding random cards. Folding suited connectors here hands the maniac exactly the walkover his raises are fishing for.",
      },
      {
        val: 'call', label: 'Call $4 more', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Price, Position, Playability', emoji: '✅',
        fb: "Call. You need about 25% equity at 3:1 and 76 suited has well more than that against a random-hand range — plus you close the action and play every postflop street in position against a player who can't stop bluffing into you. This is pot odds working together with playability: the cheap flop is worth far more than the $4.",
      },
      {
        val: 'raise', label: '3-Bet to $20', icon: '⚡', cls: 'raise',
        grade: 'partial', title: '3-Betting the Player Who Never Folds', emoji: '⚠️',
        fb: "3-betting 76s is a fine play against blinds who fold — but a maniac never folds and 4-bets light, which wrecks both things the 3-bet was for. You'd bloat the pot out of the one advantage that matters here: seeing cheap flops in position against his junk. Flat, and let his aggression pay your implied odds.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_107',
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: '3-bets the Cutoff\'s opens relentlessly from the Button, then leverages position on every street after',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises $6',  state: 'hero'   },
      3: { label: 'BTN (AR)', action: '3-Bets $20', state: 'active' },
    }),
    hand: mkHand(['A','♦'], ['T','♣']),
    board: null,
    pot: '$29',
    toCall: '$14 more',
    body: "You opened A♦T♣ from the Cutoff and the aggressive regular on the Button 3-bet to $20 — his favorite spot, because whatever you do, he has position on you for the rest of the hand. The blinds are gone. It's $14 more.",
    question: 'ATo facing a Button 3-bet you\'d have to play out of position. How much does the seat change the hand?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Position Is Half the Hand\'s Value', emoji: '✅',
        fb: "Fold. ATo defends comfortably against a 3-bet when you're the one with position — and plays miserably without it: every ace-high flop you hit, you check into a player who bets his whole range; every flop you miss, position lets him take the pot. The same cards can be a call on the Button and a fold in the Cutoff. That gap IS position.",
      },
      {
        val: 'call', label: 'Call $14 more', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Buying Three Streets of Guessing', emoji: '❌',
        fb: "Calling puts you out of position for three streets against the player best equipped to exploit it, with a hand whose good flops are dominated (his 3-bets are full of AQ and AK) and whose bad flops are unplayable. The $14 isn't the cost — the postflop seat is.",
      },
      {
        val: 'raise', label: '4-Bet to $48', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Right Instinct, Wrong Candidate', emoji: '⚠️',
        fb: "Fighting back against a relentless 3-bettor is the correct adjustment — but with the right hands. ATo blocks aces without playing well when called; suited wheel aces like A5s make better 4-bet bluffs (same blocker, real playability, cleaner fold). Save the counterpunch for the hands built for it.",
      },
    ],
  }),

  // ── July 2026 batch 2 (sc_108–sc_123): beginner depth + fresh lessons ──────

  mkScenario({
    id: 'sc_108',
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'Raises early position only with strong broadways and big pairs; his opens are honest',
    },
    tableContext: null,
    positions: mkPositions({
      0: { label: 'UTG (TR)', action: 'Raises $6', state: 'active' },
      5: { label: 'BB (You)', action: '???',       state: 'hero'   },
    }),
    hand: mkHand(['K','♠'], ['J','♦']),
    board: null,
    pot: '$9',
    toCall: '$4 more',
    body: "The tight rec raises to $6 from under the gun — the seat where his already-honest range is at its strongest. You're in the Big Blind with K♠J♦. Pretty cards; look closer at what they'd be up against.",
    question: 'KJ offsuit in the BB against an honest UTG raise. What\'s wrong with these pretty cards?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Dominated Hands Lose Big Pots', emoji: '✅',
        fb: "Fold. Against an honest UTG range — AK, AQ, KQ, big pairs — KJ offsuit is dominated everywhere it matters: hit your king and KQ or AK has you out-kicked; hit your jack and it's second-best to everything. Hands like KJo don't lose small pots, they win small ones and lose big ones. That's the definition of a preflop trap.",
      },
      {
        val: 'call', label: 'Call $4 more', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Priced In to a Kicker Problem', emoji: '❌',
        fb: "The $4 price looks friendly, but price isn't the problem — domination is. Every good flop for KJo is a better flop for the AK/KQ/AQ that raised UTG, and you'll be out of position deciding how much of your stack a second-best top pair costs. Fold the pretty trap.",
      },
      {
        val: 'raise', label: '3-Bet to $20', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Bluffing the Honest Range', emoji: '❌',
        fb: "3-betting an honest UTG raiser with a dominated hand gets exactly one result: his weak opens fold, his AK/QQ+ continues, and KJo plays a bloated pot against the precise hands that crush it. Neither the bluff nor the value case exists.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_109',
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: 'Raises or 3-bets constantly behind limpers and weak opens; punishes anyone entering a pot without a plan',
    },
    tableContext: null,
    positions: mkPositions({
      1: { label: 'HJ (You)', action: '???',    state: 'hero'   },
      2: { label: 'CO (M)',   action: 'Active', state: 'active' },
      3: { label: 'BTN',      action: 'Active', state: 'active' },
      4: { label: 'SB',       action: 'Active', state: 'active' },
      5: { label: 'BB',       action: 'Active', state: 'active' },
    }),
    hand: mkHand(['A','♣'], ['3','♣']),
    board: null,
    pot: '$3',
    toCall: null,
    body: "UTG folds and it's on you in the Hijack with A♣3♣ — a cute little suited ace. The maniac is waiting in the Cutoff, and he punishes weak entries with relentless raises. Three more players sit behind him.",
    question: 'A♣3♣ in the Hijack with a maniac and three others behind. Is a baby suited ace an open this early?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Cute Isn\'t a Category', emoji: '✅',
        fb: "Fold. Baby suited aces look playable, but from the Hijack with four players behind — one of them a maniac who attacks weak opens — A3s is a hand hunting for trouble: flush draws that cost stacks when a bigger flush calls, and ace-pairs with the worst kicker in the deck. It's an open from the Button; from here it's a fold. Starting-hand discipline IS position discipline.",
      },
      {
        val: 'call', label: 'Limp ($2)', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Limping Into the Woodchipper', emoji: '❌',
        fb: "Limping a weak hand in front of a maniac is volunteering to face a raise you can't profitably call — his whole style is built on punishing exactly this entry. If a hand can't stand a raise behind, it doesn't belong in the pot from this seat.",
      },
      {
        val: 'raise', label: 'Raise to $6', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Playable Cards, Wrong Postcode', emoji: '⚠️',
        fb: "A3 suited is a real hand — two seats later. Opening it from the Hijack means four chances to run into a better hand or a 3-bet, and the maniac behind you turns that from a chance into a promise. Save the baby aces for the Button, where they steal blinds instead of starting fires.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_110',
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Opens wide from late position and calls light; a fun player to be in position against — and dangerous to play OOP against',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (LR)',  action: 'Raises $6', state: 'active' },
      4: { label: 'SB (You)', action: '???',       state: 'hero'   },
      5: { label: 'BB',       action: 'Active',    state: 'active' },
    }),
    hand: mkHand(['J','♠'], ['8','♠']),
    board: null,
    pot: '$9',
    toCall: '$5 more',
    body: "The loose rec opens to $6 from the Cutoff. You look down at J♠8♠ in the Small Blind — suited, kind of connected, kind of tempting. If you call, you'll act first on every street with the Big Blind still lurking behind you.",
    question: 'J♠8♠ in the Small Blind facing a loose open. Does "suited" rescue the worst seat at the table?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'The Worst Seat Demands the Best Hands', emoji: '✅',
        fb: "Fold. The Small Blind is the only seat that's out of position against the entire table for the entire hand — every marginal hand loses value there, and J8s is marginal with a kicker problem attached. \"Suited\" adds about 3% equity; it doesn't fix acting first on three streets against a player who loves to pounce on weakness. From the worst seat, play a tighter game than anywhere else.",
      },
      {
        val: 'call', label: 'Call $5 more', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Suited Is Not a Seat Upgrade', emoji: '❌',
        fb: "Calling puts a mediocre suited hand out of position for the whole hand with the Big Blind still un-acted behind you — you can be squeezed before the flop even arrives. Hands like J8s need position to show a profit; in the Small Blind they just bleed.",
      },
      {
        val: 'raise', label: '3-Bet to $22', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'The Aggressive Escape Attempt', emoji: '⚠️',
        fb: "3-betting at least fights for the pot instead of limping into a bad seat, and against a loose opener it has some fold equity. But J8s is a poor candidate — when he calls, you're out of position with a dominated hand and no plan. If your SB choice is between a loose call and a thin 3-bet, the third option was the answer: fold.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_111',
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: 'C-bets every flop after raising and refuses to believe check-raises; pays off with any pair or draw',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (M)',  action: 'Bets $8',  state: 'active' },
      5: { label: 'BB (You)', action: 'Checked',  state: 'hero'   },
    }),
    hand: mkHand(['Q','♠'], ['J','♠']),
    board: ['Q♦', 'J♦', '4♣'],
    pot: '$13',
    toCall: '$8',
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check', you: true }, { text: 'BTN bets $8' }] },
    ],
    body: "You defended the Big Blind with Q♠J♠ against the maniac and flopped top two pair on Q♦J♦4♣. You checked, and he fired $8 — as he does on every flop, with everything. Two diamonds are out there.",
    question: 'Top two pair against an auto-c-bettor who never believes a check-raise. What does this hand want?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding the Second Nuts of This Flop', emoji: '❌',
        fb: "You flopped top two pair against a player who bets with anything — this is nearly the best possible situation poker deals you. Folding it isn't caution, it's declining the money.",
      },
      {
        val: 'call', label: 'Call $8', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Slow-Playing a Fast Player on a Wet Board', emoji: '⚠️',
        fb: "Flatting to \"keep his bluffs in\" has logic against a maniac — but this board has flush draws and straight draws everywhere, and every diamond or ten on the turn either beats you or kills his action. Big hands on wet boards want money in NOW, and this opponent is the one player who'll pay a raise with junk.",
      },
      {
        val: 'raise', label: 'Check-Raise to $28', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Raise the Man Who Doesn\'t Believe You', emoji: '✅',
        fb: "Check-raise to $28. Top two pair wants a big pot, the two-diamond board wants the draws charged immediately, and a maniac who \"refuses to believe check-raises\" is the dream customer — he pays with any pair, any draw, any stubborn ace-high. Aggression with a big hand against a player who can't fold is where whole sessions get won.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_112',
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Bets his pairs whenever checked to and calls raises stubbornly with top pair or better',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (LR)',  action: 'Bets $10', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked',  state: 'hero'   },
    }),
    hand: mkHand(['J','♥'], ['T','♥']),
    board: ['K♥', '9♥', '2♣', '3♥'],
    pot: '$25',
    toCall: '$10',
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'CO raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check', you: true }, { text: 'CO bets $6' }, { text: 'you call', you: true }] },
      { street: 'TURN', segments: [{ text: 'you check', you: true }, { text: 'CO bets $10' }] },
    ],
    body: "You called the flop on K♥9♥2♣ with J♥T♥ — a flush draw plus a gutshot, about 12 outs. The turn 3♥ just made your flush. You checked, and the loose rec bet $10 into $25 with what's surely a pair he likes too much.",
    question: 'Your flush came in and he\'s betting into you. Call and keep him comfortable, or raise?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding a Made Flush', emoji: '❌',
        fb: "You hit one of the strongest hands you'll make all session and he's betting into it. There is no version of this street where jack-high-flush folds to one bet from a loose player's pair.",
      },
      {
        val: 'call', label: 'Call $10', icon: '📞', cls: 'call',
        grade: 'partial', title: 'One Street of Value Instead of Two', emoji: '⚠️',
        fb: "Calling wins his $10 and hopes he bets the river too — but loose recs check back rivers when the fourth heart-scare doesn't come and their pair stops feeling great. A stubborn top pair pays a raise RIGHT NOW; the river is a promise nobody signed. Made hands against sticky opponents raise for value while the paying mood lasts.",
      },
      {
        val: 'raise', label: 'Check-Raise to $35', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Raise While He Still Likes His Hand', emoji: '✅',
        fb: "Check-raise to $35. Your 12-out draw got there, he's betting a pair he's attached to, and his notes say it plainly: calls raises stubbornly with top pair. Value betting isn't just betting — it's raising the moment your opponent's second-best hand is still in love with itself.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_113',
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Calls any bet size with any pair or any draw; never folds once he\'s connected with the flop',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (CS)',  action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['J','♠'], ['T','♠']),
    board: ['J♥', 'T♥', '4♦'],
    pot: '$13',
    toCall: null,
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }] },
    ],
    body: "You raised the Cutoff with J♠T♠ and flopped top two pair on J♥T♥4♦ — a strong hand on a draw-heavy board, against the station who calls any size with any piece. He checks. Against a nit on a dry board you'd bet small; this is the opposite table.",
    question: 'Top two pair, wet board, an any-size caller. What does this combination say about sizing?',
    correct: 'bet_large',
    choices: [
      {
        val: 'check', label: 'Check (trap)', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Trapping a Player Who Traps Himself', emoji: '❌',
        fb: "A station doesn't need encouragement to put money in — he needs a bet to call. Checking wins nothing (he rarely bets for you), hands hearts and straight draws a free card, and wastes the one street where his any-pair range was ready to pay. Big hands bet; against stations, that's the entire trick.",
      },
      {
        val: 'bet_small', label: 'Bet $6', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Discount Pricing for a Full-Price Customer', emoji: '⚠️',
        fb: "Small bets are for opponents who fold too much — that's who you're protecting your action from. This one calls $13 exactly as fast as $6, with the same pairs and draws. Every dollar under his maximum is value you volunteered away on a board where the draws needed charging anyway.",
      },
      {
        val: 'bet_large', label: 'Bet $13 (pot)', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Size Up When They Can\'t Fold', emoji: '✅',
        fb: "Pot it. Sizing follows the opponent: a nit on a dry board gets a small bet because big ones fold him out — a station on a wet board gets the maximum because NOTHING folds him out. Top two pair wants value from his pairs and full price from his heart draws, and he's volunteered to pay both. When they can't fold, the pot is the floor, not the ceiling.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_114',
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'Folds to any bet without top pair or better; calls preflop with broadways and pairs then gives up when he misses',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (Nit)',  action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['T','♠'], ['8','♠']),
    board: ['A♦', 'Q♥', '6♣'],
    pot: '$13',
    toCall: null,
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }] },
    ],
    body: "You raised the Button with T♠8♠ and the nit called from the BB. The flop misses you completely — A♦Q♥6♣, no pair, no draw — but it's the perfect board for the hand you're supposed to have, and he just checked.",
    question: 'Ten-high, no draw — but it\'s an ace-high board vs a nit who folds without top pair. Bluff?',
    correct: 'bet_small',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Ten-High Needs a Better Plan Than Hope', emoji: '❌',
        fb: "Checking back ten-high with no draw has one outcome: someone else wins this pot. The board couldn't be better for a bluff — it smashes your raising range, missed his calling range, and he folds to any bet without top pair. Air is exactly the hand to bluff with; it has nothing better to do.",
      },
      {
        val: 'bet_small', label: 'Bet $6', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Your Range Hit It, His Didn\'t', emoji: '✅',
        fb: "Bet $6. This is the anatomy of a good bluff: an ace-high board that favors the preflop raiser, an opponent whose pairs-and-broadways range mostly missed it, and a player who folds everything short of top pair. Your actual cards are irrelevant — the story is airtight and the price is small. This bluff isn't brave; it's routine.",
      },
      {
        val: 'bet_large', label: 'Bet $13 (pot)', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Paying Premium for a Discount Fold', emoji: '⚠️',
        fb: "He folds his misses to $6 just as reliably as to $13 — a nit's decision is about his cards, not your price. Betting pot risks double for the identical result and donates extra the times he woke up with the ace. Right bluff, wrong invoice.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_115',
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'C-bets small with his whole range and pays off generously when draws complete against him',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (LR)', action: 'Bets $4', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked', state: 'hero'   },
    }),
    hand: mkHand(['6','♠'], ['5','♠']),
    board: ['K♥', '7♦', '4♣'],
    pot: '$13',
    toCall: '$4',
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check', you: true }, { text: 'BTN bets $4' }] },
    ],
    body: "You defended the BB with 6♠5♠ and the flop came K♥7♦4♣ — an open-ended straight draw: any 3 or any 8 completes it, eight outs. The loose rec makes his usual tiny c-bet, $4 into $13. You're getting better than 4:1.",
    question: 'Eight outs, a $4 bet, better than 4:1 — and a payer when you get there. What does the math say?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding Eight Outs to a Minimum Bet', emoji: '❌',
        fb: "Eight clean outs, a nearly-free price, and an opponent who pays off completed draws — folding here fails every test at once. If you fold open-enders to $4, no draw in your game will ever show the profit it's supposed to.",
      },
      {
        val: 'call', label: 'Call $4', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Eight Outs at a Giveaway Price', emoji: '✅',
        fb: "Call. Eight outs hit about 17% on the turn — roughly 5:1 against — and his tiny bet lays you better than 4:1 before counting a single implied dollar from a player who pays off draws. Close on the raw card, comfortably right with what comes after. Small bets make draws cheap; take every discount they offer.",
      },
      {
        val: 'raise', label: 'Check-Raise to $16', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Raising Away Your Own Discount', emoji: '⚠️',
        fb: "Semi-bluffing has its place, but a loose rec's small bet doesn't fold much — he calls your raise with pairs and better draws, and suddenly you've turned a $4 lottery ticket into a $16 one with the same eight outs. When the price is this good, the boring call is the sharp play.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_116',
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'His value bets are always about half pot; the rare times he has potted it, he showed two pair or better',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (Nit)', action: 'Bets $23', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked',  state: 'hero'   },
    }),
    hand: mkHand(['A','♥'], ['J','♥']),
    board: ['J♦', '8♠', '3♣', '6♦'],
    pot: '$23',
    toCall: '$23',
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'CO raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check', you: true }, { text: 'CO bets $5' }, { text: 'you call', you: true }] },
      { street: 'TURN', segments: [{ text: 'you check', you: true }, { text: 'CO bets $23' }] },
    ],
    body: "You check-called the nit's usual small bet on J♦8♠3♣ with A♥J♥ — top pair, top kicker. The turn 6♦ looks harmless… and then his bet doesn't: $23, the full pot, from a player whose value bets are always half that. The size itself is the tell.",
    question: 'Top pair top kicker — but the half-pot bettor just potted it. What is the size telling you?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Listen When the Sizing Changes Voice', emoji: '✅',
        fb: "Fold, even with top pair top kicker. Players have baselines, and deviations from baseline are the loudest tells they give away free: this nit's half-pot bets are his ordinary value — the rare pot-sized ones have shown two pair or better every time. He isn't bluffing you; he's telling you. Top pair is exactly the hand a bet like this wants at the table.",
      },
      {
        val: 'call', label: 'Call $23', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Calling the Bet, Ignoring the Message', emoji: '⚠️',
        fb: "TPTK feels too strong to fold, and against an unknown, calling is fine. But this isn't an unknown — it's a player with a documented sizing baseline who just broke it in the scary direction. Call the turn and you'll face a bigger, worse decision on the river holding the same one pair. The read was free; using it is the skill.",
      },
      {
        val: 'raise', label: 'Raise to $60', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Raising Into the Announcement', emoji: '❌',
        fb: "Raising top pair into the one bet this player has never made without two pair or better is aiming aggression at the exact wrong moment. His unusual size did the hand-reading for you — overriding it with a raise turns free information into an expensive mistake.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_117',
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: '3-bets constantly with junk; calls 4-bets wide out of stubbornness; cannot stand folding preflop',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises $6',  state: 'hero'   },
      3: { label: 'BTN (M)',  action: '3-Bets $20', state: 'active' },
    }),
    hand: mkHand(['J','♦'], ['J','♣']),
    board: null,
    pot: '$29',
    toCall: '$14 more',
    body: "You opened J♦J♣ from the Cutoff and the maniac 3-bet you to $20 from the Button — his third 3-bet this orbit. Against a nit, jacks flat-call here to keep the pot small. This is not a nit.",
    question: 'JJ facing a 3-bet — from the table maniac. Same hand, different villain: same play?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding a Monster to Noise', emoji: '❌',
        fb: "Against a maniac's any-two-cards 3-bet, jacks aren't a marginal hand — they're a premium crushing his range. Folding them to his third re-raise of the orbit is letting the table bully hand you a losing strategy.",
      },
      {
        val: 'call', label: 'Call $14 more', icon: '📞', cls: 'call',
        grade: 'partial', title: 'The Right Play Against the Wrong Villain', emoji: '⚠️',
        fb: "Flatting JJ against a 3-bet is the pot-control play you'd make against a tight range — but this range isn't tight, it's random. Calling lets him barrel you off the best hand on every ace-high flop, exactly what his style feeds on. Against a maniac, jacks stop being a hand you protect and become one you press.",
      },
      {
        val: 'raise', label: '4-Bet to $48', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Same Cards, Opposite Answer', emoji: '✅',
        fb: "4-bet to $48. Versus a nit's 3-bet, jacks call to keep the pot small — versus a maniac who re-raises junk and calls 4-bets out of stubbornness, they're a value monster that wants the pot big NOW, while you're miles ahead. Opponent modeling in one sentence: the villain, not the cards, picks the play.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_118',
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'C-bets nearly every flop once, but his turn checks are honest — when he keeps betting, he has it',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (AR)',   action: 'Checked', state: 'active' },
      3: { label: 'BTN (You)', action: '???',     state: 'hero'   },
    }),
    hand: mkHand(['K','♠'], ['Q','♠']),
    board: ['8♦', '5♦', '2♣', '9♣'],
    pot: '$31',
    toCall: null,
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'CO raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'CO bets $8' }, { text: 'you call', you: true }] },
      { street: 'TURN', segments: [{ text: 'CO checks' }] },
    ],
    body: "You flatted the aggressive regular's open with K♠Q♠ on the Button and called his automatic c-bet on 8♦5♦2♣ — a float, banking on position and his honest turns. The 9♣ arrives and he checks. There it is.",
    question: 'You floated the flop in position with king-high. His turn check just told you everything — now what?',
    correct: 'bet_medium',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Cashing In the Float for Half Its Value', emoji: '⚠️',
        fb: "King-high does have some showdown value, so checking isn't absurd — but it wastes what the float was FOR. You called the flop to buy this exact moment: his honest check, your position, the pot sitting there. Take the free river only if you've decided the plan was never worth executing.",
      },
      {
        val: 'bet_medium', label: 'Bet $16', icon: '📞', cls: 'call',
        grade: 'correct', title: 'The Float, Completed', emoji: '✅',
        fb: "Bet $16. This is the two-move play position makes possible: call the auto-c-bet with a hand too good to fold, then take the pot the moment his honest turn check confesses. Out of position, floating doesn't exist — you'd have to act first, blind. Acting last turns his one weakness into your whole plan.",
      },
      {
        val: 'bet_large', label: 'Bet $31 (pot)', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Overcharging for a Pot He Already Left', emoji: '❌',
        fb: "His give-ups fold to half pot just as completely as to full — and when an aggressive reg check-CALLS a pot-sized turn bet, you've built a bloated river pot holding king-high against a hand that didn't leave. Big bluffs into small surrenders is backwards sizing.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_119',
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'C-bets his whole range once, then plays honestly — folds to a check-raise without top pair or better',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (TR)', action: 'Bets $8', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked', state: 'hero'   },
    }),
    hand: mkHand(['9','♦'], ['8','♦']),
    board: ['T♦', '7♦', '2♠'],
    pot: '$13',
    toCall: '$8',
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check', you: true }, { text: 'BTN bets $8' }] },
    ],
    body: "You defended the BB with 9♦8♦ and flopped the world: T♦7♦2♠ gives you an open-ended straight draw AND a flush draw — 15 outs, roughly a coin flip against even top pair. The tight rec fires his one automatic c-bet, $8.",
    question: 'Fifteen outs against a one-and-done c-bettor. Call and hope, or put HIM to the decision?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding a Coin Flip You\'re Being Paid For', emoji: '❌',
        fb: "Fifteen outs is not a draw you fold — it's nearly 50% against top pair with two cards to come, and he's offering odds on top. This hand mathematically cannot be folded to one bet.",
      },
      {
        val: 'call', label: 'Call $8', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Taking the Passive Route With an Active Hand', emoji: '⚠️',
        fb: "Calling is profitable — the price is fine for 15 outs. But it wins only one way: hit your card. Check-raising wins TWO ways against a player who folds everything short of top pair to a raise: he folds now, or you still have a coin flip when he doesn't. When a hand this big meets a range this honest, passive is the smaller of two profits.",
      },
      {
        val: 'raise', label: 'Check-Raise to $26', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Aggression With a Safety Net', emoji: '✅',
        fb: "Check-raise to $26. This is the semi-bluff at its purest: his automatic c-bet covers a range that's mostly nothing, he folds all of it to a raise — and the times he calls, your 15 outs make you nearly even money anyway. Fold equity plus real equity is the strongest combination in poker. Monster draws are made for the raise button.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_120',
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Pays off any river bet with top pair or better; bet size does not register once he\'s decided to call',
    },
    tableContext: 'Once he decides to call, bet size does not register.',
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (CS)',   action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['Q','♠'], ['J','♠']),
    board: ['T♦', '9♣', '4♥', '2♣', 'K♦'],
    pot: '$65',
    toCall: null,
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP',  segments: [{ text: 'BB checks' }, { text: 'you bet $8', you: true }, { text: 'BB calls' }] },
      { street: 'TURN',  segments: [{ text: 'BB checks' }, { text: 'you bet $18', you: true }, { text: 'BB calls' }] },
      { street: 'RIVER', segments: [{ text: 'BB checks' }] },
    ],
    body: "You semi-bluffed Q♠J♠ on T♦9♣4♥ and barreled the turn; the station called twice, as stations do. The river K♦ makes your hand the nuts — king-high straight, nothing beats it. He checks. His notes: once he's decided to call, the size doesn't register.",
    question: 'The nuts, against a payer whose call button ignores the price. How much is this river worth?',
    correct: 'bet_huge',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Checking the Nuts to the Table\'s Best Payer', emoji: '❌',
        fb: "Checking the stone nuts against the one player guaranteed to pay a bet is the costliest \"safe play\" that exists. There's no trap to spring — he doesn't bet when checked to, he calls when bet into. The only mistake available on this river is modesty.",
      },
      {
        val: 'bet_medium', label: 'Bet $30', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Charging Half of What He\'d Pay', emoji: '⚠️',
        fb: "Half pot gets called — that's exactly the problem. His notes say size doesn't register once he's calling: the same top pairs and two pairs that call $30 call $85. Against price-sensitive players you shade down; against price-blind ones, every dollar you don't ask for is a dollar donated back.",
      },
      {
        val: 'bet_huge', label: 'Bet $85 (overbet)', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Size to the Customer, Not the Pot', emoji: '✅',
        fb: "Overbet — $85 into $65. The K river even improved his calling range: his tens are now second pair under a king he'll pay to see. Bet sizing has one master: what will this specific opponent call? A station with a piece calls everything, so with the nuts the pot stops being the ceiling. Overbetting stations for value is the most underused size in low-stakes poker.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_121',
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'Has looked you up twice tonight and both times you showed a bluff — he is primed to call you down now',
    },
    tableContext: 'Your table image is shot: two bluffs picked off this session, both shown.',
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (TR)',   action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['6','♥'], ['5','♥']),
    board: ['A♠', 'J♦', 'T♦', '2♣', 'Q♠'],
    pot: '$65',
    toCall: null,
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP',  segments: [{ text: 'BB checks' }, { text: 'you bet $8', you: true }, { text: 'BB calls' }] },
      { street: 'TURN',  segments: [{ text: 'BB checks' }, { text: 'you bet $18', you: true }, { text: 'BB calls' }] },
      { street: 'RIVER', segments: [{ text: 'BB checks' }] },
    ],
    body: "You barreled 6♥5♥ twice on A♠J♦T♦2♣ and the tight rec called both — this from the player who has already snapped off two of your bluffs tonight and seen the evidence. The river Q♠ puts four to a straight out there. He checks.",
    question: 'Third barrel with 6-high? Your last two bluffs are face-up in his memory — does this one have a chance?',
    correct: 'check',
    choices: [
      {
        val: 'check', label: 'Check back — give up', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Your Bluffing Budget Is Spent', emoji: '✅',
        fb: "Check and surrender. Bluffing at the right frequency means tracking how often you've been caught — and you've been caught twice, shown twice, against the exact player deciding whether to call. Worse, the Q completed straights for his KQ and K-J type calls. A bluff needs a believer; you burned yours two hands ago. Fold your image into the decision, not just your cards.",
      },
      {
        val: 'bluff_small', label: 'Bet $20', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'A Discount Bluff Into a Primed Caller', emoji: '❌',
        fb: "The problem isn't the size — it's the audience. He's picked off two of your bluffs tonight and is looking for the third; small or large, this barrel gets snapped by any pair, and the river Q even upgraded some of his calls to straights. When your image is shot, the bluffing lane is closed at every price.",
      },
      {
        val: 'bluff_large', label: 'Bet $45', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'The Bluff He\'s Been Waiting For', emoji: '❌',
        fb: "This is the exact bet he's been sitting there hoping you'd make — your third barrel of the night after two shown bluffs, into a player primed to call and a river that improved his range. Bluffing frequency is a resource; you spent tonight's allowance already.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_122',
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'His rare overbets have been sets protecting against draws; he shuts down the moment a flush card lands',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (Nit)', action: 'Bets $40', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked',  state: 'hero'   },
    }),
    hand: mkHand(['9','♥'], ['8','♥']),
    board: ['K♥', '7♥', '3♠', '2♦'],
    pot: '$29',
    toCall: '$40',
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'CO raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check', you: true }, { text: 'CO bets $8' }, { text: 'you call', you: true }] },
      { street: 'TURN', segments: [{ text: 'you check', you: true }, { text: 'CO bets $40' }] },
    ],
    body: "You called the flop on K♥7♥3♠ with 9♥8♥ — nine hearts to a flush. The turn 2♦ bricked, and the nit suddenly overbets: $40 into $29. You're getting just 1.7:1 now, from a player whose overbets protect sets and who stops paying the instant a heart lands.",
    question: 'Same nine outs as always — but the price collapsed to 1.7:1 and the payoff dries up when you hit. Still a call?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Draws Don\'t Have Fixed Value — Prices Do', emoji: '✅',
        fb: "Fold. The same flush draw you'd happily call at 3.6:1 is a losing call at 1.7:1 — you need about 37% to continue and one card brings roughly 19%. And the usual rescue, implied odds, is written out of this one: his overbets are sets on guard duty, and he slams the wallet shut when the third heart arrives. A draw is never \"worth\" calling — a price is.",
      },
      {
        val: 'call', label: 'Call $40', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Paying Double for the Same Nine Outs', emoji: '❌',
        fb: "Nine outs didn't get better because the bet got bigger. At 1.7:1 you're paying roughly twice what the draw is worth on the turn card, into an opponent who won't pay you off when it comes — the two ways draws make money, price and payoff, are both gone. This is how draws turn into leaks.",
      },
      {
        val: 'raise', label: 'Raise to $100', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Semi-Bluffing the Set That Just Announced Itself', emoji: '❌',
        fb: "His overbet pattern has meant a set every time — a hand that will never, ever fold to your raise. That deletes the fold-equity half of the semi-bluff and leaves you jamming money in at 2:1 against with one card to come. Raising is the only play here worse than calling.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_123',
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Plays his strong hands fast — bets and raises early; passive-then-sudden-aggression lines are not his value pattern',
    },
    tableContext: 'His strong hands bet early, never late.',
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',      state: 'hero'   },
      5: { label: 'BB (AR)',   action: 'Bets $50', state: 'active' },
    }),
    hand: mkHand(['A','♦'], ['T','♦']),
    board: ['T♠', '8♣', '4♦', '3♥', '2♠'],
    pot: '$65',
    toCall: '$50',
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP',  segments: [{ text: 'BB checks' }, { text: 'you bet $8', you: true }, { text: 'BB calls' }] },
      { street: 'TURN',  segments: [{ text: 'BB checks' }, { text: 'you bet $18', you: true }, { text: 'BB calls' }] },
      { street: 'RIVER', segments: [{ text: 'BB leads $50' }] },
    ],
    body: "You value-bet A♦T♦ — top pair, top kicker — on the flop and turn of T♠8♣4♦3♥2♠, and the aggressive reg quietly check-called twice. Then the river 2♠, the blankest card in the deck, and suddenly he LEADS $50 into $65. Strong hands in his playbook bet early, not late.",
    question: 'He check-called twice, then fired big on a total brick. Read the line: what story is he telling — and does it add up?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding to a Story With No Author', emoji: '❌',
        fb: "Ask what hand plays this way: a set or two pair from THIS player raises the flop or turn — his notes say strong hands move early. Check-call, check-call, then a big lead on a deuce that helps nothing? That's not a value line; that's 9-7, 7-6, and 6-5 realizing the last draw died. Folding top pair here is folding to a ghost.",
      },
      {
        val: 'call', label: 'Call $50', icon: '📞', cls: 'call',
        grade: 'correct', title: 'The Line Doesn\'t Add Up — Call', emoji: '✅',
        fb: "Call. Hand-reading is story-checking: every made hand he could hold had two earlier streets to raise an aggressive player's favorite way, and none did. The river 2♠ completes zero draws — but his range is FULL of dead ones (9-7, 7-6, 6-5 all bricked). A sudden lead on a blank from a passive line is the oldest missed-draw tell in the book, and at 2.3:1 your top pair only needs to be right sometimes. It will be.",
      },
      {
        val: 'raise', label: 'Raise to $140', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Raising a Bet That Can\'t Call Worse', emoji: '❌',
        fb: "The read says he's polarized — busted draws and the occasional slow-played monster. The draws fold to a raise (they can't even beat ace-high, let alone call), and the monsters re-raise you. Raising wins nothing extra when you're ahead and loses the maximum when you're not: the textbook definition of a bet with no purpose. Just call.",
      },
    ],
  }),

  // ── July 2026 batch 3 (sc_124–sc_139): beginner depth on the thin skills ───

  mkScenario({
    id: 'sc_124',
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Limps behind and overcalls with half the deck; never raises — cheap flops are his favorite food',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: '???',    state: 'hero'   },
      3: { label: 'BTN (P)',  action: 'Active', state: 'active' },
      4: { label: 'SB',       action: 'Active', state: 'active' },
      5: { label: 'BB',       action: 'Active', state: 'active' },
    }),
    hand: mkHand(['A','♥'], ['T','♥']),
    board: null,
    pot: '$3',
    toCall: null,
    body: "Folded to you in the Cutoff with A♥T♥ — a suited ace with two high cards. The passive rec on the Button tags along behind any cheap entry, and both blinds love a discount flop. The first real decision of the hand is yours.",
    question: 'A♥T♥ first to act from the Cutoff. Raise, limp, or pass — and why does the middle option not exist?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding a Cutoff Staple', emoji: '❌',
        fb: "Both passive routes give this hand away. A♥T♥ from the Cutoff is comfortably a raise — fold it and the blinds tax you all night for nothing. And the limp is worse than it looks: it wins nothing now, announces weakness, and invites the Button and both blinds to a four-way flop where one pair of aces with a ten kicker is a trouble hand instead of a favorite. Open-limping has no upside at any table: enter the pot raising or don't enter at all.",
      },
      {
        val: 'limp', label: 'Limp in ($2)', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'The Limp Buys You Nothing', emoji: '❌',
        fb: "Both passive routes give this hand away. A♥T♥ from the Cutoff is comfortably a raise — fold it and the blinds tax you all night for nothing. And the limp is worse than it looks: it wins nothing now, announces weakness, and invites the Button and both blinds to a four-way flop where one pair of aces with a ten kicker is a trouble hand instead of a favorite. Open-limping has no upside at any table: enter the pot raising or don't enter at all.",
      },
      {
        val: 'raise', label: 'Raise to $6', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Enter Raising or Not at All', emoji: '✅',
        fb: "Raise to $6. A raise gives ATs everything it wants: the blinds can fold right now, callers come in with worse aces and weaker hands, and you take initiative into a pot you'll usually play with position. A limp offers none of that — it just rents the passive player a cheap seat to outflop you. First into the pot, there are exactly two plays: raise or fold. Limping isn't a smaller raise; it's a different, worse game.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_125',
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: '3-bets from the blinds relentlessly against steals; folds to 4-bets far more often than he continues',
    },
    tableContext: 'Fourth 3-bet over a steal tonight. His 3-bets are wide; his folds to 4-bets, wider.',
    positions: mkPositions({
      3: { label: 'BTN (You)', action: 'Raises $6',  state: 'hero'   },
      4: { label: 'SB (AR)',   action: '3-Bets $22', state: 'active' },
    }),
    hand: mkHand(['A','♠'], ['5','♠']),
    board: null,
    pot: '$30',
    toCall: '$16 more',
    body: "You opened A♠5♠ on the Button and the aggressive regular in the Small Blind 3-bet to $22 — the fourth time tonight he's done this to a steal. His 3-bets are wide, and his folds to 4-bets are wider. It's $16 more to you.",
    question: 'A5 suited facing a relentless blind 3-bettor. Which of this hand\'s properties is its real strength here?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Paying the 3-Bet Tax Forever', emoji: '⚠️',
        fb: "Folding is fine once — but he's done this four times, and if every steal you make surrenders to his 3-bet, your button becomes his profit center. Against a relentless 3-bettor you must fight back with SOME hands, and A5 suited is precisely the one built for it. Fold the junk; counterpunch with this.",
      },
      {
        val: 'call', label: 'Call $16 more', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'The Weapon Used as a Shield', emoji: '❌',
        fb: "Calling keeps his junk in and turns your hand into a liability: a weak ace that's dominated whenever an ace flops and drawing thin when it doesn't. A5s's value against this player isn't its showdown strength — it's its blocker and his fold button. Calling uses neither. Pick a direction: this hand 4-bets or folds, and against a serial 3-bettor it 4-bets.",
      },
      {
        val: 'raise', label: '4-Bet to $54', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'The Blocker Does the Talking', emoji: '✅',
        fb: "4-bet to $54. A5 suited is the textbook 4-bet bluff: your ace blocks a chunk of the AA and AK he'd continue with, the suited five gives real playability the times he calls, and his relentless 3-betting means the fold half of the plan cashes constantly. That's the whole anatomy — blocker, backup equity, fold equity. Wide 3-bettors create this spot; A5s is the hand designed to collect on it.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_126',
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: 'C-bets every flop after raising and treats any lead into him as a personal insult — raises it with everything',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (M)',  action: 'Raised $6', state: 'active' },
      5: { label: 'BB (You)', action: '???',       state: 'hero'   },
    }),
    hand: mkHand(['8','♠'], ['7','♠']),
    board: ['J♣', '8♦', '3♥'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: "you're first to act", you: true }] },
    ],
    pot: '$13',
    toCall: null,
    body: "You defended the Big Blind with 8♠7♠ against the maniac's button raise and flopped middle pair on J♣8♦3♥. You're first to act, out of position for the rest of the hand — and he c-bets every flop and raises anyone who dares lead into him.",
    question: 'Middle pair, out of position, against an auto-c-bettor who attacks leads. Who should be doing the betting here?',
    correct: 'check',
    choices: [
      {
        val: 'check', label: 'Check', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Check to the Player Who Can\'t Help Himself', emoji: '✅',
        fb: "Check. Out of position with a medium hand, the check isn't passive — it's the play that uses his weakness. He c-bets everything, so checking keeps every bluff in his range firing chips at your pair; leading would fold out exactly those hands and invite a raise you can't stand. Acting first means you have the least information at the table: let his bet arrive, then decide with more of the story. When you're out of position against an aggressive player, his aggression is your bet.",
      },
      {
        val: 'bet_small', label: 'Bet $7', icon: '📞', cls: 'call',
        grade: 'partial', title: 'The "Where Am I At?" Bet', emoji: '⚠️',
        fb: "The small lead is an information bet — and the information flows the wrong way. His junk folds (you win what you'd have won anyway), his raises put you in a guessing game for real money, and either way you've told HIM plenty about your hand. Middle pair out of position doesn't need to buy information; a check gets his whole range to keep talking for free.",
      },
      {
        val: 'bet_large', label: 'Bet $14', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Donking Into the Raiser', emoji: '❌',
        fb: "Betting pot into the preflop raiser — a maniac who attacks leads on principle — accomplishes the worst of everything: hands that miss fold instead of bluffing chips to you, hands that beat you raise, and you burn a big bet finding out which. Middle pair out of position wants a small pot and his bluffs in it; this bet builds a big pot and chases them out.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_127',
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Flats opens in position, then floats c-bets and raises wet boards relentlessly — makes out-of-position pots miserable',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: '???',    state: 'hero'   },
      3: { label: 'BTN (AR)', action: 'Active', state: 'active' },
    }),
    hand: mkHand(['A','♥'], ['Q','♣']),
    board: ['8♠', '7♠', '6♥'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $6', you: true }, { text: 'BTN calls' }] },
      { street: 'FLOP', segments: [{ text: "you're first to act", you: true }] },
    ],
    pot: '$15',
    toCall: null,
    body: "You opened A♥Q♣ from the Cutoff and the aggressive regular flatted on the Button — his favorite move. The flop is 8♠7♠6♥: nothing for you, everything for the suited connectors and middle pairs he calls with, and you're out of position against the table's most relentless floater.",
    question: 'You have the best unpaired hand you can have — and the worst board and seat to bet it from. C-bet anyway?',
    correct: 'check',
    choices: [
      {
        val: 'check', label: 'Check', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'When the Board and the Seat Both Vote No', emoji: '✅',
        fb: "Check. A c-bet needs at least one thing going for it — a board that favors your range, or position to follow up. Here you have neither: 8♠7♠6♥ smashes his flatting range (pairs, connectors, suited stuff) and misses your big-card opening range, and every raise he makes puts you in a guessing game with ace-high. Checking with the intention of letting this one go isn't weak — it's recognizing that the c-bet is a tool, not a reflex, and this board is where the tool breaks.",
      },
      {
        val: 'bet_small', label: 'Bet $8', icon: '📞', cls: 'call',
        grade: 'partial', title: 'The Automatic C-Bet Meets the Wrong Board', emoji: '⚠️',
        fb: "C-betting ace-high is standard on the boards that missed him — K♥7♦2♣ and its cousins. This isn't one. His range is full of pairs and draws that continue, he floats everything else because he has position, and your $8 mostly buys a raise or a turn you have to give up on anyway. The board and the floater each argue against betting; together they end the argument.",
      },
      {
        val: 'bet_large', label: 'Bet $15 (pot)', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Maximum Bet, Maximum Regret', emoji: '❌',
        fb: "Potting ace-high out of position into the range that just hit the board is the expensive version of the mistake. Nothing worse calls, everything that continues has you beat or flipping, and the wet board hands him a raise that ends your hand on the spot. Big c-bets belong on boards you dominate with position to back them — not here, holding neither.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_128',
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Limps half his hands, calls raises with most of them, then plays fit-or-fold once the flop arrives',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (LR)',   action: 'Limps $2', state: 'active' },
      3: { label: 'BTN (You)', action: '???',      state: 'hero'   },
      4: { label: 'SB',        action: 'Active',   state: 'active' },
      5: { label: 'BB',        action: 'Active',   state: 'active' },
    }),
    hand: mkHand(['K','♦'], ['Q','♦']),
    board: null,
    pot: '$5',
    toCall: null,
    body: "The loose rec limps in from the Cutoff — as he does with half the deck — and you're next on the Button with K♦Q♦. The blinds haven't acted yet. A limp is an invitation; the question is what kind.",
    question: 'K♦Q♦ on the Button behind a limper. What does a strong hand do to a weak entry?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding a Button Premium', emoji: '❌',
        fb: "Neither quiet option is playing the hand — they're both declining it. KQ suited on the Button is near the top of your range; folding it to a $2 limp is unthinkable, and limping behind isn't much better: it caps the pot with your best position and strongest holdings, lets both blinds in for free, and hands the loose limper the cheap multiway flop his whole style feeds on. Limpers WANT you passive. Strong hands punish weak entries — raise.",
      },
      {
        val: 'limp', label: 'Limp behind ($2)', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Joining the Puddle', emoji: '❌',
        fb: "Neither quiet option is playing the hand — they're both declining it. KQ suited on the Button is near the top of your range; folding it to a $2 limp is unthinkable, and limping behind isn't much better: it caps the pot with your best position and strongest holdings, lets both blinds in for free, and hands the loose limper the cheap multiway flop his whole style feeds on. Limpers WANT you passive. Strong hands punish weak entries — raise.",
      },
      {
        val: 'raise', label: 'Raise to $10', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Punish the Limp', emoji: '✅',
        fb: "Raise to $10 — bigger than a standard open, because there's a limper to charge. The isolation raise does three jobs at once: it shoves the blinds out, it gets the loose limper's dead money in while you hold position and the better hand, and it buys you the initiative against a fit-or-fold player who will miss two flops out of three. Aggression isn't about bluffing — it's about never letting weak plays go unbilled.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_129',
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'C-bets faithfully when his preflop raise connects; his checks after raising are honest surrender',
    },
    tableContext: null,
    positions: mkPositions({
      4: { label: 'SB (TR)',  action: 'Checked', state: 'active' },
      5: { label: 'BB (You)', action: '???',     state: 'hero'   },
    }),
    hand: mkHand(['9','♣'], ['8','♣']),
    board: ['Q♦', '8♥', '4♠'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'SB raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'SB checks' }] },
    ],
    pot: '$12',
    toCall: null,
    body: "The tight rec raised from the Small Blind and you defended with 9♣8♣. The flop comes Q♦8♥4♠ — middle pair for you — and instead of his usual faithful c-bet, he checks. From this player, that check is a confession.",
    question: 'The reliable c-bettor didn\'t c-bet. What did he just tell you, and what does your pair of eights want to do about it?',
    correct: 'bet_medium',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Letting the Confession Go to Waste', emoji: '⚠️',
        fb: "Checking back isn't a disaster — your pair has showdown value. But his skipped c-bet told you his range is mostly big cards that missed, and every one of them holds six outs against your eights. A free turn card is a gift to AK and AJ, paid for by you. When an honest player announces weakness, the pot is sitting there asking to be taken; checking leaves it on the table and invites the overcard that turns your win into his.",
      },
      {
        val: 'bet_medium', label: 'Bet $8', icon: '📞', cls: 'call',
        grade: 'correct', title: 'The C-Bet That Didn\'t Come', emoji: '✅',
        fb: "Bet $8. This player c-bets when he's connected — so the check IS the read: a range of AK, AJ, KJ-type hands that whiffed Q♦8♥4♠. Your middle pair is almost certainly best right now, and betting does both jobs at once: it takes the pot from hands that were about to give up, and it makes the ones that peel pay for their six overcard outs. Aggression isn't just for bluffs and monsters — it's for the moment an honest opponent tells you the pot is unguarded.",
      },
      {
        val: 'bet_large', label: 'Bet $16', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Overcharging a Range That Already Quit', emoji: '❌',
        fb: "His missed hands fold to $8 exactly as fast as to $16 — you can't collect extra from a range that's done with the hand. What an oversized bet does change is what happens when he continues: a tight player calling or raising your overbet on this flop has your eights beat, and now the pot is twice as bloated. Size the bet to the job; the job here is small.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_130',
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'Treats blind defense as optional — folds his blind to almost any raise and plays fit-or-fold when he does peel',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',    state: 'hero'   },
      4: { label: 'SB (TR)',   action: 'Active', state: 'active' },
      5: { label: 'BB',        action: 'Active', state: 'active' },
    }),
    hand: mkHand(['T','♥'], ['7','♥']),
    board: null,
    pot: '$3',
    toCall: null,
    body: "Folded to you on the Button with T♥7♥ — a hand no chart loves. But the chart didn't watch the last two hours: the tight rec in the Small Blind folds his blind to almost anything, and the Big Blind is no fighter either. There's $3 out there that keeps going unclaimed.",
    question: 'T♥7♥ is a fold against blinds who defend. These blinds don\'t. Which fact wins?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Right Against Defenders, Wrong Against These Two', emoji: '⚠️',
        fb: "Against blinds who fight back, folding T7 suited is exactly correct — that's why it feels safe. But the entire point of reading opponents is that reads change your defaults: when both blinds surrender to any raise, the $3 in the middle is nearly free money, hand almost irrelevant. Folding here isn't discipline; it's ignoring two hours of evidence because a chart said so.",
      },
      {
        val: 'limp', label: 'Limp in ($2)', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'The One Play With No Argument', emoji: '❌',
        fb: "Limping gets the worst of every world: it puts money in with a weak hand, collects zero fold equity from two players whose defining flaw is folding, and invites a multiway flop where T7 needs to actually make a hand. The whole reason this spot is profitable is their fold button — the limp is the one play that never presses it.",
      },
      {
        val: 'raise', label: 'Raise to $6', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Steal What They Keep Giving Away', emoji: '✅',
        fb: "Raise to $6. In a vacuum T7 suited isn't a Button open — but poker isn't played in a vacuum, it's played against these two, and they fold. When the blinds surrender to almost any raise, stealing wide isn't a bluff, it's rent collection: risk $6 to win $3 from players who rarely contest, and even the times they peel, they play fit-or-fold with you holding position. The read, not the cards, makes this raise. That's opponent modeling in one hand.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_131',
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'Has not 3-bet in two hours; when he finally re-raises, it is queens or better and ace-king, nothing else',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Raises $6',  state: 'hero'   },
      3: { label: 'BTN (Nit)', action: '3-Bets $20', state: 'active' },
    }),
    hand: mkHand(['A','♠'], ['Q','♥']),
    board: null,
    pot: '$29',
    toCall: '$14 more',
    body: "You opened A♠Q♥ from the Cutoff — a clearly profitable open — and then the unthinkable: the nit 3-bet to $20. His first re-raise in two hours, from a player whose 3-betting range is queens-plus and ace-king, full stop. It's $14 more.",
    question: 'AQ is a strong hand. Against THIS range, is it? Do the matchup math before touching a chip.',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Strong Hand, Wrong Opponent', emoji: '✅',
        fb: "Fold, and don't look back. Run AQ against his actual range — QQ+, AK — and there isn't a single hand you're happy against: AK dominates your ace, the pairs dominate everything. This is the same $14 you'd happily put in against the maniac's junk-filled 3-bets, and that's the entire lesson: a hand has no fixed strength, only strength against a range. The nit spent two hours defining his; believe him.",
      },
      {
        val: 'call', label: 'Call $14 more', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Calling Into the Definition of Dominated', emoji: '❌',
        fb: "Continuing at all is the mistake — pick your poison. Call, and every flop you like is a disaster: an ace makes AK a bigger pot-winner and AA a stack-taker, a queen walks into QQ and KK barrels. 4-bet, and you're bluffing the one player at the table who cannot fold what he finally 3-bet — his range doesn't contain a folding hand. Position and prettiness don't rescue AQ from a range that's precisely QQ+/AK; only the fold button does.",
      },
      {
        val: 'raise', label: '4-Bet to $48', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Bluffing the Unbluffable', emoji: '❌',
        fb: "Continuing at all is the mistake — pick your poison. Call, and every flop you like is a disaster: an ace makes AK a bigger pot-winner and AA a stack-taker, a queen walks into QQ and KK barrels. 4-bet, and you're bluffing the one player at the table who cannot fold what he finally 3-bet — his range doesn't contain a folding hand. Position and prettiness don't rescue AQ from a range that's precisely QQ+/AK; only the fold button does.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_132',
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Chases every draw he finds, but he does the math when you make him — pays bad prices reluctantly, good ones gladly',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (LR)',   action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['A','♣'], ['J','♣']),
    board: ['J♠', 'T♠', '4♥'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }] },
    ],
    pot: '$13',
    toCall: null,
    body: "You raised A♣J♣ on the Button and flopped top pair, top kicker on J♠T♠4♥ — a strong hand on a board crawling with draws: two spades, straight cards everywhere. The loose rec checks. He'll chase anything; the only question is what price he chases at.",
    question: 'Top pair on a draw-heavy board. Your bet size is a price tag — what should a flush draw have to pay?',
    correct: 'bet_large',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Free Cards on a Board Like This', emoji: '❌',
        fb: "Checking hands every draw on the board exactly what it wants: a free look at the card that beats you. On a dry board, checking back top pair has its moments — on J♠T♠4♥ against a chaser, it's the one play that can't be defended. The draws are there, he has them often, and the only question is whether they pay. Your check answers: no charge.",
      },
      {
        val: 'bet_small', label: 'Bet $4', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Right Idea, Wrong Price Tag', emoji: '⚠️',
        fb: "You bet — good — but do the math on what you charged: $4 into $13 offers his draws better than 4:1, and a flush draw only needs about 4:1 to call correctly. You set a price that turns his chases profitable, which means the bet changed nothing except the pot size. A bet that doesn't change your opponent's math is a check with extra steps. Against a player who counts, make the count come out wrong for him.",
      },
      {
        val: 'bet_large', label: 'Bet $10', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'You Set the Price Draws Pay', emoji: '✅',
        fb: "Bet $10 — about three-quarters of the pot. This is the heart of bet sizing: your bet is the price tag on his draw, and at $10 into $13 every flush draw and gutshot pays roughly 2:1 on a chase that hits far less often than that. He calls anyway — chasers chase — and every call is money moved to you in slow motion. Size to the board, not just the hand: wet boards demand a price that makes chasing a mistake.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_133',
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Snap-calls any discounted price with any two cards — and he has position on you; only a full-sized raise slows him down',
    },
    tableContext: null,
    positions: mkPositions({
      1: { label: 'HJ (You)', action: '???',    state: 'hero'   },
      2: { label: 'CO (CS)',  action: 'Active', state: 'active' },
      3: { label: 'BTN',      action: 'Active', state: 'active' },
      4: { label: 'SB',       action: 'Active', state: 'active' },
      5: { label: 'BB',       action: 'Active', state: 'active' },
    }),
    hand: mkHand(['K','♠'], ['Q','♥']),
    board: null,
    pot: '$3',
    toCall: null,
    body: "Folded to you in the Hijack with K♠Q♥ — an easy open. The interesting part is the size: the station in the Cutoff, sitting right behind you with position, calls anything that looks like a bargain, and KQ offsuit hates a crowded flop.",
    question: 'The open is automatic; the amount isn\'t. What does each size invite from the seats behind you?',
    correct: 'raise',
    choices: [
      {
        val: 'limp', label: 'Limp in ($2)', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'An Invitation to the Whole Table', emoji: '❌',
        fb: "A limp prices in everyone — the station flops anything with position on you, the blinds come along free, and KQ plays a four-way pot where top pair is never safe and second-best kickers cost real money. The problem with cheap entries isn't just passivity; it's that YOU set the price of the flop, and you set it at 'everyone welcome.'",
      },
      {
        val: 'raise_small', label: 'Min-raise to $4', icon: '📞', cls: 'call',
        grade: 'partial', title: 'A Raise That Doesn\'t Raise Anything', emoji: '⚠️',
        fb: "The raising instinct is right — the number is decoration. $4 changes nobody's decision: the station calls a discount with rags, the Big Blind gets 3.5:1 to peel with junk, and you've built a multiway pot at a size that filtered out no one. A raise has a job — thin the field so your big cards play against one player, not four. A min-raise skips the job and keeps the title.",
      },
      {
        val: 'raise', label: 'Raise to $6', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Size the Raise to Do Its Job', emoji: '✅',
        fb: "Raise to $6. KQ offsuit wants exactly what a full-sized raise buys: a heads-up pot, ideally against a blind, where one pair with a good kicker is usually the best hand. At $6 the station needs an actual hand to call out of position— at $4 he needs a pulse. Preflop sizing isn't about the chips, it's about the shape of the flop you'll see: full raises buy small fields, and small fields are where high-card hands make their living.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_134',
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Called your open in position and never folds once any part of his hand touches the board',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: '???',     state: 'hero'   },
      3: { label: 'BTN (CS)', action: 'Active',  state: 'active' },
      5: { label: 'BB (LR)',  action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['A','♦'], ['K','♦']),
    board: ['9♣', '8♣', '7♥'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $6', you: true }, { text: 'BTN calls' }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }] },
    ],
    pot: '$19',
    toCall: null,
    body: "You opened A♦K♦ from the Cutoff and got two callers — the station on the Button, the loose rec in the Big Blind. The flop is 9♣8♣7♥: a total whiff for you, a playground for both of their calling ranges. The BB checks; the station waits behind you with position.",
    question: 'Ace-king high, two opponents, and a board that hit both of them. How many people does a bluff have to fool?',
    correct: 'check',
    choices: [
      {
        val: 'check', label: 'Check', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Bluffs Shrink With Every Caller', emoji: '✅',
        fb: "Check. A bluff needs everyone to fold, and everyone here won't: the odds of getting through two players are roughly the square of getting through one, this 9♣8♣7♥ board pours pairs and draws into both of their calling ranges — and one of your two targets is a station who doesn't fold on principle. Heads-up on a dry board, ace-king high c-bets happily. Multiway on a wet one, the bluff isn't brave, it's arithmetic that doesn't work. Check, and let this pot go find its rightful owner.",
      },
      {
        val: 'bet_medium', label: 'Bet $10', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Two Targets, One of Them Bulletproof', emoji: '❌',
        fb: "Any bluff into this pair of opponents fails the same test twice: BOTH players must fold, on the one flop texture — middling and connected — that hit both of their ranges square, and one of them is a station whose folding muscle atrophied years ago. Size doesn't rescue it; $19 buys the same calls as $10, just dearer. Save the c-bet for boards that missed them and, above all, for fewer of them: bluffing is a headcount business, and this room is too crowded.",
      },
      {
        val: 'bet_large', label: 'Bet $19 (pot)', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Pot-Sized Into a Crowd', emoji: '❌',
        fb: "Any bluff into this pair of opponents fails the same test twice: BOTH players must fold, on the one flop texture — middling and connected — that hit both of their ranges square, and one of them is a station whose folding muscle atrophied years ago. Size doesn't rescue it; $19 buys the same calls as $10, just dearer. Save the c-bet for boards that missed them and, above all, for fewer of them: bluffing is a headcount business, and this room is too crowded.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_135',
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Reads checked-through streets as weakness and calls river stabs with any pair; his own checks are caution, not surrender',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (LR)',   action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['6','♦'], ['5','♦']),
    board: ['K♠', 'J♥', '8♣', '9♥', '3♣'],
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP',  segments: [{ text: 'BB checks' }, { text: 'you check', you: true }] },
      { street: 'TURN',  segments: [{ text: 'BB checks' }, { text: 'you check', you: true }] },
      { street: 'RIVER', segments: [{ text: 'BB checks' }] },
    ],
    pot: '$13',
    toCall: null,
    body: "You raised 6♦5♦ on the Button, whiffed K♠J♥8♣ completely, and sensibly checked it through — twice. Now the river 3♣ changes nothing, the loose rec checks a third time, and the pot sits there looking stealable. Ask first: what hand would YOU have that plays this way and now bets?",
    question: 'Six-high wants to bluff at a $13 pot. You checked twice already — what story would a river bet even tell?',
    correct: 'check',
    choices: [
      {
        val: 'check', label: 'Check back — give up', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'A Bluff Needs a Story, and Yours Has Two Blank Pages', emoji: '✅',
        fb: "Check and let it go. A believable bluff represents a real hand playing a real line — but you checked the flop AND the turn, and no value hand you could hold tells that story before suddenly betting a blank river. This opponent reads double-checks as weakness and calls with any pair on a board made of them (kings, jacks, eights, nines all connect). Six-high loses every showdown, but a called bluff loses more. Some pots were never yours; this one stopped being yours on the flop.",
      },
      {
        val: 'bluff_small', label: 'Bet $9', icon: '📞', cls: 'call',
        grade: 'partial', title: 'A Stab With Logic but No Audience', emoji: '⚠️',
        fb: "River stabs after checked-through streets do work — against opponents who give up. This one does the opposite: your two checks are exactly why he'll call, because they told him his bottom pair is good, and K♠J♥8♣9♥ left his loose range full of pairs to call with. The play isn't wrong in general; it's wrong against a player whose note reads 'calls river stabs with any pair.' Know which opponents fold to the weakness-stab, and save it for them.",
      },
      {
        val: 'bluff_large', label: 'Bet $18', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Betting Big on a Story You Never Told', emoji: '❌',
        fb: "An overbet is supposed to say 'I have it.' After two checks, it says 'I remembered the pot exists.' No hand you'd play this way bets this river for value, the loose rec calls stabs with any pair precisely because you showed weakness twice, and this board dealt his range pairs by the handful. Bluffing frequency starts with bluff selection: no story, no believer, no bet.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_136',
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: 'Barrels every street once he starts and never folds to raises; his bets are constant, but they are never free cards',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (M)',  action: 'Bets $24', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked',  state: 'hero'   },
    }),
    hand: mkHand(['J','♥'], ['T','♥']),
    board: ['Q♦', '9♣', '3♠', '2♣'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check', you: true }, { text: 'BTN bets $8' }, { text: 'you call', you: true }] },
      { street: 'TURN', segments: [{ text: 'you check', you: true }, { text: 'BTN bets $24' }] },
    ],
    pot: '$29',
    toCall: '$24',
    body: "You defended J♥T♥ and flopped an open-ended straight draw on Q♦9♣3♠ — any king or eight. The cheap flop call was easy. But the turn 2♣ bricked, and the maniac's bet tripled: $24 into $29. You're getting 2.2:1 now, with one card to come.",
    question: 'Eight outs \'is 32% with two cards to come\' — so why might that number be the trap here?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Two Cards Only Count If You See Them Both', emoji: '✅',
        fb: "Fold. The famous 32% for eight outs assumes you see BOTH remaining cards — but his $24 only buys you one. On a single card, eight outs hit about 17%, roughly 5:1 against, and he's laying you just 2.2:1. That 'rule of four' number is for all-in situations; against a player who charges you street by street — and this one never stops betting — the turn is priced with the rule of two. Same outs as the flop, completely different math. The card count didn't change; the price of admission did.",
      },
      {
        val: 'call', label: 'Call $24', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Paying a Two-Card Price for One Card', emoji: '❌',
        fb: "Putting more chips in is the mistake in either form. Calling pays 2.2:1 on a 5:1 shot — the 32% two-card figure doesn't apply when the river will cost you another bet from a player who always fires. And check-raising sends good money after bad in the one matchup where semi-bluffs die: maniacs don't fold, so the 'fold equity' half of the raise is fiction and you're left all-in on eight outs. When the price is wrong and the opponent is unfoldable, the draw goes in the muck.",
      },
      {
        val: 'raise', label: 'Check-Raise to $60', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Semi-Bluffing the Unfoldable', emoji: '❌',
        fb: "Putting more chips in is the mistake in either form. Calling pays 2.2:1 on a 5:1 shot — the 32% two-card figure doesn't apply when the river will cost you another bet from a player who always fires. And check-raising sends good money after bad in the one matchup where semi-bluffs die: maniacs don't fold, so the 'fold equity' half of the raise is fiction and you're left all-in on eight outs. When the price is wrong and the opponent is unfoldable, the draw goes in the muck.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_137',
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'C-bets one street with his whole range — big cards included — then gives up honestly when he has nothing',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (TR)', action: 'Bets $8', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked', state: 'hero'   },
    }),
    hand: mkHand(['8','♥'], ['7','♥']),
    board: ['9♦', '8♣', '5♥'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check', you: true }, { text: 'BTN bets $8' }] },
    ],
    pot: '$13',
    toCall: '$8',
    body: "You defended 8♥7♥ and the flop came 9♦8♣5♥: middle pair, plus a gutshot — any six makes your straight. The tight rec fires his standard one-and-done c-bet, $8 into $13. You're getting 2.6:1. The question is what you're actually holding: one weak pair, or more?",
    question: 'Middle pair AND a gutshot AND a c-bettor who\'s often just holding big cards. Add it all up before you decide.',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding a Hand With Three Ways to Win', emoji: '❌',
        fb: "This fold throws away three different assets at once: a pair that's frequently the best hand right now (his c-bet range is stuffed with unpaired big cards), four straight outs, and five more outs to trips or two pair when you ARE behind. Any one of those alone might not justify $8 — together, at 2.6:1, they're not close. Weak-looking hands with layered equity are exactly where over-folders bleed.",
      },
      {
        val: 'call', label: 'Call $8', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Add Up Everything You\'ve Got', emoji: '✅',
        fb: "Call. Pot odds aren't just for flashy draws — count the WHOLE hand: your eights beat every ace-king and ace-queen he auto-c-bets, four sixes make a straight, and two eights plus three sevens upgrade you when he does have a nine or an overpair. Made-hand value plus draw value plus a 2.6:1 price is a comfortable continue, and his one-and-done habit means the turn often checks through for free. Equity comes in layers; players who only count the obvious ones fold winners.",
      },
      {
        val: 'raise', label: 'Check-Raise to $26', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'It Works — It\'s Just Unnecessary', emoji: '⚠️',
        fb: "Check-raising an honest one-street c-bettor prints money in the right spots, and this isn't a terrible one. But your hand doesn't want the job: it beats the hands that would fold anyway and gets action only from the ones that beat you. Calling keeps his whiffed big cards bluffing into your pair and keeps your price on the straight draw tiny. Save the check-raise for hands that NEED fold equity; this one profits quietly without it.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_138',
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Check-calls his draws to the bitter end and never bets without a made hand; when he suddenly leads, the last card made him',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',      state: 'hero'   },
      5: { label: 'BB (P)',    action: 'Bets $45',  state: 'active' },
    }),
    hand: mkHand(['K','♠'], ['Q','♦']),
    board: ['K♥', '9♥', '4♣', '2♠', '6♥'],
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP',  segments: [{ text: 'BB checks' }, { text: 'you bet $8', you: true }, { text: 'BB calls' }] },
      { street: 'TURN',  segments: [{ text: 'BB checks' }, { text: 'you bet $18', you: true }, { text: 'BB calls' }] },
      { street: 'RIVER', segments: [{ text: 'BB leads $45' }] },
    ],
    pot: '$65',
    toCall: '$45',
    body: "You value-bet K♠Q♦ — top pair, strong kicker — through K♥9♥4♣ and the 2♠ turn, and the passive rec quietly check-called both streets. The river is the 6♥, the third heart. And for the first time all hand, he bets: $45 into $65, leading straight into you.",
    question: 'He check-called twice, then the flush card arrived, and NOW he\'s betting. What changed — his hand, or his mood?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'He Called, He Called, and Then the Heart Came', emoji: '✅',
        fb: "Fold. Read the sequence like a sentence: passive players check-call while they're drawing and bet when they arrive — and the one card that changed between his last check-call and this sudden lead is the 6♥ completing the flush. Players like him don't invent river bluffs; the line and the card agree completely. Top pair did its job for two streets against a drawing hand. Paying $45 now isn't a call, it's a receipt. When a card that completes the obvious draw flips a caller into a bettor, believe the pattern.",
      },
      {
        val: 'call', label: 'Call $45', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Paying $45 to Confirm the Obvious', emoji: '❌',
        fb: "Every extra chip goes in against a hand that just announced itself. The story has no other reading: a player who never bets without the goods check-called two streets — the signature of a draw — and woke up betting the instant the third heart landed. Calling pays him off; raising is lighting money on fire against a range that's practically face-up flushes and re-raises you with them. His passivity made him easy to read all hand. The read only has value if you act on it: fold.",
      },
      {
        val: 'raise', label: 'Raise to $120', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Raising One Pair Into a Face-Up Flush', emoji: '❌',
        fb: "Every extra chip goes in against a hand that just announced itself. The story has no other reading: a player who never bets without the goods check-called two streets — the signature of a draw — and woke up betting the instant the third heart landed. Calling pays him off; raising is lighting money on fire against a range that's practically face-up flushes and re-raises you with them. His passivity made him easy to read all hand. The read only has value if you act on it: fold.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_139',
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'His value bets grow street by street; when a hand of his dies along the way, the final bet shrinks to a token stab',
    },
    tableContext: 'His real hands size up street by street.',
    positions: mkPositions({
      3: { label: 'BTN (AR)', action: 'Bets $4', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked', state: 'hero'   },
    }),
    hand: mkHand(['9','♠'], ['9','♦']),
    board: ['Q♣', '7♦', '4♠', 'J♦', '3♥'],
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP',  segments: [{ text: 'you check', you: true }, { text: 'BTN bets $8' }, { text: 'you call', you: true }] },
      { street: 'TURN',  segments: [{ text: 'you check', you: true }, { text: 'BTN bets $20' }, { text: 'you call', you: true }] },
      { street: 'RIVER', segments: [{ text: 'you check', you: true }, { text: 'BTN bets $4' }] },
    ],
    pot: '$69',
    toCall: '$4',
    body: "You check-called the aggressive reg twice with 9♠9♦ under the Q♣7♦4♠ board — $8, then $20 as the J♦ raised the stakes. Then the river 3♥ blanks and his story collapses: $4 into $69. From a player whose real hands bet bigger every street, the whimper is deafening.",
    question: 'Bets of $8, $20… then $4 into a $69 pot. What does a bet that tiny usually mean from a player like this?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding at 17-to-1 to a Whimper', emoji: '❌',
        fb: "You're being offered better than 17:1 on a bet that reads as pure surrender — from this player, value bets climb, they don't collapse. Folding a pair here needs him to have a monster more than 94% of the time, and the size says the opposite. Some folds are discipline; this one is just flinching at the word 'bet.'",
      },
      {
        val: 'call', label: 'Call $4', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Big, Bigger… Tiny', emoji: '✅',
        fb: "Call. Bets that grow tell one story — a hand that likes every card. Bets that collapse tell another: $8, $20, then $4 is a hand that stopped believing in itself, the busted straight draws and give-ups paying a token price to see if you'll fold. Your nines beat every hand that whimpers like this, and at 17:1 you'd only need to win once in eighteen for the call to break even. Sizing patterns are the loudest tell in poker; the drop-off IS the information.",
      },
      {
        val: 'raise', label: 'Check-Raise to $40', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'You Read Him Right, Then Overplayed It', emoji: '⚠️',
        fb: "The read is correct — the tiny bet is weak — but the raise misuses it. His give-ups fold to your check-raise, and you beat them anyway at showdown for $4; the only hands that pay off $40 are the slow-played monsters that have your nines crushed. Raising risks ten times the price to win nothing extra from the range you beat. When the cheap call already banks the read, take the profit quietly.",
      },
    ],
  }),

  // ── July 2026 batch 4 (sc_140–sc_155): 2 per skill, 1 beginner + 1 int ─────

  mkScenario({
    id: 'sc_140',
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: 'Sits directly behind you and 3-bets early-position opens constantly — small pairs can\'t stand the heat',
    },
    tableContext: null,
    positions: mkPositions({
      0: { label: 'UTG (You)', action: '???',    state: 'hero'   },
      1: { label: 'HJ (M)',    action: 'Active', state: 'active' },
      2: { label: 'CO',        action: 'Active', state: 'active' },
      3: { label: 'BTN',       action: 'Active', state: 'active' },
      4: { label: 'SB',        action: 'Active', state: 'active' },
      5: { label: 'BB',        action: 'Active', state: 'active' },
    }),
    hand: mkHand(['3','♣'], ['3','♦']),
    board: null,
    pot: '$3',
    toCall: null,
    body: "First to act, under the gun, with 3♣3♦. A pocket pair is always tempting — but this one plays the whole hand out of position against five unknown seats, and the maniac in the Hijack punishes early opens with 3-bets you can't call with treys.",
    question: 'Bottom pocket pair from the worst seat. What do small pairs need that UTG can\'t give them?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Small Pairs Need Cheap Flops and Good Seats', emoji: '✅',
        fb: "Fold. Treys make a set one flop in eight — the other seven you hold the worst pair possible, out of position against the whole table. Small pairs profit when the flop is cheap and your seat is late; UTG guarantees neither, and the maniac behind you makes the 'cheap' part a fantasy. The same 3♣3♦ is a fine open from the Button. Position isn't just about postflop play — it decides which hands are playable at all.",
      },
      {
        val: 'limp', label: 'Limp in ($2)', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Limping Into the 3-Bet You Fear', emoji: '❌',
        fb: "The limp tries to buy the cheap flop treys want — from the one seat where it's not for sale. The maniac attacks weak entries, and when his raise arrives you either fold $2 away or call more, out of position, still holding bottom pair. If a hand can't stand a raise from five players behind, it doesn't enter the pot from UTG.",
      },
      {
        val: 'raise', label: 'Raise to $6', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Playable Pair, Wrong Postcode', emoji: '⚠️',
        fb: "Raising is at least honest aggression, and some players do open small pairs everywhere. But from UTG, treys open a pot they can't defend: 3-bets force a fold or a bad set-mine, callers behind hold position on you all hand, and seven flops in eight leave you with nothing to bet honestly. Save the small pairs for the seats where the flop comes cheap and you act last.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_141',
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Opens wide from any seat and pays off 3-bets with most of it; his callers tend to come along too',
    },
    tableContext: null,
    positions: mkPositions({
      1: { label: 'HJ (LR)',  action: 'Raises $6', state: 'active' },
      3: { label: 'BTN (CS)', action: 'Calls $6',  state: 'active' },
      5: { label: 'BB (You)', action: '???',       state: 'hero'   },
    }),
    hand: mkHand(['A','♦'], ['Q','♦']),
    board: null,
    pot: '$15',
    toCall: '$4 more',
    body: "The loose rec opens to $6 from the Hijack — routine for him — and the station on the Button flats, as he does with anything. You're in the Big Blind with A♦Q♦, looking at $4 more, two wide ranges, and a pile of money that already likes the pot.",
    question: 'AQ suited against a wide opener AND a station caller. Your hand is ahead of both ranges — what does that suggest?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding the Best Hand at the Table', emoji: '❌',
        fb: "Against these two ranges — a wide open and an any-two flat — A♦Q♦ is comfortably the strongest hand in the pot, and you're being offered it at a discount. Folding here isn't tight; it's declining money that was being handed to you.",
      },
      {
        val: 'call', label: 'Call $4 more', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Closing the Action, Opening the Problems', emoji: '⚠️',
        fb: "The $4 call is fine arithmetic — you close the action getting a great price. But it plays the hand three-way, out of position, with the pot small exactly when your edge is biggest. AQ suited against two wide, sticky ranges doesn't want a cheap look; it wants their loose money in the middle while it's still the best hand. Calling isn't wrong so much as small.",
      },
      {
        val: 'raise', label: '3-Bet to $28', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'The Value Squeeze', emoji: '✅',
        fb: "3-bet to $28 — and note why the size is big: this isn't a squeeze-bluff hoping they fold, it's a value squeeze expecting they won't. The loose opener pays off 3-bets, the station calls behind him, and every extra dollar goes in while A♦Q♦ dominates both of their ranges. When the players are this loose, the squeeze changes jobs: less about the fold button, more about the price of their stubbornness. Charge it.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_142',
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'Check-calls only with real pieces of the board; his river calls have shown top pair with good kickers',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (TR)',   action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['A','♥'], ['8','♥']),
    board: ['A♦', 'Q♣', '7♠', '4♥', '2♦'],
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP',  segments: [{ text: 'BB checks' }, { text: 'you bet $8', you: true }, { text: 'BB calls' }] },
      { street: 'TURN',  segments: [{ text: 'BB checks' }, { text: 'you check', you: true }] },
      { street: 'RIVER', segments: [{ text: 'BB checks' }] },
    ],
    pot: '$29',
    toCall: null,
    body: "You raised A♥8♥ on the Button and bet your top pair once on A♦Q♣7♠; the tight rec check-called — and his check-calls mean a real piece. The turn went check-check, and now his river check hands you the last word on the hand.",
    question: 'Top pair, weak kicker, last to act. Before betting, ask: which hands call you, and which fold?',
    correct: 'check',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'The Free Showdown Is a Prize — Take It', emoji: '✅',
        fb: "Check it back and turn your cards over. Run the river bet through the only test that matters: his queens and worse aces mostly fold, his better aces — the heart of a tight check-calling range — call. A bet wins nothing extra and loses more; the check wins the pot every time your hand is good, for free. That option is position itself: last to act, you're the only player at the table who can simply end the hand and collect. Out of position, A8 would be facing a bet right now, guessing.",
      },
      {
        val: 'bet_small', label: 'Bet $12', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Thin Value Needs a Different Customer', emoji: '⚠️',
        fb: "Betting thin isn't a sin — against a station who calls with any queen, $12 here is fine. But this is a tight rec whose check-calls have shown top pair with better kickers than yours: the hands that pay your bet beat you, and the ones you beat let go. Thin value is opponent-specific. Against this customer, the showdown you already own is worth more than the bet.",
      },
      {
        val: 'bet_large', label: 'Bet $25', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Turning a Winner Into a Guess', emoji: '❌',
        fb: "A big bet polarizes you — it tells him you have a strong ace or nothing — and a tight player responds precisely: folds everything you beat, calls everything that beats you. You've taken a hand that wins at showdown constantly and converted it into a bet that only loses. The last seat's superpower is the free showdown; this bet throws it away at maximum price.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_143',
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Opens almost any two when folded to on the Button; folds most of it to 3-bets, barrels hard when he does continue',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (AR)', action: 'Raises $6', state: 'active' },
      4: { label: 'SB (You)', action: '???',       state: 'hero'   },
      5: { label: 'BB',       action: 'Active',    state: 'active' },
    }),
    hand: mkHand(['A','♠'], ['J','♠']),
    board: null,
    pot: '$9',
    toCall: '$5 more',
    body: "Folded to the aggressive regular on the Button, who raises to $6 — as he does with almost anything when it's folded to him. You're in the Small Blind with A♠J♠: too good to fold to a steal, and sitting in the one seat where calling creates its own problems.",
    question: 'AJ suited in the Small Blind facing a Button steal. The hand clearly continues — but which way, and why?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Folding the Best Hand to the Widest Range', emoji: '⚠️',
        fb: "Discipline in the Small Blind is usually right — but AJ suited crushes a Button-steal range, and folding it makes his any-two raise print against you. The SB's tight standards exist because of the seat's problems; a hand this far ahead is exactly the one that's supposed to fight through them.",
      },
      {
        val: 'call', label: 'Call $5 more', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'The Worst Seat\'s Worst Habit', emoji: '❌',
        fb: "The Small Blind flat is a trap with three jaws: you're out of position against the whole table for the entire hand, the Big Blind is still behind you with a squeeze available, and your call caps your range — he barrels every flop knowing you'd have 3-bet your monsters. Calling turns the best hand preflop into a guessing game on every street after. In this seat, that price is never as cheap as it looks.",
      },
      {
        val: 'raise', label: '3-Bet to $24', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'From the Small Blind, Play 3-Bet-or-Fold', emoji: '✅',
        fb: "3-bet to $24. The Small Blind is the one seat where the middle option barely exists: a flat invites the squeeze, plays capped and faceup, and signs you up for three streets out of position. The 3-bet fixes all of it at once — it folds out most of his any-two range immediately, takes the initiative for the times he continues, and shuts the Big Blind out of the pot. Same hand, one seat back, calling is fine. Here, the seat picks the play: 3-bet or fold, and AJ suited is far too good to fold.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_144',
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Bets tiny on rivers with medium hands hoping for a cheap showdown — and can\'t quite fold them once he\'s put chips in',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (LR)', action: 'Bets $5', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked', state: 'hero'   },
    }),
    hand: mkHand(['T','♥'], ['8','♥']),
    board: ['T♦', '8♦', '3♣', 'K♠', '2♥'],
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP',  segments: [{ text: 'you check', you: true }, { text: 'BTN bets $8' }, { text: 'you call', you: true }] },
      { street: 'TURN',  segments: [{ text: 'you check', you: true }, { text: 'BTN checks' }] },
      { street: 'RIVER', segments: [{ text: 'you check', you: true }, { text: 'BTN bets $5' }] },
    ],
    pot: '$29',
    toCall: '$5',
    body: "You check-called the flop with T♥8♥ — two pair on T♦8♦3♣ — and the K♠ turn went check-check. On the river 2♥ he bets $5 into $29: the classic tiny 'please just call' bet from a player who wants a cheap showdown with something medium.",
    question: 'Two pair facing a $5 shrug-bet. Calling is easy and obviously fine — is it the most this hand can earn?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding Two Pair to Five Dollars', emoji: '❌',
        fb: "You have two pair and he's begging you to call five dollars. There is no read, no board, no universe in which this fold makes sense — bets this small from medium hands are the softest money poker offers.",
      },
      {
        val: 'call', label: 'Call $5', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Winning the Minimum on Purpose', emoji: '⚠️',
        fb: "Calling banks the pot and can't lose much — but look at what the bet told you: tiny river bets are medium hands asking for a cheap showdown, which means he HAS something, and his notes say he can't fold it once chips are in. A hand that bets $5 to see your cards will pay $25 for the same view. Calling is the play against a bluff; against an announced medium hand, it's a discount you're giving him.",
      },
      {
        val: 'raise', label: 'Raise to $25', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Punish the Shrug-Bet', emoji: '✅',
        fb: "Raise to $25. His tiny bet is an open book — 'I have a medium hand, please show me yours cheaply' — and the correct response to an open book is to charge admission. King-x and worse two pairs that bet $5 for a look will grudgingly call a fair raise; that's the difference between winning the pot and winning the hand. This is the aggression that matters most at low stakes: not bluffing more, but never letting a made hand collect less than the customer was willing to pay. (When you're the one HOLDING the bluff-catcher against this bet, just call — the raise is for value.)",
      },
    ],
  }),

  mkScenario({
    id: 'sc_145',
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Limps everything remotely playable and takes flops four ways; folds to real pressure before the flop',
    },
    tableContext: 'Three limpers in, nobody showing strength — a loose family pot.',
    positions: mkPositions({
      1: { label: 'HJ (P)',   action: 'Limps $2', state: 'active' },
      2: { label: 'CO',       action: 'Limps $2', state: 'active' },
      3: { label: 'BTN',      action: 'Limps $2', state: 'active' },
      5: { label: 'BB (You)', action: '???',      state: 'hero'   },
    }),
    hand: mkHand(['K','♥'], ['Q','♥']),
    board: null,
    pot: '$9',
    toCall: null,
    body: "Limp, limp, limp — three of them, led by the passive rec in the Hijack, and the Small Blind is gone. You check your option holding K♥Q♥... or do you? The pot is $9 of loose change, and nobody has shown a hint of strength.",
    question: 'KQ suited, a free option, and three limpers who\'ve announced weakness. What\'s wrong with taking the free flop?',
    correct: 'raise_big',
    choices: [
      {
        val: 'check', label: 'Check your option', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Free Isn\'t the Same as Best', emoji: '⚠️',
        fb: "The check costs nothing, which makes it feel safe — but it plays KQ suited four ways, out of position, in a pot nobody built for you. Top pair in a limped family pot wins small and gets outdrawn constantly. Free flops are for junk. A premium suited broadway against three announced-weak ranges wants the pot bigger and the field smaller, and only one action does both.",
      },
      {
        val: 'raise_small', label: 'Raise to $6', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'A Raise Priced Like an Invitation', emoji: '❌',
        fb: "Raising $4 more into three limpers changes nobody's plans — each of them calls getting huge odds, and you've built a bigger four-way pot without thinning it, the worst of both worlds. Multiway raises have to be sized for the crowd: too small, and you've just sweetened the pot for the field you were trying to shrink.",
      },
      {
        val: 'raise_big', label: 'Raise to $12', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Punish the Parade', emoji: '✅',
        fb: "Raise to $12. Three limps are three confessions, and passive limpers fold to real pressure before the flop — most of that $9 walks straight into your stack uncontested. When someone does call, you've got a premium suited hand, the initiative, and a heads-up pot instead of a four-way lottery. Sizing scales with the crowd: a big raise into limpers isn't a bluff, it's collections. Checking your option with a hand this strong is the quiet leak that never shows up in anyone's notes.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_146',
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Anchors on the pot, not his hand — calls half-pot river bets with any pair he\'s carried that far',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (CS)',   action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['J','♠'], ['T','♠']),
    board: ['Q♦', '9♥', '3♣', '8♦', '2♠'],
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP',  segments: [{ text: 'BB checks' }, { text: 'you bet $8', you: true }, { text: 'BB calls' }] },
      { street: 'TURN',  segments: [{ text: 'BB checks' }, { text: 'you bet $20', you: true }, { text: 'BB calls' }] },
      { street: 'RIVER', segments: [{ text: 'BB checks' }] },
    ],
    pot: '$69',
    toCall: null,
    body: "Your J♠T♠ turned the straight on Q♦9♥3♣8♦ and the station called you the whole way, as stations do. The river 2♠ changes nothing and he checks. The pot is $69 — and the only question left is a number.",
    question: 'The straight is made, the caller is caught. Is a $6 bet and a $35 bet even the same kind of decision?',
    correct: 'bet_medium',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'The Last Street Pays the Best', emoji: '❌',
        fb: "He called two streets with a pair and arrived at the river still holding it — this is the exact moment his stubbornness is supposed to pay you. Checking back a straight against a caller isn't caution; it's leaving the biggest bet of the hand unbilled.",
      },
      {
        val: 'bet_small', label: 'Bet $6', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Six Dollars Into Sixty-Nine', emoji: '⚠️',
        fb: "At least it's a bet — but look at it as a fraction, because that's how poker counts: $6 into $69 is under a tenth of the pot, from a hand that beats everything he called with. Bets aren't dollar amounts, they're percentages of what's in the middle, and his notes say he anchors on the pot too — he calls HALF of it with any pair. You asked for a tip when the menu said he'd pay for dinner.",
      },
      {
        val: 'bet_medium', label: 'Bet $35 (half pot)', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Think in Fractions, Not Chips', emoji: '✅',
        fb: "Bet $35 — half the pot, which is the smallest useful way to think about any bet. A $6 bet and a $35 bet aren't sizes of the same play; they're different plays entirely, because his decision runs on the pot: he calls half-pot with the pairs he's carried this far, so half-pot is what the straight charges. Train the habit now, at every stake: before picking a number, name the fraction. Chips lie; percentages don't.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_147',
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Reads small bets as weakness and raises them relentlessly; lately he\'s been checking back flops when just called',
    },
    tableContext: 'He\'s raised two small flop bets tonight and shown down air both times.',
    positions: mkPositions({
      3: { label: 'BTN (AR)', action: 'Raised $6', state: 'active' },
      5: { label: 'BB (You)', action: '???',       state: 'hero'   },
    }),
    hand: mkHand(['7','♠'], ['6','♠']),
    board: ['9♠', '8♥', '5♦'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: "you're first to act", you: true }] },
    ],
    pot: '$13',
    toCall: null,
    body: "You defended 7♠6♠ against the aggressive regular and flopped the nuts — 9♠8♥5♦ wraps your straight. You're first to act against a player who's been checking back flops lately, but who attacks small 'scared' bets on sight. Twice tonight he's raised one and shown down air.",
    question: 'The nuts, out of position, against a bully who hates small bets. How do you get his chips moving?',
    correct: 'bet_small',
    choices: [
      {
        val: 'check', label: 'Check (go for the check-raise)', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'The Standard Play Against the Wrong Tendency', emoji: '⚠️',
        fb: "Check-raising the c-bettor is the textbook line with a flopped monster — but you're holding the book upside down for this opponent: he's been checking back flops when merely called, so your check risks a free turn card and a pot that never grows. Reads outrank defaults. When the c-bet stopped being automatic, the check-raise stopped being the plan.",
      },
      {
        val: 'bet_small', label: 'Bet $4', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Set the Bait He Can\'t Resist', emoji: '✅',
        fb: "Lead $4 — a bet designed to look exactly like the weakness he loves to attack. His notes write the script: small bets get raised, and twice tonight the raise was air. Your tiny lead hands him rope, his raise builds the pot with junk, and your re-raise or call keeps the nuts in the driver's seat. This is the deepest bet-sizing idea in the game: size doesn't just extract value, it PROVOKES action. Against a bully, the smallest bet is the loudest bait.",
      },
      {
        val: 'bet_large', label: 'Bet $13 (pot)', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Scaring Off Your Best Customer', emoji: '❌',
        fb: "A pot-sized lead into the preflop raiser announces strength — the one message that makes an aggressive player behave. His air folds instead of raising, his medium hands proceed with caution, and the nut straight wins a pot the size of a handshake. You have the hand that can't be outdrawn standing against the player who can't resist attacking; big sizing is the only way to lose the show.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_148',
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'Calls river bets only with a pair or better; never pays off with unimproved high cards',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (TR)',   action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['A','♦'], ['J','♥']),
    board: ['9♦', '8♦', '6♠', '3♣', '2♥'],
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP',  segments: [{ text: 'BB checks' }, { text: 'you check', you: true }] },
      { street: 'TURN',  segments: [{ text: 'BB checks' }, { text: 'you check', you: true }] },
      { street: 'RIVER', segments: [{ text: 'BB checks' }] },
    ],
    pot: '$13',
    toCall: null,
    body: "You raised A♦J♥, the tight rec defended, and the 9♦8♦6♠ flop was one to check behind on — his territory, not yours. It checked through again on the 3♣, and now he checks the 2♥ river. Ace-high, $13 pot, and a strong urge to 'just take it.'",
    question: 'Before you bluff, answer one question: which hands fold to your bet — and were any of them beating you?',
    correct: 'check',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Your Hand Already Beats Everything That Folds', emoji: '✅',
        fb: "Check and show it down. A bluff earns money one way: by folding out better hands. Now audit his three checks — a tight rec with any pair bets or check-calls somewhere, so his range here is whiffed broadways and king-high, and your ace-high beats every bit of it at showdown for free. The only hands that call your bet are pairs, which beat you. Betting folds out what you beat and gets called by what beats you: the perfect anti-bluff. Hands with showdown value don't need to bluff — they already win the quiet way.",
      },
      {
        val: 'bluff_small', label: 'Bet $9', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Bluffing Away a Winning Hand', emoji: '❌',
        fb: "Run the accounting on this bet at any size: every hand that folds — busted king-high, queen-high — was already losing to your ace at showdown, so those folds earn you nothing. Every hand that calls has a pair, so those calls all cost you. The bet cannot gain and can only lose; it converts a hand that wins the pot for free into one that pays to lose it. Bluff with hands that can't win a showdown. Ace-high on this river isn't one of them.",
      },
      {
        val: 'bluff_large', label: 'Bet $18', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'The Expensive Version of Pointless', emoji: '❌',
        fb: "Run the accounting on this bet at any size: every hand that folds — busted king-high, queen-high — was already losing to your ace at showdown, so those folds earn you nothing. Every hand that calls has a pair, so those calls all cost you. The bet cannot gain and can only lose; it converts a hand that wins the pot for free into one that pays to lose it. Bluff with hands that can't win a showdown. Ace-high on this river isn't one of them.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_149',
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'Hates big rivers without the nuts — folds one-pair hands to serious pressure when obvious draws complete',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (TR)',   action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['A','♠'], ['T','♦']),
    board: ['Q♠', '9♠', '4♦', '8♣', '2♠'],
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP',  segments: [{ text: 'BB checks' }, { text: 'you bet $8', you: true }, { text: 'BB calls' }] },
      { street: 'TURN',  segments: [{ text: 'BB checks' }, { text: 'you bet $18', you: true }, { text: 'BB calls' }] },
      { street: 'RIVER', segments: [{ text: 'BB checks' }] },
    ],
    pot: '$65',
    toCall: null,
    body: "You barreled A♠T♦ on Q♠9♠4♦ and the 8♣ — gutshot, overcard, and the nut spade in your hand — and the tight rec check-called twice. The river 2♠ completes the flush, misses you entirely… and puts the one card in your hand that matters: the A♠ says he doesn't have the nut flush, because you do... the blocker version of it.",
    question: 'Busted draw, ace-high — and the A♠ in your hand on a three-spade river. What story can you tell that he can\'t call?',
    correct: 'bet_huge',
    choices: [
      {
        val: 'check', label: 'Check back — give up', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Surrendering With the Best Card in the Deck', emoji: '❌',
        fb: "Checking loses at showdown almost always — he check-called two streets, so his range is pairs that beat ace-high. Unlike a hand with showdown value, this one has nothing to protect and everything to gain: the flush came in, he hates big rivers without the nuts, and you hold the A♠ that makes the nut flush impossible for him. This is the one river where giving up costs more than firing.",
      },
      {
        val: 'bet_medium', label: 'Bet $25', icon: '📞', cls: 'call',
        grade: 'partial', title: 'A Nut Story Told in a Small Voice', emoji: '⚠️',
        fb: "The right read, the wrong volume. A $25 bet into $65 offers his top pair 3.6:1 — a price that makes even a nervous tight player call to 'keep you honest' with the flush out there. Polarized stories need polarized sizes: if your bet claims the nut flush, it has to cost what the nut flush would charge. Small bluffs on scare cards die from their own affordability.",
      },
      {
        val: 'bet_huge', label: 'Bet $70 (overbet)', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'The Blocker Bluff, Full Price', emoji: '✅',
        fb: "Overbet — $70 into $65. Every piece is in place: the third spade is the exact card your two barrels advertised, his check-calls capped him at one pair, his notes say he folds those to big rivers when draws complete — and your A♠ is the crown jewel, removing the nut flush from his range entirely while letting you credibly claim it yourself. That's what a blocker is for: you're not just betting that he's weak, you're holding the card that proves he can't be strong. When the story, the opponent, and the blocker all agree, bet like you mean it.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_150',
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: 'Opens constantly and drags callers along; his pots go multiway and bloated more often than not',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (M)',   action: 'Raises $6', state: 'active' },
      3: { label: 'BTN',      action: 'Calls $6',  state: 'active' },
      4: { label: 'SB',       action: 'Calls $6',  state: 'active' },
      5: { label: 'BB (You)', action: '???',       state: 'hero'   },
    }),
    hand: mkHand(['8','♦'], ['6','♦']),
    board: null,
    pot: '$20',
    toCall: '$4 more',
    body: "The maniac opens to $6 from the Cutoff, the Button calls, the Small Blind calls, and you're in the Big Blind with 8♦6♦ — a hand you'd fold without a thought heads-up. But there's $20 in the middle, it's $4 to you, and you close the action: 5:1.",
    question: '8♦6♦ is junk. $4 into a $20 pot at 5:1, closing the action, is not junk. Which one are you playing?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Folding the Price Along With the Hand', emoji: '⚠️',
        fb: "Folding 86 suited is never a catastrophe — but at 5:1, closing the action with no raise possible behind you, it's leaving equity on the table. You need to win about 17% of the time for the call to break even, and a live suited one-gapper against three wide ranges clears that bar with room to spare. The lesson runs one way: you don't call because the hand is good; you call because the price is.",
      },
      {
        val: 'call', label: 'Call $4 more', icon: '📞', cls: 'call',
        grade: 'correct', title: 'The Price Makes the Hand', emoji: '✅',
        fb: "Call. This decision is arithmetic wearing a poker face: $4 to win $20 is 5:1, meaning you need about 17% equity, and 8♦6♦ — suited, connected, fully live against three loose ranges — carries more than that to every flop. Closing the action seals it: no re-raise can punish you, so the price you see is the price you get. Fold this exact hand to a normal raise heads-up, forever. But when the pot lays 5:1 and the risk is capped, junk stops being junk. Read the price first, the cards second.",
      },
      {
        val: 'raise', label: '3-Bet to $26', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Squeezing With a Hand That Wanted a Discount', emoji: '❌',
        fb: "A squeeze needs folds, and this table doesn't sell them — the maniac continues with everything and two callers are already glued to the pot. 3-betting 86 suited turns a $4 bargain into a $26 bloated guess, out of position, with the worst high-card hand at the table. The pot odds were offering you a cheap lottery ticket; the raise buys the whole losing roll.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_151',
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Marries top pair and pays it off through completed draws — as long as the danger isn\'t obvious on the board',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (LR)', action: 'Bets $10', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked',  state: 'hero'   },
    }),
    hand: mkHand(['7','♣'], ['6','♣']),
    board: ['K♠', '8♦', '5♥'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check', you: true }, { text: 'BTN bets $10' }] },
    ],
    pot: '$13',
    toCall: '$10',
    body: "You defended 7♣6♣ and flopped an open-ended straight draw on the rainbow K♠8♦5♥ — any 9 or 4 fills it. The loose rec bets $10 into $13: only 2.3:1, a thin direct price for eight outs. But study the board — when your card lands, what will he see? Nothing.",
    question: 'The direct price is marginal. What are the other dollars in this call — and why does THIS draw collect them?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Counting Only the Dollars on the Table', emoji: '❌',
        fb: "By raw one-card math, 2.3:1 for a 5:1 draw looks like a fold — but that arithmetic pretends the hand ends on the turn. It doesn't: this opponent marries top pair, and your straight card is a stealth missile. No flush pattern, no paired board, just a harmless-looking 9 or 4 — he'll never see it coming and his king will pay off two more streets. Direct odds are the sticker price; implied odds are the deal. Draws this disguised, against payers this loyal, call thin prices for a living.",
      },
      {
        val: 'call', label: 'Call $10', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Hidden Outs Are Worth Extra', emoji: '✅',
        fb: "Call — and know exactly why, because the direct price alone doesn't justify it. Implied odds have two requirements: an opponent who pays when you hit, and a draw he can't see coming. You have both. His notes say he marries top pair 'as long as the danger isn't obvious' — and on rainbow K♠8♦5♥, a 9 or a 4 is the least obvious card in the deck. Compare the flush draw that arrives with sirens blaring and shuts every wallet: YOUR draw completes in silence. The more invisible the draw, the more the future pays — that's the half of pot odds that isn't printed on the table.",
      },
      {
        val: 'raise', label: 'Check-Raise to $32', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Semi-Bluffing the Player Who Doesn\'t Fold', emoji: '⚠️',
        fb: "The semi-bluff check-raise is a fine weapon — against opponents who fold. This one marries top pair, so your raise mostly gets called, the pot swells to $70-plus while you're a 2:1 dog, and you've traded a cheap, disguised draw for an expensive, obvious confrontation. When the whole value of your hand is that he'll pay you off LATER, don't scare the money now.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_152',
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'Open-limps only when he wants action on a monster; his limp-reraise has shown aces both times he\'s used it tonight',
    },
    tableContext: 'This limp-reraise has shown aces twice tonight.',
    positions: mkPositions({
      0: { label: 'UTG (Nit)', action: '3-Bets $32', state: 'active' },
      3: { label: 'BTN (You)', action: 'Raises $10', state: 'hero'   },
    }),
    hand: mkHand(['A','♠'], ['Q','♣']),
    board: null,
    pot: '$45',
    toCall: '$22 more',
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'UTG limps' }, { text: 'you raise to $10', you: true }, { text: 'UTG re-raises to $32' }] },
    ],
    body: "The nit open-limped under the gun — odd, from a player this careful — and you raised A♠Q♣ to $10 on the Button to punish it. Then the trap snapped: he re-raised to $32. The limp-reraise, from a nit, who has already shown aces with this move twice tonight.",
    question: 'Limp, then re-raise, from the table\'s tightest player. This line has a name and a face — what\'s under it?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'The Oldest Trap in the Book', emoji: '✅',
        fb: "Fold, and be glad it only cost $10. The limp-reraise is the most famous line in poker for a reason: careful players don't limp early and then re-raise with anything except the hands they were praying you'd attack — aces, kings, little else. This nit has already shown you the answer twice tonight. Lines tell stories, and some lines only have one author. AQ is a fine hand against a raise; against a limp-reraise from a nit, it's dominated by the entire script.",
      },
      {
        val: 'call', label: 'Call $22 more', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Paying to Confirm What He Already Told You', emoji: '❌',
        fb: "Every chip that continues here runs into the same wall: his range is aces and kings, full stop. Calling 'to see a flop' is the disaster path — hit your ace and his aces have you drawing near dead in a pot that will only grow; miss and you fold anyway. And 4-betting bluffs the one range on Earth that was BUILT to re-raise you: he limped specifically hoping someone would put in more money. The read was free, loud, and repeated. Take it.",
      },
      {
        val: 'raise', label: '4-Bet to $75', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: '4-Betting Into the Trap\'s Teeth', emoji: '❌',
        fb: "Every chip that continues here runs into the same wall: his range is aces and kings, full stop. Calling 'to see a flop' is the disaster path — hit your ace and his aces have you drawing near dead in a pot that will only grow; miss and you fold anyway. And 4-betting bluffs the one range on Earth that was BUILT to re-raise you: he limped specifically hoping someone would put in more money. The read was free, loud, and repeated. Take it.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_153',
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Bluffs plenty on flops and turns — but like most players, his river check-raises have only ever shown monsters',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: 'Bets $22',      state: 'hero'   },
      5: { label: 'BB (AR)',   action: 'Check-Raises',  state: 'active' },
    }),
    hand: mkHand(['A','♣'], ['Q','♥']),
    board: ['Q♦', 'T♠', '6♣', '3♦', '9♥'],
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP',  segments: [{ text: 'BB checks' }, { text: 'you bet $8', you: true }, { text: 'BB calls' }] },
      { street: 'TURN',  segments: [{ text: 'BB checks' }, { text: 'you bet $18', you: true }, { text: 'BB calls' }] },
      { street: 'RIVER', segments: [{ text: 'BB checks' }, { text: 'you bet $22', you: true }, { text: 'BB check-raises to $70' }] },
    ],
    pot: '$157',
    toCall: '$48 more',
    body: "You value-bet A♣Q♥ — top pair, top kicker — three times on Q♦T♠6♣3♦, and the aggressive reg check-called twice. Then the river 9♥ landed, he checked again, you bet $22… and he check-raised to $70. It's $48 more, into a pot that's now $157.",
    question: 'He bluffs flops and turns all night. So why is a RIVER check-raise a different animal — and what beat you?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'The Least-Bluffed Line in Poker', emoji: '✅',
        fb: "Fold, top pair and all. Reads live at two levels — the player, and the line — and here the line outranks the player: even relentless bluffers go honest on river check-raises, because the move risks the most money with zero cards left to improve and needs YOU to have a calling hand. His own history says it plainly: monsters only. Add the board's testimony — the 9♥ slots KJ and J8 into straights his two check-calls were drawing to — and every story ends the same way. Bluff-catch his barrels all night; when the river check-raise arrives, believe it.",
      },
      {
        val: 'call', label: 'Call $48 more', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Calling the Player, Ignoring the Line', emoji: '⚠️',
        fb: "The logic is tempting: he's aggressive, you hold top pair top kicker, and $48 into $157 only needs to be right one time in three. But the read you have isn't about his flop barrels — it's that his river check-raises specifically have never once been a bluff. Against THAT line, one-in-three is a fantasy: check-call, check-call, check-raise on the card that completes KJ is value telling you its name. Lines have frequencies; this one's bluff frequency rounds to zero.",
      },
      {
        val: 'raise', label: 'Re-raise to $170', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Re-Raising One Pair Into the Nut Line', emoji: '❌',
        fb: "Re-raising here takes the hand furthest from what the evidence supports: his river check-raise range is straights and sets that never fold, so your one pair is drawing dead money in. Nothing worse than top pair continues against your re-raise, and everything better snaps you off. When a line this honest raises you, the only chips worth discussing are the ones you save.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_154',
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Double- and triple-barrels relentlessly once he senses weakness — but folds his bluffs instantly to a check-raise',
    },
    tableContext: 'Barrels relentlessly at weakness, but his bluffs evaporate against a check-raise.',
    positions: mkPositions({
      3: { label: 'BTN (AR)', action: 'Bets $8', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked', state: 'hero'   },
    }),
    hand: mkHand(['Q','♦'], ['J','♦']),
    board: ['Q♠', 'J♣', '5♥'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check', you: true }, { text: 'BTN bets $8' }] },
    ],
    pot: '$13',
    toCall: '$8',
    body: "You defended Q♦J♦ and flopped top two pair on the dry Q♠J♣5♥. The aggressive reg c-bets $8 — and his file says the interesting part: he barrels relentlessly at weakness, but his bluffs evaporate the instant someone check-raises.",
    question: 'Top two against a serial barreler who believes check-raises. Where does his money come from — his calls, or his next two bets?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding the Second-Best Flop You Can Hit', emoji: '❌',
        fb: "Top two pair against a c-bet is about as far from a fold as poker gets. The only question this flop asks is how to win the MOST — folding answers a question nobody asked.",
      },
      {
        val: 'call', label: 'Call $8', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Let the Barreler Keep Barreling', emoji: '✅',
        fb: "Just call — and understand why, because the answer lives in his file, not your cards. His bluffs fold to check-raises but barrel relentlessly at weakness: your call reads as weakness, so the turn and river bets are already loading. Against the maniac, top two check-raises immediately — he pays raises with anything. Against THIS player, the raise is a mute button on his bluffs, and his bluffs are where your money is. Same monster, opposite plays, chosen entirely by who's sitting across the felt. The dry board makes the slowplay nearly free; let him write checks to your top two all the way down.",
      },
      {
        val: 'raise', label: 'Check-Raise to $26', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Winning the Pot, Firing the Customer', emoji: '⚠️',
        fb: "The check-raise isn't bad — it wins the pot and protects against the rare gutshot. But read his file again: bluffs fold INSTANTLY to check-raises, and bluffs are most of what an aggressive reg c-bets on Q-J-5. Your raise collects $21 and ends the show; his double and triple barrels were worth twice that. Strong hands against bluff-heavy barrels want to open the door, not slam it. Save this raise for the villain who pays it.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_155',
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'unknown',
      notes: 'Sat down two hands ago. No showdowns, no history, no tells — you know nothing about this player yet',
    },
    tableContext: 'A brand-new player — you have zero reads.',
    positions: mkPositions({
      3: { label: 'BTN (?)',  action: 'Bets $29', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked',  state: 'hero'   },
    }),
    hand: mkHand(['T','♣'], ['T','♦']),
    board: ['A♠', '8♦', '4♣', '6♠', '2♥'],
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP',  segments: [{ text: 'you check', you: true }, { text: 'BTN bets $8' }, { text: 'you call', you: true }] },
      { street: 'TURN',  segments: [{ text: 'you check', you: true }, { text: 'BTN checks' }] },
      { street: 'RIVER', segments: [{ text: 'you check', you: true }, { text: 'BTN bets $29' }] },
    ],
    pot: '$29',
    toCall: '$29',
    body: "A stranger sat down two hands ago; this is your first pot against him. You check-called his flop bet with T♣T♦ under the A♠8♦4♣ board, the turn checked through, and now he fires a full-pot $29 on the river. Getting 2:1 — with zero reads to lean on.",
    question: 'You know NOTHING about this player. When the file is empty, what do you play — his tendencies, or everyone\'s?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'No Reads? Play the Population', emoji: '✅',
        fb: "Fold — not because of anything you know about him, but because of what you know about everyone. When the file is empty, the default read IS the read: at these stakes, full-pot river bets are value far more often than the 33% your price requires, and your tens lose to every ace he's betting. Hero calls are earned by evidence, and you have none. There's a bonus in the fold, too: the note you take. 'Pots river after checking turn' goes in the file, and the NEXT decision against him won't be blind. Against unknowns, play solid and collect data — the exploits come later.",
      },
      {
        val: 'call', label: 'Call $29', icon: '📞', cls: 'call',
        grade: 'partial', title: 'A Price That Needs a Read You Don\'t Have', emoji: '⚠️',
        fb: "The math isn't crazy — 2:1 means you only need to be good a third of the time, and the turn check-back adds a whiff of a missed hand. But that story requires an assumption about a specific player, and you met this one two hands ago. Absent evidence, the population baseline rules: big river bets at these stakes are under-bluffed, and second pair is exactly what they're built to beat. Save the hero calls for players who've shown you they bluff. Today you pay for information either way; folding is the cheaper tuition.",
      },
      {
        val: 'raise', label: 'Raise to $75', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Bluffing a Ghost', emoji: '❌',
        fb: "Raising second pair here needs him to fold better hands — an assumption about a player you cannot possibly have modeled yet. If he's betting an ace for value, as unknowns usually are, your $75 disappears into a snap call. Fancy plays are built ON reads; with an empty file, they're built on air. Unknown opponent, standard poker: fold the bluff-catcher, open the notebook.",
      },
    ],
  }),

  // ── July 2026 batch 5 (sc_156–sc_171): gap-targeting — early seats, turn
  //    street, 3-bet pots, paired/monotone textures, potodds answer variety ──

  mkScenario({
    id: 'sc_156',
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'maniac',
      notes: 'Attacks early-position opens with 3-bets for sport; five players act behind you and he\'s the first of them',
    },
    tableContext: null,
    positions: mkPositions({
      0: { label: 'UTG (You)', action: '???',    state: 'hero'   },
      1: { label: 'HJ (M)',    action: 'Active', state: 'active' },
      2: { label: 'CO',        action: 'Active', state: 'active' },
      3: { label: 'BTN',       action: 'Active', state: 'active' },
      4: { label: 'SB',        action: 'Active', state: 'active' },
      5: { label: 'BB',        action: 'Active', state: 'active' },
    }),
    hand: mkHand(['Q','♠'], ['J','♠']),
    board: null,
    pot: '$3',
    toCall: null,
    body: "Under the gun with Q♠J♠ — suited, connected, two paint cards, genuinely pretty. But you're first to speak with five players behind you, the maniac nearest of them, and every seat at the table still holding live cards against yours.",
    question: 'Q♠J♠ is a standard open from the Button. What changes when the same two cards are UTG?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'The First Seat Plays the Tightest Range', emoji: '✅',
        fb: "Fold. A starting hand isn't strong or weak by itself — it's strong or weak from a seat. From the Button, QJs attacks two random blinds; from UTG it asks five players in a row for permission, plays the whole hand out of position, and gets its action from ranges full of AQ, KQ, and better pairs — the exact hands that turn queen-jack top pairs into expensive second-bests. Same cards, different seat, different answer: that IS preflop discipline.",
      },
      {
        val: 'limp', label: 'Limp in ($2)', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'The Worst Seat and the Worst Entry', emoji: '❌',
        fb: "Limping UTG stacks every problem this hand has on top of a new one: you invite the whole table in behind you, hand the maniac his favorite raising target, and still play the rest of the hand first to act with a dominated-prone hand. If QJs isn't strong enough to raise from here — and it isn't — it isn't strong enough to play from here.",
      },
      {
        val: 'raise', label: 'Raise to $6', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'A Button Hand Raised From the Wrong Chair', emoji: '⚠️',
        fb: "At least raising plays poker — but count the headwinds: five players behind, a maniac who 3-bets early opens for sport, and a hand that flops second-best top pairs against the ranges that call UTG raises. QJs isn't a bad hand; it's a bad hand from HERE. Move it two seats later and the raise becomes automatic. Seats set ranges — let yours.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_157',
    effectiveStacks: 200,
    skill: 'preflop',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: '3-bets middle-position opens from the Button constantly — his re-raises are about position, not premiums',
    },
    tableContext: null,
    positions: mkPositions({
      1: { label: 'HJ (You)', action: 'Raises $6',  state: 'hero'   },
      3: { label: 'BTN (AR)', action: '3-Bets $20', state: 'active' },
    }),
    hand: mkHand(['9','♠'], ['9','♥']),
    board: null,
    pot: '$29',
    toCall: '$14 more',
    body: "You opened 9♠9♥ from the Hijack and the aggressive regular did what he always does to middle-position opens: 3-bet to $20 from the Button. His re-raises are a position play, not a hand announcement. It's $14 more to you.",
    question: 'Medium pair, wide 3-bettor. One option folds too much, one bloats the pot backwards — which one is neither?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Feeding the Position Tax', emoji: '⚠️',
        fb: "Against a nit whose 3-bets are queens-plus, this fold is automatic. Against a player 3-betting the Button at this frequency, it's a donation: nines are comfortably ahead of a range built on position, and folding the middle of your range every time is exactly what his strategy is designed to farm. The villain sets the answer, and this villain says continue.",
      },
      {
        val: 'call', label: 'Call $14 more', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Medium Pairs Are Built for This Call', emoji: '✅',
        fb: "Call. Nines can't fold to a range this wide, and they can't 4-bet without turning themselves into a bluff — so they do what medium pairs do best: call, ahead of his ace-highs and suited junk, with a set draw as the bonus prize. Yes, you're out of position; that's the price of showing his wide 3-bets they don't get free money. Fold to the nit, call the position player — the hand is the same, the answer never is.",
      },
      {
        val: 'raise', label: '4-Bet to $48', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Sorting His Range in His Favor', emoji: '❌',
        fb: "The 4-bet does exactly one thing here: it sorts his range perfectly against you. Every hand you're crushing — the A5s, the K9s, the position junk — folds, and every hand that continues has nines crushed or flipping. Medium pairs lose their value the moment the money gets big preflop; keep the pot at a size where being ahead of his RANGE still matters.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_158',
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'passive',
      notes: 'Limp-completes half his hands from the Small Blind, then check-folds most flops when the texture misses him',
    },
    tableContext: null,
    positions: mkPositions({
      4: { label: 'SB (P)',   action: 'Limps $2', state: 'active' },
      5: { label: 'BB (You)', action: '???',      state: 'hero'   },
    }),
    hand: mkHand(['K','♦'], ['9','♦']),
    board: null,
    pot: '$4',
    toCall: null,
    body: "Folded around to the Small Blind, who completes for $2 — his standard shrug with half the deck. You're in the Big Blind with K♦9♦, and here's the quiet gift of this matchup: for once, the Big Blind acts LAST on every street.",
    question: 'Blind versus blind is the one battle where your seat acts last all hand. What does that make K♦9♦ worth?',
    correct: 'raise',
    choices: [
      {
        val: 'check', label: 'Check your option', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'A Free Flop, a Wasted Edge', emoji: '⚠️',
        fb: "Checking is free and never terrible. But tally what you're sitting on: a hand well ahead of a half-the-deck limping range, a player who check-folds most flops, and — the rarity — position on him for the entire hand. Free flops are for hands with nothing going; this one has everything going. The check doesn't lose money so much as decline it.",
      },
      {
        val: 'raise_small', label: 'Min-raise to $4', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Pressure That Doesn\'t Press', emoji: '❌',
        fb: "The min-raise gives him 3:1 to continue with the whole limping mess he arrived with — so he does, and the 'pressure' changed nothing except the pot size. If the point of raising a weak limp is to charge it or end it, $2 more does neither. Size the raise to ask a real question.",
      },
      {
        val: 'raise', label: 'Raise to $8', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'The One Seat Where the Big Blind Rules', emoji: '✅',
        fb: "Raise to $8. Blind-versus-blind is the lone matchup where the Big Blind holds position for the whole hand — the advantage every other seat pays to get, handed to you free. Add a limper who check-folds most flops and K♦9♦ becomes a value raise: he folds now and donates the limp, or he calls and plays every street first into a player holding a better hand AND the last word. When the table's worst seat becomes its best for one hand, collect.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_159',
    effectiveStacks: 200,
    skill: 'position',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Opens wide from late position and peels 3-bets out of position, then plays fit-or-fold honestly on the flop',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (LR)',   action: 'Calls $20', state: 'active' },
      3: { label: 'BTN (You)', action: '3-Bets $20', state: 'hero'  },
    }),
    hand: mkHand(['A','♥'], ['K','♥']),
    board: ['Q♠', '7♦', '3♣'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'CO raises to $6' }, { text: 'you 3-bet to $20', you: true }, { text: 'CO calls' }] },
      { street: 'FLOP', segments: [{ text: 'CO checks' }] },
    ],
    pot: '$43',
    toCall: null,
    body: "You 3-bet A♥K♥ on the Button over the loose rec's Cutoff open, and he peeled from the worse seat — as he does. The flop misses you: Q♠7♦3♣. But look at the geometry: he checks, and he'll be acting first, checking to you, every single street.",
    question: 'Ace-high in a 3-bet pot you missed — but every street runs through you last. What does the seat let you do that the cards alone don\'t?',
    correct: 'bet_small',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Showdown Value on a Leash', emoji: '⚠️',
        fb: "Ace-king high really can win this pot unimproved, so checking isn't absurd. But it hands a fit-or-fold player a free card and mutes everything your position offers: he'll check to you again on the turn not knowing if you have queens or air, and a check-back tells him it's air. In 3-bet pots, the in-position player who keeps the story going gets paid in folds; the one who goes quiet invites stabs.",
      },
      {
        val: 'bet_small', label: 'Bet $14', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Small Bet, Big Seat', emoji: '✅',
        fb: "Bet $14 — a third of the pot, and let position do the heavy lifting. Your 3-bet plus this dry queen-high board own his fit-or-fold range: everything without a queen folds to any bet, so buy those folds at the cheapest price, with six outs to the nuts and last action as insurance the times he peels. This is what 3-bet pots in position are: he has to solve every street first, blind, while your small bets ask expensive questions. The seat, not the ace-king, is the hand's engine.",
      },
      {
        val: 'bet_large', label: 'Bet $40', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Paying Double for the Same Folds', emoji: '❌',
        fb: "His no-queen hands fold to $14 exactly as fast as to $40 — that's what fit-or-fold means. The big bet buys the identical folds at triple the price, and when he does call, you're playing a bloated pot with ace-high against a range that connected. Your seat was offering cheap, multi-street control; the big bet trades it for one loud street. Efficient pressure beats loud pressure.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_160',
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Double-barrels most turns once he c-bets — but gives up on rivers when two streets of pressure haven\'t worked',
    },
    tableContext: 'The third bullet rarely comes without a hand.',
    positions: mkPositions({
      3: { label: 'BTN (AR)', action: 'Bets $20', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked',  state: 'hero'   },
    }),
    hand: mkHand(['7','♠'], ['7','♣']),
    board: ['J♠', '7♦', '2♣', '3♥'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check', you: true }, { text: 'BTN bets $8' }, { text: 'you call', you: true }] },
      { street: 'TURN', segments: [{ text: 'you check', you: true }, { text: 'BTN bets $20' }] },
    ],
    pot: '$29',
    toCall: '$20',
    body: "You flopped middle set with 7♠7♣ on J♠7♦2♣ and just called his c-bet — letting the barreler barrel. The 3♥ turn changes nothing, and here comes the second bullet, $20 into $29, right on schedule. His file says the third bullet rarely comes without a hand.",
    question: 'The trap caught his second barrel. His file says there\'s rarely a third. When does the trap close?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding a Set to the Bet You Fished For', emoji: '❌',
        fb: "You slow-played specifically to make him fire this barrel, and it worked. Folding middle set on a board with no draw in sight isn't caution — it's abandoning the plan at the moment it succeeded.",
      },
      {
        val: 'call', label: 'Call $20', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Waiting for a Bullet That Isn\'t Coming', emoji: '⚠️',
        fb: "Calling kept his bluffs firing on the flop — that was right. But read his file again before doing it twice: he gives up on rivers when two barrels haven't worked, so the third bullet you're waiting for mostly doesn't exist. Flat here and the river goes check-check, his air showing down for free. The barrels you were milking end after this street; milk the last one all the way.",
      },
      {
        val: 'raise', label: 'Check-Raise to $55', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Strike After the Last Bullet', emoji: '✅',
        fb: "Check-raise to $55. Trapping has two halves and beginners only learn the first: lie in wait while the bluffs keep betting — then STRIKE before the betting dies. His file says turns get barreled and rivers get surrendered, so this $20 is the last chips his air will ever offer, and his real hands — jacks, overpairs — are exactly the ones that pay a raise right now in a pot finally worth raising. Flat the flop, raise the turn: aggression isn't just having the gas pedal; it's knowing which street to floor it.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_161',
    effectiveStacks: 200,
    skill: 'aggression',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'nit',
      notes: 'On flush-heavy boards he\'s honest to a fault — without a piece of the suit, even his pairs fold to real bets',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (Nit)',  action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['A','♥'], ['J','♣']),
    board: ['9♥', '6♥', '2♥'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }] },
    ],
    pot: '$13',
    toCall: null,
    body: "You raised A♥J♣ on the Button and the flop came down all hearts: 9♥6♥2♥. You hold the A♥ — the one card that makes the nut flush, in a hand that also carries two overcards. The nit checks, already looking uncomfortable.",
    question: 'No pair — but the ace of the flopped suit is in YOUR hand. Who does a monotone board really belong to?',
    correct: 'bet_medium',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'A Free Card You Didn\'t Need to Buy', emoji: '⚠️',
        fb: "Checking keeps the pot small and your draw live, and against a trappy opponent that's a real plan. But this opponent isn't trappy — he's a nit staring at three hearts he doesn't hold, ready to surrender to the first bet. Taking a free card here passes up the purest kind of profit: a pot nobody wants, claimable by whoever speaks first with a credible story. You hold the best possible story in your hand.",
      },
      {
        val: 'bet_medium', label: 'Bet $9', icon: '📞', cls: 'call',
        grade: 'correct', title: 'The Board Belongs to Whoever Holds the A♥', emoji: '✅',
        fb: "Bet $9. Monotone boards freeze everyone who didn't flop the suit — and you own the card that trumps the whole texture: the A♥ means the nut flush is either yours already or one card away, and no hand he holds can ever be sure. His file makes it a layup (even pairs fold without a heart), and the times he does peel, nine hearts and two overcards keep you drawing to the world. Semi-bluffing is at its strongest when your worst case is this good: fold equity now, the nuts later.",
      },
      {
        val: 'bet_large', label: 'Bet $13 (pot)', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Overpaying on a Frozen Board', emoji: '❌',
        fb: "A monotone flop already did the scaring for you — his heartless hands fold to $9 just as surely as to $13, so the pot-sized bet buys nothing extra when he folds and costs extra the times he's sitting on a made flush. On boards this frightening, bets are announcements, not crowbars: say it at the cheap price.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_162',
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Chases spade draws and calls with any pair; the size only matters to him as a fraction of what\'s already out there',
    },
    tableContext: null,
    positions: mkPositions({
      1: { label: 'HJ (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (CS)',  action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['A','♠'], ['A','♥']),
    board: ['J♦', '8♠', '3♠', '2♣'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }, { text: 'you bet $8', you: true }, { text: 'BB calls' }] },
      { street: 'TURN', segments: [{ text: 'BB checks' }] },
    ],
    pot: '$29',
    toCall: null,
    body: "You opened A♠A♥ from the Hijack and bet $8 on the J♦8♠3♠ flop; the station called with whatever he's chasing. The 2♣ turn changes nothing — he checks again. On the flop, $8 was a real bet — sixty percent of what was in the middle. The middle has since more than doubled.",
    question: 'Your flop bet was 60% of the pot. Bet the same $8 now and it\'s 28%. What should actually stay the same?',
    correct: 'bet_large',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Skipping a Street of Rent', emoji: '❌',
        fb: "Aces against a station on a draw-flecked board is a three-street value hand — every street you don't bet is rent he skips. His spade draws get a free card, his pairs save a payment, and your best hand of the night collects two streets instead of three. Against players who can't fold, checking is the only real mistake.",
      },
      {
        val: 'bet_small', label: 'Bet $8 (same as the flop)', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Same Chips, Half the Bet', emoji: '⚠️',
        fb: "It feels consistent — $8 worked on the flop, bet $8 again. But bets aren't measured in chips, they're measured against the pot, and the pot doubled: your 60% flop bet just shrank to 28% without you touching anything. The draws you were charging now peel at a discount, and the pairs that would pay half-pot get billed a third of that. Every street, re-derive the fraction. The pot moved; your price tag has to move with it.",
      },
      {
        val: 'bet_large', label: 'Bet $20', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Bets Scale With the Pot, Not With Habit', emoji: '✅',
        fb: "Bet $20 — the same two-thirds fraction your flop bet was, which means it's the same BET, even though the chips doubled. That's the whole lesson: the pot is the ruler every wager gets measured against, and it grows street by street, so the chips must grow to stand still. His notes even say it plainly — size registers with him as a fraction of the middle. Charge the spades the same wrong price twice; overpairs against stations are how sessions get paid for.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_163',
    effectiveStacks: 200,
    skill: 'betsize',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'Sticks around with any pair or open draw at almost any price — top pair especially never finds the fold button',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (LR)',   action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['K','♦'], ['Q','♣']),
    board: ['J♠', 'T♦', '4♥', 'A♦'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }, { text: 'you bet $8', you: true }, { text: 'BB calls' }] },
      { street: 'TURN', segments: [{ text: 'BB checks' }] },
    ],
    pot: '$29',
    toCall: null,
    body: "You bet K♦Q♣ on J♠T♦4♥ with an open-ended draw and the loose rec called. The turn is the A♦ — your card, twice over: it completes your Broadway straight, and it's the single best card in the deck for your preflop raising range. For his check-calling range? A card that improves almost nothing he holds.",
    question: 'The turn made you the nuts AND made your story unbeatable. When one card does both, what happens to the price?',
    correct: 'bet_huge',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Slow-Playing the Card That Made You', emoji: '❌',
        fb: "Checking the nuts has one justification — keeping bluffs in — and this opponent doesn't bluff, he calls. His jacks and tens and diamond draws are sitting there ready to pay; a check collects nothing, risks a scare card killing his action, and wastes the card that just handed you both the nuts and the perfect story. The money is in his stubbornness, and stubbornness only pays when you bill it.",
      },
      {
        val: 'bet_medium', label: 'Bet $15 (half pot)', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Standard Size, Special Card', emoji: '⚠️',
        fb: "Half pot is the textbook turn bet, and it gets called — that's exactly why it's not enough. Look at what the A♦ did to the two ranges: yours got stronger (every AK, AQ, and this exact straight lives in it), his got capped (he check-called with jacks and tens that just fell further behind). When a card widens the gap between the ranges that much, the sizing should widen with it. You're leaving the gap unbilled.",
      },
      {
        val: 'bet_huge', label: 'Bet $45 (overbet)', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'Asymmetric Card, Asymmetric Size', emoji: '✅',
        fb: "Overbet — $45 into $29. Here's the intermediate sizing idea in one sentence: bets should grow with the gap between the two ranges, and the A♦ just blew that gap wide open — it lives all over your raising range and nowhere in his check-call range, so he can never punish the size, only decide how much of it his top pair pays. Against a player who never finds the fold button with a pair, the answer is: plenty. Big cards for your range are green lights for big numbers.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_164',
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'loose',
      notes: 'On suited boards he calls with any pair OR any card of the suit — half his range has a piece of a monotone flop',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (LR)',  action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['A','♣'], ['K','♣']),
    board: ['9♠', '7♠', '3♠'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }] },
    ],
    pot: '$13',
    toCall: null,
    body: "You raised A♣K♣ from the Cutoff and the flop arrived wearing one suit: 9♠7♠3♠. You hold clubs — not a spade in sight. The loose rec checks, and the c-bet feels automatic… until you ask what you'd do when a call comes back and a fourth spade hits.",
    question: 'Monotone flop, zero cards of the suit in your hand. Which player does this board actually scare?',
    correct: 'check',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'You Can\'t Rep a Suit You Don\'t Hold', emoji: '✅',
        fb: "Check. A monotone board turns every hand into a flush conversation, and you arrived without a word of the language: no spade means no draw when called, no credible flush when a fourth spade lands, and no good turn card — the spade scares YOU, everything else changes nothing. Meanwhile his loose range is full of stray spades and pairs that never fold here. Compare the mirror image: with the lone A♥ on a heart board, you attack, because the best flush card hands you the story. With nothing? The board is his. Check, and keep your chips out of a conversation you can't win.",
      },
      {
        val: 'bluff_small', label: 'Bet $6', icon: '📞', cls: 'call',
        grade: 'partial', title: 'A Cheap Bet Into an Expensive Problem', emoji: '⚠️',
        fb: "Six dollars looks harmless, but price was never this bluff's problem — the audience is: half his range holds a spade or a pair on this texture and calls, and then you're on the turn with ace-high, no draw, and no plan. Cheap bluffs into ranges that don't fold aren't small mistakes; they're small installments on a big one.",
      },
      {
        val: 'bluff_large', label: 'Bet $13 (pot)', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'The Big Bluff With No Backup', emoji: '❌',
        fb: "A pot-sized bluff on a monotone board makes a loud claim — 'I have the flush' — to the one opponent whose range is stuffed with reasons to look you up, while your hand holds zero outs to back the story when he does. Bluffs need either folds today or equity tomorrow. Betting big here buys neither; it just sets fire to the pot you could have exited for free.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_165',
    effectiveStacks: 200,
    skill: 'bluffing',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'Defends his blind with broadways and middling cards, then plays the flop honestly — no pair, no interest',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: '???',     state: 'hero'   },
      5: { label: 'BB (TR)',  action: 'Checked', state: 'active' },
    }),
    hand: mkHand(['K','♥'], ['Q','♦']),
    board: ['8♠', '8♣', '3♦'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $6', you: true }, { text: 'BB calls' }] },
      { street: 'FLOP', segments: [{ text: 'BB checks' }] },
    ],
    pot: '$13',
    toCall: null,
    body: "You raised K♥Q♦ from the Cutoff, the tight rec defended his blind, and the flop came down 8♠8♣3♦ — paired, dry, and about as far from his broadway-heavy defending range as a flop can get. He checks. Do the census: how many hands can he actually HAVE here?",
    question: 'Two of the four eights are on the board. His range is broadways that just missed. What texture is better for a bluff than this?',
    correct: 'bet_small',
    choices: [
      {
        val: 'check', label: 'Check back', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Two Overcards Taking the Scenic Route', emoji: '⚠️',
        fb: "Checking king-queen high isn't reckless — you have six outs and a free card is a free card. But it walks past the most profitable c-bet spot in poker: a paired, bone-dry board that missed his entire defending range, against a player who folds whatever didn't pair. Betting wins the pot outright the huge majority of the time; checking wins it only when your king or queen arrives. Take the sure small profit over the occasional lucky one.",
      },
      {
        val: 'bet_small', label: 'Bet $5', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Paired Boards Hit Nobody — Bet Them Cheap', emoji: '✅',
        fb: "Bet $5. Here's the census that makes paired boards a bluffer's paradise: only two eights remain in the deck, so his range of broadways and middling cards is almost entirely no-pair — and an honest player with no pair on 8♠8♣3♦ is done the moment chips move. That's why the size is tiny: you're not charging draws (there are none) or building value; you're buying a near-certain fold, and $5 buys it as surely as $13. Best board to bluff, best price to do it. When the board pairs low and dry, the c-bet is close to free money.",
      },
      {
        val: 'bet_large', label: 'Bet $13 (pot)', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Full Price for a Discount Fold', emoji: '❌',
        fb: "Everything foldable folds to $5, so the pot-sized bet only changes the outcomes you don't want: it loses triple when he's slow-playing the case eight, and it turns a nearly-free bluff into an expensive one for identical folds. On boards where nobody has anything, the smallest bet does the entire job — spending more isn't strength, it's leakage.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_166',
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Calls everything — but his own bets mean a real hand, and he pays off in full the rare times you outdraw him',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (CS)',  action: 'Bets $12', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked',  state: 'hero'   },
    }),
    hand: mkHand(['J','♣'], ['T','♣']),
    board: ['Q♦', '8♥', '4♠'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'CO raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check', you: true }, { text: 'CO bets $12' }] },
    ],
    pot: '$13',
    toCall: '$12',
    body: "You defended J♣T♣ and the flop came Q♦8♥4♠ — a gutshot: exactly the four nines fill your straight. The station bets $12 into $13, and the tempting math whispers: he pays off EVERYTHING when you hit. Barely 2:1 on four outs. Run the real numbers.",
    question: 'Four outs, 2:1, and the best implied odds in the room. Can a perfect payer rescue a bad enough price?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Implied Odds Have a Ceiling', emoji: '✅',
        fb: "Fold — and this is the discipline lesson precisely BECAUSE he's a payer. Four outs is roughly 11:1 against on the turn; his bet lays you 2:1. That gap is a canyon, and implied odds are a rope bridge: even if he pays off two full streets when your nine arrives, you land the nine so rarely that the math still drowns. Implied odds sweeten close calls — 8 or 9 outs at a slightly thin price. They do not resurrect 4 outs at 2:1 against anyone, ever. The payer changes how much you win when you get there; he can't change how often you get there.",
      },
      {
        val: 'call', label: 'Call $12', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'The Payer Can\'t Fix the Price', emoji: '❌',
        fb: "Putting more chips in chases the same four cards either way. The call needs the nine to arrive about one time in twelve and pays like it comes one in three — a hole no amount of future payoff fills at these bet sizes. And raising? His notes say his bets mean a hand and his calls mean everything: a semi-bluff needs a folder, and you've picked the one player in poker guaranteed to call. Bad price, wrong target, four outs. Let it go.",
      },
      {
        val: 'raise', label: 'Check-Raise to $36', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Semi-Bluffing the Player Who Never Folds', emoji: '❌',
        fb: "Putting more chips in chases the same four cards either way. The call needs the nine to arrive about one time in twelve and pays like it comes one in three — a hole no amount of future payoff fills at these bet sizes. And raising? His notes say his bets mean a hand and his calls mean everything: a semi-bluff needs a folder, and you've picked the one player in poker guaranteed to call. Bad price, wrong target, four outs. Let it go.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_167',
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'His big turn bets are top-pair protection, not commitment — he has folded top pair to check-raises twice tonight',
    },
    tableContext: 'Folded top pair to a check-raise twice tonight.',
    positions: mkPositions({
      3: { label: 'BTN (TR)', action: 'Bets $24', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked',  state: 'hero'   },
    }),
    hand: mkHand(['9','♠'], ['8','♠']),
    board: ['K♠', '6♠', '2♦', '3♣'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check', you: true }, { text: 'BTN bets $6' }, { text: 'you call', you: true }] },
      { street: 'TURN', segments: [{ text: 'you check', you: true }, { text: 'BTN bets $24' }] },
    ],
    pot: '$25',
    toCall: '$24',
    body: "Your 9♠8♠ flush draw called a cheap flop bet on K♠6♠2♦, and the 3♣ turn bricked. Now the tight rec bets $24 into $25 — 2:1 on a 4:1 draw, the classic collapsed price. But before the fold hits the muck, check his file: he's folded top pair to check-raises twice tonight.",
    question: 'The price says fold and the price is right. Is calling or folding really the whole menu?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Right Math, Shorter Menu', emoji: '⚠️',
        fb: "The fold is honest: 2:1 for a one-card 4:1 draw loses money, and walking away from bad prices is a real skill. But pot odds are the mathematics of CALLING — they say nothing about the third option. Against a player whose big turn bets are protection he abandons under pressure, your hand has a move left that the price can't touch. Folding is the second-best answer in a spot that has a best one.",
      },
      {
        val: 'call', label: 'Call $24', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Paying the Price You Already Know Is Wrong', emoji: '❌',
        fb: "This is the one clearly losing line: nine outs hit about 19% on the river and he's charging you like it's 33%, with a file that says he stops paying the moment the third spade lands. Calling bad turn prices with face-up draws is the leak that never feels like one — each call is 'only' $24. They add up to the session.",
      },
      {
        val: 'raise', label: 'Check-Raise to $65', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'When the Price Is Wrong, Renegotiate', emoji: '✅',
        fb: "Check-raise to $65. Pot odds judge a passive call, but aggression rewrites the equation: his file says these bets are top-pair protection he's already folded twice under pressure, so the raise wins the whole pot immediately a healthy chunk of the time — and when he does call, nine outs to the flush are still yours. Fold equity plus card equity beats price alone. Compare the maniac who never folds: there, this raise is lighting money on fire and the fold is right. The draw and the price were identical; the OPPONENT decided whether math or muscle wins the street.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_168',
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'His c-bets into multiple players — especially with a station in the field — have shown top pair or better every time; he saves his bluffs for heads-up pots',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (TR)',  action: 'Bets $14', state: 'active' },
      3: { label: 'BTN (CS)', action: 'Calls $14', state: 'active' },
      5: { label: 'BB (You)', action: 'Checked',  state: 'hero'   },
    }),
    hand: mkHand(['9','♥'], ['8','♥']),
    board: ['Q♠', '9♦', '4♣'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'CO raises to $6' }, { text: 'BTN calls' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check', you: true }, { text: 'CO bets $14' }, { text: 'BTN calls' }] },
    ],
    pot: '$47',
    toCall: '$14',
    body: "Three to the flop: you defended 9♥8♥, and Q♠9♦4♣ gave you middle pair. You checked, the tight rec bet $14 — into you AND the station — and the station called. Heads-up you'd peel this all day. But nobody bluffs into a crowd, and especially not into that crowd.",
    question: 'Middle pair faces a bet aimed at two players, one of whom never folds. What does the audience tell you about the bet?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Nobody Bluffs Into a Calling Station', emoji: '✅',
        fb: "Fold, and pocket the read that saved you: a bet is priced by its audience. Heads-up, a c-bet can be anything — that's why you'd peel. But betting into TWO players needs both to fold, and betting into a station needs a miracle; a tight player knows this better than anyone, which is why his multiway c-bets have shown top pair or better every single time. Then the station called in front of you, stacking a second pair-heavy range on the pile. Middle pair against one honest bet and one sticky call is drawing at five outs, priced like a hand. The crowd told you what the bet meant; believe the crowd.",
      },
      {
        val: 'call', label: 'Call $14', icon: '📞', cls: 'call',
        grade: 'partial', title: 'The Heads-Up Peel in a Three-Way Pot', emoji: '⚠️',
        fb: "This call is correct in the pot you're imagining — heads-up, where his c-bet range includes whiffed overcards your nines beat. But that's not this pot: he chose to bet into a station, which strips the bluffs out of his range, and the station's call ahead of you means beating ONE strong range isn't even enough anymore. The same $14 buys a completely different product multiway. Count the opponents before you count the price.",
      },
      {
        val: 'raise', label: 'Check-Raise to $45', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Bluffing the Honest Bet and the Unbluffable Caller', emoji: '❌',
        fb: "The raise needs folds from two players who just told you they won't give them: the tight rec's multiway bets are never bluffs (nothing honest folds), and the station... is a station. Middle pair with a raise builds a huge pot exactly when the evidence says you're behind at least one range, probably two. Reads exist to keep chips out of spots like this.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_169',
    effectiveStacks: 200,
    skill: 'reads',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: 'Barrels his bluffs on scare cards religiously — when a turn ace arrives and he DOESN\'T bet, he\'s protecting a made hand',
    },
    tableContext: null,
    positions: mkPositions({
      3: { label: 'BTN (AR)', action: 'Checked', state: 'active' },
      5: { label: 'BB (You)', action: '???',     state: 'hero'   },
    }),
    hand: mkHand(['6','♠'], ['5','♠']),
    board: ['K♦', '8♣', '7♥', 'A♥', 'Q♣'],
    actionHistory: [
      { street: 'PRE',   segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP',  segments: [{ text: 'you check', you: true }, { text: 'BTN bets $8' }, { text: 'you call', you: true }] },
      { street: 'TURN',  segments: [{ text: 'you check', you: true }, { text: 'BTN checks' }] },
      { street: 'RIVER', segments: [{ text: "you're first to act", you: true }] },
    ],
    pot: '$29',
    toCall: null,
    body: "You called the flop on K♦8♣7♥ with 6♠5♠ — an open-ended draw. Then the A♥ turn, the single best bluffing card in the deck for the preflop raiser… and he checked it. The river Q♣ bricks your draw. Six-high, first to act, $29 sitting there.",
    question: 'He bluffs scare cards religiously — and checked the scariest one. What did that check tell you about bluffing him now?',
    correct: 'check',
    choices: [
      {
        val: 'check', label: 'Check — give up', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'The Card He Didn\'t Bet Is the Tell', emoji: '✅',
        fb: "Check and surrender. The loudest information in this hand is a bet that never happened: this player barrels scare cards religiously, the turn A♥ was the best scare card poker prints, and he declined it. Bluffs and air fire there every time — so his check means the ace didn't scare him, which means a made hand throttling down for pot control. Your six-high can't win a showdown, but bluffing into a range that just announced 'I have a hand and I intend to call' is worse than losing quietly. Read the silences, not just the bets; the missing barrel is the most honest sentence he'll say all night.",
      },
      {
        val: 'bluff_small', label: 'Bet $15', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Bluffing the Man Who Told You He\'d Call', emoji: '❌',
        fb: "Any bluff here argues with the read instead of using it. His turn check on the A♥ — the card his bluffs always bet — subtracted the air from his range and left made hands managing the pot; those hands check the turn PLANNING to call a river bet, and yours is made of six-high and hope. Size can't fix it: $15 and $35 get looked up by the same kings and aces. The information was free and it said fold your bluffing plans; paying $15 or $35 to ignore it just sets the price of not listening.",
      },
      {
        val: 'bluff_large', label: 'Bet $35', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'A Bigger Argument With the Same Evidence', emoji: '❌',
        fb: "Any bluff here argues with the read instead of using it. His turn check on the A♥ — the card his bluffs always bet — subtracted the air from his range and left made hands managing the pot; those hands check the turn PLANNING to call a river bet, and yours is made of six-high and hope. Size can't fix it: $15 and $35 get looked up by the same kings and aces. The information was free and it said fold your bluffing plans; paying $15 or $35 to ignore it just sets the price of not listening.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_170',
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'beginner',
    weight: 1.0,
    villain: {
      type: 'calling-station',
      notes: 'Limps most hands, calls raises with all of them, and pays off top pair no matter how the board runs out',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (CS)',   action: 'Limps $2', state: 'active' },
      3: { label: 'BTN (You)', action: '???',      state: 'hero'   },
      4: { label: 'SB',        action: 'Active',   state: 'active' },
      5: { label: 'BB',        action: 'Active',   state: 'active' },
    }),
    hand: mkHand(['A','♠'], ['9','♠']),
    board: null,
    pot: '$5',
    toCall: null,
    body: "The station limps from the Cutoff — his tenth limp of the hour — and you're next with A♠9♠ on the Button. Against a solid opener this hand goes in the maybe pile. But that's not who's in the pot, and who's in the pot is the whole question.",
    question: 'A9 suited is a borderline hand against most raises. Against this limper, is \'borderline\' still the right file?',
    correct: 'raise',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Grading the Hand, Ignoring the Opponent', emoji: '⚠️',
        fb: "If a decent player had opened, folding A9s wouldn't be wrong — kicker trouble against real ranges is real. But hand standards aren't fixed; they move with the opponent, and this opponent limp-calls with most of the deck and pays off top pair to the end. Folding here grades the cards and skips the player. The player is the profitable part.",
      },
      {
        val: 'limp', label: 'Limp behind ($2)', icon: '📞', cls: 'call',
        grade: 'incorrect', title: 'Splitting the Prize Four Ways', emoji: '❌',
        fb: "Limping behind invites both blinds into what should be a private lesson: multiway, your A9 wins small pots and inherits kicker problems, and the station's beautiful habit — paying off top pair forever — gets diluted by two extra players who might actually have hands. You found the softest spot at the table; don't share it.",
      },
      {
        val: 'raise', label: 'Raise to $10', icon: '⚡', cls: 'raise',
        grade: 'correct', title: 'The Opponent Moves the Line', emoji: '✅',
        fb: "Raise to $10 and isolate him. This is opponent modeling changing a preflop chart in real time: A9 suited is marginal against players who punish marginal — and a value monster against one who limp-calls everything and pays off top pair no matter what. Heads-up, in position, your ace outkicks his entire loose range for the rest of the night. The cards didn't get better than 'borderline'; the customer did. Loosen up exactly where the opposition invites it — that's the entire art of seat-and-villain selection compressed into one raise.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_171',
    effectiveStacks: 200,
    skill: 'opponent',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: '3-bets wide with position and c-bets every 3-bet pot once — ace-high is the backbone of his range here',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: '3-Bets $20', state: 'hero'   },
      3: { label: 'BTN (AR)', action: 'Bets $22',   state: 'active' },
    }),
    hand: mkHand(['T','♥'], ['T','♣']),
    board: ['7♦', '5♣', '2♥'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $6', you: true }, { text: 'BTN 3-bets to $20' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check', you: true }, { text: 'BTN bets $22' }] },
    ],
    pot: '$43',
    toCall: '$22',
    body: "You opened T♥T♣ from the Cutoff, the aggressive reg 3-bet you to $20 from the Button — position, as usual — and you called. The flop couldn't be safer: 7♦5♣2♥. You check, he fires $22 into $43, the c-bet he makes with one hundred percent of his range.",
    question: 'Overpair to the board, in a 3-bet pot, against a range built on ace-high. What\'s the plan — for this street and the next two?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding the Best Hand to the Automatic Bet', emoji: '❌',
        fb: "His 3-bets are wide and his 3-bet-pot c-bets are universal — which means this $22 says nothing and your tens beat most of everything: every AK, AQ, AJ, every suited position play. Folding an overpair to a bet the villain makes with his whole range is paying full respect to zero information. In 3-bet pots, medium pairs ARE the calling range; if tens fold here, you have no calling range at all.",
      },
      {
        val: 'call', label: 'Call $22', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Your Hand Is a Three-Street Plan, Not One Call', emoji: '✅',
        fb: "Call — and know the plan runs to the river. Against THIS villain the math is bluntly in your favor: wide 3-bets plus automatic c-bets means ace-high makes up the bulk of his betting range, and tens beat all of it. Raising would fix his mistake for him — folding the air you beat, keeping the overpairs you don't. So you call, and you keep calling reasonable bets on safe cards, letting his bluffs fund the pot bullet by bullet. Against a nit who 3-bet you, tens play a small, careful pot. Against the position 3-bettor, they're a bluff-catching monster. The villain didn't just size your call — he wrote your whole script.",
      },
      {
        val: 'raise', label: 'Check-Raise to $60', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Protecting Your Hand From His Mistakes', emoji: '⚠️',
        fb: "The raise isn't crazy — it denies AK its six outs and takes the pot now. But study what it does to his range: the ace-highs you crush fold instantly (their next two barrels were your profit), and everything that continues — jacks through aces — has tens in terrible shape. You hold a hand that wants to be paid, against a player whose style is to keep paying. Don't interrupt him.",
      },
    ],
  }),

  // ── sc_172: founder-requested (July 7) — AKs TPTK facing a 3-bet-pot jam.
  //    First all-in scenario and first 2-option scenario in the pool.
  //    Founder spec was $1/$3 (18/55/100/225); scaled to house $1/$2 keeping
  //    every ratio: 6bb open, ~3.3x 3-bet, ~0.85-pot lead, ~2.3x jam, 3.5:1. ──

  mkScenario({
    id: 'sc_172',
    effectiveStacks: 200,
    skill: 'potodds',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'aggressive',
      notes: '3-bets light with position and hates being led into — his big raises mix monsters with overpairs and the occasional pure tantrum',
    },
    tableContext: null,
    positions: mkPositions({
      2: { label: 'CO (You)', action: 'Bets $70', state: 'hero'   },
      3: { label: 'BTN (AR)', action: 'All-In',   state: 'active' },
    }),
    hand: mkHand(['A','♥'], ['K','♥']),
    board: ['K♠', '9♦', '4♣'],
    actionHistory: [
      { street: 'PRE',  segments: [{ text: 'you raise to $12', you: true }, { text: 'BTN 3-bets to $40' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you bet $70', you: true }, { text: 'BTN raises all-in to $160' }] },
    ],
    pot: '$313',
    toCall: '$90 more',
    body: "You opened A♥K♥ to $12, the aggressive regular 3-bet to $40 from the Button — his favorite move — and you called. The flop is everything you wanted: K♠9♦4♣, rainbow, top pair top kicker. You led $70… and he shoved, all-in to $160. It's $90 more into a $313 pot: 3.5:1.",
    question: 'Top pair top kicker in a 3-bet pot, facing an all-in raise from an aggressive regular. Call or fold?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding to Monsters That Are Mostly Imaginary', emoji: '❌',
        fb: "Run the requirement before you run the fear: at 3.5:1 the call only needs to win 22% of the time, so folding claims that four times out of five this jam shows you a set or aces exactly. But an aggressive regular's 3-bet-then-shove range is far messier than that — queens and jacks hating your king, ace-king chopping, the occasional tantrum at being led into. Yes, sets and aces are in there, and sometimes you'll pay them. That's not a mistake; it's the price the odds already covered. Folding the effective nuts of your range, in a 3-bet pot, at 3.5:1, against the table's most aggressive player is how big pots get quietly donated all night.",
      },
      {
        val: 'call', label: 'Call $90 more (all-in)', icon: '📞', cls: 'call',
        grade: 'correct', title: 'The Price Answers the Scary Question', emoji: '✅',
        fb: "Call. The math is short and it's the whole answer: $90 to win $313 means you need 22%, and against an aggressive regular's shoving range — overpairs under your king (QQ, JJ), ace-king chopping, bluff-tantrums at being led into, alongside the real monsters — top pair top kicker clears that bar with room to spare. The hands that beat you exist; they just don't exist four times in five, and that's what your price requires. One caveat worth filing: against a NIT, this exact jam is sets and aces almost always, and the same call becomes a fold. Same cards, same price — the range across the table decides. Today that range is wide, the price is 3.5:1, and the chips go in.",
      },
    ],
  }),

];

// Contrast pairs (R4): same-difficulty groups the session builder prefers to
// deal together. Ids match scenario `id` values exactly — the original 83 are
// numeric. Cross-difficulty mirrors are listed in comments only (they cannot
// co-deal): sc_161↔sc_164 monotone attack/release · sc_122↔sc_136 price
// mirror · sc_138↔sc_123 river-lead mirror · {4,'sc_117'}↔'sc_131' trio arm ·
// sc_122↔sc_092 price mirror.
export const CONTRAST_PAIRS = [
  // beginner
  [2, 'sc_084'],          // A7o: open on the BTN vs fold in the CO (position)
  [4, 'sc_117'],          // JJ: call the nit vs shove on the maniac 4-bet
  ['sc_088', 'sc_113'],   // sizing: small on nit-dry vs pot on station-wet
  ['sc_111', 'sc_154'],   // same monster: raise the maniac vs check-call the barreler
  ['sc_139', 'sc_144'],   // tiny river bet: call w/ bluff-catcher vs value-raise
  ['sc_154', 'sc_160'],   // milk the barrels vs raise the turn (sequenced pair)
  // intermediate
  ['sc_122', 'sc_167'],   // same 2:1-ish price, opposite answer (fold vs check-raise)
  ['sc_122', 'sc_151'],   // face-up flush draw vs hidden-outs implied odds
  ['sc_118', 'sc_127'],   // float in position vs abandon the c-bet vs the floater
  ['sc_083', 'sc_104'],   // price-based call vs great-price-dead-hand fold
];

export default SCENARIOS;