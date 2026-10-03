import React from 'react';

export default function SectionHead({ title, children }) {
  return (
    <header className="section-head">
      <h2 className="section-title">{title}</h2>
      {children ? <p className="section-lede">{children}</p> : null}
    </header>
  );
}
