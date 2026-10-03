import React, { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../hooks/useTheme';
import { projects } from '../data/portfolioData';
import SectionHead from './SectionHead';
import LabTeaser from './LabTeaser';

// Animates the first number in a cell from 0 when the table scrolls into view.
function CountUp({ text, run }) {
  const m = text.match(/^(\D*?)(\d[\d,]*\.?\d*)(.*)$/s);
  const [val, setVal] = useState(m && !prefersReducedMotion() ? 0 : null);
  useEffect(() => {
    if (!m || !run || val === null) return undefined;
    const target = parseFloat(m[2].replace(/,/g, ''));
    let raf = 0; let start = 0;
    const tick = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / 900);
      setVal(target * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(tick); else setVal(null);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m || val === null) return text;
  const decimals = (m[2].split('.')[1] || '').length;
  const shown = val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${m[1]}${shown}${m[3]}`;
}

function ResultsTable({ results }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold: 0.35 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  if (!results) return null;
  return (
    <figure className={`results ${inView ? 'in-view' : ''}`} ref={ref}>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>{results.columns.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr>
          </thead>
          <tbody>
            {results.rows.map((r, i) => (
              <tr key={i} style={{ '--row': i }}>
                {r.map((cell, j) => (j === 0
                  ? <th key={j} scope="row">{cell}</th>
                  : <td key={j}><CountUp text={cell} run={inView} /></td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption>{results.caption}</figcaption>
    </figure>
  );
}

function Project({ p, lead, highlighted }) {
  const [open, setOpen] = useState(lead);
  useEffect(() => { if (highlighted) setOpen(true); }, [highlighted]);

  return (
    <article id={`project-${p.slug}`} className={`project ${lead ? 'project-lead' : ''} ${highlighted ? 'flash' : ''}`}>
      <div className="project-meta">
        <span className={`status status-${p.status}`}>{p.statusText}</span>
        <ul className="stack">{p.stack.map((s) => <li key={s}>{s}</li>)}</ul>
      </div>

      <div className="project-body">
        <h3 className="project-title">{p.title}</h3>
        <p className="project-abstract">{p.abstract}</p>

        <ResultsTable results={p.results} />
        {p.takeaway ? <p className="takeaway">{p.takeaway}</p> : null}

        {(p.method?.length || p.limitations || p.figure) ? (
          <>
            <button
              type="button"
              className="disclose"
              aria-expanded={open}
              aria-controls={`details-${p.slug}`}
              onClick={() => setOpen((v) => !v)}
            >
              {`${open ? 'Hide' : 'Show'} ${p.limitations ? 'method and limitations' : 'details'}`}
            </button>
            <div id={`details-${p.slug}`} className={`details ${open ? 'open' : ''}`} hidden={!open}>
              {p.method?.length ? (
                <>
                  <h4>How I did it</h4>
                  <ul className="method">{p.method.map((m, i) => <li key={i}>{m}</li>)}</ul>
                </>
              ) : null}
              {p.figure ? (
                <figure className="project-figure">
                  <img src={p.figure.src} alt={p.figure.alt} loading="lazy" />
                  <figcaption>{p.figure.caption}</figcaption>
                </figure>
              ) : null}
              {p.limitations ? (
                <>
                  <h4>Limitations</h4>
                  <p className="limits">{p.limitations}</p>
                </>
              ) : null}
            </div>
          </>
        ) : null}

        {p.links?.length ? (
          <p className="project-links">
            {p.links.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default function Projects() {
  const [highlight, setHighlight] = useState('');

  // The command palette and chat assistant can ask to open a specific project.
  useEffect(() => {
    const onOpen = (e) => {
      const slug = e.detail;
      setHighlight(slug);
      requestAnimationFrame(() => {
        document.getElementById(`project-${slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      window.setTimeout(() => setHighlight(''), 2200);
    };
    window.addEventListener('open-project', onOpen);
    const m = window.location.hash.match(/^#project-([\w-]+)$/);
    if (m) setTimeout(() => onOpen({ detail: m[1] }), 300);
    return () => window.removeEventListener('open-project', onOpen);
  }, []);

  return (
    <section id="research" className="section">
      <div className="container">
        <SectionHead title="Research and projects">
          What I built, what the numbers were, and what they do not show.
        </SectionHead>
        <div className="project-list">
          {projects.map((p, i) => (
            <Project key={p.slug} p={p} lead={i === 0} highlighted={highlight === p.slug} />
          ))}
        </div>
        <LabTeaser />
      </div>
    </section>
  );
}
