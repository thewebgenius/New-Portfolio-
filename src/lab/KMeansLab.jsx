import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { config } from '../config';
import './lab.css';

const SAMPLES = [
  { id: 'landscape', label: 'Landscape', src: '/samples/landscape.jpg', credit: 'Photo: danielbuechele, CC BY 2.0' },
  { id: 'food', label: 'Food', src: '/samples/food.jpg', credit: 'Photo: Rachel Michetti, CC0' },
  { id: 'space', label: 'Space', src: '/samples/space.jpg', credit: 'Hubble eXtreme Deep Field, NASA (public domain)' },
  { id: 'human', label: 'Original post', src: '/samples/human.jpg', credit: 'The photo from my original LinkedIn post (132,666 colours)' },
];
const MAX_BYTES = 10 * 1024 * 1024;
const DISPLAY_MAX = 1600; // longest side shown and repainted
const CLUSTER_MAX = 400;  // longest side used for clustering
const ELBOW_KS = [2, 4, 8, 16, 32, 64];
const FIXED_SEED = 42;

const fmt = (n) => n.toLocaleString('en-US');
const hex = (p) => `#${[p.r, p.g, p.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const fmtDb = (v) => (Number.isFinite(v) ? `${v.toFixed(2)} dB` : '∞');
const bitsFor = (k) => Math.max(1, Math.ceil(Math.log2(Math.max(2, k))));
const ratioFor = (px, k) => (24 * px) / (px * bitsFor(k) + 24 * k);

function toImageData(source, maxSide) {
  const w0 = source.width; const h0 = source.height;
  const s = Math.min(1, maxSide / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * s)); const h = Math.max(1, Math.round(h0 * s));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

async function decode(blobOrUrl) {
  if (typeof blobOrUrl === 'string') {
    const img = new Image();
    img.decoding = 'async';
    img.src = blobOrUrl;
    await img.decode();
    return img;
  }
  if (window.createImageBitmap) return createImageBitmap(blobOrUrl);
  const url = URL.createObjectURL(blobOrUrl);
  const img = new Image(); img.src = url; await img.decode(); URL.revokeObjectURL(url);
  return img;
}

function paint(canvas, buffer, w, h) {
  if (!canvas) return;
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(buffer), w, h), 0, 0);
}

function download(canvas, name) {
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}

/* ---------------- before / after slider ---------------- */
function Compare({ originalRef, compressedRef, uniformRef, view, width, height, rightLabel, busy }) {
  const [pos, setPos] = useState(50);
  const boxRef = useRef(null);
  const dragging = useRef(false);

  const setFromEvent = (e) => {
    const r = boxRef.current.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
  };
  const onDown = (e) => { dragging.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); setFromEvent(e); };
  const onMove = (e) => { if (dragging.current) setFromEvent(e); };
  const onUp = () => { dragging.current = false; };
  const onKey = (e) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft') { e.preventDefault(); setPos((p) => Math.max(0, p - step)); }
    if (e.key === 'ArrowRight') { e.preventDefault(); setPos((p) => Math.min(100, p + step)); }
    if (e.key === 'Home') setPos(0);
    if (e.key === 'End') setPos(100);
  };

  return (
    <div
      className={`km-compare ${busy ? 'is-busy' : ''}`}
      ref={boxRef}
      style={{ aspectRatio: `${width} / ${height}` }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <canvas ref={originalRef} className="km-layer" aria-label="Original image" role="img" />
      <canvas
        ref={compressedRef}
        className="km-layer km-top"
        style={{ clipPath: `inset(0 0 0 ${pos}%)`, visibility: view === 'kmeans' ? 'visible' : 'hidden' }}
        aria-label="K-Means compressed image"
        role="img"
      />
      <canvas
        ref={uniformRef}
        className="km-layer km-top"
        style={{ clipPath: `inset(0 0 0 ${pos}%)`, visibility: view === 'uniform' ? 'visible' : 'hidden' }}
        aria-label="Uniformly quantized image"
        role="img"
      />
      <span className="km-tag km-tag-left">Original</span>
      <span className="km-tag km-tag-right">{rightLabel}</span>
      <div className="km-divider" style={{ left: `${pos}%` }}>
        <button
          type="button"
          className="km-handle"
          role="slider"
          aria-label="Move the divider between original and compressed"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          onKeyDown={onKey}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      {busy ? <div className="km-busy"><span className="spinner" /> {busy}</div> : null}
    </div>
  );
}

/* ---------------- elbow plot ---------------- */
function Elbow({ points, currentK, loading, progress }) {
  const [hover, setHover] = useState(null);
  const W = 520; const H = 220; const pad = { l: 52, r: 16, t: 16, b: 36 };
  const geom = useMemo(() => {
    if (!points?.length) return null;
    const xs = (k) => pad.l + ((Math.log2(k) - 1) / 5) * (W - pad.l - pad.r);
    const max = Math.max(...points.map((p) => p.inertia));
    const ys = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
    // elbow = point farthest from the straight line between the first and last point (normalised)
    const nx = (k) => (Math.log2(k) - 1) / 5; const ny = (v) => v / max;
    const a = points[0]; const b = points[points.length - 1];
    let best = null; let bd = -1;
    points.forEach((p) => {
      const x0 = nx(p.k); const y0 = ny(p.inertia);
      const x1 = nx(a.k); const y1 = ny(a.inertia); const x2 = nx(b.k); const y2 = ny(b.inertia);
      const d = Math.abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1) / Math.hypot(y2 - y1, x2 - x1);
      if (d > bd) { bd = d; best = p; }
    });
    return { xs, ys, max, elbow: best };
  }, [points]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !geom) {
    return (
      <div className="km-elbow-skel">
        <span className="spinner" /> Computing inertia for K = 2, 4, 8, 16, 32, 64{progress ? ` (${progress})` : ''}…
      </div>
    );
  }
  const { xs, ys, max, elbow } = geom;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${xs(p.k).toFixed(1)},${ys(p.inertia).toFixed(1)}`).join(' ');
  const ticks = [0, 0.5, 1].map((t) => t * max);
  const cx = xs(Math.min(64, Math.max(2, currentK)));

  return (
    <figure className="km-elbow">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Elbow plot. The curve flattens around K equals ${elbow.k}.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={ys(t)} y2={ys(t)} className="km-grid" />
            <text x={pad.l - 8} y={ys(t) + 4} className="km-axis" textAnchor="end">{t >= 1000 ? `${(t / 1000).toFixed(1)}k` : Math.round(t)}</text>
          </g>
        ))}
        {points.map((p) => (
          <text key={p.k} x={xs(p.k)} y={H - pad.b + 20} className="km-axis" textAnchor="middle">{p.k}</text>
        ))}
        <text x={W - pad.r} y={H - 4} className="km-axis" textAnchor="end">K (log scale)</text>
        <line x1={cx} x2={cx} y1={pad.t} y2={H - pad.b} className="km-current" />
        <text x={cx + 6} y={pad.t + 10} className="km-current-label">K = {currentK}</text>
        <path d={path} className="km-line" />
        {points.map((p) => (
          <g key={p.k} onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)}>
            <circle cx={xs(p.k)} cy={ys(p.inertia)} r="14" fill="transparent" />
            <circle cx={xs(p.k)} cy={ys(p.inertia)} r={p === elbow ? 6 : 4} className={p === elbow ? 'km-dot km-dot-elbow' : 'km-dot'} />
          </g>
        ))}
        <text x={xs(elbow.k) + 10} y={ys(elbow.inertia) - 10} className="km-elbow-label">elbow ≈ K {elbow.k}</text>
        {hover ? (
          <g transform={`translate(${Math.min(xs(hover.k) + 10, W - 150)}, ${Math.max(ys(hover.inertia) - 44, 4)})`}>
            <rect width="138" height="36" rx="4" className="km-tip-bg" />
            <text x="8" y="15" className="km-tip-text">K = {hover.k}</text>
            <text x="8" y="29" className="km-tip-text">inertia {hover.inertia.toFixed(1)}</text>
          </g>
        ) : null}
      </svg>
      <figcaption>
        Inertia is the average squared distance from each pixel to its cluster colour. Past the elbow, adding colours buys
        much less error reduction per colour.
      </figcaption>
    </figure>
  );
}

