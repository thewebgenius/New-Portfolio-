import React, { useState } from 'react';
import { profile } from '../data/portfolioData';
import SectionHead from './SectionHead';

export default function Contact() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(profile.email); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (e) { /* ignore */ }
  };
  return (
    <section id="contact" className="section contact">
      <div className="container">
        <SectionHead title="Contact">
          I am looking for research internships and collaborations in NLP for low-resource languages.
          Email is the fastest way to reach me.
        </SectionHead>
        <div className="contact-grid">
          <div className="contact-email">
            <a href={`mailto:${profile.email}`} className="email-big">{profile.email}</a>
            <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
              {copied ? 'Copied' : 'Copy email'}
            </button>
            <span className="sr-only" aria-live="polite">{copied ? 'Email copied to clipboard' : ''}</span>
          </div>
          <dl className="contact-list">
            <div><dt>Phone</dt><dd>{profile.phones.map((p) => <a key={p} href={`tel:${p.replace(/\s/g, '')}`}>{p}</a>)}</dd></div>
            <div><dt>Based in</dt><dd>{profile.location}</dd></div>
            <div><dt>Elsewhere</dt><dd>
              <a href={profile.links.github} target="_blank" rel="noreferrer">GitHub</a>
              <a href={profile.links.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
              <a href={profile.links.resume} download>Résumé (PDF)</a>
            </dd></div>
          </dl>
        </div>
      </div>
    </section>
  );
}
