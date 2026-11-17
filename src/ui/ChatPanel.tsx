import { useEffect, useRef, useState } from 'react';
import { useFoStore } from '../store';
import { DEMO_REQUEST, startTask } from '../sim/orchestrator';
import { GLASS, isRunning } from './format';
import { IconChat, IconSend, RichText } from './parts';

const SUGGESTIONS = [
  { label: 'Get my clothes dry-cleaned', request: DEMO_REQUEST },
  { label: 'Return my package to the shipping store', request: 'Return my package to the shipping store' },
];

export default function ChatPanel() {
  const messages = useFoStore((s) => s.messages);
  const stage = useFoStore((s) => s.stage);
  const running = isRunning(stage);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, running]);

  const send = (value: string) => {
    const v = value.trim();
    if (!v || running) return;
    setText('');
    void startTask(v, { mode: 'live' });
  };

  const waiting = running && messages[messages.length - 1]?.role === 'user';

  return (
    <div className={`pointer-events-auto absolute bottom-5 left-5 flex w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden ${GLASS}`}>
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3.5 py-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-linear-to-br from-sky-400/30 to-violet-500/30 text-sky-100 ring-1 ring-white/10">
          <IconChat className="h-3.5 w-3.5" />
        </span>
        <div className="leading-tight">
          <div className="text-[12.5px] font-semibold text-white">Fo</div>
          <div className="text-[10.5px] text-white/45">Fo handles the calls. We handle the miles.</div>
        </div>
      </div>

      {messages.length > 0 && (
        <div ref={listRef} className="fw-scroll flex max-h-[240px] flex-col gap-2 overflow-y-auto px-3.5 py-3">
          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="fw-fade-up max-w-[85%] self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-linear-to-br from-indigo-500/80 to-violet-500/80 px-3 py-1.5 text-[12.5px] leading-snug text-white shadow-[0_4px_14px_-4px_rgba(99,102,241,0.6)]">
                <RichText text={m.text} />
              </div>
            ) : (
              <div key={m.id} className="fw-fade-up max-w-[90%] self-start whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-white/[0.07] px-3 py-1.5 text-[12.5px] leading-snug text-white/90 ring-1 ring-white/[0.06]">
                <RichText text={m.text} />
              </div>
            ),
          )}
          {waiting && (
            <div className="fw-fade-up flex gap-1 self-start rounded-2xl rounded-bl-md bg-white/[0.07] px-3 py-2.5 ring-1 ring-white/[0.06]">
              {[0, 1, 2].map((i) => (
                <span key={i} className="fw-dot h-1.5 w-1.5 rounded-full bg-white/70" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          )}
        </div>
      )}

      {!running && (
        <div className="flex flex-wrap gap-1.5 px-3.5 pt-3">
          {SUGGESTIONS.map((s) => (
            <button key={s.label} type="button" title={s.request} onClick={() => send(s.request)}
              className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/75 ring-1 ring-white/10 transition hover:bg-indigo-400/15 hover:text-white hover:ring-indigo-300/40">
              {s.label}
            </button>
          ))}
        </div>
      )}

      <form className="flex items-center gap-2 p-3" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={running}
          placeholder={running ? 'Fo is on it…' : 'Ask Fo to handle something…'}
          className="min-w-0 flex-1 rounded-xl bg-white/[0.06] px-3 py-2 text-[12.5px] text-white ring-1 ring-white/10 outline-none transition placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-indigo-300/50 disabled:opacity-50"
        />
        <button type="submit" disabled={running || !text.trim()} aria-label="Send"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-500 text-white shadow-[0_4px_14px_-4px_rgba(129,140,248,0.8)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none">
          <IconSend className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
