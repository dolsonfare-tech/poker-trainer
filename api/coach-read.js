// Coach's Read — the only code that calls the Claude API.
// Locked down (July 2026): requires a signed-in Supabase user and enforces a
// per-user daily cap, so anonymous token-burning is impossible. Input caps and
// the small max_tokens bound the cost of any single call.
const { createClient } = require('@supabase/supabase-js');

// Coach calls per user per day (1 per session played). Lowered 20 → 5 at the
// founder's call (July 18, 2026, subscription research): the free allowance
// launches at its long-term level so a future Pro tier never has to take
// anything away. Mirrored by COACH_DAILY_LIMIT in SessionSummary.jsx.
const DAILY_LIMIT = 5;

// aggregate() and the scenario library are ES modules; this handler is
// CommonJS, so they load through dynamic import (supported on the Node
// runtime). The lookup is built here and PASSED IN — coachWindow.js must never
// import the scenario chunk itself (CA-014 bundle split).
//
// Both modules and everything they pull in use fully-specified relative
// specifiers (`./spacedrep.js`, not `./spacedrep`). Node's ESM resolver does no
// extension guessing, so an extensionless import anywhere in that subtree makes
// this load fail at runtime while every local gate stays green — which is
// exactly how `npm run eval:coach` sat broken from CA-014 until this commit.
// The scenario metadata aggregate() cites, keyed by id. EXPORTED so the eval
// harness calls this exact function instead of keeping its own copy: a
// byte-identical duplicate is the same hazard class as the `mk()` payload
// mapping this seam removed. Rename `villain.label` with a second copy in play
// and the harness would quietly emit `undefined` villains into the prompt while
// the endpoint stayed correct — a drift the eval exists to catch, not cause.

// The disambiguator. `tag` is a PURE FUNCTION of `skill` (scenarios.js:
// `tag = SKILL_TAGS[rest.skill]`), so a spot labelled by tag + villain alone
// collapses 172 scenarios into 57 distinct labels — about three scenarios per
// label. Two different pot-odds spots missed twice each against a Calling
// Station then render as two byte-identical prompt lines, under a rule that
// forbids inventing statistics: the model can only merge them (undercounting)
// or emit something that reads as a data error. Citing a repeated spot the
// player cannot compute for themselves is the whole point of the ten-session
// window, so the label has to identify the HAND.
//
// Seat + hole cards + street + BOARD. The board joined July 29, 2026 with the
// evidence bar (finding 3): once a citation may have to stand WITHOUT its tag —
// because the tag is the skill in prose and a sub-bar skill may not be named —
// the spot has to carry the whole identity on its own. Measured over the
// current library (172 scenarios):
//   - seat + hole + street            → 167/172 distinct
//   - seat + hole + street + board    → 172/172 distinct
//   - villain + spot, tag WITHHELD    → 172/172 distinct
//   - villain + tag + spot            → 172/172 distinct
// So the rendered citation is unambiguous whether or not the tag is present;
// without the board it would have fallen to 171/172 in the withheld case
// (`Aggressive Regular | BB Q♦J♦ flop` is two different hands). Cost is ~7
// characters and it stays inside the 30-char clamp (longest spot: 25).
//
// Suit symbols, never shorthand (KQs/98d) — CLAUDE.md, and it is what the
// player saw on the felt.
const STREET_BY_BOARD = { 0: 'preflop', 3: 'flop', 4: 'turn', 5: 'river' };
function describeSpot(s) {
  const seat = (s.positions ?? []).find(p => p.state === 'hero')?.label?.split(' ')[0];
  const hole = (s.hand ?? []).map(c => `${c.r}${c.s}`).join('');
  const board = (s.board ?? []).join('');
  return [seat, hole, STREET_BY_BOARD[(s.board ?? []).length], board].filter(Boolean).join(' ');
}

function buildLookup(scenarios) {
  const byId = new Map((scenarios ?? []).map(s => [s.id, s]));
  return (id) => {
    const s = byId.get(id);
    return s
      ? { tag: s.tag, skill: s.skill, villain: s.villain?.label, spot: describeSpot(s) }
      : null;
  };
}

let _mods = null;
async function loadModules() {
  if (!_mods) {
    const [win, scen] = await Promise.all([
      import('../src/utils/coachWindow.js'),
      import('../src/data/scenarios.js'),
    ]);
    _mods = {
      aggregate: win.aggregate,
      COACH_WINDOW: win.COACH_WINDOW,
      lookup: buildLookup(scen.default),
    };
  }
  return _mods;
}

