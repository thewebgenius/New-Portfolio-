import React, { Suspense, lazy } from 'react';
import { ThemeContext, useThemeState } from './hooks/useTheme';
import { isLabPage } from './lib/route';
import Nav from './components/Nav';
import Hero from './components/Hero';
import About from './components/About';
import Projects from './components/Projects';
import Playground from './components/Playground';
import Experience from './components/Experience';
import GitHubStats from './components/GitHubStats';
import Contact from './components/Contact';
import Footer from './components/Footer';
import LazySection from './components/LazySection';
import CommandPalette from './components/CommandPalette';
import ChatAssistant from './components/ChatAssistant';

// Three.js is only downloaded when the explorer section scrolls near the viewport.
const EmbeddingExplorer = lazy(() => import('./components/EmbeddingExplorer'));
// The K-Means playground is a separate page at /lab/kmeans, loaded only when visited.
const KMeansLab = lazy(() => import('./lab/KMeansLab'));

export default function App() {
  const theme = useThemeState();

  if (isLabPage) {
    return (
      <ThemeContext.Provider value={theme}>
        <a className="skip-link" href="#main">Skip to content</a>
        <Nav page="lab" />
        <main id="main">
          <Suspense fallback={<div className="lazy-placeholder" style={{ minHeight: '80vh', border: 0 }} />}>
            <KMeansLab />
          </Suspense>
        </main>
        <Footer />
        <CommandPalette />
        <ChatAssistant />
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={theme}>
      <a className="skip-link" href="#main">Skip to content</a>
      <Nav />
      <main id="main">
        <Hero />
        <About />
        <Projects />
        <Playground />
        <LazySection id="embeddings" minHeight={640}>
          <Suspense fallback={<div className="lazy-placeholder" style={{ minHeight: 640 }} />}>
            <EmbeddingExplorer />
          </Suspense>
        </LazySection>
        <Experience />
        <GitHubStats />
        <Contact />
      </main>
      <Footer />
      <CommandPalette />
      <ChatAssistant />
    </ThemeContext.Provider>
  );
}
