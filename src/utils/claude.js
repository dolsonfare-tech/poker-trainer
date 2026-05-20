const CLAUDE_API_KEY = process.env.REACT_APP_CLAUDE_API_KEY;

export async function fetchCoachRead(shuffledScenarios, skillResults, lastIndex) {
  const decisionsPlayed = shuffledScenarios.slice(0, lastIndex + 1).map(s => ({
    scenario: s.tag,
    villain: s.villain.label,
    villainNotes: s.villain.notes,
    tableContext: s.tableContext || null,
    skill: s.skill,
    result: skillResults[s.skill] || 'unknown',
  }));

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are a poker coach reviewing a student's session results. Look for a pattern across their mistakes and name the underlying mental model causing them.

Session decisions:
${decisionsPlayed.map(d =>
  `- ${d.scenario} vs ${d.villain} (${d.villainNotes})${d.tableContext ? ` | Table: ${d.tableContext}` : ''}: ${d.result}`
).join('\n')}

Write 2-3 sentences identifying the pattern. Rules:
- Sound like a human coach, not an AI
- No em dashes, no "not only... but also" constructions
- No generic praise or filler
- Be direct and specific about what you observe
- Reference the villain types they struggled against, not just the abstract skill
- If they got everything right, acknowledge it briefly and name one area to keep watching
- Start with the observation, not with "you"`,
      }],
    }),
  });

  const data = await res.json();
  return data.content?.find(b => b.type === 'text')?.text || '';
}