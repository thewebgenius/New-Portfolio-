import React, { useEffect, useMemo, useRef, useState } from 'react';
import { prefersReducedMotion } from '../hooks/useTheme';
import { config } from '../config';
import SectionHead from './SectionHead';

// Live fallback when public/stats.json has not been generated yet. Uses the unauthenticated
// GitHub API (60 requests/hour per visitor IP) — 3 requests per page view.
async function fetchLive(user) {
  const get = async (p) => {
    const r = await fetch(`https://api.github.com${p}`);
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  };
  const [u, reposAll, events] = await Promise.all([
    get(`/users/${user}`),
    get(`/users/${user}/repos?per_page=100&sort=pushed`),
    get(`/users/${user}/events/public?per_page=100`).catch(() => []),
  ]);
  const repos = reposAll.filter((r) => !r.fork);
  const byLang = {};
  repos.forEach((r) => { if (r.language) byLang[r.language] = (byLang[r.language] || 0) + 1; });
  const total = Object.values(byLang).reduce((a, b) => a + b, 0) || 1;
  const counts = {};
  events.forEach((e) => {
    if (e.type !== 'PushEvent') return;
    const d = e.created_at.slice(0, 10);
    counts[d] = (counts[d] || 0) + (e.payload?.size || 1);
  });
  const days = [];
  for (let i = 181; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    days.push({ date: d, count: counts[d] || 0 });
  }
  return {
    generatedAt: new Date().toISOString(),
    live: true,
    publicRepos: u.public_repos,
    followers: u.followers,
    totalStars: repos.reduce((a, r) => a + r.stargazers_count, 0),
    languages: Object.entries(byLang).sort((a, b) => b[1] - a[1])
      .map(([name, n]) => ({ name, pct: +(100 * n / total).toFixed(1), repos: n })),
    calendar: { source: 'events', total: Object.values(counts).reduce((a, b) => a + b, 0), days },
    latestRepos: repos.slice(0, 5).map((r) => ({
      name: r.name, description: r.description, url: r.html_url, language: r.language,
      stars: r.stargazers_count, updatedAt: r.pushed_at,
    })),
    huggingFace: null,
  };
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const ago = (iso) => {
  const days = Math.floor((Date.now() - new Date(iso)) / 864e5);
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 45) return `${days} days ago`;
  return fmtDate(iso);
};

function useWeeks(calendar) {
  return useMemo(() => {
    const days = calendar.days.slice(-26 * 7);
    // pad the start so columns are full weeks starting on Sunday
    const first = new Date(days[0].date);
    const pad = Array.from({ length: first.getUTCDay() }, () => null);
    const cells = [...pad, ...days];
    const w = [];
    for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i + 7));
    return { weeks: w, max: Math.max(1, ...days.map((d) => d.count)) };
  }, [calendar]);
}

