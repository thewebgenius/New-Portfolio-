# Shivam Kumar Sah — portfolio

React (Create React App), deployed as a static site (Netlify). No paid backend.

```bash
npm install
npm start          # dev server on http://localhost:3000
npm run build      # static build in ./build
```

All text, numbers and links live in **`src/data/portfolioData.js`**. Site settings are in
**`src/config.js`** and can be set with a `.env` file:

```
REACT_APP_GITHUB_USER=thewebgenius
REACT_APP_HF_USER=                 # optional, Hugging Face username
REACT_APP_TAGGER_ENDPOINT=         # URL of the Hugging Face Space, once deployed
```

## How each feature works

**1. Train / Inference mode** (`src/hooks/useTheme.js`, `Nav.jsx`, `LossCurve.jsx`)
Every colour is a CSS variable in `src/styles/App.css`. The mode is stored on `<html data-mode>`;
an inline script in `public/index.html` sets it before first paint (saved choice, else the system
light/dark setting). Switching adds a 300 ms colour transition. Train mode swaps headings to
JetBrains Mono, adds the blinking cursor, and draws a faint loss curve under the navbar.

**2. Neural-network hero** (`NeuralBackground.jsx`)
A 4-6-6-3 network on a canvas (3-5-5-2 on touch or low-end devices). Pulses travel layer to layer.
Nodes lean toward the pointer and hovering a node fires a pulse. Colours come from `--nn-*`
variables. The loop stops when the hero is off-screen or the tab is hidden, and draws a still frame
when the visitor prefers reduced motion.

**3. Command palette** (`CommandPalette.jsx`, `src/lib/fuzzy.js`)
Ctrl+K / Cmd+K, or the Search button (an icon on mobile). Fuzzy search over sections, projects,
links and actions. Terminal commands: `help`, `whoami`, `stats`, `run --project <lid|smartbinx|skin|mvbs|iot>`,
`sudo hire shivam`, `clear`.

**4. GitHub stats** (`GitHubStats.jsx`, `scripts/fetch-github-stats.mjs`, `.github/workflows/github-stats.yml`)
The GitHub Action runs daily, writes `public/stats.json` (repos, stars, languages by bytes,
contribution calendar, latest 5 repos, optional Hugging Face counts) and commits it, which also
triggers a Netlify rebuild. Until that file exists the page calls the public GitHub API directly
(3 requests per visit); if that fails too, it shows a link to GitHub instead.
Run it locally with `GITHUB_TOKEN=... npm run stats`.

**5. 3D embedding explorer** (`EmbeddingExplorer.jsx`)
Three.js loads only when the section comes near the screen. It reads `public/data/embeddings.json`.
**The current file is placeholder data** and the page says so. To make the real one:

```bash
pip install sentence-transformers umap-learn pandas
python scripts/make_embeddings.py sentences.csv     # CSV with columns: text,label (ne|en|mixed)
```

**6. Code-switch tagger playground** (`Playground.jsx`, `src/lib/tagger.js`, `hf-space/`)
Until `REACT_APP_TAGGER_ENDPOINT` is set, the playground runs a small word-list baseline and labels
it clearly as *not* the trained model. To connect the real model, deploy `hf-space/` as a Hugging
Face Docker Space (steps in `hf-space/README.md`), then set the endpoint and rebuild. The client
handles the "model is waking up" case (free Spaces sleep) with a longer retry.
Phase 2 (in-browser ONNX with Transformers.js) is not built yet.

**Chat assistant** (`ChatAssistant.jsx`, `src/lib/assistantBrain.js`)
Runs entirely in the browser. It matches the question to a topic (typo-tolerant), remembers which
project you were discussing so follow-ups like "how accurate is it?" work, and types its reply out
word by word. To change what it says, edit `assistantBrain.js`.

## Round 2 additions

**K-Means image compression playground** — a separate page at `/lab/kmeans` (`src/lab/`), linked from
the Research section, the navbar ("Lab") and the command palette (`run kmeans`). The page's code only
loads when someone visits it.
- `kmeans.worker.js` runs everything in Web Workers (one for the slider, one for the elbow plot), so the
  page never freezes: k-means++ init, at most 20 Lloyd iterations with early stopping, a fixed-seed
  toggle (seed 42), and RGB or CIELAB ("perceptual mode") clustering.