async function aggregateForUser(sessions) {
  const { aggregate, lookup } = await loadModules();
  return aggregate(sessions, lookup);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // No request body to validate any more — the window is derived server-side.

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // ── Auth + per-user daily cap ─────────────────────────────────────────
  // Enforced whenever the server has Supabase credentials (always in prod).
  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  // Declared out here so the no-credentials branch below still sees them.
  let sessions = [];
  // Stamps the finished read onto the newest session row — the session that
  // triggered this read. The client inserts that row (coach_read null) BEFORE
  // calling here, so the window below includes it; the read then has to be
  // written back or it never reaches the append-only log at all (RLS has no
  // update policy on sessions — the service role is the only writer that can).
  // db.js rebuilds coachReads and sessionsSinceRead from rows' coach_read, so
  // a read that skips the log is erased on the next profile load.
  let stampRead = null;
  // The cap INCREMENT, deferred. The cap READ (the 429 short-circuit) stays
  // inline below — that is the cost guard and must fire before any work. But
  // the increment runs only once the model call is actually about to happen:
  // charging first meant a Supabase hiccup burned one of five daily calls for
  // a request that never reached Claude.
  let chargeCall = null;
  if (supabaseUrl && secretKey) {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Sign in required' });

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: authErr } = await admin.auth.getUser(token);
    const uid = userData?.user?.id;
    if (authErr || !uid) return res.status(401).json({ error: 'Sign in required' });

    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await admin
      .from('coach_usage').select('calls')
      .eq('user_id', uid).eq('day', today).maybeSingle();
    const calls = usage?.calls ?? 0;
    if (calls >= DAILY_LIMIT) {
      return res.status(429).json({ error: 'Daily coach limit reached' });
    }
    chargeCall = () => admin.from('coach_usage').upsert(
      { user_id: uid, day: today, calls: calls + 1 },
      { onConflict: 'user_id,day' }
    );

    // The window is built HERE, from the append-only log, not sent by the
    // client — so it cannot be inflated or fabricated. Two windows' worth:
    // the trailing one the read speaks about, plus the one before it for the
    // accuracy comparison. Ordered newest first, which is what aggregate()
    // expects.
    //
    // `.eq('user_id', uid)` is the tenant scope — the single line standing
    // between one player's read and another player's hands. Pinned by
    // check-invariants rule 30; do not remove it.
    const { COACH_WINDOW } = await loadModules();
    const { data: rows, error: sessErr } = await admin
      .from('sessions')
      .select('id, hands, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(COACH_WINDOW * 2);
    // A failed query is NOT an empty log. Collapsing the two would answer a
    // transient DB outage with the 400 below, which triages as a client bug
    // and hides the outage.
    if (sessErr) {
      return res.status(500).json({ error: 'Could not load session history' });
    }
    sessions = rows ?? [];

    // `.is('coach_read', null)` so a retry or race can never overwrite a read
    // that already landed; `.eq('id', ...)` so exactly the triggering row is
    // stamped; `.eq('user_id', uid)` is the same tenant scope as the window
    // query (rule 33 pins all three).
    const newestId = sessions[0]?.id;
    if (newestId) {
      stampRead = (text) => admin
        .from('sessions')
        .update({ coach_read: text })
        .eq('user_id', uid)
        .eq('id', newestId)
        .is('coach_read', null);
    }
  }

  // Unreachable through the product: the client only asks for a read on a
  // cadence that requires sessionsCompleted >= 6, so a signed-in user with an
  // empty log can never be due. Without Supabase credentials there is no
  // serverless function at all (local preview is a static file server), so that
  // branch is moot rather than a user-facing error. This is a guard against a
  // state the cadence cannot produce, not a live path.
  if (sessions.length === 0) {
    return res.status(400).json({ error: 'No sessions to read' });
  }

  try {
    // Inside the try: a dynamic-import or aggregate failure is a structured
    // 500 on the same path as an upstream failure, not a bare platform crash.
    const summary = await aggregateForUser(sessions);
    // Charged here and nowhere earlier — the model call is the very next line.
    if (chargeCall) await chargeCall();
    const raw = await callClaude(summary, apiKey);
    // The wire format is always { text: string } (claude.js, the persist flow,
    // and both DB columns are untouched by the JSON restructure). On success we
    // re-serialize the parsed object so the string on the wire and in the DB is
    // always canonical JSON; on any parse/validation failure we pass the model's
    // raw text through so the client renders it as prose (graceful degradation).
    const text = normalizeCoachRead(raw);
    // Stamp failure is logged, never fatal: the model call is already paid for
    // and the player is waiting. The cost of a lost stamp is bounded — the
    // rebuilt counter keeps climbing, so the next session fetches again.
    if (stampRead && text.trim()) {
      const { error: stampErr } = await stampRead(text);
      if (stampErr) console.error('coach_read stamp failed', stampErr);
    }
    return res.status(200).json({ text });
  } catch (err) {
    if (err?.upstream) return res.status(502).json({ error: 'Upstream API error' });
    return res.status(500).json({ error: 'Upstream API call failed' });
  }
};

