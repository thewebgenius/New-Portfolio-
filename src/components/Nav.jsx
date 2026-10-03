import React, { useEffect, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import LossCurve from './LossCurve';
import { LAB_URL } from '../lib/route';

export const sections = [
  { id: 'about', label: 'About' },
  { id: 'research', label: 'Research' },
  { id: 'playground', label: 'Demo' },
  { id: 'experience', label: 'Experience' },
  { id: 'github', label: 'GitHub' },
  { id: 'contact', label: 'Contact' },
];

export function openPalette() {
  window.dispatchEvent(new CustomEvent('open-palette'));
}

export default function Nav({ page = 'home' }) {
  const onHome = page === 'home';
  const { mode, setMode } = useTheme();
  const [active, setActive] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    sections.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
  }, [menuOpen]);

  return (
    <nav className="nav" aria-label="Main">
      <div className="nav-inner">
        <a href={onHome ? '#top' : '/'} className="nav-brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-full">Shivam Kumar Sah</span>
          <span className="brand-short" aria-hidden="true">Shivam</span>
        </a>

        <ul className={`nav-links ${menuOpen ? 'open' : ''}`}>
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={onHome ? `#${s.id}` : `/#${s.id}`}
                className={active === s.id ? 'active' : ''}
                aria-current={active === s.id ? 'true' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {s.label}
              </a>
            </li>
          ))}
          <li>
            <a
              href={LAB_URL}
              className={`nav-lab ${!onHome ? 'active' : ''}`}
              aria-current={!onHome ? 'page' : undefined}
            >
              Lab
            </a>
          </li>
        </ul>

        <div className="nav-tools">
          <button type="button" className="kbd-hint" onClick={openPalette} aria-label="Open command palette">
            <span className="kbd-hint-text">Search</span>
            <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd>
          </button>

          <div className="mode-switch" role="radiogroup" aria-label="Display mode">
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'inference'}
              className={mode === 'inference' ? 'on' : ''}
              onClick={(e) => setMode('inference', e)}
              title="Light mode"
            >
              Inference
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'train'}
              className={mode === 'train' ? 'on' : ''}
              onClick={(e) => setMode('train', e)}
              title="Dark terminal mode"
            >
              Train
            </button>
            <span className="mode-thumb" aria-hidden="true" />
          </div>

          <button
            type="button"
            className="menu-btn"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span /><span />
          </button>
        </div>
      </div>
      {mode === 'train' ? <LossCurve /> : null}
    </nav>
  );
}
