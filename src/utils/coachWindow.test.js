import { aggregate, COACH_WINDOW } from './coachWindow';
import { MIN_RATED_ATTEMPTS } from '../data/constants';

// Two scenarios sharing a tag and a villain — the collision the `spot` field
// exists to break. Without it these two render as the same prompt line.
const LOOKUP = {
  sc_bluff: { tag: 'Bluff Frequency', skill: 'bluffing', villain: 'Calling Station', spot: 'BTN A♠K♠ flop' },
  sc_odds:  { tag: 'Pot Odds', skill: 'potodds', villain: 'Tight Nit', spot: 'BB J♥8♥ preflop' },
  sc_odds2: { tag: 'Pot Odds', skill: 'potodds', villain: 'Tight Nit', spot: 'CO Q♦Q♣ turn' },
};
const lookup = (id) => LOOKUP[id] ?? null;

const hand = (id, result, over = {}) => ({
  scenarioId: id, skill: LOOKUP[id].skill, result, choiceVal: 'fold', decisionMs: 30000, ...over,
});
const session = (hands) => ({ hands });
// Enough attempts to clear the product-wide evidence bar, so a test about
// tallies is not silently a test about the bar.
const rated = (id, result, over = {}) =>
  Array.from({ length: MIN_RATED_ATTEMPTS }, () => hand(id, result, over));
// Padding that lifts a skill over the bar without adding misses: a citation
// only carries its `scenario` tag once its skill is rated (see the evidence-bar
// block below), so a fixture about tallies has to clear the bar deliberately or
// it becomes a test of the bar by accident.
const clearsBar = (id) => rated(id, 'correct');

test('an empty window aggregates to a zeroed, non-crashing shape', () => {
  const out = aggregate([], lookup);
  expect(out).toMatchObject({ sessions: 0, hands: 0, previous: null, timeouts: 0 });
  expect(out.skills).toEqual([]);
  expect(out.confidentMisses).toEqual([]);
  expect(out.repeats).toEqual([]);
});

test('the window is the newest COACH_WINDOW sessions, the rest is the comparison', () => {
  const recent = Array.from({ length: COACH_WINDOW }, () => session([hand('sc_odds', 'correct')]));
  const older  = Array.from({ length: COACH_WINDOW }, () => session([hand('sc_odds', 'incorrect')]));
  const out = aggregate([...recent, ...older], lookup);
  expect(out.sessions).toBe(COACH_WINDOW);
  expect(out.accuracy).toEqual({ correct: COACH_WINDOW, total: COACH_WINDOW });
  expect(out.previous).toEqual({ correct: 0, total: COACH_WINDOW });
});

test('per-skill tallies come out attempts-desc, and skills with no attempts are absent', () => {
  const out = aggregate([session([
    ...rated('sc_bluff', 'incorrect'), hand('sc_bluff', 'correct'),
    ...rated('sc_odds', 'correct'),
  ])], lookup);
  expect(out.skills).toEqual([
    { skill: 'bluffing', attempts: MIN_RATED_ATTEMPTS + 1, correct: 1 },
    { skill: 'potodds', attempts: MIN_RATED_ATTEMPTS, correct: MIN_RATED_ATTEMPTS },
  ]);
  expect(out.skills.find(s => s.skill === 'preflop')).toBeUndefined();
});

// ── the evidence bar ─────────────────────────────────────────────────────────
// MIN_RATED_ATTEMPTS is the same bar the skill ledger and the recent-form strip
// enforce. If the prompt could name a skill they call unrated, three surfaces
// would give one player three different answers — and the founder would only
// find out during a LIVE eval that costs real money. Pinned in BOTH directions:
// exactly at the bar is reportable, one attempt under it is not.
test('a skill AT MIN_RATED_ATTEMPTS is reportable to the prompt', () => {
  const out = aggregate([session(rated('sc_odds', 'correct'))], lookup);
  expect(out.skills).toEqual([
    { skill: 'potodds', attempts: MIN_RATED_ATTEMPTS, correct: MIN_RATED_ATTEMPTS },
  ]);
  expect(out.unratedSkills).toEqual([]);
});

test('a skill BELOW MIN_RATED_ATTEMPTS is never named to the prompt', () => {
  const thin = Array.from({ length: MIN_RATED_ATTEMPTS - 1 }, () => hand('sc_bluff', 'incorrect'));
  const out = aggregate([session([...rated('sc_odds', 'correct'), ...thin])], lookup);
  expect(out.skills.map(s => s.skill)).toEqual(['potodds']);
  expect(out.skills.find(s => s.skill === 'bluffing')).toBeUndefined();
  // Still counted — the hands are real, they just cannot be spoken about.
  expect(out.unratedSkills).toEqual(['bluffing']);
  expect(out.hands).toBe(MIN_RATED_ATTEMPTS * 2 - 1);
});

