import React from 'react';
import { openPalette } from './Nav';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <p>© {new Date().getFullYear()} Shivam Kumar Sah. Built with React; source on GitHub.</p>
        <button type="button" className="link-btn" onClick={openPalette}>Open command palette</button>
      </div>
    </footer>
  );
}
