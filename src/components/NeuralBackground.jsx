import React, { useEffect, useRef } from 'react';
import { cssVar, prefersReducedMotion, isLowEndDevice } from '../hooks/useTheme';

// A small feed-forward network drawn in 3D on a 2D canvas (no WebGL needed).
// Each layer is a ring of neurons; the whole net sways slowly and tilts toward the pointer.
// Pulses travel along the connections like a forward pass; hovering a neuron fires one.
//
// Clicking a neuron (the glowing core one is marked) releases liquid in the neuron colour.
// The liquid streams out, settles into new nodes, and the nodes join up to spell SHIVAM.

// Capital letters as strokes on a 4 x 6 grid (x right, y down).
const GLYPHS = {
  S: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  I: [[[1, 0], [3, 0]], [[2, 0], [2, 6]], [[1, 6], [3, 6]]],
  V: [[[0, 0], [2, 6], [4, 0]]],
  A: [[[0, 6], [1, 3], [2, 0], [3, 3], [4, 6]], [[1, 3], [3, 3]]],
  M: [[[0, 6], [0, 0], [2, 3], [4, 0], [4, 6]]],
};
const WORD = 'SHIVAM';

// Turn the word into vertices (with long strokes subdivided) and edges between them.
function buildWord() {
  const verts = []; const edges = [];
  const key = new Map();
  const vid = (x, y) => {
    const k = `${x.toFixed(3)},${y.toFixed(3)}`;
    if (!key.has(k)) { key.set(k, verts.length); verts.push({ gx: x, gy: y }); }
    return key.get(k);
  };
  [...WORD].forEach((ch, li) => {
    const ox = li * 6; // 4 units of letter + 2 of gap
    GLYPHS[ch].forEach((stroke) => {
      for (let i = 0; i < stroke.length - 1; i += 1) {
        const [x1, y1] = stroke[i]; const [x2, y2] = stroke[i + 1];
        const pieces = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 2));
        let prev = vid(ox + x1, y1);
        for (let p = 1; p <= pieces; p += 1) {
          const t = p / pieces;
          const cur = vid(ox + x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
          edges.push([prev, cur]);
          prev = cur;
        }
      }
    });
  });
  return { verts, edges, gridW: WORD.length * 6 - 2, gridH: 6 };
}
const WORD_GEOM = buildWord();

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

