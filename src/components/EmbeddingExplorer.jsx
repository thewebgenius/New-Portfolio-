import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { cssVar, prefersReducedMotion } from '../hooks/useTheme';
import SectionHead from './SectionHead';

const CLASSES = [
  { key: 'ne', name: 'Nepali', varName: '--c-ne' },
  { key: 'en', name: 'English', varName: '--c-en' },
  { key: 'mixed', name: 'Code-mixed', varName: '--c-mixed' },
];

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  // solid core with a soft halo, so points glow slightly against the backdrop
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.42, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function EmbeddingExplorer() {
  const mountRef = useRef(null);
  const apiRef = useRef({});
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState({});
  const [tip, setTip] = useState(null);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    const mount = mountRef.current;
    let disposed = false;
    let raf = 0; let visible = true;
    const reduced = prefersReducedMotion();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
    camera.position.set(1.8, 1.2, 2.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = !reduced;
    controls.autoRotateSpeed = 0.6;
    controls.minDistance = 0.8; controls.maxDistance = 6;
    controls.addEventListener('start', () => { controls.autoRotate = false; });

    const grid = new THREE.GridHelper(2.4, 12);
    grid.position.y = -1.1;
    scene.add(grid);
    // faint bounding cube gives the space some depth
    const box = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.4, 2.2, 2.4)),
      new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35 })
    );
    scene.add(box);
    // three short axes from the corner
    const axes = new THREE.AxesHelper(0.5);
    axes.position.set(-1.2, -1.1, -1.2);
    scene.add(axes);

    const groups = {};
    const tex = dotTexture();

    const applyTheme = () => {
      const dark = document.documentElement.getAttribute('data-mode') === 'train';
      const gridColor = cssVar('--emb-grid') || '#c9cfdb';
      grid.material.color = new THREE.Color(gridColor);
      grid.material.opacity = dark ? 0.55 : 0.7; grid.material.transparent = true;
      box.material.color = new THREE.Color(gridColor);
      CLASSES.forEach((c) => {
        const g = groups[c.key];
        if (!g) return;
        g.material.color = new THREE.Color(cssVar(c.varName));
        g.material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        g.material.needsUpdate = true;
      });
    };

    const resize = () => {
      const w = mount.clientWidth; const h = mount.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize); ro.observe(mount); resize();

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 0.035;
    const pointer = new THREE.Vector2();
    let pointsData = {};

    const onMove = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const targets = Object.values(groups).filter((g) => g.visible);
      const hit = raycaster.intersectObjects(targets)[0];
      if (hit) {
        const key = hit.object.userData.key;
        const p = pointsData[key][hit.index];
        setTip({ x: e.clientX - r.left, y: e.clientY - r.top, text: p.text, label: key });
      } else setTip(null);
    };
    const onLeave = () => setTip(null);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerleave', onLeave);

    fetch('/data/embeddings.json')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json) => {
        if (disposed) return;
        const points = Array.isArray(json) ? json : json.points;
        const info = Array.isArray(json) ? { placeholder: false } : json;
        const c = {};
        CLASSES.forEach((cls) => {
          const pts = points.filter((p) => p.label === cls.key);
          c[cls.key] = pts.length;
          pointsData[cls.key] = pts;
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3));
          const mat = new THREE.PointsMaterial({ size: 0.085, map: tex, transparent: true, depthWrite: false, sizeAttenuation: true });
          const obj = new THREE.Points(geo, mat);
          obj.userData.key = cls.key;
          groups[cls.key] = obj;
          scene.add(obj);
        });
        applyTheme();
        setCounts(c);
        setMeta(info);
      })
      .catch((err) => setError(`Could not load the embedding data (${err.message}).`));

    const onTheme = () => applyTheme();
    window.addEventListener('themechange', onTheme);

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(mount);

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    apiRef.current.setVisible = (key, v) => { if (groups[key]) groups[key].visible = v; };

    return () => {
      disposed = true;
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      window.removeEventListener('themechange', onTheme);
      controls.dispose();
      Object.values(groups).forEach((g) => { g.geometry.dispose(); g.material.dispose(); });
      box.geometry.dispose(); box.material.dispose(); grid.geometry.dispose(); grid.material.dispose();
      tex.dispose(); renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  const toggle = (key) => {
    const next = { ...hidden, [key]: !hidden[key] };
    setHidden(next);
    apiRef.current.setVisible?.(key, !next[key]);
  };

  return (
    <section className="section">
      <div className="container">
        <SectionHead title="How the sentences sit in embedding space">
          Each dot is a sentence, placed by a multilingual sentence encoder and squeezed into 3D with UMAP.
          Drag to rotate, scroll to zoom, hover a dot to read the sentence.
        </SectionHead>

        <div className="emb-wrap">
          <div className="emb-legend" role="group" aria-label="Show or hide classes">
            {CLASSES.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`legend-btn lg-${c.key} ${hidden[c.key] ? 'off' : ''}`}
                aria-pressed={!hidden[c.key]}
                onClick={() => toggle(c.key)}
              >
                <span className="swatch" aria-hidden="true" />
                {c.name}{counts[c.key] != null ? <span className="count">{counts[c.key]}</span> : null}
              </button>
            ))}
          </div>
          <div className="emb-stage" ref={mountRef}>
            {!meta && !error ? <div className="emb-loading"><span className="spinner" /> Loading points…</div> : null}
            {error ? <p className="pg-error emb-error">{error}</p> : null}
            {tip ? (
              <div className="emb-tip" style={{ left: tip.x, top: tip.y }}>
                <span className={`emb-tip-label lg-${tip.label}`}>{CLASSES.find((c) => c.key === tip.label)?.name}</span>
                {tip.text}
              </div>
            ) : null}
          </div>
          <p className="emb-caption">
            {meta?.placeholder ? (
              <><strong>Placeholder data.</strong> These clusters are synthetic, to show how the explorer works.
                The real plot will come from the paper's sentences using <code>scripts/make_embeddings.py</code>.{' '}</>
            ) : null}
            {meta && !meta.placeholder ? <>Model: <code>{meta.model}</code>. </> : null}
            UMAP to 3 dimensions with {meta?.umap?.n_neighbors ?? 15} neighbours, min_dist {meta?.umap?.min_dist ?? 0.1}, cosine distance.
          </p>
        </div>
      </div>
    </section>
  );
}