// ── the bar reaches CITATIONS too (live eval finding 3, July 29 2026) ────────
// Dropping sub-bar skills from `skills` closed only half the hole. A citation
// carries `scenario`, which is the scenario's `tag` — and `tag` is a pure
// function of `skill`, i.e. the skill written out in prose. So a window with a
// single fast-and-wrong `bluffing` hand sent NO bluffing skill line and still
// showed the model "Bluff Frequency, BTN A♠K♠ flop ...", under a prompt that
// instructs it to headline confident errors. The read headlined Bluff Frequency
// while the ledger greyed it out.
//
// The confident error is NOT discarded — it is the highest-leverage signal the
// product has (F2). Only its skill LABEL is withheld; seat, hole cards, street,
// board and villain still identify the spot (172/172 distinct without the tag).
// Both directions, because a gate that only ever sees one input is untested.
test('a citation on a RATED skill carries its tag', () => {
  const out = aggregate([session([
    ...clearsBar('sc_bluff'),
    hand('sc_bluff', 'incorrect', { decisionMs: 4000 }),
  ])], lookup);
  expect(out.skills.map(s => s.skill)).toEqual(['bluffing']);
  expect(out.confidentMisses).toEqual([
    { villain: 'Calling Station', scenario: 'Bluff Frequency', spot: 'BTN A♠K♠ flop' },
  ]);
});

test('a citation on a SUB-BAR skill withholds the tag but keeps the spot', () => {
  const out = aggregate([session([
    ...clearsBar('sc_odds'),                              // an unrelated rated skill
    hand('sc_bluff', 'incorrect', { decisionMs: 4000 }),  // one thin, confident miss
  ])], lookup);
  expect(out.unratedSkills).toEqual(['bluffing']);
  // The error still reaches the model, fully located, just unlabelled.
  expect(out.confidentMisses).toEqual([
    { villain: 'Calling Station', scenario: '', spot: 'BTN A♠K♠ flop' },
  ]);
  expect(out.confidentByVillain[0].spots[0].spot).toBe('BTN A♠K♠ flop');
});

test('a repeat-offender citation is gated by the same bar', () => {
  const twice = [hand('sc_bluff', 'incorrect'), hand('sc_bluff', 'incorrect')];
  const thin = aggregate([session([...clearsBar('sc_odds'), ...twice])], lookup);
  expect(thin.repeats).toEqual([
    { scenario: '', villain: 'Calling Station', spot: 'BTN A♠K♠ flop', misses: 2 },
  ]);
  const fat = aggregate([session([...clearsBar('sc_bluff'), ...twice])], lookup);
  expect(fat.repeats[0].scenario).toBe('Bluff Frequency');
});

// The structural claim, not just the two cases above: `skills` is the ONE
// channel through which a skill name can reach the model, and it applies the
// bar. Nothing a sub-bar skill is called — neither its key nor its prose tag —
// may appear anywhere the prompt renders. (`unratedSkills` is excluded on
// purpose: it is for the eval doc and debugging and is never rendered.)
test('a sub-bar skill cannot reach the model as a nameable skill', () => {
  const out = aggregate([session([
    ...clearsBar('sc_odds'),
    hand('sc_bluff', 'incorrect', { decisionMs: 4000 }),
    hand('sc_bluff', 'incorrect'),
  ])], lookup);
  const rendered = JSON.stringify({
    skills: out.skills,
    confidentByVillain: out.confidentByVillain,
    repeatsByVillain: out.repeatsByVillain,
    confidentMisses: out.confidentMisses,
    repeats: out.repeats,
  });
  expect(rendered).not.toContain('Bluff Frequency');   // the tag: the skill in prose
  expect(rendered).not.toContain('bluffing');          // and the raw skill key
  // Negative control: the rated skill IS nameable, so the assertions above are
  // not passing because nothing is named at all.
  expect(rendered).toContain('potodds');
});

// The failure the founder actually saw in the dry run: one 0-of-1 skill was the
// only 0% line in the prompt, so it read as the headline leak.
test('a lone 0-of-1 skill cannot become the prompt\'s only 0% line', () => {
  const out = aggregate([session([
    ...rated('sc_odds', 'correct'), hand('sc_bluff', 'incorrect'),
  ])], lookup);
  expect(out.skills.every(s => s.attempts >= MIN_RATED_ATTEMPTS)).toBe(true);
  expect(out.skills.some(s => s.correct === 0)).toBe(false);
});