// Validate the model's structured output and re-serialize it. Returns canonical
// JSON when the three fields are present and well-typed, else the raw text
// unchanged (the client's parseCoachRead falls back to prose rendering).
function normalizeCoachRead(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return raw;
  try {
    const p = JSON.parse(raw);
    const ok = p && typeof p === 'object'
      && typeof p.headline === 'string'
      && Array.isArray(p.evidence)
      && typeof p.watchFor === 'string';
    if (!ok) return raw;
    return JSON.stringify({ headline: p.headline, evidence: p.evidence, watchFor: p.watchFor });
  } catch {
    return raw;
  }
}

const clamp = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');

// Structured-output schema for the Coach's Read. The structured-outputs feature
// requires additionalProperties:false and does NOT support length/count
// constraints (maxLength, minItems/maxItems) — every word/count limit is
// enforced in the prompt text instead. Supported on claude-sonnet-5.
const COACH_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    evidence: { type: 'array', items: { type: 'string' } },
    watchFor: { type: 'string' },
  },
  required: ['headline', 'evidence', 'watchFor'],
  additionalProperties: false,
};

// The single agreed rule about where a confident-error pattern goes (live eval
// finding 3, July 29 2026):
//
//   When the window contains ANY confident errors, the headline must be about
//   that confident-error pattern. The evidence alone is not enough.
//
// It drifted three ways at once. This prompt had softened to "they belong in the
// headline OR the evidence", while checkRead in the eval harness and the
// confident-misser persona's `expect` both still demanded the headline — so two
// live runs that put the pattern in the evidence obeyed the prompt and were
// marked wrong. Resolved toward the ORIGINAL pre-Phase-B intent ("the headline
// MUST be about that confident-error pattern"), because confident errors are the
// F2 diagnosis moat and the highest-leverage coaching moment the product has;
// burying them under the headline is the weaker read.
//
// EXPORTED and interpolated into the prompt rather than restated, so the prompt,
// the harness check and the persona expectation are the same string in memory.
// A softening edit now has to happen HERE, once, in the open — the three-way
// disagreement that caused this cannot re-form from a partial edit.
const HEADLINE_RULE = 'headline must be about that confident-error pattern';

// Tier 2 of the headline precedence (prompt v2, July 29 2026): when the window
// has NO confident errors but DOES show measured improvement over the previous
// stretch, the improvement IS the encouragement — the only kind honest labeling
// permits, because it is copied from the data rather than manufactured. Tier 1
// (HEADLINE_RULE) always wins; this fires only in its absence. Exported and
// imported by scripts/eval-coach.mjs for the same single-sourcing reason as
// HEADLINE_RULE.
const TRAJECTORY_RULE = 'open the headline with that improvement, copying both correct-counts as written above, then name the clearest remaining pattern in the same sentence';

// The three length bounds, ONE source (live eval finding 4, July 29 2026).
// COACH_SCHEMA cannot carry them — structured outputs support no maxLength or
// maxItems — so the prompt text is the only place they can be stated, and the
// eval harness is the only place they can be measured. Written here once and
// interpolated below, then IMPORTED by scripts/eval-coach.mjs, so "the check and
// the prompt disagree" is not a state this file can be edited into. The prior
// arrangement restated them in both files, and they had already drifted once
// (harness allowing 1-3 items at <= 15 words against a prompt asking 1-2 at
// <= 12) — which prints a clean report on nine systematically over-long reads.
//
// evidence 24 and watchFor 20 were re-tuned on July 29 2026 as part of prompt
// v2 (docs/superpowers/specs/2026-07-29-coach-read-prompt-v2-design.md) — the
// moment ROADMAP path 1 promised ("re-tune when the prompt is next touched so
// one live run validates both"). Measured basis, not vibes: evidence items at
// 21w and 22w, and four watchFors at exactly 19w, across the July 29 live
// runs. PRE-REGISTERED before the validating run — a cap is never moved to
// green a failing run, and the pending live run can still fail on substance.
const WORD_CAPS = { headline: 12, evidence: 24, watchFor: 20, evidenceItems: [1, 2] };

