// Small fuzzy matcher: every query character must appear in order; contiguous runs and
// word-start matches score higher. Returns -1 for no match.
export function fuzzyScore(query, text) {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return 0;
  if (t.includes(q)) return 1000 - t.indexOf(q);
  let score = 0; let ti = 0; let run = 0;
  for (let qi = 0; qi < q.length; qi += 1) {
    const ch = q[qi];
    if (ch === ' ') continue;
    const found = t.indexOf(ch, ti);
    if (found === -1) return -1;
    run = found === ti ? run + 1 : 0;
    score += 10 + run * 5 + (found === 0 || t[found - 1] === ' ' ? 8 : 0) - Math.min(found - ti, 10);
    ti = found + 1;
  }
  return score;
}
