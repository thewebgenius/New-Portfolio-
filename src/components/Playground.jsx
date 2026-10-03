import React, { useEffect, useState } from 'react';
import { config } from '../config';
import { baselineTag, modelTag } from '../lib/tagger';
import SectionHead from './SectionHead';

const EXAMPLES = [
  'Malai yo video ekdam funny lagyo 😂',
  'Aaja ko match ma team le dherai ramro khelyo, seriously best game!',
  'Office ko meeting cancel bhayo so ma ghar jandai chu',
  'Wifi slow cha yaar, youtube load nai hudaina',
];

const LABEL_NAMES = { NE: 'Nepali', EN: 'English', OTHER: 'Other' };

export default function Playground() {
  const live = Boolean(config.taggerEndpoint);
  const [text, setText] = useState(EXAMPLES[0]);
  const [state, setState] = useState({ status: 'idle', tokens: [], source: '', error: '' });

  const run = async (input) => {
    const value = (input ?? text).trim();
    if (!value) { setState({ status: 'error', tokens: [], source: '', error: 'Type a sentence first.' }); return; }
    if (!live) {
      setState({ status: 'done', tokens: baselineTag(value), source: 'baseline', error: '' });
      return;
    }
    setState({ status: 'loading', tokens: [], source: '', error: '' });
    try {
      const tokens = await modelTag(value, () => setState((s) => ({ ...s, status: 'waking' })));
      setState({ status: 'done', tokens, source: 'model', error: '' });
    } catch (err) {
      setState({
        status: 'done',
        tokens: baselineTag(value),
        source: 'baseline',
        error: `Could not reach the model (${err.message}). Showing the rule-based baseline instead.`,
      });
    }
  };

  // Without a live model the baseline is instant, so show the first example tagged on load.
  useEffect(() => {
    if (!live) setState({ status: 'done', tokens: baselineTag(EXAMPLES[0]), source: 'baseline', error: '' });
  }, [live]);

  const onSubmit = (e) => { e.preventDefault(); run(); };
  const pick = (ex) => { setText(ex); run(ex); };

  return (
    <section id="playground" className="section playground">
      <div className="container">
        <SectionHead title="Try the code-switch tagger">
          Type a sentence mixing romanized Nepali and English. Each token comes back tagged Nepali,
          English or Other, with the model's confidence underneath.
        </SectionHead>

        <div className="pg-panel">
          <form onSubmit={onSubmit} className="pg-form">
            <label htmlFor="pg-input" className="sr-only">Sentence to tag</label>
            <textarea
              id="pg-input"
              rows={2}
              value={text}
              maxLength={400}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } }}
              placeholder="e.g. Malai yo song dherai man paryo"
            />
            <button type="submit" className="btn btn-primary" disabled={state.status === 'loading' || state.status === 'waking'}>
              {state.status === 'loading' || state.status === 'waking' ? 'Tagging…' : 'Tag sentence'}
            </button>
          </form>

          <div className="pg-examples" role="group" aria-label="Example sentences">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="chip-btn" onClick={() => pick(ex)}>{ex}</button>
            ))}
          </div>

          <div className="pg-output" aria-live="polite" aria-busy={state.status === 'loading' || state.status === 'waking'}>
            {state.status === 'idle' ? <p className="pg-empty">Pick an example or type your own, then press Tag sentence.</p> : null}
            {state.status === 'loading' ? <div className="pg-loading"><span className="spinner" /> Tagging…</div> : null}
            {state.status === 'waking' ? (
              <div className="pg-loading"><span className="spinner" /> The model is waking up. Free hosting sleeps when idle, so the first request can take up to a minute.</div>
            ) : null}
            {state.error ? <p className="pg-error">{state.error}</p> : null}
            {state.status === 'done' ? (
              <>
                <ol className="pg-tokens">
                  {state.tokens.map((t, i) => (
                    <li key={i} className={`pg-tok tag-${t.label.toLowerCase()}`} title={`${LABEL_NAMES[t.label] || t.label} · confidence ${(t.score * 100).toFixed(1)}%`}>
                      <span className="pg-word">{t.token}</span>
                      <span className="pg-label">{t.label}</span>
                      <span className="pg-conf" aria-label={`confidence ${(t.score * 100).toFixed(0)} percent`}>
                        <span style={{ width: `${Math.round(t.score * 100)}%` }} />
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="pg-legend">
                  <span className="lg lg-ne">NE Nepali</span>
                  <span className="lg lg-en">EN English</span>
                  <span className="lg lg-other">OTHER punctuation, numbers, emoji</span>
                </p>
              </>
            ) : null}
          </div>

          <p className="pg-note">
            {state.source === 'baseline' || !live ? (
              <>
                <strong>You are seeing a simple word-list baseline, not the trained model.</strong>{' '}
                The XLM-RoBERTa model (99.5% token accuracy on the test set) will run here once its hosted
                endpoint is online.
              </>
            ) : (
              <>Research demo running the fine-tuned XLM-RoBERTa model; predictions may be wrong.</>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
