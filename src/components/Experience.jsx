import React from 'react';
import { experience } from '../data/portfolioData';
import SectionHead from './SectionHead';

export default function Experience() {
  return (
    <section id="experience" className="section">
      <div className="container">
        <SectionHead title="Experience" />
        <ul className="exp-list">
          {experience.map((x) => (
            <li key={x.role + x.org} className="exp">
              <span className="exp-period">{x.period}</span>
              <div>
                <h3 className="exp-role">{x.role}, <span>{x.org}</span></h3>
                <p>{x.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