/* ---------------- main ---------------- */
export default function KMeansLab() {
  const runWorker = useRef(null);
  const elbowWorker = useRef(null);
  const origCanvas = useRef(null);
  const outCanvas = useRef(null);
  const uniCanvas = useRef(null);
  const kmCanvasBuf = useRef(null);
  const fileInput = useRef(null);

  const [image, setImage] = useState(null); // { name, width, height, uniqueOriginal, credit }
  const [k, setK] = useState(16);
  const [space, setSpace] = useState('rgb');
  const [seeded, setSeeded] = useState(true);
  const [view, setView] = useState('kmeans'); // kmeans | uniform
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [elbow, setElbow] = useState({ loading: false, points: null, progress: '' });
  const [copied, setCopied] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const runId = useRef(0);
  const inFlight = useRef(false);
  const pending = useRef(null);
  const elbowId = useRef(0);
  const elbowVisible = useRef(false);
  const elbowRef = useRef(null);
  const latestParams = useRef({ k, space, seeded });
  latestParams.current = { k, space, seeded };

  const sendRun = useCallback((params) => {
    if (!runWorker.current) return;
    if (inFlight.current) { pending.current = params; return; }
    inFlight.current = true;
    runId.current += 1;
    runWorker.current.postMessage({
      type: 'run', id: runId.current, k: params.k, space: params.space,
      seed: params.seeded ? FIXED_SEED : null,
    });
  }, []);

  const requestElbow = useCallback(() => {
    if (!elbowWorker.current || !image) return;
    elbowId.current += 1;
    setElbow({ loading: true, points: null, progress: '' });
    elbowWorker.current.postMessage({ type: 'elbow', id: elbowId.current, space: latestParams.current.space, seed: FIXED_SEED, ks: ELBOW_KS });
  }, [image]);

  // workers
  useEffect(() => {
    const w = new Worker(new URL('./kmeans.worker.js', import.meta.url));
    const e = new Worker(new URL('./kmeans.worker.js', import.meta.url));
    runWorker.current = w; elbowWorker.current = e;
    w.onmessage = ({ data }) => {
      if (data.type === 'progress') { setBusy(data.stage); return; }
      if (data.type === 'loaded') {
        setImage((im) => (im ? { ...im, uniqueOriginal: data.uniqueColors } : im));
        return;
      }
      if (data.type === 'error') { inFlight.current = false; setBusy(''); setError(data.message); return; }
      if (data.type === 'result') {
        inFlight.current = false;
        kmCanvasBuf.current = data;
        paint(outCanvas.current, data.kmeans.pixels, data.width, data.height);
        paint(uniCanvas.current, data.uniform.pixels, data.width, data.height);
        setResult({
          k: data.k, space: data.space, ms: data.ms, iterations: data.iterations,
          kmeans: { ...data.kmeans, pixels: undefined }, uniform: { ...data.uniform, pixels: undefined },
        });
        if (pending.current) { const p = pending.current; pending.current = null; sendRun(p); } else setBusy('');
      }
    };
    e.onmessage = ({ data }) => {
      if (data.type === 'elbow-progress' && data.id === elbowId.current) setElbow((s) => ({ ...s, progress: `${data.done}/${data.total}` }));
      if (data.type === 'elbow' && data.id === elbowId.current) setElbow({ loading: false, points: data.points, progress: '' });
    };
    return () => { w.terminate(); e.terminate(); };
  }, [sendRun]);

  const loadSource = useCallback(async (source, meta) => {
    setError('');
    setBusy('Reading the image…');
    try {
      const bitmap = await decode(source);
      if (!bitmap.width || !bitmap.height) throw new Error('That image has no pixels.');
      const full = toImageData(bitmap, DISPLAY_MAX);
      const small = toImageData(bitmap, CLUSTER_MAX);
      paint(origCanvas.current, full.data.buffer.slice(0), full.width, full.height);
      setImage({ ...meta, width: full.width, height: full.height, srcWidth: bitmap.width, srcHeight: bitmap.height, uniqueOriginal: null });
      setResult(null);
      const smallCopy = small.data.buffer.slice(0);
      runWorker.current.postMessage({ type: 'load', id: 0, full: { width: full.width, height: full.height, data: full.data.buffer }, small: { width: small.width, height: small.height, data: small.data.buffer } }, [full.data.buffer, small.data.buffer]);
      elbowWorker.current.postMessage({ type: 'load', id: 0, full: { width: 1, height: 1, data: new Uint8ClampedArray(4).buffer }, small: { width: small.width, height: small.height, data: smallCopy } }, [smallCopy]);
      inFlight.current = false; pending.current = null;
      sendRun(latestParams.current);
    } catch (err) {
      setBusy('');
      setError(`Could not open that image (${err.message || 'unknown error'}). Try a JPG, PNG or WebP under 10 MB.`);
    }
  }, [sendRun]);

  // page title when reached through client-side routing
  useEffect(() => {
    const prev = document.title;
    document.title = 'K-Means Image Compression Playground | Shivam Kumar Sah';
    return () => { document.title = prev; };
  }, []);

  // first sample on mount
  useEffect(() => { loadSource(SAMPLES[0].src, { name: SAMPLES[0].label, credit: SAMPLES[0].credit, sample: SAMPLES[0].id }); }, [loadSource]);

  // debounced re-run when K / space / seed change
  useEffect(() => {
    if (!image) return undefined;
    const t = setTimeout(() => sendRun({ k, space, seeded }), 200);
    return () => clearTimeout(t);
  }, [k, space, seeded]); // eslint-disable-line react-hooks/exhaustive-deps

  // elbow: compute lazily when visible, and again when the image or colour space changes
  useEffect(() => {
    const el = elbowRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !elbowVisible.current) { elbowVisible.current = true; requestElbow(); }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [requestElbow]);
  useEffect(() => { if (elbowVisible.current && image) requestElbow(); }, [image?.name, space]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFiles = (files) => {
    const f = files?.[0];
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setError('That file type is not supported. Use a JPG, PNG or WebP image.'); return; }
    if (f.size > MAX_BYTES) { setError(`That file is ${(f.size / 1048576).toFixed(1)} MB. The limit is 10 MB.`); return; }
    loadSource(f, { name: f.name, credit: 'Your image', sample: null });
  };

  const copyHex = async (h) => {
    try { await navigator.clipboard.writeText(h); setCopied(h); setTimeout(() => setCopied(''), 1400); } catch (e) { setCopied(''); }
  };

  const downloadPalette = () => {
    if (!result) return;
    const pal = result.kmeans.palette;
    const sw = 96; const c = document.createElement('canvas');
    const cols = Math.min(pal.length, 8); const rows = Math.ceil(pal.length / cols);
    c.width = cols * sw; c.height = rows * (sw + 28);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    pal.forEach((p, i) => {
      const x = (i % cols) * sw; const y = Math.floor(i / cols) * (sw + 28);
      ctx.fillStyle = hex(p); ctx.fillRect(x, y, sw, sw);
      ctx.fillStyle = '#141821'; ctx.font = '13px monospace'; ctx.fillText(hex(p), x + 8, y + sw + 18);
    });
    download(c, `palette-k${result.k}.png`);
  };

  const downloadCompressed = () => {
    const src = view === 'uniform' ? uniCanvas.current : outCanvas.current;
    if (src) download(src, `${view === 'uniform' ? 'uniform' : 'kmeans'}-k${result?.k ?? k}.png`);
  };

  const downloadShare = () => {
    if (!result || !origCanvas.current || !outCanvas.current) return;
    const o = origCanvas.current; const q = outCanvas.current;
    const s = Math.min(1, 800 / Math.max(o.width, o.height));
    const w = Math.round(o.width * s); const h = Math.round(o.height * s);
    const gap = 16; const capH = 64;
    const c = document.createElement('canvas'); c.width = w * 2 + gap * 3; c.height = h + gap * 2 + capH;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(o, gap, gap, w, h); ctx.drawImage(q, gap * 2 + w, gap, w, h);
    ctx.fillStyle = '#141821'; ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`K-Means colour compression, K = ${result.k}${result.space === 'lab' ? ' (CIELAB)' : ''}`, gap, h + gap + 30);
    ctx.font = '15px sans-serif'; ctx.fillStyle = '#5b6273';
    ctx.fillText(`${image?.uniqueOriginal ? fmt(image.uniqueOriginal) : '?'} → ${fmt(result.kmeans.unique)} colours · PSNR ${fmtDb(result.kmeans.psnr)} · SSIM ${result.kmeans.ssim.toFixed(3)}`, gap, h + gap + 52);
    ctx.textAlign = 'right'; ctx.fillText(window.location.host, c.width - gap, h + gap + 52);
    download(c, `kmeans-k${result.k}-comparison.png`);
  };

  const active = result ? result[view] : null;
  const pixels = image ? image.width * image.height : 0;

  return (
    <div className="km-page">
      <section className="km-hero">
        <div className="container">
          <p className="km-crumb"><a href="/">Shivam Kumar Sah</a> / Lab</p>
          <h1 className="km-title">K-Means image compression</h1>
          <p className="km-lede">
            One of my LinkedIn posts showed a photo with 132,666 colours squeezed down to 16 using K-Means. It reached
            over 211,000 impressions, so I turned it into something you can try on your own pictures.
          </p>
          <p className="km-privacy">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 11V8a5 5 0 0110 0v3M5 11h14v10H5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
            Your image is processed locally and never uploaded.
          </p>
        </div>
      </section>

      <section className="km-workbench">
        <div className="container km-grid">
          <div className="km-left">
            <div
              className={`km-drop ${dragOver ? 'over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files); }}
            >
              <p><strong>Drop an image here</strong> or <button type="button" className="link-btn" onClick={() => fileInput.current?.click()}>choose a file</button> (JPG, PNG or WebP, up to 10 MB).</p>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
              <div className="km-samples" role="group" aria-label="Sample images">
                <span>Or try a sample:</span>
                {SAMPLES.map((s) => (
                  <button key={s.id} type="button" className={`km-sample ${image?.sample === s.id ? 'on' : ''}`} onClick={() => { if (s.id === 'human') setK(16); loadSource(s.src, { name: s.label, credit: s.credit, sample: s.id }); }}>
                    <img src={s.src} alt="" width="28" height="28" />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            {error ? <p className="km-error" role="alert">{error}</p> : null}

            <Compare
              originalRef={origCanvas}
              compressedRef={outCanvas}
              uniformRef={uniCanvas}
              view={view}
              width={image?.width || 3}
              height={image?.height || 2}
              rightLabel={view === 'kmeans' ? `K-Means, ${result?.k ?? k} colours` : `Uniform, ≤${result?.k ?? k} colours`}
              busy={busy}
            />
            <p className="km-credit">
              {image ? `${image.credit}. ` : ''}
              {image && (image.srcWidth > image.width) ? `Shown at ${image.width}×${image.height} (original ${image.srcWidth}×${image.srcHeight}). ` : ''}
              Drag the divider or use the arrow keys.
            </p>
          </div>

          <aside className="km-right">
            <div className="km-control">
              <label htmlFor="km-k" className="km-k-label">
                Colours (K) <output htmlFor="km-k" className="km-k-value">{k}</output>
              </label>
              <input id="km-k" type="range" min="2" max="64" step="1" value={k} onChange={(e) => setK(Number(e.target.value))} style={{ '--fill': `${((k - 2) / 62) * 100}%` }} />
              <div className="km-k-scale" aria-hidden="true"><span>2</span><span>16</span><span>32</span><span>64</span></div>
            </div>

            <div className="km-toggles">
              <label className="km-switch">
                <input type="checkbox" checked={space === 'lab'} onChange={(e) => setSpace(e.target.checked ? 'lab' : 'rgb')} />
                <span className="km-switch-ui" aria-hidden="true" />
                <span>Perceptual mode <small>cluster in CIELAB instead of RGB</small></span>
              </label>
              <label className="km-switch">
                <input type="checkbox" checked={seeded} onChange={(e) => setSeeded(e.target.checked)} />
                <span className="km-switch-ui" aria-hidden="true" />
                <span>Fixed random seed <small>same result every run</small></span>
              </label>
            </div>

            <div className="km-tabs" role="tablist" aria-label="Method">
              <button type="button" role="tab" aria-selected={view === 'kmeans'} className={view === 'kmeans' ? 'on' : ''} onClick={() => setView('kmeans')}>K-Means</button>
              <button type="button" role="tab" aria-selected={view === 'uniform'} className={view === 'uniform' ? 'on' : ''} onClick={() => setView('uniform')}>Uniform quantization</button>
            </div>

            <dl className="km-metrics" aria-live="polite">
              <div className="km-metric km-metric-wide">
                <dt>Unique colours</dt>
                <dd>
                  {image?.uniqueOriginal != null ? fmt(image.uniqueOriginal) : '…'}
                  <span className="km-arrow">→</span>
                  <strong>{active ? fmt(active.unique) : '…'}</strong>
                </dd>
              </div>
              <div className="km-metric"><dt>PSNR</dt><dd>{active ? fmtDb(active.psnr) : '…'}</dd></div>
              <div className="km-metric"><dt>SSIM</dt><dd>{active ? active.ssim.toFixed(3) : '…'}</dd></div>
              <div className="km-metric">
                <dt>
                  Compression
                  <span className="km-info" tabIndex={0} aria-describedby="km-ratio-tip">?
                    <span role="tooltip" id="km-ratio-tip" className="km-tooltip">
                      Raw size at 24 bits per pixel, divided by the palette-indexed size: {bitsFor(active?.unique || k)} bits per pixel
                      (enough to index {active?.unique || k} colours) plus 24 bits per palette colour. Not a real file size: PNG or JPEG
                      encoding would change it.
                    </span>
                  </span>
                </dt>
                <dd>{active && pixels ? `${ratioFor(pixels, active.unique).toFixed(1)}×` : '…'}</dd>
              </div>
              <div className="km-metric"><dt>Runtime</dt><dd>{result ? `${Math.round(result.ms)} ms` : '…'}</dd></div>
            </dl>

            <div className="km-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={downloadCompressed} disabled={!result}>Download compressed image</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={downloadShare} disabled={!result}>Download side-by-side</button>
            </div>
          </aside>
        </div>

        <div className="container">
          <div className="km-palette-head">
            <h2 className="km-h2">Palette</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={downloadPalette} disabled={!result}>Download palette as PNG</button>
          </div>
          <ul className="km-palette" aria-label="Dominant colours, sorted by share of pixels">
            {result?.kmeans.palette.map((p) => {
              const h = hex(p);
              return (
                <li key={h} style={{ flexGrow: Math.max(p.share * 100, 1.4) }}>
                  <button type="button" style={{ background: h }} onClick={() => copyHex(h)} aria-label={`${h}, ${(p.share * 100).toFixed(1)} percent of pixels. Click to copy.`}>
                    <span className="km-sw-tip">{copied === h ? 'Copied' : `${h} · ${(p.share * 100).toFixed(1)}%`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="km-fine">Widths show each colour's share of the pixels. Click a colour to copy its hex code.</p>
        </div>
      </section>

      <section className="km-section">
        <div className="container km-two">
          <div ref={elbowRef}>
            <h2 className="km-h2">How many colours is enough?</h2>
            <Elbow points={elbow.points} currentK={k} loading={elbow.loading || !elbow.points} progress={elbow.progress} />
          </div>
          <div>
            <h2 className="km-h2">K-Means against a uniform grid</h2>
            <p className="km-p">
              Uniform quantization cuts each colour channel into equal steps without looking at the image. K-Means puts its
              colours where the image&apos;s pixels actually are. Same colour budget, very different result.
            </p>
            <div className="table-scroll">
              <table className="km-table">
                <thead><tr><th scope="col">At K = {result?.k ?? k}</th><th scope="col">K-Means</th><th scope="col">Uniform</th></tr></thead>
                <tbody>
                  <tr><th scope="row">Colours used</th><td>{result ? fmt(result.kmeans.unique) : '…'}</td><td>{result ? `${fmt(result.uniform.unique)} (${result.uniform.levels.join('×')} grid)` : '…'}</td></tr>
                  <tr><th scope="row">PSNR</th><td className={result && result.kmeans.psnr >= result.uniform.psnr ? 'win' : ''}>{result ? fmtDb(result.kmeans.psnr) : '…'}</td><td className={result && result.uniform.psnr > result.kmeans.psnr ? 'win' : ''}>{result ? fmtDb(result.uniform.psnr) : '…'}</td></tr>
                  <tr><th scope="row">SSIM</th><td className={result && result.kmeans.ssim >= result.uniform.ssim ? 'win' : ''}>{result ? result.kmeans.ssim.toFixed(3) : '…'}</td><td className={result && result.uniform.ssim > result.kmeans.ssim ? 'win' : ''}>{result ? result.uniform.ssim.toFixed(3) : '…'}</td></tr>
                </tbody>
              </table>
            </div>
            <button type="button" className="link-btn" onClick={() => { setView(view === 'kmeans' ? 'uniform' : 'kmeans'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              {view === 'kmeans' ? 'Show the uniform result in the slider' : 'Show the K-Means result in the slider'}
            </button>
            <p className="km-fine">PSNR: higher is closer to the original. SSIM: structural similarity on brightness, measured over 8×8 blocks (1.0 means identical).</p>
          </div>
        </div>
      </section>

      <section className="km-section km-writeup">
        <div className="container">
          <h2 className="km-h2">Notes</h2>
          <div className="km-notes">
            <div>
              <h3>What it is</h3>
              <p>Every pixel is a point in 3D colour space. K-Means finds K colours that sit in the middle of the crowds of pixels, then repaints each pixel with the closest one. The picture keeps its shapes; only the number of colours drops.</p>
            </div>
            <div>
              <h3>How it works</h3>
              <p>Pick K starting colours with k-means++ (spread out on purpose). Assign every pixel to its nearest centroid. Move each centroid to the average of its pixels. Repeat until little changes, at most 20 rounds. Clustering runs on a copy of at most 400 px; the centroids are then applied to the full image.</p>
            </div>
            <div>
              <h3>What I learned</h3>
              <p>Photos look like they need thousands of colours, but most of them are tiny variations of a few. Around 16 colours is often where the image stops visibly improving, which the elbow plot shows. Clustering in CIELAB tends to keep skin tones and skies smoother, because distance there tracks what the eye notices.</p>
            </div>
            <div>
              <h3>Limitations</h3>
              <p>K-Means only looks at colour, not at where pixels are, so it ignores edges and textures and produces banding in smooth gradients. It is a colour-quantization demo, not a real image codec like JPEG or WebP, and the compression ratio above is an estimate of raw palette-indexed size.</p>
            </div>
          </div>
          <p className="km-links">
            <a href={config.kmeansPostUrl} target="_blank" rel="noreferrer">The original LinkedIn post</a>
            <a href={config.kmeansRepoUrl} target="_blank" rel="noreferrer">Code on GitHub</a>
            <a href="/#research">Back to my research</a>
          </p>
        </div>
      </section>
    </div>
  );
}
