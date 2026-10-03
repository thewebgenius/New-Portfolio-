import React, { useRef, useState } from 'react';
import { LAB_URL } from '../lib/route';

// Small preview of the K-Means playground. Move the pointer across the image to compare.
export default function LabTeaser() {
  const [pos, setPos] = useState(55);
  const ref = useRef(null);
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
  };

  return (
    <aside className="lab-teaser" aria-labelledby="lab-teaser-title">
      <a
        href={LAB_URL}
        className="lab-teaser-img"
        ref={ref}
        onPointerMove={onMove}
        aria-label="Open the K-Means playground"
        style={{ '--pos': `${pos}%` }}
      >
        <img src="/samples/landscape.jpg" alt="" width="640" height="427" loading="lazy" />
        <img src="/samples/landscape-k16.png" alt="" width="640" height="427" loading="lazy" className="lab-teaser-q" />
        <span className="lab-teaser-line" aria-hidden="true" />
        <span className="lab-teaser-cap lab-teaser-cap-l">88,089 colours</span>
        <span className="lab-teaser-cap lab-teaser-cap-r">16 colours</span>
      </a>
      <div className="lab-teaser-text">
        <p className="lab-teaser-kicker">Side experiment</p>
        <h3 id="lab-teaser-title" className="lab-teaser-title">Compressing a photo to 16 colours with K-Means</h3>
        <p>
          A LinkedIn post of mine took a photo from 132,666 colours down to 16 by clustering its pixels. It reached
          211,000+ impressions, so I rebuilt it as a playground: drop in any image, move the K slider, and compare
          against plain uniform quantization. Everything runs in your browser.
        </p>
        <ul className="lab-teaser-stats">
          <li><strong>211K</strong> impressions</li>
          <li><strong>879</strong> reactions</li>
          <li><strong>45</strong> comments</li>
        </ul>
        <a href={LAB_URL} className="btn btn-primary">Open the playground</a>
      </div>
    </aside>
  );
}
