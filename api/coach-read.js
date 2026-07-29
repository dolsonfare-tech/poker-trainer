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
let _mods = null;
async function loadModules() {
  if (!_mods) {
    const [win, scen] = await Promise.all([
      import('../src/utils/coachWindow.js'),
      import('../src/data/scenarios.js'),
    ]);
    const byId = new Map((scen.default ?? []).map(s => [s.id, s]));
    _mods = {
      aggregate: win.aggregate,
      COACH_WINDOW: win.COACH_WINDOW,
      lookup: (id) => {
        const s = byId.get(id);
        return s ? { tag: s.tag, skill: s.skill, villain: s.villain?.label } : null;
      },
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
function buildPrompt(decisionsPlayed) {
  return `You are a poker coach jotting field notes right after watching a student play a short 5-hand session. This is an observation log entry, not a diagnosis: five hands is a small sample, and your student knows it. Your read should sound like "here's what I noticed today", never a verdict on who they are as a player. Find the clearest pattern in this session's mistakes and describe the thinking that seems to be behind it.

Session decisions (what they chose vs the best play):
${decisionsPlayed.map(d => {
  const table = clamp(d.tableContext);
  const spot = [clamp(d.position, 30), clamp(d.hand, 20)].filter(Boolean).join(' with ');
  const line = [
    `${clamp(d.scenario)}${spot ? ` | ${spot}` : ''} vs ${clamp(d.villain)} (${clamp(d.villainNotes)})`,
    table ? `Table: ${table}` : '',
    `chose ${clamp(d.chose, 40) || 'unknown'}, best was ${clamp(d.correctAction, 40) || 'unknown'}`,
    clamp(d.result, 20),
    d.confidentMiss ? 'answered fast (looked sure)' : '',
  ].filter(Boolean).join(' | ');
  return `- ${line}`;
}).join('\n')}

Respond with three fields — "headline", "evidence", "watchFor":
- headline: ONE sentence, 12 words or fewer, naming the clearest pattern you saw THIS session as an observation ("Three profitable raises went unmade today"), not a verdict ("You're too passive a player"). Start with the observation, not with "you". If misses marked "answered fast (looked sure)" cluster, the headline MUST be about that confident-error pattern.
- evidence: 2 to 3 short items (1 is fine for a clean session), each 20 words or fewer, each tied to a SPECIFIC hand and villain from the data above ("Fired a bluff into the calling station on Q94r; bluffs need a folder").
- watchFor: ONE sentence, 18 words or fewer, concrete and actionable for the next session ("When a passive player raises the river, believe him").

Rules for all three fields:
- Scope every claim to this session ("today", "this session", "these hands") and to observed behavior. Never pronounce on their overall game or identity: no "you are a...", "you always...", "your game...". The trend across sessions is the notebook's job; yours is one session's field notes
- The direction of the mistakes is the read: folding or flat-calling when raising was best is a different tendency than raising when caution was best. A timeout means they froze on the decision. Name the tendency you actually see, not a generic weakness
- A miss marked "answered fast (looked sure)" is a confident error — they don't know it's a leak. If those cluster, the headline leads with it
- Mention only hands and actions listed above — never invent holdings, outcomes, or spots that aren't in the data
- If the misses point in different directions (some too passive, some too aggressive), say so honestly instead of forcing them into one story
- These are exploitative judgment spots, not solver outputs: say "the recommended play", never "the solve" or GTO language
- Sound like a human coach, not an AI
- No em dashes, no "not only... but also" constructions
- No generic praise or filler
- Be direct and specific about what you observe
- Reference the villain types they struggled against, not just the abstract skill
- If they got everything right, acknowledge it briefly in the headline and name one area to keep watching in watchFor`;
}

async function callClaude(decisionsPlayed, apiKey) {
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
      messages: [{ role: 'user', content: buildPrompt(decisionsPlayed) }],
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