// F2: fast AND wrong is the confident miss — the leak the player does not know
// they have. Slow-wrong is an ordinary miss; fast-RIGHT is not a miss at all.
test('only fast AND wrong counts as a confident miss', () => {
  const out = aggregate([session([
    ...clearsBar('sc_bluff'),                              // so the tag may be cited
    hand('sc_bluff', 'incorrect', { decisionMs: 4000 }),   // fast + wrong  -> yes
    hand('sc_odds', 'incorrect', { decisionMs: 40000 }),   // slow + wrong  -> no
    hand('sc_odds', 'correct', { decisionMs: 3000 }),      // fast + right  -> no
    hand('sc_bluff', 'incorrect', { decisionMs: null }),   // timeout       -> no
  ])], lookup);
  expect(out.confidentMisses).toEqual([
    { villain: 'Calling Station', scenario: 'Bluff Frequency', spot: 'BTN A♠K♠ flop' },
  ]);
});

// A freeze is a distinct behaviour from a bad choice, and the prompt says so on
// its own line. Both nulls are required: keying on `result` would sweep up every
// ordinary miss, and keying on decisionMs alone would sweep up an ANSWERED hand
// whose shown-at timestamp went missing.
test('a timeout is the player never acting, not a slow or a wrong answer', () => {
  const out = aggregate([session([
    hand('sc_odds', 'incorrect', { choiceVal: null, decisionMs: null }),  // froze          -> yes
    hand('sc_bluff', 'incorrect', { choiceVal: null, decisionMs: null }), // froze          -> yes
    hand('sc_bluff', 'incorrect', { decisionMs: 90000 }),                 // slow, ANSWERED -> no
    hand('sc_bluff', 'incorrect', { decisionMs: 4000 }),                  // fast + wrong   -> no
    hand('sc_odds', 'incorrect', { decisionMs: null }),                   // answered, no clock -> no
    hand('sc_odds', 'correct'),                                           // answered right -> no
  ])], lookup);
  expect(out.timeouts).toBe(2);
});

// The absence-means-presence hazard: `timeouts` is the one place a missing value
// is an affirmative signal, so a reduced hand shape must NOT be read as a freeze.
test('a hand missing the keys entirely is not a freeze, only an explicit null is', () => {
  const out = aggregate([session([
    { scenarioId: 'sc_odds', skill: 'potodds', result: 'incorrect' },  // keys absent -> no
    { scenarioId: 'sc_odds', skill: 'potodds', result: 'incorrect', choiceVal: null, decisionMs: null },
  ])], lookup);
  expect(out.timeouts).toBe(1);
});

test('a window with nobody freezing reports zero timeouts', () => {
  const out = aggregate([session([
    hand('sc_odds', 'correct'), hand('sc_bluff', 'incorrect'),
  ])], lookup);
  expect(out.timeouts).toBe(0);
});

test('a scenario missed more than once in the window is a repeat offender', () => {
  const out = aggregate([
    session(clearsBar('sc_bluff')),   // so the tag may be cited
    session([hand('sc_bluff', 'incorrect')]),
    session([hand('sc_bluff', 'incorrect')]),
    session([hand('sc_odds', 'incorrect')]),
  ], lookup);
  expect(out.repeats).toEqual([
    {
      scenario: 'Bluff Frequency', villain: 'Calling Station',
      spot: 'BTN A♠K♠ flop', misses: 2,
    },
  ]);
});

// The collision this field exists to break: `tag` is a pure function of `skill`,
// so two DIFFERENT pot-odds spots against the same villain carry an identical
// tag and villain. Cited by tag + villain alone they are the same line twice,
// inside a prompt that forbids inventing statistics — the model can only merge
// them or emit what reads as a data error. The spot is what keeps them two.
test('two spots sharing a tag and a villain still cite distinctly', () => {
  const out = aggregate([
    session(clearsBar('sc_odds')),   // so the tag is present to collide at all
    session([hand('sc_odds', 'incorrect'), hand('sc_odds2', 'incorrect')]),
    session([hand('sc_odds', 'incorrect'), hand('sc_odds2', 'incorrect')]),
  ], lookup);
  expect(out.repeats).toHaveLength(2);
  const cited = out.repeats.map(r => `${r.scenario}|${r.villain}`);
  expect(new Set(cited).size).toBe(1);                       // identical without the spot
  expect(new Set(out.repeats.map(r => r.spot)).size).toBe(2); // distinct with it
});

