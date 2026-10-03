import React, { useCallback, useEffect, useRef, useState } from 'react';
import { greeting, reply } from '../lib/assistantBrain';
import { prefersReducedMotion } from '../hooks/useTheme';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(false);
  const stateRef = useRef({ topic: null, turns: 0 });
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const busy = useRef(false);

  const scrollDown = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // Reveal a reply a few words at a time, after a short "typing" pause sized to the reply.
  const say = useCallback(async (msg) => {
    const reduced = prefersReducedMotion();
    setTyping(true);
    await sleep(reduced ? 150 : Math.min(1400, 450 + msg.text.length * 6));
    setTyping(false);
    const id = Date.now() + Math.random();
    if (reduced) {
      setMessages((m) => [...m, { id, from: 'bot', text: msg.text, action: msg.action, suggestions: msg.suggestions }]);
      return;
    }
    setMessages((m) => [...m, { id, from: 'bot', text: '', streaming: true }]);
    const parts = msg.text.split(/(\s+)/);
    let shown = '';
    for (let i = 0; i < parts.length; i += 1) {
      shown += parts[i];
      if (i % 2 === 0) {
        const snapshot = shown;
        setMessages((m) => m.map((x) => (x.id === id ? { ...x, text: snapshot } : x)));
        // eslint-disable-next-line no-await-in-loop
        await sleep(/[.!?]$/.test(parts[i]) ? 140 : 22 + Math.random() * 30);
      }
    }
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, streaming: false, action: msg.action, suggestions: msg.suggestions } : x)));
  }, []);

  const openChat = useCallback(() => {
    setOpen(true);
    setUnread(false);
  }, []);

  const closeChat = useCallback(() => {
    setOpen(false);
    setTimeout(() => launcherRef.current?.focus(), 50);
  }, []);

  // first open: greet
  useEffect(() => {
    if (open && messages.length === 0) say(greeting());
    if (open) setTimeout(() => inputRef.current?.focus(), 380);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(scrollDown, [messages, typing]);

  useEffect(() => {
    const onOpen = () => openChat();
    const onKey = (e) => { if (e.key === 'Escape' && open) closeChat(); };
    window.addEventListener('open-chat', onOpen);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('open-chat', onOpen); window.removeEventListener('keydown', onKey); };
  }, [open, openChat, closeChat]);

  // A gentle hint dot after a while, once per visit.
  useEffect(() => {
    const t = setTimeout(() => setUnread(true), 20000);
    return () => clearTimeout(t);
  }, []);

  const send = async (text) => {
    const value = text.trim();
    if (!value || busy.current) return;
    busy.current = true;
    setInput('');
    setMessages((m) => [...m.map((x) => ({ ...x, suggestions: undefined })), { id: Date.now(), from: 'me', text: value }]);
    const r = reply(value, stateRef.current);
    stateRef.current = r.state;
    await say(r);
    busy.current = false;
  };

  const runAction = (a) => {
    if (a.project) { window.dispatchEvent(new CustomEvent('open-project', { detail: a.project })); return; }
    if (a.section) { document.getElementById(a.section)?.scrollIntoView({ behavior: 'smooth' }); return; }
    if (a.href) {
      const el = document.createElement('a');
      el.href = a.href;
      if (a.download) el.download = '';
      if (a.external) { el.target = '_blank'; el.rel = 'noreferrer'; }
      el.click();
    }
  };

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className={`chat-launcher ${open ? 'is-hidden' : ''}`}
        onClick={openChat}
        aria-label="Open chat: ask about Shivam's work"
        aria-expanded={open}
        aria-controls="chat-panel"
      >
        <span className="chat-emoji" aria-hidden="true">🤖</span>
        <span className="chat-launcher-text">Ask about my work</span>
        {unread ? <span className="chat-dot" aria-hidden="true" /> : null}
      </button>

      <section
        id="chat-panel"
        className={`chat-panel ${open ? 'open' : ''}`}
        role="dialog"
        aria-label="Chat about Shivam's work"
        aria-hidden={!open}
        inert={!open ? '' : undefined}
      >
        <header className="chat-head">
          <div className="chat-who">
            <span className="chat-avatar" aria-hidden="true">🤖<span className="chat-online" /></span>
            <div>
              <p className="chat-name">Shivam's assistant</p>
              <p className="chat-sub">{typing ? 'typing…' : 'Answers from his portfolio'}</p>
            </div>
          </div>
          <button type="button" className="chat-close" onClick={closeChat} aria-label="Close chat">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </header>

        <div className="chat-log" ref={listRef} aria-live="polite">
          {messages.map((m, idx) => (
            <div key={m.id} className={`msg msg-${m.from}`}>
              <p className="bubble">{m.text}{m.streaming ? <span className="caret" aria-hidden="true" /> : null}</p>
              {m.action ? (
                <button type="button" className="msg-action" onClick={() => runAction(m.action)}>{m.action.label}</button>
              ) : null}
              {m.suggestions && idx === messages.length - 1 && !typing ? (
                <div className="suggests">
                  {m.suggestions.map((s) => (
                    <button key={s} type="button" className="suggest" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {typing ? (
            <div className="msg msg-bot">
              <p className="bubble typing" aria-label="Typing"><span /><span /><span /></p>
            </div>
          ) : null}
        </div>

        <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <label htmlFor="chat-input" className="sr-only">Your message</label>
          <input
            id="chat-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            autoComplete="off"
            maxLength={300}
          />
          <button type="submit" aria-label="Send" disabled={!input.trim()}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </form>
      </section>
    </>
  );
}
