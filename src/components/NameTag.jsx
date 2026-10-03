import React, { useEffect, useRef, useState } from 'react';
import { profile } from '../data/portfolioData';
import { prefersReducedMotion } from '../hooks/useTheme';

// A conference-style badge hanging from a lanyard. Drag it to swing it, hover to tilt it,
// click (or press Enter) to flip it over. A tiny spring simulation drives the swing.
export default function NameTag() {
  const pivotRef = useRef(null);
  const cardRef = useRef(null);
  const [flipped, setFlipped] = useState(false);
  const sim = useRef({ angle: 0, vel: 0, tiltX: 0, tiltY: 0, tTiltX: 0, tTiltY: 0, gx: 50, gy: 30, dragging: false, lastX: 0, moved: 0 });
  const rafRef = useRef(0);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    const s = sim.current;
    const pivot = pivotRef.current;
    const card = cardRef.current;
    let running = false;

    const render = () => {
      pivot.style.transform = `rotateZ(${s.angle.toFixed(3)}deg)`;
      card.style.setProperty('--tilt-x', `${s.tiltX.toFixed(2)}deg`);
      card.style.setProperty('--tilt-y', `${s.tiltY.toFixed(2)}deg`);
      card.style.setProperty('--gx', `${s.gx}%`);
      card.style.setProperty('--gy', `${s.gy}%`);
    };

    const tick = () => {
      if (!s.dragging) {
        // damped spring back to hanging straight down
        s.vel += -0.045 * s.angle;
        s.vel *= 0.94;
        s.angle += s.vel;
      }
      s.tiltX += (s.tTiltX - s.tiltX) * 0.12;
      s.tiltY += (s.tTiltY - s.tiltY) * 0.12;
      render();
      const energy = Math.abs(s.angle) + Math.abs(s.vel) + Math.abs(s.tTiltX - s.tiltX) + Math.abs(s.tTiltY - s.tiltY);
      if (energy > 0.02 || s.dragging) rafRef.current = requestAnimationFrame(tick);
      else { running = false; s.angle = 0; s.vel = 0; render(); }
    };
    const kick = () => { if (!running && !reduced) { running = true; rafRef.current = requestAnimationFrame(tick); } };

    // a small swing on first view, like it was just hung up
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { s.vel = reduced ? 0 : 1.6; kick(); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(pivot);

    const onMove = (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width; const py = (e.clientY - r.top) / r.height;
      s.tTiltY = (px - 0.5) * 22; s.tTiltX = -(py - 0.5) * 16;
      s.gx = Math.round(px * 100); s.gy = Math.round(py * 100);
      if (s.dragging) {
        const dx = e.clientX - s.lastX; s.lastX = e.clientX;
        s.moved += Math.abs(dx);
        s.vel = dx * 0.35; s.angle = Math.max(-35, Math.min(35, s.angle + dx * 0.35));
      }
      kick();
    };
    const onLeave = () => { s.tTiltX = 0; s.tTiltY = 0; kick(); };
    const onDown = (e) => { s.dragging = true; s.lastX = e.clientX; s.moved = 0; card.setPointerCapture?.(e.pointerId); kick(); };
    const onUp = () => { s.dragging = false; kick(); };

    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerleave', onLeave);
    card.addEventListener('pointerdown', onDown);
    card.addEventListener('pointerup', onUp);
    card.addEventListener('pointercancel', onUp);
    render();
    return () => {
      cancelAnimationFrame(rafRef.current); io.disconnect();
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerleave', onLeave);
      card.removeEventListener('pointerdown', onDown);
      card.removeEventListener('pointerup', onUp);
      card.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const onClick = () => {
    // a drag should not also flip the card
    if (sim.current.moved > 6) { sim.current.moved = 0; return; }
    setFlipped((f) => !f);
  };

  return (
    <div className="tag-rig">
      <div className="tag-pivot" ref={pivotRef}>
        <div className="tag-strap" aria-hidden="true">
          <span>DIT University · AI/ML · DIT University · AI/ML ·</span>
        </div>
        <div className="tag-clip" aria-hidden="true" />
        <button
          type="button"
          ref={cardRef}
          className={`tag-card ${flipped ? 'flipped' : ''}`}
          onClick={onClick}
          aria-label={`Name badge for ${profile.name}. ${flipped ? 'Showing the back.' : 'Showing the front.'} Press to flip.`}
          aria-pressed={flipped}
        >
          <span className="tag-inner">
            <span className="tag-face tag-front">
              <span className="tag-slot" aria-hidden="true" />
              <span className="tag-band">
                <span>DIT University</span>
                <span>B.Tech CSE · AI/ML</span>
              </span>
              <img src={profile.photo} alt={`Portrait of ${profile.name}`} className="tag-photo" draggable="false" />
              <span className="tag-name">{profile.name}</span>
              <span className="tag-role">ML research · NLP for low-resource languages</span>
              <span className="tag-foot">
                <span>Class of 2027</span>
                <span className="tag-code" aria-hidden="true" />
              </span>
              <span className="tag-glare" aria-hidden="true" />
            </span>
            <span className="tag-face tag-back">
              <span className="tag-slot" aria-hidden="true" />
              <span className="tag-back-title">Currently working on</span>
              <span className="tag-back-item">Token-level language ID for romanized Nepali-English (paper in preparation)</span>
              <span className="tag-back-item">MVBS — a voice banking assistant for NepGlish speakers</span>
              <span className="tag-back-title">Reach me</span>
              <span className="tag-back-item mono">{profile.email}</span>
              <span className="tag-back-item mono">github.com/thewebgenius</span>
              <span className="tag-back-hint">Tap to flip back</span>
            </span>
          </span>
        </button>
      </div>
      <p className="tag-hint">Drag the badge to swing it. Click to flip.</p>
    </div>
  );
}