// Exported for scripts/eval-coach.mjs — the eval harness must exercise the
// REAL prompt and the REAL request params, never a copy that can drift. This
// file remains the ONLY code that talks to the Anthropic API.
function buildPrompt(s) {
  const pct = (c, t) => (t > 0 ? Math.round((c / t) * 100) : 0);
  const skillLines = s.skills
    .map(k => `- ${clamp(k.skill, 20)}: ${k.correct} of ${k.attempts}`)
    .join('\n');
  // `spot` (seat + hole cards + street) is what makes two lines tell two hands
  // apart — see describeSpot. The old `(potodds)` suffix is gone: `scenario` is
  // the tag, the tag IS the skill in prose, and the same fact twice in two
  // vocabularies is noise in a prompt that pays for every token.
  // An id the lookup cannot resolve yields an empty spot rather than a second
  // "Unknown" — one unknown per line is a gap, three is noise.
  //
  // GROUPED BY OPPONENT, with the per-opponent count already computed
  // (coachWindow.js groupByVillain, July 29 2026). The villain moves out of the
  // per-spot line and into the group header, so the model reads "Tight Nit: 2"
  // instead of counting two lines that happen to end in the same name — the
  // fabricated-statistic defect two live runs reproduced. The spot detail is
  // unchanged and still disambiguates within the group.
  // `m.scenario` is the tag, and the tag IS the skill in prose. coachWindow.js
  // leaves it EMPTY on any citation whose skill has not cleared
  // MIN_RATED_ATTEMPTS, so the line degrades to the spot alone (still 172/172
  // distinct — see describeSpot) rather than handing the model a skill name the
  // ledger greys out. The `|| 'unspecified spot'` covers the degenerate case
  // where the id resolves to nothing at all and the tag is withheld too: an
  // empty bullet is worse than an honest one.
  const cite = (m) =>
    [clamp(m.scenario, 40), clamp(m.spot, 30)].filter(Boolean).join(', ') || 'unspecified spot';
  const grouped = (groups, noun, line) => (groups ?? [])
    .map(g => `- ${clamp(g.villain, 30)}: ${g.count} ${noun}${g.count === 1 ? '' : 's'}\n`
      + g.spots.map(sp => `    - ${line(sp)}`).join('\n'))
    .join('\n');
  const confident = grouped(s.confidentByVillain, 'confident error', cite);
  const repeats = grouped(s.repeatsByVillain, 'repeated spot',
    (r) => `${cite(r)}: missed ${r.misses} times`);
  // Only when it happened. A freeze is not a bad choice, and it carries no
  // direction (schema.js refuses to classify one), so without this line a player
  // who is timing out reads to the model as making patternless mistakes.
  const timeouts = s.timeouts
    ? `They ran out of the clock without acting at all on ${s.timeouts} of these hands. That is freezing on the decision, not choosing badly, and it carries no direction, so treat it as its own pattern rather than folding it into the passive or aggressive story.\n\n`
    : '';

  return `You are a poker coach reviewing a student's last ${s.sessions} sessions (${s.hands} hands) and writing up what you have been seeing lately. This is a trend review, not a verdict on who they are: name what has been happening over this stretch, and stay in the present tense of "lately".

Overall: ${s.accuracy.correct} of ${s.accuracy.total} correct (${pct(s.accuracy.correct, s.accuracy.total)}%)${
  s.previous ? `, against ${s.previous.correct} of ${s.previous.total} (${pct(s.previous.correct, s.previous.total)}%) over the stretch before this one` : ''
}.

Per skill over this stretch:
${skillLines || '- (no skill has enough attempts to report)'}

Direction of their mistakes: too passive (${s.direction.under}), too aggressive (${s.direction.over}), too loose (${s.direction.loose}), over ${s.direction.evidence} weighted misses.

${timeouts}${confident ? `Confident errors (answered fast and got it wrong, so they do not know these are leaks), already counted for you by opponent:\n${confident}` : 'No confident errors this stretch.'}

${repeats ? `Spots they have missed more than once in this stretch, already counted for you by opponent:\n${repeats}` : 'No spot was missed more than once.'}

Respond with three fields named "headline", "evidence" and "watchFor":
- headline: ONE sentence, ${WORD_CAPS.headline} words or fewer, naming the clearest pattern across these ${s.sessions} sessions as something they have been DOING lately ("Bluffs keep firing into players who never fold"), never as an identity ("You are a maniac"). Start with the observation, not with "you". If confident errors are listed above, the ${HEADLINE_RULE}. If there are NO confident errors listed and the stretch-before comparison is given and this stretch improved on it, ${TRAJECTORY_RULE}. Otherwise name the clearest pattern as above.
- evidence: ${WORD_CAPS.evidenceItems[0]} to ${WORD_CAPS.evidenceItems[1]} short items, each ${WORD_CAPS.evidence} words or fewer, each citing a NUMBER or a repeated spot from the data above ("Bluffing: 3 of 11 across these sessions, twice into a station"). These must be things the player cannot compute for themselves, never a restatement of a single hand's result.
- watchFor: ONE sentence, ${WORD_CAPS.watchFor} words or fewer, phrased as a trigger-action plan for their next session: name the situation cue, then the action ("Next time a raise crosses your mind, make it"). Cite one number from above only if it sharpens the instruction, copied as written. Count the words before you answer; ${WORD_CAPS.watchFor} is a hard limit, not a target.

Rules for all three fields:
- Scope every claim to this STRETCH ("lately", "over these sessions", "recently") and to observed behaviour. Never pronounce on their identity, their habits as a whole, or their game: no "you are a...", no "you always..." or "you never...", no "your game is...". A habitual claim ("you always fold the river") is an identity verdict wearing different words, so say "kept folding the river over these sessions" instead. Naming the player's type is a different surface's job, not yours
- The direction of the mistakes is the read: folding or flat-calling when raising was best is a different tendency from raising when caution was best. Name the tendency the numbers actually show
- Confident errors are the highest-leverage thing here, because they do not know those are leaks. If any are listed above, the ${HEADLINE_RULE} — putting it in the evidence instead is not enough
- Use only the numbers and spots given above. Never invent a hand, a holding, an opponent or a statistic
- COUNTS ARE GIVEN, NEVER DERIVED. Every number you write must be copied from a number written above. Do not count the listed lines yourself, do not add two counts together, and do not describe a group as "two vs X" unless the line above literally says X: 2. The per-opponent tallies are already done for you
- If the mistakes point in different directions, say so honestly instead of forcing one story
- These are exploitative judgement spots, not solver outputs: say "the recommended play", never "the solve" or GTO language
- Sound like a human coach, not an AI
- No em dashes, no "not only... but also" constructions
- No generic praise or filler
- If they are genuinely playing well across this stretch, say so in the headline and name one thing to keep watching in watchFor`;
}

