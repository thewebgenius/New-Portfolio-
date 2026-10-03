import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

export const ThemeContext = createContext({ mode: 'inference', toggle: () => {}, setMode: () => {} });

export function useThemeState() {
  const [mode, setModeState] = useState(
    () => document.documentElement.getAttribute('data-mode') || 'inference'
  );

  const setMode = useCallback((next, evt) => {
    const root = document.documentElement;
    if (root.getAttribute('data-mode') === next) return;
    const apply = () => {
      root.setAttribute('data-mode', next);
      try { localStorage.setItem('theme-mode', next); } catch (e) { /* storage blocked */ }
      setModeState(next);
      window.dispatchEvent(new CustomEvent('themechange', { detail: next }));
    };
    const reduced = prefersReducedMotion();
    // Circular reveal from the switch, where the browser supports view transitions.
    if (document.startViewTransition && !reduced) {
      const x = evt?.clientX ?? window.innerWidth - 80;
      const y = evt?.clientY ?? 32;
      root.style.setProperty('--vt-x', `${x}px`);
      root.style.setProperty('--vt-y', `${y}px`);
      root.style.setProperty('--vt-r', `${Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))}px`);
      document.startViewTransition(() => { flushSync(apply); });
      return;
    }
    root.classList.add('mode-switching');
    apply();
    window.setTimeout(() => root.classList.remove('mode-switching'), 350);
  }, []);

  const toggle = useCallback(() => setMode(mode === 'train' ? 'inference' : 'train'), [mode, setMode]);

  // Follow the system setting until the visitor picks a mode themselves.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => {
      let saved = null;
      try { saved = localStorage.getItem('theme-mode'); } catch (err) { /* ignore */ }
      if (!saved) {
        const next = e.matches ? 'train' : 'inference';
        document.documentElement.setAttribute('data-mode', next);
        setModeState(next);
        window.dispatchEvent(new CustomEvent('themechange', { detail: next }));
      }
    };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'train' ? '#07090a' : '#f5f6f8');
  }, [mode]);

  return { mode, toggle, setMode };
}

export const useTheme = () => useContext(ThemeContext);

// Read a CSS variable from the root element (used by canvas/Three.js code).
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isLowEndDevice() {
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  return coarse || cores <= 2 || mem <= 2;
}
