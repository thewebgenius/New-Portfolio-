import { config } from '../config';

// Same tokenizer as the paper: words (with optional apostrophe suffix) or single non-space symbols.
const TOKEN_RE = /[A-Za-z0-9]+(?:'[A-Za-z]+)?|[^\w\s]/gu;
export const tokenize = (text) => text.match(TOKEN_RE) || [];

// ---------- Fallback: simple rule-based baseline (NOT the trained model) ----------
// Used only when no model endpoint is configured or the endpoint is unreachable.
const EN_WORDS = new Set(`a about after again all also am an and any are as at be because been before being best
better big book but by call can car class college come could day did do does done down easy enjoy even every
exam excellent family fan feel few film final find first for friend from fun funny game get give go good great
had happy has have he hello help her here hi him his home hope how i if in is it its job just know last later
let life like little live lol long look love made make man many match me mind miss mobile money more morning
most movie much music my name need never new news next nice night no not now of off oh ok okay on once one only
or other our out over party people phone play please post really right sad same say school see she should show
sir so some song sorry start still stop story study such super sure team test text than thank thanks that the
their them then there these they thing think this time to today too true try under up us very video want was
watch way we weather well were what when where which who why will win winner wifi with work world would wow
year yes you your youtube update traffic office meeting online shopping mix models model language english nepali
awesome amazing cool bro dude bad sweet nice best worst seriously really actually`.split(/\s+/));

export function baselineTag(text) {
  return tokenize(text).map((token) => {
    if (!/[A-Za-z]/.test(token)) return { token, label: 'OTHER', score: 0.99 };
    const lower = token.toLowerCase();
    if (EN_WORDS.has(lower)) return { token, label: 'EN', score: 0.7 };
    return { token, label: 'NE', score: 0.55 };
  });
}

// ---------- Live model ----------
function fetchWithTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

// Accepts either our Space format {tokens:[{token,label,score}]}
// or the HF token-classification format [{word, entity|entity_group, score, start, end}].
function normalise(text, data) {
  if (data && Array.isArray(data.tokens)) return data.tokens;
  if (Array.isArray(data)) {
    return data.map((d) => ({
      token: d.word ? d.word.replace(/^▁/, '') : text.slice(d.start, d.end),
      label: String(d.entity_group || d.entity || '').replace(/^[BI]-/, '').toUpperCase(),
      score: d.score,
    }));
  }
  throw new Error('Unexpected response from the model.');
}

export async function modelTag(text, onWaking) {
  const base = config.taggerEndpoint.replace(/\/$/, '');
  const url = /\/predict$/.test(base) || /api-inference|endpoints\.huggingface/.test(base) ? base : `${base}/predict`;
  const body = JSON.stringify(/api-inference|endpoints\.huggingface/.test(base) ? { inputs: text } : { text });
  const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body };

  try {
    const res = await fetchWithTimeout(url, opts, 12000);
    if (res.status === 503) throw Object.assign(new Error('waking'), { waking: true });
    if (!res.ok) throw new Error(`The model returned an error (${res.status}).`);
    return normalise(text, await res.json());
  } catch (err) {
    // Free Spaces sleep after inactivity; the first request can take up to a minute.
    if (err.waking || err.name === 'AbortError') {
      onWaking?.();
      const res = await fetchWithTimeout(url, opts, 75000);
      if (!res.ok) throw new Error(`The model is still starting (${res.status}). Try again in a minute.`);
      return normalise(text, await res.json());
    }
    throw err;
  }
}
