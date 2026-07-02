export async function fetchCoachRead(shuffledScenarios, skillResults, lastIndex) {
  const decisionsPlayed = shuffledScenarios.slice(0, lastIndex + 1).map(s => ({
    scenario: s.tag,
    villain: s.villain.label,
    villainNotes: s.villain.notes,
    tableContext: s.tableContext || null,
    skill: s.skill,
    result: skillResults[s.skill] || 'unknown',
  }));

  const res = await fetch('/api/coach-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisionsPlayed }),
  });

  if (!res.ok) return '';
  const data = await res.json();
  return data.text || '';
}