- Clustering runs on a copy of at most 400 px on its longest side; the centroids are then applied to the
  displayed image (capped at 1600 px so phones stay responsive) with a colour-lookup cache.
- Metrics: unique colours before/after, PSNR, SSIM (luma, 8×8 windows), estimated compression ratio
  (24 bits per pixel vs. ⌈log2 K⌉ bits per pixel plus the palette), runtime. Transparent pixels are
  compared as they look over white.
- Uniform quantization at the same colour budget for comparison, palette strip (click to copy hex,
  download as PNG), compressed-image and side-by-side downloads, elbow plot over K = 2…64.
- Sample images: `public/samples/` — landscape (danielbuechele, CC BY 2.0, via scikit-learn),
  food (Rachel Michetti, CC0, via scikit-image), space (Hubble eXtreme Deep Field, NASA, public domain).
  No photos of people.
- Tested with an 8×8 image, a 4000×3000 image, a greyscale PNG, a PNG with transparency, a non-image
  file, and K = 2 and K = 64.
- `public/_redirects` makes Netlify serve the app for `/lab/kmeans`. Other hosts need the same
  "all paths → index.html" rewrite.
- Set the real post and repo links with `REACT_APP_KMEANS_POST_URL` and `REACT_APP_KMEANS_REPO_URL`.

**3D touches**
- Hero network is now 3D (`NeuralBackground.jsx`): each layer is a ring of neurons, projected with
  perspective, swaying slowly and tilting toward the pointer. Still plain canvas, no WebGL.
- Name badge (`NameTag.jsx`): a lanyard ID card in the About section. Drag to swing it (small spring
  simulation), hover to tilt, click or Enter to flip it over.
- GitHub activity can be shown as 3D isometric bars or as the flat grid (`GitHubStats.jsx`).
- Embedding explorer has a lit backdrop, a bounding cube, axes and glowing points instead of flat black.

**Motion polish**
- Theme switch does a circular reveal from the switch (View Transitions API; plain fade elsewhere).
- Chat launcher uses a 🤖 emoji, springs out on hover, and the panel opens with a circular reveal.
- Hover effects on the hero name letters, links, buttons, project titles and figures; results tables
  slide in row by row, count their numbers up, and highlight the hovered row.
- Everything respects `prefers-reduced-motion`.

## Round 3 additions

- **SHIVAM in the hero network** (`NeuralBackground.jsx`): click any neuron (the glowing core one is marked
  with a breathing ring) and liquid in the neuron colour flows out of it, settles into new nodes, and the
  nodes join up to spell SHIVAM. It fades back into the network after a few seconds, or on the next click.
  The liquid is drawn on its own canvas with an SVG "goo" filter so drops merge like fluid. Keyboard users
  can Tab to a "Spell my name with the network" button. With reduced motion, the letters appear without the
  liquid.
- **Original LinkedIn photo in the lab**: `public/samples/human.jpg` is the original file (exactly
  132,666 colours). The "Original post" sample loads it and sets K = 16, reproducing the post.
- **SEO**: see `SEO.md` for the step-by-step guide. Code changes: `public/index.html` (title, description,
  canonical, Open Graph/Twitter, JSON-LD `ProfilePage` + `Person` + `WebSite`, noscript content),
  `public/robots.txt`, `public/sitemap.xml`, `public/site.webmanifest`, icons, `public/og-image.png`, and
  `scripts/prerender-meta.mjs` (runs after `npm run build`, gives `/lab/kmeans` its own static meta tags).

## Files you still need to provide

| What | Where | Why |
|---|---|---|
| Real sentence embeddings | `public/data/embeddings.json` | replace the placeholder (script above) |
| Fine-tuned XLM-R model + Space URL | `hf-space/`, `.env` | live tagger instead of the baseline |
| Hugging Face username (optional) | `.github/workflows/github-stats.yml`, `.env` | model/dataset counts |
| Exact LinkedIn post URL + K-Means GitHub repo | `.env` (`REACT_APP_KMEANS_POST_URL`, `REACT_APP_KMEANS_REPO_URL`) | links on the playground page |
| Paper figures (optional) | `public/images/projects/` | loss curve / confusion matrix for the LID project |

No API keys are needed. The GitHub Action uses the built-in `GITHUB_TOKEN`.