// Isometric "skyline": one prism per day, height = activity that day.
function Heatmap3D({ weeks, max, level, onHover }) {
  const [grow, setGrow] = useState(prefersReducedMotion() ? 1 : 0);
  const ref = useRef(null);
  useEffect(() => {
    if (grow === 1) return undefined;
    let raf = 0; let start = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const tick = (t) => {
        if (!start) start = t;
        const p = Math.min(1, (t - start) / 1100);
        setGrow(1 - (1 - p) ** 3);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.3 });
    if (ref.current) io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tw = 22; const th = 11; const maxH = 64;
  const cols = weeks.length; const rows = 7;
  const W = (cols + rows) * (tw / 2) + 8;
  const H = (cols + rows) * (th / 2) + maxH + 12;
  const ox = rows * (tw / 2) + 4; const oy = maxH + 6;
  const cells = [];
  weeks.forEach((wk, c) => wk.forEach((d, r) => { if (d) cells.push({ d, c, r }); }));
  cells.sort((a, b) => (a.c + a.r) - (b.c + b.r) || a.c - b.c);

  return (
    <svg ref={ref} className="hm3d" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Activity over the last 26 weeks as 3D bars; taller bars mean more activity that day">
      {cells.map(({ d, c, r }) => {
        const lv = level(d.count);
        const hgt = (lv === 0 ? 1.5 : 4 + (d.count / max) * (maxH - 4)) * grow;
        const x = ox + (c - r) * (tw / 2); const y = oy + (c + r) * (th / 2);
        const top = `${x},${y - hgt} ${x + tw / 2},${y + th / 2 - hgt} ${x},${y + th - hgt} ${x - tw / 2},${y + th / 2 - hgt}`;
        const left = `${x - tw / 2},${y + th / 2 - hgt} ${x},${y + th - hgt} ${x},${y + th} ${x - tw / 2},${y + th / 2}`;
        const right = `${x + tw / 2},${y + th / 2 - hgt} ${x},${y + th - hgt} ${x},${y + th} ${x + tw / 2},${y + th / 2}`;
        return (
          <g key={d.date} className={`hm3d-bar l${lv}`} onMouseEnter={() => onHover(d)} onMouseLeave={() => onHover(null)}>
            <polygon points={left} className="f-left" />
            <polygon points={right} className="f-right" />
            <polygon points={top} className="f-top" />
          </g>
        );
      })}
    </svg>
  );
}

function Heatmap({ calendar }) {
  const [hover, setHover] = useState(null);
  const [view, setView] = useState('3d');
  const { weeks, max } = useWeeks(calendar);
  const level = (c) => (c === 0 ? 0 : Math.min(4, Math.ceil((c / max) * 4)));

  return (
    <div className="heatmap-wrap">
      <div className="hm-toggle" role="group" aria-label="Heatmap style">
        <button type="button" className={view === '3d' ? 'on' : ''} aria-pressed={view === '3d'} onClick={() => setView('3d')}>3D</button>
        <button type="button" className={view === 'flat' ? 'on' : ''} aria-pressed={view === 'flat'} onClick={() => setView('flat')}>Flat</button>
      </div>
      {view === '3d' ? (
        <Heatmap3D weeks={weeks} max={max} level={level} onHover={setHover} />
      ) : (
        <div className="heatmap" role="img" aria-label={`Contribution activity over the last 26 weeks: ${calendar.total} in total`}>
          {weeks.map((wk, wi) => (
            <div key={wi} className="hm-col">
              {Array.from({ length: 7 }).map((_, di) => {
                const d = wk[di];
                if (!d) return <span key={di} className="hm-cell hm-empty" />;
                return (
                  <span
                    key={di}
                    className={`hm-cell l${level(d.count)}`}
                    onMouseEnter={() => setHover(d)}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
      <p className="hm-readout">
        {hover
          ? `${hover.count} ${calendar.source === 'events' ? 'commit' : 'contribution'}${hover.count === 1 ? '' : 's'} on ${fmtDate(hover.date)}`
          : `${calendar.total} ${calendar.source === 'events' ? 'pushed commits in recent public activity' : 'contributions in the last year'}. Hover a day for details.`}
      </p>
    </div>
  );
}

export default function GitHubStats() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/stats.json', { cache: 'no-cache' });
        if (!r.ok) throw new Error('missing');
        const json = await r.json();
        if (!json.publicRepos && !json.latestRepos) throw new Error('empty');
        if (!cancelled) { setData(json); setStatus('ok'); }
      } catch (e) {
        try {
          const live = await fetchLive(config.githubUser);
          if (!cancelled) { setData(live); setStatus('ok'); }
        } catch (err) {
          if (!cancelled) setStatus('error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const profileUrl = `https://github.com/${config.githubUser}`;

  return (
    <section id="github" className="section">
      <div className="container">
        <SectionHead title="Code on GitHub">
          Pulled from the public GitHub API, refreshed daily.
        </SectionHead>

        {status === 'error' ? (
          <div className="gh-fallback">
            <p>GitHub stats could not be loaded right now. The repositories are all public on{' '}
              <a href={profileUrl} target="_blank" rel="noreferrer">github.com/{config.githubUser}</a>.</p>
          </div>
        ) : (
          <div className={`gh-grid ${status === 'loading' ? 'is-loading' : ''}`} aria-busy={status === 'loading'}>
            <dl className="gh-numbers">
              <div><dt>Public repositories</dt><dd>{data ? data.publicRepos : <span className="sk sk-num" />}</dd></div>
              <div><dt>Stars</dt><dd>{data ? data.totalStars : <span className="sk sk-num" />}</dd></div>
              <div><dt>Followers</dt><dd>{data ? data.followers : <span className="sk sk-num" />}</dd></div>
              {data?.huggingFace ? (
                <div><dt>Hugging Face models / datasets</dt><dd>{data.huggingFace.models ?? 0} / {data.huggingFace.datasets ?? 0}</dd></div>
              ) : null}
            </dl>

            <div className="gh-langs">
              <h3 className="sub-title">Languages</h3>
              {data ? (
                data.languages.length ? (
                  <ul className="lang-bars">
                    {data.languages.slice(0, 6).map((l) => (
                      <li key={l.name}>
                        <span className="lang-name">{l.name}</span>
                        <span className="lang-track" title={`${l.name}: ${l.pct}%`}><span style={{ width: `${l.pct}%` }} /></span>
                        <span className="lang-pct">{l.pct}%</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="muted">No language data yet.</p>
              ) : <div className="sk sk-block" style={{ height: 168 }} />}
              <p className="fine">{data?.live || data?.languages?.[0]?.repos ? 'Share of repositories by main language.' : 'Share of code by bytes, across all public repositories.'}</p>
            </div>

            <div className="gh-activity">
              <h3 className="sub-title">Activity</h3>
              {data?.calendar ? <Heatmap calendar={data.calendar} /> : <div className="sk sk-block" style={{ height: 120 }} />}
            </div>

            <div className="gh-repos">
              <h3 className="sub-title">Recently updated</h3>
              <ul className="repo-list">
                {data
                  ? data.latestRepos.map((r) => (
                    <li key={r.name}>
                      <a href={r.url} target="_blank" rel="noreferrer" className="repo-name">{r.name}</a>
                      <p className="repo-desc">{r.description || 'No description.'}</p>
                      <p className="repo-meta">
                        {r.language ? <span>{r.language}</span> : null}
                        {r.stars ? <span>★ {r.stars}</span> : null}
                        <span>updated {ago(r.updatedAt)}</span>
                      </p>
                    </li>
                  ))
                  : Array.from({ length: 5 }).map((_, i) => <li key={i}><div className="sk sk-block" style={{ height: 64 }} /></li>)}
              </ul>
            </div>

            <p className="gh-stamp">
              {data ? <>Last updated {fmtDate(data.generatedAt)}{data.live ? ' (live from the GitHub API)' : ''}. </> : null}
              <a href={profileUrl} target="_blank" rel="noreferrer">See all repositories on GitHub</a>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
