export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { decisionsPlayed } = req.body;
  const MAX_DECISIONS = 10; // sessions are 5 scenarios; anything larger is abuse
  if (!Array.isArray(decisionsPlayed) || decisionsPlayed.length === 0 || decisionsPlayed.length > MAX_DECISIONS) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const clamp = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const prompt = `You are a poker coach reviewing a student's session results. Look for a pattern across their mistakes and name the underlying mental model causing them.

Session decisions:
${decisionsPlayed.map(d => {
  const table = clamp(d.tableContext);
  return `- ${clamp(d.scenario)} vs ${clamp(d.villain)} (${clamp(d.villainNotes)})${table ? ` | Table: ${table}` : ''}: ${clamp(d.result, 20)}`;
}).join('\n')}

Write 2-3 sentences identifying the pattern. Rules:
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
