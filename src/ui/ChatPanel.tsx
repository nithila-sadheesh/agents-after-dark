import { useEffect, useRef, useState } from 'react';
import { useFoStore } from '../store';
import { startTask } from '../sim/orchestrator';
import { CARD, isRunning, SUGGESTIONS } from './format';
import { FoAvatar, IconArrowUpRight, PromptInput, RichText } from './parts';

export default function ChatPanel() {
  const messages = useFoStore((s) => s.messages);
  const stage = useFoStore((s) => s.stage);
  const running = isRunning(stage);
  // Docked chat takes over from the idle hero once a conversation exists.
  const visible = !(stage === 'IDLE' && messages.length === 0);
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
    <div aria-hidden={!visible}
      className={`absolute bottom-5 left-5 flex w-[344px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${CARD} ${
        visible ? 'pointer-events-auto visible translate-y-0 opacity-100 delay-150' : 'invisible translate-y-4 opacity-0'}`}>
      <div className="flex items-center gap-2.5 px-4 pb-2 pt-4">
        <FoAvatar className="h-8 w-8" />
        <div className="leading-tight">
          <div className="text-[13.5px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">Fo</div>
          <div className="text-[11.5px] text-[#8a8a8a]">Fo handles the calls. We handle the miles.</div>
        </div>
      </div>

      {messages.length > 0 && (
        <div ref={listRef} className="fw-scroll flex max-h-[200px] flex-col gap-2 overflow-y-auto px-4 py-2.5">
          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="fw-fade-up max-w-[85%] self-end whitespace-pre-wrap break-words rounded-[18px] rounded-br-md bg-[#0a0a0a] px-3.5 py-2 text-[13px] leading-snug text-white">
                <RichText text={m.text} />
              </div>
            ) : (
              <div key={m.id} className="fw-fade-up flex max-w-[92%] items-end gap-2 self-start">
                <FoAvatar className="mb-0.5 h-5 w-5" />
                <div className="whitespace-pre-wrap break-words rounded-[18px] rounded-bl-md bg-[#f3f3f3] px-3.5 py-2 text-[13px] leading-snug text-[#0a0a0a]">
                  <RichText text={m.text} />
                </div>
              </div>
            ),
          )}
          {waiting && (
            <div className="fw-fade-up flex items-end gap-2 self-start">
              <FoAvatar className="mb-0.5 h-5 w-5" />
              <div className="flex gap-1 rounded-[18px] rounded-bl-md bg-[#f3f3f3] px-3.5 py-3">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="fw-dot h-1.5 w-1.5 rounded-full bg-[#0a0a0a]" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!running && (
        <div className="flex flex-col px-4 pt-1">
          {SUGGESTIONS.map((s) => (
            <button key={s.label} type="button" title={s.request} onClick={() => send(s.request)}
              className="group flex items-center gap-2 border-t border-[#ededed] py-2 text-left text-[12.5px] text-[#3a3a3a] transition-colors first:border-t-0 hover:text-[#0a0a0a]">
              <span className="flex-1 truncate">{s.label}</span>
              <IconArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#a3a3a3] transition-transform group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-[#0a0a0a]" />
            </button>
          ))}
        </div>
      )}

      <div className="p-3 pt-2">
        <PromptInput value={text} onChange={setText} onSubmit={() => send(text)} disabled={running}
          placeholder={running ? 'Fo is on it…' : 'Ask Fo to handle something…'} />
      </div>
    </div>
  );
}
