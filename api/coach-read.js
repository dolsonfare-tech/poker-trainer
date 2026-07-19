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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { decisionsPlayed } = req.body;
  const MAX_DECISIONS = 10; // sessions are 5 scenarios; anything larger is abuse
  if (!Array.isArray(decisionsPlayed) || decisionsPlayed.length === 0 || decisionsPlayed.length > MAX_DECISIONS) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // ── Auth + per-user daily cap ─────────────────────────────────────────
  // Enforced whenever the server has Supabase credentials (always in prod).
  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
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
    await admin.from('coach_usage').upsert(
      { user_id: uid, day: today, calls: calls + 1 },
      { onConflict: 'user_id,day' }
    );
  }

  try {
    const raw = await callClaude(decisionsPlayed, apiKey);
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
  return `You are a poker coach reviewing a student's session results. Look for a pattern across their mistakes and name the underlying mental model causing them.

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
- headline: ONE sentence, 12 words or fewer, naming the underlying pattern or mental model plainly. Start with the observation, not with "you". If misses marked "answered fast (looked sure)" cluster, the headline MUST be about that confident-error pattern.
- evidence: 2 to 3 short items (1 is fine for a clean session), each 20 words or fewer, each tied to a SPECIFIC hand and villain from the data above ("Fired a bluff into the calling station on Q94r; bluffs need a folder").
- watchFor: ONE sentence, 18 words or fewer, concrete and actionable for the next session ("When a passive player raises the river, believe him").

Rules for all three fields:
- The direction of the mistakes is the diagnosis: folding or flat-calling when raising was best is a different leak than raising when caution was best. A timeout means they froze on the decision. Name the tendency you actually see, not a generic weakness
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

module.exports.buildPrompt = buildPrompt;
module.exports.callClaude = callClaude;
