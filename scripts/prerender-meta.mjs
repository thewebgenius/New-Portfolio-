// Runs after `npm run build`. Writes build/lab/kmeans/index.html: a copy of the app shell whose
// <title>, description, canonical and social tags describe the playground, so search engines and
// link previews see the right page without running JavaScript.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const SITE = 'https://shubhamportfolio743.netlify.app';
const html = await readFile('build/index.html', 'utf8');

const title = 'K-Means Image Compression Playground | Shivam Kumar Sah';
const desc = 'Compress any photo to a handful of colours with K-Means, right in your browser. Compare against uniform quantization, see PSNR, SSIM and the elbow plot. By Shivam Kumar Sah.';
const url = `${SITE}/lab/kmeans`;

const ld = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'K-Means Image Compression Playground',
  url,
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Any (runs in the browser)',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: { '@id': `${SITE}/#person` },
  isPartOf: { '@id': `${SITE}/#website` },
  description: desc,
};

const page = html
  .replace(/<title>[\s\S]*?<\/title>/, `<title>${title.replace('&', '&amp;')}</title>`)
  .replace(/(<meta name="description" content=")[^"]*(")/, `$1${desc}$2`)
  .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
  .replace(/(<meta property="og:type" content=")[^"]*(")/, '$1website$2')
  .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
  .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${desc}$2`)
  .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
  .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`)
  .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${desc}$2`)
  .replace('</head>', `<script type="application/ld+json">${JSON.stringify(ld)}</script></head>`);

await mkdir('build/lab/kmeans', { recursive: true });
await writeFile('build/lab/kmeans/index.html', page);
// also kmeans.html, so hosts without directory indexes serve /lab/kmeans directly
await writeFile('build/lab/kmeans.html', page);
console.log('prerender-meta: wrote build/lab/kmeans/index.html');