// ── pre-aggregation by villain (live eval finding 2, July 29 2026) ──────────
// The prompt used to hand the model a flat list and let it tally: on a window of
// Calling Station x1, Tight Recreational x1, Tight Nit x2, Maniac x1 it returned
// "two vs Tight Nit, two vs Tight Recreational" — an invented statistic, twice
// out of two live runs, on the single highest-leverage read the product makes.
// The count is computed here now, so citing it is a read rather than a tally.
test('confident errors arrive tallied by villain, so the model never has to count', () => {
  const out = aggregate([session([
    ...clearsBar('sc_odds'), ...clearsBar('sc_bluff'),   // both skills over the bar
    hand('sc_odds', 'incorrect', { decisionMs: 4000 }),
    hand('sc_odds2', 'incorrect', { decisionMs: 4000 }),
    hand('sc_bluff', 'incorrect', { decisionMs: 4000 }),
  ])], lookup);
  expect(out.confidentByVillain).toEqual([
    {
      villain: 'Tight Nit',
      count: 2,
      spots: [
        { villain: 'Tight Nit', scenario: 'Pot Odds', spot: 'BB J♥8♥ preflop' },
        { villain: 'Tight Nit', scenario: 'Pot Odds', spot: 'CO Q♦Q♣ turn' },
      ],
    },
    {
      villain: 'Calling Station',
      count: 1,
      spots: [
        { villain: 'Calling Station', scenario: 'Bluff Frequency', spot: 'BTN A♠K♠ flop' },
      ],
    },
  ]);
});

// The tally is added to the specifics, never substituted for them: seat + hole
// cards + street is still what tells two same-tag, same-villain hands apart, and
// it now lives INSIDE the group.
test('the disambiguating spot labels survive inside each villain group', () => {
  const out = aggregate([session([
    hand('sc_odds', 'incorrect', { decisionMs: 4000 }),
    hand('sc_odds2', 'incorrect', { decisionMs: 4000 }),
  ])], lookup);
  expect(out.confidentByVillain).toHaveLength(1);
  expect(out.confidentByVillain[0].spots.map(s => s.spot))
    .toEqual(['BB J♥8♥ preflop', 'CO Q♦Q♣ turn']);
});

// The truncation trap. Only MAX_CITED lines reach the prompt, so a tally taken
// over the whole window would print a number the model cannot reconcile with the
// list beneath it — and reconciling an unreconcilable prompt is how it invents.
// The count must always describe the lines that are actually visible.
test('the villain tally counts the CITED lines, never more than the prompt shows', () => {
  const many = Array.from({ length: 8 }, () => hand('sc_odds', 'incorrect', { decisionMs: 4000 }));
  const out = aggregate([session(many)], lookup);
  const tallied = out.confidentByVillain.reduce((n, g) => n + g.count, 0);
  expect(out.confidentMisses.length).toBeLessThan(8);      // truncated
  expect(tallied).toBe(out.confidentMisses.length);        // and the tally agrees
  expect(out.confidentByVillain[0].spots).toHaveLength(out.confidentMisses.length);
});

test('repeat-offender spots are tallied by villain on the same terms', () => {
  const twice = () => session([
    hand('sc_odds', 'incorrect'), hand('sc_odds2', 'incorrect'), hand('sc_bluff', 'incorrect'),
  ]);
  const out = aggregate([twice(), twice()], lookup);
  expect(out.repeatsByVillain.map(g => [g.villain, g.count]))
    .toEqual([['Tight Nit', 2], ['Calling Station', 1]]);
  // per-spot miss counts are still there — the group count is how many SPOTS,
  // the spot count is how many times each was missed. Both are given, neither
  // is derived.
  expect(out.repeatsByVillain[0].spots.map(s => [s.spot, s.misses]))
    .toEqual([['BB J♥8♥ preflop', 2], ['CO Q♦Q♣ turn', 2]]);
});

test('a window with no confident errors and no repeats carries empty tallies', () => {
  const out = aggregate([session([hand('sc_odds', 'correct')])], lookup);
  expect(out.confidentByVillain).toEqual([]);
  expect(out.repeatsByVillain).toEqual([]);
});

