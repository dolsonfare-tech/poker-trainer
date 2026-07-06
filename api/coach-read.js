// Coach's Read — the only code that calls the Claude API.
// Locked down (July 2026): requires a signed-in Supabase user and enforces a
// per-user daily cap, so anonymous token-burning is impossible. Input caps and
// the small max_tokens bound the cost of any single call.
const { createClient } = require('@supabase/supabase-js');

const DAILY_LIMIT = 20; // coach calls per user per day (1 per session played)

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

  const clamp = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');

  const prompt = `You are a poker coach reviewing a student's session results. Look for a pattern across their mistakes and name the underlying mental model causing them.

Session decisions (what they chose vs the best play):
${decisionsPlayed.map(d => {
  const table = clamp(d.tableContext);
  const spot = [clamp(d.position, 30), clamp(d.hand, 20)].filter(Boolean).join(' with ');
  const line = [
    `${clamp(d.scenario)}${spot ? ` | ${spot}` : ''} vs ${clamp(d.villain)} (${clamp(d.villainNotes)})`,
    table ? `Table: ${table}` : '',
    `chose ${clamp(d.chose, 40) || 'unknown'}, best was ${clamp(d.correctAction, 40) || 'unknown'}`,
    clamp(d.result, 20),
  ].filter(Boolean).join(' | ');
  return `- ${line}`;
}).join('\n')}

Write 2-3 sentences identifying the pattern. Rules:
- The direction of the mistakes is the diagnosis: folding or flat-calling when raising was best is a different leak than raising when caution was best. A timeout means they froze on the decision. Name the tendency you actually see, not a generic weakness
- Sound like a human coach, not an AI
- No em dashes, no "not only... but also" constructions
- No generic praise or filler
- Be direct and specific about what you observe
- Reference the villain types they struggled against, not just the abstract skill
- If they got everything right, acknowledge it briefly and name one area to keep watching
- Start with the observation, not with "you"`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 300,
        // Sonnet 5 runs adaptive thinking by default when `thinking` is
        // omitted, and thinking tokens count against max_tokens — which can
        // eat the whole 300 budget and return truncated or empty text.
        thinking: { type: 'disabled' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'Upstream API error' });
    }

    const data = await response.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '';
    return res.status(200).json({ text });
  } catch {
    return res.status(500).json({ error: 'Upstream API call failed' });
  }
}
