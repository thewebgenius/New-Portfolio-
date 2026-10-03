import React from 'react';
import { profile, researchInterests, skills, education } from '../data/portfolioData';
import SectionHead from './SectionHead';
import NameTag from './NameTag';

export default function About() {
  return (
    <section id="about" className="section">
      <div className="container">
        <SectionHead title="About" />
        <div className="about-grid">
          <div className="about-main">
            <p className="about-summary">{profile.summary}</p>

            <h3 className="sub-title">What I work on</h3>
            <dl className="interests">
              {researchInterests.map((r) => (
                <div key={r.name} className="interest">
                  <dt>{r.name}</dt>
                  <dd>{r.text}</dd>
                </div>
              ))}
            </dl>

            <h3 className="sub-title">Tools I use</h3>
            <dl className="skills">
              {skills.map((s) => (
                <div key={s.group} className="skill-row">
                  <dt>{s.group}</dt>
                  <dd>{s.items.join(', ')}</dd>
                </div>
              ))}
            </dl>
          </div>

          <aside className="about-side">
            <NameTag />
            <h3 className="sub-title">Education</h3>
            <ol className="edu">
              {education.map((e) => (
                <li key={e.place}>
                  <span className="edu-place">{e.place}</span>
                  <span className="edu-period">{e.period}</span>
                  <span className="edu-detail">{e.detail}</span>
                </li>
              ))}
            </ol>
            <p className="langs">Speaks Nepali (native), English and Hindi.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
