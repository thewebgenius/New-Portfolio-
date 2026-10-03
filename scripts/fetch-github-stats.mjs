// Writes public/stats.json with GitHub (and optional Hugging Face) stats.
// Run locally:   GITHUB_TOKEN=xxx node scripts/fetch-github-stats.mjs
// In CI it runs from .github/workflows/github-stats.yml once a day.
import { writeFile, mkdir } from 'node:fs/promises';

const USER = process.env.GH_USER || 'thewebgenius';
const HF_USER = process.env.HF_USER || '';
const TOKEN = process.env.GITHUB_TOKEN || '';
const headers = { 'User-Agent': 'portfolio-stats', Accept: 'application/vnd.github+json' };
if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

async function contributionCalendar() {
  if (!TOKEN) return null;
  const query = `query($login:String!){ user(login:$login){ contributionsCollection{ contributionCalendar{
    totalContributions weeks{ contributionDays{ date contributionCount } } } } } }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const cal = json?.data?.user?.contributionsCollection?.contributionCalendar;
  if (!cal) return null;
  return {
    source: 'contributions',
    total: cal.totalContributions,
    days: cal.weeks.flatMap((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount }))),
  };
}

async function eventsCalendar() {
  const events = await gh(`/users/${USER}/events/public?per_page=100`).catch(() => []);
  const counts = {};
  events.forEach((e) => {
    if (e.type !== 'PushEvent') return;
    const day = e.created_at.slice(0, 10);
    counts[day] = (counts[day] || 0) + (e.payload?.size || 1);
  });
  const days = [];
  for (let i = 181; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    days.push({ date: d, count: counts[d] || 0 });
  }
  return { source: 'events', total: Object.values(counts).reduce((a, b) => a + b, 0), days };
}

async function huggingFace() {
  if (!HF_USER) return null;
  const get = async (kind) => {
    const r = await fetch(`https://huggingface.co/api/${kind}?author=${HF_USER}&limit=1000`);
    return r.ok ? (await r.json()).length : null;
  };
  return { user: HF_USER, models: await get('models'), datasets: await get('datasets'), spaces: await get('spaces') };
}

const user = await gh(`/users/${USER}`);
const repos = (await gh(`/users/${USER}/repos?per_page=100&sort=pushed`)).filter((r) => !r.fork);

const langBytes = {};
for (const r of repos) {
  const langs = await gh(`/repos/${USER}/${r.name}/languages`).catch(() => ({}));
  for (const [k, v] of Object.entries(langs)) langBytes[k] = (langBytes[k] || 0) + v;
}
const totalBytes = Object.values(langBytes).reduce((a, b) => a + b, 0) || 1;
const languages = Object.entries(langBytes)
  .sort((a, b) => b[1] - a[1])
  .map(([name, bytes]) => ({ name, bytes, pct: +(100 * bytes / totalBytes).toFixed(1) }));

const stats = {
  generatedAt: new Date().toISOString(),
  user: USER,
  publicRepos: user.public_repos,
  followers: user.followers,
  totalStars: repos.reduce((a, r) => a + r.stargazers_count, 0),
  languages,
  calendar: (await contributionCalendar()) || (await eventsCalendar()),
  latestRepos: repos.slice(0, 5).map((r) => ({
    name: r.name, description: r.description, url: r.html_url, language: r.language,
    stars: r.stargazers_count, updatedAt: r.pushed_at,
  })),
  huggingFace: await huggingFace(),
};

await mkdir('public', { recursive: true });
await writeFile('public/stats.json', JSON.stringify(stats, null, 2));
console.log(`stats.json written: ${repos.length} repos, ${languages.length} languages`);
