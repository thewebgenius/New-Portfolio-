import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { profile, projects, projectAliases } from '../data/portfolioData';
import { useTheme } from '../hooks/useTheme';
import { fuzzyScore } from '../lib/fuzzy';
import { sections } from './Nav';
import { isLabPage, LAB_URL } from '../lib/route';

const go = (id) => {
  if (isLabPage) { window.location.href = `/#${id}`; return; }
  window.dispatchEvent(new CustomEvent('force-load-section', { detail: id }));
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
};
const openProject = (slug) => {
  if (isLabPage) { window.location.href = `/#project-${slug}`; return; }
  window.dispatchEvent(new CustomEvent('open-project', { detail: slug }));
};

function resolveProject(name) {
  const n = name.toLowerCase().trim();
  const direct = projects.find((p) => p.slug === n);
  if (direct) return direct.slug;
  const alias = Object.entries(projectAliases).find(([, list]) => list.includes(n));
  return alias ? alias[0] : null;
}

export default function CommandPalette() {
  const { mode, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const [output, setOutput] = useState(null);
  const inputRef = useRef(null);
  const lastFocus = useRef(null);
  const listRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false); setQuery(''); setOutput(null); setSel(0);
    lastFocus.current?.focus?.();
  }, []);

  const show = useCallback(() => {
    lastFocus.current = document.activeElement;
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) close(); else show();
      }
    };
    const onOpen = () => show();
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-palette', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('open-palette', onOpen); };
  }, [open, close, show]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 10); }, [open]);

  const copyEmail = async () => {
    try { await navigator.clipboard.writeText(profile.email); setOutput({ title: 'Copied', body: `${profile.email} is on your clipboard.` }); } catch (e) {
      setOutput({ title: 'Could not copy', body: `Your browser blocked clipboard access. The address is ${profile.email}.` });
    }
  };

  const showStats = () => {
    const done = projects.filter((p) => p.status === 'completed').length;
    setOutput({
      title: 'stats',
      body: [
        `projects        ${projects.length} (${done} completed, 1 paper in preparation, 1 pending, 1 not completed)`,
        'best LID acc    99.54% token accuracy (XLM-R, 12,166 test tokens)',
        'SmartBinX       94.75% on unseen test images (96.44% full split)',
        'HAM10000        70.4% balanced accuracy, lesion-grouped split',
        'GitHub          see the GitHub section for live numbers',
      ].join('\n'),
      mono: true,
    });
  };

  const commands = useMemo(() => {
    const list = [];
    sections.forEach((s) => list.push({ id: `go-${s.id}`, group: 'Go to', label: s.label, run: () => { go(s.id); close(); } }));
    list.push({ id: 'go-embeddings', group: 'Go to', label: 'Embedding explorer', run: () => { go('embeddings'); close(); } });
    list.push({ id: 'go-lab', group: 'Go to', label: 'K-Means image compression playground', hint: 'Lab', run: () => { window.location.href = LAB_URL; } });
    projects.forEach((p) => list.push({
      id: `p-${p.slug}`, group: 'Projects', label: p.title, hint: p.statusText,
      run: () => { openProject(p.slug); close(); },
    }));
    list.push(
      { id: 'gh', group: 'Links', label: 'Open GitHub', run: () => { window.open(profile.links.github, '_blank', 'noopener'); close(); } },
      { id: 'li', group: 'Links', label: 'Open LinkedIn', run: () => { window.open(profile.links.linkedin, '_blank', 'noopener'); close(); } },
      { id: 'mail', group: 'Links', label: 'Send an email', run: () => { window.location.href = `mailto:${profile.email}`; close(); } },
      { id: 'copy', group: 'Actions', label: 'Copy email address', run: copyEmail },
      { id: 'cv', group: 'Actions', label: 'Download résumé (PDF)', run: () => {
        const a = document.createElement('a'); a.href = profile.links.resume; a.download = ''; a.click(); close();
      } },
      { id: 'theme', group: 'Actions', label: `Switch to ${mode === 'train' ? 'Inference (light)' : 'Train (dark)'} mode`, run: () => { toggle(); close(); } },
      { id: 'chat', group: 'Actions', label: 'Ask the assistant a question', run: () => { close(); window.dispatchEvent(new CustomEvent('open-chat')); } },
      { id: 'stats', group: 'Actions', label: 'Show stats', run: showStats },
      { id: 'whoami', group: 'Terminal', label: 'whoami', run: () => setOutput({ title: 'whoami', body: `${profile.name}\n${profile.role}.\nDIT University, B.Tech CSE (AI/ML), 2023–2027.`, mono: true }) },
      { id: 'run', group: 'Terminal', label: 'run --project <name>', hint: 'e.g. run --project lid', fill: 'run --project ' },
      { id: 'sudo', group: 'Terminal', label: 'sudo hire shivam', run: () => setOutput({
        title: 'sudo hire shivam',
        body: `[sudo] password for recruiter: ********\nPermission granted.\nNext step: send an email to ${profile.email}.`,
        mono: true,
      }) },
      { id: 'help', group: 'Terminal', label: 'help', run: () => setOutput({
        title: 'help', mono: true,
        body: 'whoami                 short bio\nrun --project <name>   open a project (lid, smartbinx, skin, mvbs, iot)\nrun kmeans             open the K-Means playground\nsudo hire shivam       try it\nstats                  key numbers\nclear                  clear output',
      }) },
    );
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Typed terminal commands take priority over the fuzzy list.
  const terminal = useMemo(() => {
    const q = query.trim().toLowerCase();
    const m = q.match(/^run\s+--project\s+(.+)$/);
    if (m) {
      const slug = resolveProject(m[1]);
      return slug
        ? { label: `run --project ${m[1]}`, hint: projects.find((p) => p.slug === slug).title, run: () => { openProject(slug); close(); } }
        : { label: `run --project ${m[1]}`, hint: 'unknown project — try lid, smartbinx, skin, mvbs or iot', run: () => {} };
    }
    if (/^sudo\s+hire\s+(shivam|shubham|me)\b/.test(q)) return commands.find((c) => c.id === 'sudo');
    if (/^run\s+(--lab\s+)?kmeans$/.test(q) || q === 'lab') return { label: 'run kmeans', hint: 'K-Means playground', run: () => { window.location.href = LAB_URL; } };
    if (q === 'whoami') return commands.find((c) => c.id === 'whoami');
    if (q === 'stats') return commands.find((c) => c.id === 'stats');
    if (q === 'help') return commands.find((c) => c.id === 'help');
    if (q === 'clear') return { label: 'clear', run: () => { setOutput(null); setQuery(''); } };
    return null;
  }, [query, commands, close]);

  const results = useMemo(() => {
    if (terminal) return [{ ...terminal, id: 'terminal', group: 'Run' }];
    if (!query.trim()) return commands;
    return commands
      .map((c) => ({ c, s: Math.max(fuzzyScore(query, c.label), fuzzyScore(query, `${c.group} ${c.label}`) - 5) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.c);
  }, [query, commands, terminal]);

  useEffect(() => { setSel(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const runItem = (item) => {
    if (!item) return;
    if (item.fill) { setQuery(item.fill); inputRef.current?.focus(); return; }
    item.run?.();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); runItem(results[sel]); }
    else if (e.key === 'Tab') {
      // keep focus inside the dialog
      e.preventDefault();
      inputRef.current?.focus();
    }
  };

  if (!open) return null;

  let lastGroup = '';
  return (
    <div className="palette-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={onKeyDown}>
        <div className="palette-input">
          <span className="prompt" aria-hidden="true">›</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sections, projects, or type a command (try help)"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[sel] ? `cmd-${results[sel].id}` : undefined}
            autoComplete="off"
            spellCheck="false"
          />
          <kbd>Esc</kbd>
        </div>

        {output ? (
          <div className={`palette-output ${output.mono ? 'mono' : ''}`} aria-live="polite">
            <span className="out-title">{output.title}</span>
            <pre>{output.body}</pre>
          </div>
        ) : null}

        <ul id="palette-list" className="palette-list" role="listbox" ref={listRef}>
          {results.length === 0 ? <li className="palette-empty">No matches. Type <code>help</code> for terminal commands.</li> : null}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <React.Fragment key={r.id}>
                {header ? <li className="palette-group" role="presentation">{header}</li> : null}
                <li
                  id={`cmd-${r.id}`}
                  role="option"
                  aria-selected={i === sel}
                  className={i === sel ? 'sel' : ''}
                  onMouseMove={() => setSel(i)}
                  onClick={() => runItem(r)}
                >
                  <span className="cmd-label">{r.label}</span>
                  {r.hint ? <span className="cmd-hint">{r.hint}</span> : null}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
        <div className="palette-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> run</span><span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
