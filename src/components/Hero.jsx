import React from 'react';
import { profile, heroSentence } from '../data/portfolioData';
import NeuralBackground from './NeuralBackground';

export default function Hero() {
  return (
    <section id="top" className="hero">
      <NeuralBackground />
      <button
        type="button"
        className="nn-spell-btn"
        onClick={() => window.dispatchEvent(new CustomEvent('nn-spell'))}
      >
        Spell my name with the network
      </button>
      <div className="container hero-grid">
        <div className="hero-copy">
          <h1 className="hero-name" aria-label={profile.name}>
            {profile.name.split(' ').map((word, wi) => (
              <React.Fragment key={wi}>
                {wi > 0 ? ' ' : null}
                <span className="hn-word" aria-hidden="true">
                  {word.split('').map((ch, ci) => <span key={ci} className="hn-ch">{ch}</span>)}
                </span>
              </React.Fragment>
            ))}
          </h1>
          <p className="hero-role">{profile.role}.</p>

          <figure className="hero-tagged" aria-label="Example of token-level language identification">
            <p className="tagged-line" lang="ne-Latn">
              {heroSentence.tokens.map(([tok, tag], i) => (
                <span key={i} className={`tok tok-${tag.toLowerCase()}`} style={{ '--i': i }}>
                  <span className="tok-word">{tok}</span>
                  <span className="tok-tag">{tag}</span>
                </span>
              ))}
            </p>
            <figcaption>
              “{heroSentence.translation}” Each word tagged Nepali (NE), English (EN) or Other, the way my
              language-ID model tags it.
            </figcaption>
          </figure>

          <div className="hero-actions">
            <a href="#research" className="btn btn-primary">Read my research</a>
            <a href={profile.links.resume} className="btn btn-ghost" download>Download résumé (PDF)</a>
          </div>
          <ul className="hero-links">
            <li><a href={profile.links.github} target="_blank" rel="noreferrer">GitHub</a></li>
            <li><a href={profile.links.linkedin} target="_blank" rel="noreferrer">LinkedIn</a></li>
            <li><a href={`mailto:${profile.email}`}>{profile.email}</a></li>
          </ul>
        </div>
      </div>
    </section>
  );
}