// The fact F5 criterion 3 now hangs on: villains reach the prompt ONLY through
// confidentMisses and repeats. A window with neither carries no villain string
// at all, so judging such a read against "references the villain types" is
// judging it against a bar the design cannot meet — which is exactly what the
// eval harness asked the founder to do on 7 of 9 personas. If a future change
// puts villains somewhere else in the aggregate, this fails and the harness
// wording has to be revisited with it.
test('villains reach the aggregate ONLY via confident misses and repeats', () => {
  const out = aggregate([session([
    hand('sc_odds', 'correct'),                          // right, so no citation
    hand('sc_bluff', 'incorrect', { decisionMs: 90000 }), // slow miss, cited nowhere
  ])], lookup);
  expect(out.confidentMisses).toEqual([]);
  expect(out.repeats).toEqual([]);
  const { confidentMisses, repeats, confidentByVillain, repeatsByVillain, ...rest } = out;
  const villains = Object.values(LOOKUP).map(v => v.villain);
  expect(villains.some(v => JSON.stringify(rest).includes(v))).toBe(false);
});

// The lookup is a parameter precisely so this module never imports the lazy
// scenario chunk. An unknown id must degrade, not throw.
test('an unknown scenario id degrades instead of throwing', () => {
  const gone = { scenarioId: 'sc_gone', skill: 'reads', result: 'incorrect', choiceVal: 'call', decisionMs: 2000 };
  const out = aggregate([session(Array.from({ length: MIN_RATED_ATTEMPTS }, () => gone))], lookup);
  expect(out.hands).toBe(MIN_RATED_ATTEMPTS);
  expect(out.skills).toEqual([{ skill: 'reads', attempts: MIN_RATED_ATTEMPTS, correct: 0 }]);
  // An unresolvable id yields an EMPTY spot, never a second 'Unknown' — the
  // prompt drops the empty segment rather than printing three unknowns a row.
  // `reads` HAS cleared the bar here, so the tag slot is filled (with 'Unknown',
  // since the lookup resolved nothing) rather than withheld.
  expect(out.confidentMisses[0]).toEqual({ villain: 'Unknown', scenario: 'Unknown', spot: '' });
});

// ── direction ────────────────────────────────────────────────────────────────
// Carried forward from the Task 3 review: `direction` had ZERO coverage, and
// the meta-read prompt renders under/over/loose/evidence directly. A wrong
// value there would surface only in the LIVE eval, which costs the founder real
// money and time — so it gets pinned mechanically here instead.
//
// These fixtures use REAL scenario ids, unlike the rest of this file: direction
// is resolved by schema.js against data/scenario-index.js, not against the
// `lookup` parameter, so a made-up id yields no directional signal at all and
// would make these assertions vacuously pass. Per the index:
//   id 1  → correct 'call'  (cls call): fold = under, raise = over
//   id 18 → correct 'fold'  (cls fold): call = loose
// Weighting is incorrect=1.0, partial=0.5 (DIRECTION_WEIGHT); a correct answer
// contributes no direction but still counts toward `hands`, the denominator.
const dHand = (scenarioId, result, choiceVal) => ({
  scenarioId, skill: 'potodds', result, choiceVal, decisionMs: 30000,
});

test('direction tallies the DIRECTION of misses, weighted, not just their count', () => {
  const out = aggregate([session([
    dHand(1, 'incorrect', 'fold'),   // passive miss      → under 1.0
    dHand(1, 'partial', 'fold'),     // half-credit miss  → under 0.5
    dHand(1, 'incorrect', 'raise'),  // aggressive miss   → over  1.0
    dHand(18, 'incorrect', 'call'),  // call-when-fold    → loose 1.0
    dHand(1, 'correct', 'call'),     // no direction, still a hand
  ])], lookup);

  expect(out.direction).toEqual({
    under: 1.5, over: 1, loose: 1, evidence: 3.5, hands: 5,
  });
});

// Negative control: the cells must stay at zero for hands that carry no
// directional signal, so a future change cannot quietly manufacture evidence.
// A timeout is a freeze, never a direction; an unknown id resolves to nothing.
test('timeouts and unknown scenarios add hands but no direction', () => {
  const out = aggregate([session([
    dHand(1, 'incorrect', null),          // timeout — choiceVal null
    dHand('sc_gone', 'incorrect', 'fold'), // id not in the scenario index
  ])], lookup);

  expect(out.direction).toEqual({ under: 0, over: 0, loose: 0, evidence: 0, hands: 2 });
});

test('partial credit counts as an attempt but not as correct', () => {
  const out = aggregate([session(rated('sc_odds', 'partial'))], lookup);
  expect(out.skills).toEqual([
    { skill: 'potodds', attempts: MIN_RATED_ATTEMPTS, correct: 0 },
  ]);
  expect(out.accuracy).toEqual({ correct: 0, total: MIN_RATED_ATTEMPTS });
});
