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

const VILLAIN_LABELS = {
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
        fb: "Folding J8 suited in the BB against a wide opener is leaving money on the table. You're getting nearly 3:1 and the hand has real playability — suited connectors thrive in exactly these spots.",
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
    question: "You're getting 3.6:1 pot odds with 10 outs. What's your play?",
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Folding Equity Left Behind', emoji: '❌',
        fb: "You have 10 outs (4 to the nut straight, 6 overcard outs) and you're getting 3.6:1 — this is a mandatory call. Folding KQ on this board gives up too much equity against a passive player who isn't even likely to barrel future streets.",
      },
      {
        val: 'call', label: 'Call $15', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Solid Pot Odds Decision', emoji: '✅',
        fb: "With 10 outs and 3.6:1 odds, calling is the clear play. A passive regular who only bets for value is unlikely to fold to a raise, so you take the good price and look to hit your draw.",
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
    pot: '$27',
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
    pot: '$5',
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
        val: 'raise', label: 'Open raise to $15', icon: '📞', cls: 'call',
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
    skill: 'preflop',
    difficulty: 'intermediate',
    weight: 1.0,
    villain: {
      type: 'tight',
      notes: 'Tight recs defend blinds too narrow — fold to shoves ~80% of the time.',
    },
    positions: mkPositions({
      3: { label: 'BTN (You)', action: '???',    state: 'hero'   },
      4: { label: 'SB',        action: 'Active', state: 'active' },
      5: { label: 'BB',        action: 'Active', state: 'active' },
    }),
    hand: mkHand(['K','♦'], ['9','♦']),
    board: null,
    pot: '$600',
    toCall: null,
    body: 'Folds to you on BTN. SB and BB are both tight recreational players.',
    question: 'K♦9♦ on BTN with 25BB in a tournament. Tight recs in the blinds. What do you do?',
    correct: 'shove',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Bleeding Chips', emoji: '❌',
        fb: "K9s at 25BB is too strong to fold. Tournament chips are bleeding away — against tight players who over-fold, this is a profitable shove. Passivity at this stack depth is slow suicide.",
      },
      {
        val: 'shove', label: 'Shove all-in', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Correct ICM Shove', emoji: '✅',
        fb: "At 25BB, K9s is a clear shove against tight recreational players who fold to pressure. The small raise just commits you anyway — go all-in, deny them the ability to call off 10BB and fold the rest.",
      },
      {
        val: 'raise', label: 'Raise to 2.5BB', icon: '⚡', cls: 'raise',
        grade: 'partial', title: 'Small Raise Commits You Anyway', emoji: '⚠️',
        fb: "Raising small at 25BB creates a pot you'll commit to anyway on most flops. Against tight recs who fold to shoves 80% of the time, just put the pressure on immediately and take the pot now.",
      },
    ],
  }),

  mkScenario({
    id: 13,
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
    board: ['K♠', '9♥', '3♦'],
    pot: '$40',
    toCall: null,
    actionHistory: [
      { street: 'PRE', segments: [{ text: "BB raises" }, { text: "you 3-bet", you: true }, { text: "BB calls" }] },
      { street: 'FLOP', segments: [{ text: "BB checks" }] },
    ],
    body: 'BTN 3-bet preflop. BB aggressive regular called. Flop K♠9♥3♦. BB checks.',
    question: 'A♦5♦ — overcard on K93. As the 3-bettor, aggressive BB checks. C-bet or check?',
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
        fb: "Correct fold. A nit betting AKQ monotone has a J-high flush or better — your 8-high flush is almost never good. The pot odds are irrelevant when your outs are dead.",
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
        fb: "Folding is correct. A passive player who checks and calls all session and then bets the river for the first time almost always has the goods. The Jack completes straights and gives JX a strong hand — trust the pattern.",
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
    question: '99 on K83 rainbow. Tight nit bets after your check. What do you do?',
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
        fb: "Calling with 99 on K83 against a nit who only bets with top pair is drawing to 2 outs. You need roughly 16:1 pot odds to call profitably — you're getting less than 3:1. Fold and move on.",
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
    pot: '$27',
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
    pot: '$27',
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
        fb: "Pot-sized bet with AA on J98 two-tone. This board is too dangerous to play coy — every turn card threatens your overpair. Charge him full price to draw, and if he check-raises, you 3-bet and get it in with the best hand.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_046',
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
    body: "BTN vs BB aggressive regular. You have T♦9♦ — you riveted a straight. River 7♦. He checks.",
    question: 'Rivered nut straight on J8Q27 vs aggressive regular who re-raises polarized. What size?',
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
    body: "You c-bet the flop with J♦T♦ (gutshot + two overs) and the nit called. Turn is 2♥ — a blank. He checks to you.",
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
    body: "BTN vs BB passive player. You bet flop and turn with K♣Q♣ (gutshot + two overs). River T♠ — you backdoored the nut straight. He checks to you.",
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
    body: "BTN vs BB tight recreational. You barreled flop and turn representing a strong range with A♦4♦ (backdoor nut flush draw — needs running diamonds). River bricks 5♣ — the flush never materialized and you're left with ace-high and a pair of 4s with no real showdown value. He checks.",
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
    pot: '$15',
    toCall: '$10',
    body: "Passive BTN bets $10 into a $15 pot on A♦7♥3♣. You're in BB with A♠5♣ — top pair, weak kicker.",
    question: 'Top pair weak kicker on A73 rainbow. Passive villain bets $10. Getting 2.5:1. What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Top Pair is Not a Fold', emoji: '❌',
        fb: "Folding top pair getting 2.5:1 on the flop is massively over-folding. You're well within profitable calling territory — A5 beats his draws and many worse aces that a passive player might bet with.",
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
    hand: mkHand(['T','♥'], ['9','♥']),
    board: ['K♦', '8♣', '2♠', '3♥', 'Q♣'],
    pot: '$50',
    toCall: '$40',
    actionHistory: [
      { street: 'PRE', segments: [{ text: 'BTN raises to $6' }, { text: 'you call', you: true }] },
      { street: 'FLOP', segments: [{ text: 'you check-call his bet', you: true }] },
      { street: 'TURN', segments: [{ text: 'you check-call his bet', you: true }] },
      { street: 'RIVER', segments: [{ text: 'you check', you: true }, { text: 'BTN shoves $40' }] },
    ],
    body: "Maniac BTN fires three streets on K823Q. River Q♣. He shoves $40 into $50. You have T♥9♥ — total air, no pair, no draw.",
    question: 'T♥9♥ (nothing) on K823Q. Maniac shoves river, 60% bluff frequency. Getting 2.25:1. What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: 'Math Says Call', emoji: '❌',
        fb: "Folding here is a math error. You need 31% equity to call at 2.25:1, and the maniac's bluff frequency is 60%. T9 beats his bluffs and you have a profitable call. Trust the math.",
      },
      {
        val: 'call', label: 'Call $40', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Bluff-Catch at the Right Frequency', emoji: '✅',
        fb: "Call. At 2.25:1 you need to be right 31% of the time — and the maniac bluffs 60% of rivers. Even with no pair, calling a polarized river bet from a known bluffer is mathematically mandatory.",
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
    question: 'QQ (top set) on QT43J. You bet river $35. Passive player raises to $100 for the first time all hand. What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'partial', title: 'Folding is Defensible', emoji: '⚠️',
        fb: "Folding is tempting but a passive player's raise range isn't exclusively the nuts — he can raise with KJ, JJ (full house) that you beat with the higher full house. The fold is close but calling has merit given your hand strength.",
      },
      {
        val: 'call', label: 'Call $50 more', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Call — You Still Beat Some of His Range', emoji: '✅',
        fb: "Call. A passive player raising the river on QT43J has AK (the straight) or K9 most of the time — but you still beat 9-high draws that turned into straights he was slow-playing and set-over-set is unlikely. Call and accept being behind occasionally.",
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
    question: 'AT (TPTK) on A74 two-tone. Passive player check-raises your c-bet. Fold, call, or re-raise?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Passive Check-Raise = Strong', emoji: '✅',
        fb: "Fold TPTK. A passive player who almost never raises check-raises you with two pair or better — AK/A7/A4/77/44 are all in his range and all have you crushed. Disciplined fold.",
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
    question: 'Top two pair (AK) on AK8J. Loose rec — who slow-plays — suddenly leads the turn. Fold, call, or raise?',
    correct: 'fold',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'correct', title: 'Read the Slow-Play Pattern', emoji: '✅',
        fb: "Fold. A loose recreational who slow-plays strong hands and suddenly leads the turn on AK8J has exactly QT (the straight), AJ (better two pair), or a set. His lead after passive calls screams monster.",
      },
      {
        val: 'call', label: 'Call $22', icon: '📞', cls: 'call',
        grade: 'partial', title: 'Calling Leaks Chips on This Board', emoji: '⚠️',
        fb: "Calling top two pair on AK8J when a slow-playing loose rec leads for the first time is expensive. This board completed a straight and his exact pattern — passive then leads — is the classic slow-play tell.",
      },
      {
        val: 'raise', label: 'Raise to $70', icon: '⚡', cls: 'raise',
        grade: 'incorrect', title: 'Raising Into Slow-Played Monster', emoji: '❌',
        fb: "Raising into a loose recreational's first lead after two passive calls on AK8J is committing maximum chips against his narrowest possible range. The pattern is a strong tell — fold.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_065',
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
    pot: '$37',
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
        grade: 'partial', title: 'Checking Has Showdown Value', emoji: '⚠️',
        fb: "Checking back misses a clear bluffing opportunity. You have 10-high, no showdown value, and a line that looks strong. The aggressive regular's check is a signal — fire.",
      },
      {
        val: 'call', label: 'Bet $25 (half-pot bluff)', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Represent the Range You Have', emoji: '✅',
        fb: "Half-pot bluff is correct. You called three streets so your range looks strong — a river bluff after the aggressive regular checks is credible and he gives up with missed draws 70% of the time. Half-pot is the efficient size.",
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
    body: "BTN aggressive regular bets $9 on T♣8♣2♦. You have J♣5♣ — a flush draw plus gutshot (potentially 12 outs).",
    question: 'J♣5♣ (flush draw + gutshot, ~12 outs) on T82 two-tone. Aggressive regular bets $9. Getting 2.56:1. What do you do?',
    correct: 'call',
    choices: [
      {
        val: 'fold', label: 'Fold', icon: '🃏', cls: 'fold',
        grade: 'incorrect', title: '12 Outs is Not a Fold', emoji: '❌',
        fb: "Folding 12 outs getting 2.56:1 is a significant mathematical error. Even without implied odds you're close to break-even — with position and implied odds, this is a straightforward call.",
      },
      {
        val: 'call', label: 'Call $9', icon: '📞', cls: 'call',
        grade: 'correct', title: 'Call and Realize Draw Equity', emoji: '✅',
        fb: "Call with 12 outs at 2.56:1. You're getting enough direct odds plus implied odds against an aggressive regular — hitting the flush or straight on the turn sets up a big pot. Calling preserves maximum implied odds.",
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
        fb: "Medium bet is correct. A passive player calls top pair and two pair with medium bets and folds to overbets. Three streets of $35 extracts more than one street of $130 — keep him in the hand.",
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
    body: "BTN vs BB passive player. Flop A♥T♦4♣ — you c-bet, he called. Turn 2♠ — he checks. You have Q♣9♣ (gutshot + backdoor flush draw).",
    question: 'Q♣9♣ (gutshot, some backdoor equity) on AT42. Passive player checks turn. Second barrel or give up?',
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
        fb: "Pot-betting as a second barrel with a gutshot and no pair overcommits your chips on a draw. $12 is enough to fold out his medium hands — size down and keep risk manageable.",
      },
    ],
  }),

  mkScenario({
    id: 'sc_076',
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
    pot: '$7',
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
    body: "BTN vs BB passive player. You c-bet flop, he called. Turn A♣. You have J♦9♦ — an open-ended straight draw (needs Q or 8). He checks.",
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
    body: "BB vs BTN aggressive regular. Three streets of betting on Q♦9♠4♥2♦K♠. He fires river $55 into $70. You have QT — middle top pair, decent kicker. He bluffs rivers 40% of the time.",
    question: 'QT (top pair) on Q942K river. Aggressive regular who bluffs rivers 40% fires $55. Getting 2.27:1. What do you do?',
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

];

export default SCENARIOS;