async function callClaude(summary, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      // Raised 300 → 500 for the structured (JSON) output: three fields plus
      // JSON syntax overhead need headroom, and a truncated response is
      // unparseable rather than merely short (truncation was a real eval defect).
      max_tokens: 500,
      // Sonnet 5 runs adaptive thinking by default when `thinking` is
      // omitted, and thinking tokens count against max_tokens — which can
      // eat the whole budget and return truncated or empty text.
      thinking: { type: 'disabled' },
      // Structured output: constrain the response to the three-field schema.
      output_config: { format: { type: 'json_schema', schema: COACH_SCHEMA } },
      messages: [{ role: 'user', content: buildPrompt(summary) }],
    }),
  });
  if (!response.ok) {
    const err = new Error(`Upstream API error (${response.status})`);
    err.upstream = true;
    throw err;
  }
  const data = await response.json();
  return data.content?.find(b => b.type === 'text')?.text || '';
}

// These MUST stay below the `module.exports = handler` assignment above — that
// reassignment replaces the exports object wholesale, so any property attached
// earlier in the file is silently discarded.
module.exports.buildPrompt = buildPrompt;
module.exports.callClaude = callClaude;
module.exports.aggregateForUser = aggregateForUser;
module.exports.buildLookup = buildLookup;
// The prompt's own contract, exported so the eval harness MEASURES the numbers
// the prompt ASKS for — never a second copy of them (findings 3 and 4).
module.exports.HEADLINE_RULE = HEADLINE_RULE;
module.exports.TRAJECTORY_RULE = TRAJECTORY_RULE;
module.exports.WORD_CAPS = WORD_CAPS;