export default function NeuralBackground() {
  const canvasRef = useRef(null);
  const liquidRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const liquid = liquidRef.current;
    const ctx = canvas.getContext('2d');
    const lctx = liquid.getContext('2d');
    const hero = canvas.parentElement;
    const reduced = prefersReducedMotion();
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const lowEnd = isLowEndDevice();
    const layers = touch || lowEnd ? [3, 5, 5, 2] : [4, 6, 6, 3];

    let w = 0; let h = 0; let dpr = 1;
    let cx = 0; let cy = 0; let scale = 1; let wide = true; let netLeft = 0;
    const nodes = []; const edges = [];
    let pulses = [];
    let colors = {};
    const mouse = { x: 0, y: 0, active: false, nx: 0, ny: 0 };
    let yaw = -0.5; let pitch = 0.18; let tYaw = -0.5; let tPitch = 0.18;
    let raf = 0; let running = false; let visible = true;
    let lastSpawn = 0; let lastHoverFire = 0; const t0 = performance.now();
    let coreIndex = 0;
    let spell = null; // active name animation
    let netAlpha = 1;

    // build the 3D model once
    const spanX = 2.6;
    layers.forEach((count, li) => {
      const x = -spanX / 2 + (spanX * li) / (layers.length - 1);
      const radius = 0.22 + count * 0.09;
      for (let k = 0; k < count; k += 1) {
        const a = (k / count) * Math.PI * 2 + li * 0.35;
        nodes.push({ layer: li, x, y: Math.cos(a) * radius, z: Math.sin(a) * radius, heat: 0, sx: 0, sy: 0, s: 1, depth: 0 });
      }
    });
    nodes.forEach((a, ai) => nodes.forEach((b, bi) => { if (b.layer === a.layer + 1) edges.push({ a: ai, b: bi, heat: 0 }); }));

    const readColors = () => {
      colors = {
        node: cssVar('--nn-node') || '#1d3fa6',
        edge: cssVar('--nn-edge') || 'rgba(29,63,166,0.12)',
        pulse: cssVar('--nn-pulse') || '#c8102e',
        glow: cssVar('--nn-glow') || 'rgba(29,63,166,0.35)',
      };
    };

    const layout = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      [canvas, liquid].forEach((c) => { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      wide = w > 1100;
      if (wide) {
        netLeft = Math.max(w * 0.6, (w - 1120) / 2 + 680);
        cx = (netLeft + w) / 2 - 16; cy = h * 0.5;
        scale = Math.min((w - netLeft) * 0.3, h * 0.34);
      } else {
        netLeft = 0;
        cx = w * 0.5; cy = h * 0.5;
        scale = Math.min(w * 0.3, h * 0.32);
      }
      if (spell) placeWord(spell);
    };

    const project = (x, y, z) => {
      const cyw = Math.cos(yaw); const syw = Math.sin(yaw);
      const x1 = x * cyw + z * syw; const z1 = -x * syw + z * cyw;
      const cp = Math.cos(pitch); const sp = Math.sin(pitch);
      const y1 = y * cp - z1 * sp; const z2 = y * sp + z1 * cp;
      const persp = 4.2 / (4.2 + z2);
      return { sx: cx + x1 * scale * persp, sy: cy + y1 * scale * persp, s: persp, depth: z2 };
    };

    const fire = (ni, many) => {
      const outs = edges.filter((e) => e.a === ni);
      if (!outs.length) return;
      outs.sort(() => Math.random() - 0.5).slice(0, many ? 3 : 1)
        .forEach((e) => pulses.push({ e, t: 0, speed: 0.014 + Math.random() * 0.01 }));
    };

    // ---------- the SHIVAM animation ----------
    function placeWord(sp) {
      const { gridW, gridH } = WORD_GEOM;
      const x0 = wide ? netLeft - 40 : 20;
      const x1 = wide ? w - 32 : w - 20;
      const unit = Math.min((x1 - x0) / gridW, (h * (wide ? 0.42 : 0.3)) / gridH);
      const ox = (x0 + x1) / 2 - (gridW * unit) / 2;
      const oy = (wide ? cy : h * 0.42) - (gridH * unit) / 2;
      sp.unit = unit;
      sp.targets = WORD_GEOM.verts.map((v) => ({ x: ox + v.gx * unit, y: oy + v.gy * unit }));
    }

    const startSpell = (originIndex) => {
      const n = nodes[originIndex];
      const now = performance.now();
      const sp = { start: now, ox: n.sx, oy: n.sy, origin: originIndex, drops: [], dissolveAt: 0, ending: 0 };
      placeWord(sp);
      // launch order: sweep left to right so the word "writes" itself
      const order = WORD_GEOM.verts.map((v, i) => i).sort((a, b) => sp.targets[a].x - sp.targets[b].x);
      order.forEach((vi, k) => {
        const tgt = sp.targets[vi];
        const dx = tgt.x - sp.ox; const dy = tgt.y - sp.oy;
        const len = Math.hypot(dx, dy) || 1;
        const bend = (Math.random() - 0.5) * Math.min(160, len * 0.6);
        sp.drops[vi] = {
          launch: reduced ? 0 : 380 + k * 26,
          dur: reduced ? 0 : 700 + Math.random() * 380,
          // control point bent sideways so the liquid flows in arcs
          c1x: sp.ox + dx * 0.45 - (dy / len) * bend,
          c1y: sp.oy + dy * 0.45 + (dx / len) * bend - 30,
          r: 5 + Math.random() * 3,
        };
      });
      sp.lastArrival = Math.max(...sp.drops.map((d) => d.launch + d.dur));
      sp.dissolveAt = sp.lastArrival + 4200;
      spell = sp;
      hero.classList.add('nn-spelling');
      n.heat = 1;
      if (!running) { running = true; raf = requestAnimationFrame(loop); }
    };

    const endSpell = (now) => {
      if (!spell || spell.ending) return;
      spell.ending = now;
    };

    const bezier = (d, sp, tgt, t) => {
      const u = 1 - t;
      return {
        x: u * u * sp.ox + 2 * u * t * d.c1x + t * t * tgt.x,
        y: u * u * sp.oy + 2 * u * t * d.c1y + t * t * tgt.y,
      };
    };

    const drawSpell = (now) => {
      const sp = spell;
      const el = now - sp.start;
      let fade = 1;
      if (sp.ending) fade = 1 - clamp01((now - sp.ending) / 900);
      if (fade <= 0) {
        spell = null;
        hero.classList.remove('nn-spelling');
        lctx.clearRect(0, 0, w, h);
        return;
      }

      // liquid layer (blurred + thresholded by a CSS SVG filter, so blobs merge like fluid)
      lctx.clearRect(0, 0, w, h);
      lctx.fillStyle = colors.node;
      lctx.globalAlpha = fade;
      if (!reduced) {
        // the reservoir at the clicked neuron: swells, then drains as drops leave
        const swell = clamp01(el / 300);
        const drain = 1 - clamp01((el - 380) / (sp.lastArrival - 380 || 1));
        const rr = (8 + 18 * swell) * Math.max(0.15, drain);
        if (!sp.ending) { lctx.beginPath(); lctx.arc(sp.ox, sp.oy, rr, 0, Math.PI * 2); lctx.fill(); }
        sp.drops.forEach((d, vi) => {
          const tgt = sp.targets[vi];
          const local = (el - d.launch) / d.dur;
          if (local <= 0) return;
          if (local < 1) {
            const p = ease(local);
            // a short tail of shrinking drops makes a stream
            for (let k = 0; k < 5; k += 1) {
              const tp = clamp01(p - k * 0.035);
              const q = bezier(d, sp, tgt, tp);
              lctx.beginPath(); lctx.arc(q.x, q.y, d.r * (1 - k * 0.16), 0, Math.PI * 2); lctx.fill();
            }
          } else {
            // landed: the drop shrinks into the node
            const settle = clamp01((el - d.launch - d.dur) / 260);
            const r = d.r * (1 - settle) + 1;
            if (settle < 1) { lctx.beginPath(); lctx.arc(tgt.x, tgt.y, r + 3 * Math.sin(settle * Math.PI), 0, Math.PI * 2); lctx.fill(); }
          }
        });
      }
      lctx.globalAlpha = 1;

      // crisp letters: edges grow once both ends have landed, nodes pop in
      const landed = (vi) => { const d = sp.drops[vi]; return d.launch + d.dur; };
      ctx.save();
      ctx.lineCap = 'round';
      ctx.shadowColor = colors.glow; ctx.shadowBlur = 10;
      ctx.strokeStyle = colors.node; ctx.lineWidth = Math.max(1.6, sp.unit * 0.14);
      WORD_GEOM.edges.forEach(([a, b]) => {
        const tA = landed(a); const tB = landed(b);
        const first = tA <= tB ? a : b; const second = first === a ? b : a;
        const p = reduced ? 1 : clamp01((el - Math.max(tA, tB)) / 280);
        if (p <= 0) return;
        const A = sp.targets[first]; const B = sp.targets[second];
        ctx.globalAlpha = 0.85 * fade;
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(A.x + (B.x - A.x) * ease(p), A.y + (B.y - A.y) * ease(p)); ctx.stroke();
      });
      ctx.shadowBlur = 0;
      sp.targets.forEach((t, vi) => {
        const p = reduced ? 1 : clamp01((el - landed(vi)) / 320);
        if (p <= 0) return;
        const pop = p < 1 ? 1 + Math.sin(p * Math.PI) * 0.5 : 1;
        const r = Math.max(3, sp.unit * 0.24) * pop;
        ctx.globalAlpha = fade;
        ctx.fillStyle = colors.node;
        ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.55 * fade;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(t.x - r * 0.35, t.y - r * 0.35, r * 0.35, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();

      if (!sp.ending && now > sp.start + sp.dissolveAt) endSpell(now);
    };

    // ---------- main loop ----------
    const step = (now) => {
      const t = (now - t0) / 1000;
      const motion = reduced ? 0 : 1;
      const baseYaw = -0.5 + Math.sin(t * 0.25) * 0.45 * motion;
      tYaw = baseYaw + (mouse.active ? mouse.nx * 0.5 : 0) * motion;
      tPitch = 0.18 + (Math.sin(t * 0.18) * 0.08 + (mouse.active ? mouse.ny * 0.35 : 0)) * motion;
      yaw += (tYaw - yaw) * 0.05; pitch += (tPitch - pitch) * 0.05;

      // the network fades back while the name is shown
      const targetAlpha = spell && !spell.ending ? 0.16 : 1;
      netAlpha += (targetAlpha - netAlpha) * 0.08;

      if (!spell && !reduced && now - lastSpawn > 850) {
        lastSpawn = now;
        const inputs = nodes.map((n, i) => (n.layer === 0 ? i : -1)).filter((i) => i >= 0);
        fire(inputs[Math.floor(Math.random() * inputs.length)], false);
      }

      let best = Infinity;
      nodes.forEach((n, i) => {
        Object.assign(n, project(n.x, n.y, n.z));
        const dc = Math.hypot(n.sx - cx, n.sy - cy) + n.depth * 40; // nearest the centre, toward the viewer
        if (dc < best) { best = dc; coreIndex = i; }
        if (mouse.active && !spell) {
          const d = Math.hypot(mouse.x - n.sx, mouse.y - n.sy);
          if (d < 150) n.heat = Math.max(n.heat, 1 - d / 150);
          if (d < 22 && now - lastHoverFire > 350) { lastHoverFire = now; n.heat = 1; fire(i, true); }
        }
        n.heat *= 0.95;
      });
      edges.forEach((e) => { e.heat *= 0.94; });

      pulses = pulses.filter((p) => {
        p.t += p.speed;
        p.e.heat = Math.max(p.e.heat, 0.7);
        if (p.t >= 1) {
          nodes[p.e.b].heat = Math.max(nodes[p.e.b].heat, 0.9);
          if (Math.random() < 0.8 && !spell) fire(p.e.b, false);
          return false;
        }
        return true;
      });
      if (pulses.length > 48) pulses = pulses.slice(-48);
    };

    const draw = (now = performance.now()) => {
      ctx.clearRect(0, 0, w, h);
      edges.forEach((e) => {
        const a = nodes[e.a]; const b = nodes[e.b];
        const depthFade = Math.max(0.25, Math.min(1, (a.s + b.s) / 2 - 0.35)) * netAlpha;
        ctx.globalAlpha = depthFade;
        ctx.strokeStyle = colors.edge; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
        if (e.heat > 0.02) {
          ctx.globalAlpha = Math.min(1, e.heat) * depthFade;
          ctx.strokeStyle = colors.glow; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
        }
      });
      ctx.fillStyle = colors.pulse;
      pulses.forEach((p) => {
        const A = nodes[p.e.a]; const B = nodes[p.e.b];
        const q = project(A.x + (B.x - A.x) * p.t, A.y + (B.y - A.y) * p.t, A.z + (B.z - A.z) * p.t);
        ctx.globalAlpha = 0.9 * netAlpha;
        ctx.beginPath(); ctx.arc(q.sx, q.sy, 2.6 * q.s, 0, Math.PI * 2); ctx.fill();
      });
      const order = nodes.slice().sort((a, b) => b.depth - a.depth);
      order.forEach((n) => {
        const isCore = nodes.indexOf(n) === coreIndex;
        const r = (4.5 + n.heat * 2.5 + (isCore ? 2 : 0)) * n.s;
        const base = Math.min(1, 0.35 + 0.55 * (n.s - 0.6) / 0.6 + 0.4 * n.heat + (isCore ? 0.3 : 0));
        ctx.globalAlpha = base * netAlpha;
        ctx.fillStyle = colors.node;
        ctx.beginPath(); ctx.arc(n.sx, n.sy, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha *= 0.55;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(n.sx - r * 0.35, n.sy - r * 0.35, r * 0.35, 0, Math.PI * 2); ctx.fill();
        if (n.heat > 0.05) {
          ctx.globalAlpha = n.heat * 0.5 * netAlpha;
          ctx.strokeStyle = colors.pulse; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(n.sx, n.sy, r + 5 + n.heat * 4, 0, Math.PI * 2); ctx.stroke();
        }
        // the core neuron breathes, inviting a click
        if (isCore && !spell) {
          const b = reduced ? 0.5 : (Math.sin(now / 520) + 1) / 2;
          ctx.globalAlpha = 0.25 + 0.35 * (1 - b);
          ctx.strokeStyle = colors.node; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(n.sx, n.sy, r + 6 + b * 8, 0, Math.PI * 2); ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;
      if (spell) drawSpell(now);
    };

    function loop(now) {
      step(now); draw(now);
      // keep the loop alive for the name animation even when motion is reduced
      if ((!reduced || spell) && visible && !document.hidden) raf = requestAnimationFrame(loop);
      else running = false;
    }
    const start = () => {
      if (running || !visible || document.hidden) return;
      if (reduced && !spell) { still(); return; }
      running = true; raf = requestAnimationFrame(loop);
    };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const still = () => { step(performance.now()); draw(); };

    readColors(); layout(); still();

    const ro = new ResizeObserver(() => { layout(); if (!running) still(); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) start(); else stop(); });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);
    const onTheme = () => { readColors(); if (!running) still(); };
    window.addEventListener('themechange', onTheme);

    const localPoint = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const nodeAt = (p, radius) => {
      let hit = -1; let bd = radius;
      nodes.forEach((n, i) => { const d = Math.hypot(p.x - n.sx, p.y - n.sy); if (d < bd) { bd = d; hit = i; } });
      return hit;
    };
    const onMove = (e) => {
      const p = localPoint(e);
      mouse.x = p.x; mouse.y = p.y; mouse.active = true;
      mouse.nx = (mouse.x - cx) / (w / 2); mouse.ny = (mouse.y - cy) / (h / 2);
      canvas.style.cursor = !spell && nodeAt(p, 22) >= 0 ? 'pointer' : '';
    };
    const onLeave = () => { mouse.active = false; };
    const onClick = (e) => {
      const p = localPoint(e);
      if (spell) { endSpell(performance.now()); return; }
      const hit = nodeAt(p, touch ? 30 : 22);
      if (hit >= 0) startSpell(hit);
    };
    const onSpellRequest = () => { if (spell) endSpell(performance.now()); else startSpell(coreIndex); };

    if (!touch) {
      hero.addEventListener('pointermove', onMove);
      hero.addEventListener('pointerleave', onLeave);
    }
    canvas.addEventListener('click', onClick);
    window.addEventListener('nn-spell', onSpellRequest);
    start();

    return () => {
      stop(); ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('themechange', onTheme);
      window.removeEventListener('nn-spell', onSpellRequest);
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('click', onClick);
      hero.classList.remove('nn-spelling');
    };
  }, []);

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
        <filter id="nn-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" result="goo" />
        </filter>
      </svg>
      <canvas ref={liquidRef} className="nn-liquid" aria-hidden="true" />
      <canvas ref={canvasRef} className="nn-canvas" aria-hidden="true" />
    </>
  );
}
