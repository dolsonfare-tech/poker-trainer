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
// Seat + hole cards + street is what the pre-window prompt used for exactly
// this, and it costs ~16 characters. Measured over the current library: the
// spot alone is 167/172 distinct, and the rendered `tag, spot vs villain` line
// is 172/172 — every scenario cites unambiguously.
//
// Suit symbols, never shorthand (KQs/98d) — CLAUDE.md, and it is what the
// player saw on the felt.
const STREET_BY_BOARD = { 0: 'preflop', 3: 'flop', 4: 'turn', 5: 'river' };
function describeSpot(s) {
  const seat = (s.positions ?? []).find(p => p.state === 'hero')?.label?.split(' ')[0];
  const hole = (s.hand ?? []).map(c => `${c.r}${c.s}`).join('');
  return [seat, hole, STREET_BY_BOARD[(s.board ?? []).length]].filter(Boolean).join(' ');
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
      .select('hands, created_at')
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
    return res.status(200).json({ text: normalizeCoachRead(raw) });
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
  const cite = (m) => `${[clamp(m.scenario, 40), clamp(m.spot, 30)].filter(Boolean).join(', ')}`
    + ` vs ${clamp(m.villain, 30)}`;
  const confident = s.confidentMisses.map(m => `- ${cite(m)}`).join('\n');
  const repeats = s.repeats.map(r => `- ${cite(r)}: missed ${r.misses} times`).join('\n');
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

${timeouts}${confident ? `Confident errors (answered fast and got it wrong, so they do not know these are leaks):\n${confident}` : 'No confident errors this stretch.'}

${repeats ? `Spots they have missed more than once in this stretch:\n${repeats}` : 'No spot was missed more than once.'}

Respond with three fields named "headline", "evidence" and "watchFor":
- headline: ONE sentence, 12 words or fewer, naming the clearest pattern across these ${s.sessions} sessions as something they have been DOING lately ("Bluffs keep firing into players who never fold"), never as an identity ("You are a maniac"). Start with the observation, not with "you".
- evidence: 1 to 2 short items, each 20 words or fewer, each citing a NUMBER or a repeated spot from the data above ("Bluffing: 3 of 11 across these sessions, twice into a station"). These must be things the player cannot compute for themselves, never a restatement of a single hand's result.
- watchFor: ONE sentence, 18 words or fewer, concrete and actionable for their next session.

Rules for all three fields:
- Scope every claim to this STRETCH ("lately", "over these sessions", "recently") and to observed behaviour. Never pronounce on their identity, their habits as a whole, or their game: no "you are a...", no "you always..." or "you never...", no "your game is...". A habitual claim ("you always fold the river") is an identity verdict wearing different words, so say "kept folding the river over these sessions" instead. Naming the player's type is a different surface's job, not yours
- The direction of the mistakes is the read: folding or flat-calling when raising was best is a different tendency from raising when caution was best. Name the tendency the numbers actually show
- Confident errors are the highest-leverage thing here, because they do not know those are leaks. If there are any, they belong in the headline or the evidence
- Use only the numbers and spots given above. Never invent a hand, a holding, an opponent or a statistic
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
