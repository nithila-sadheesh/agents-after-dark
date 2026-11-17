import { useState } from 'react';
import { useFoStore } from '../store';
import { startTask } from '../sim/orchestrator';
import { CARD, SUGGESTIONS } from './format';
import { FoMark, IconArrowUpRight, IconBox, IconHanger, PromptInput } from './parts';

const ICONS = { hanger: IconHanger, box: IconBox } as const;

/** Idle-state hero (Wajo-style). Gives way to the docked ChatPanel once a task starts. */
export default function Hero() {
  const visible = useFoStore((s) => s.stage === 'IDLE' && s.messages.length === 0);
  const [text, setText] = useState('');

  const send = (value: string) => {
    const v = value.trim();
    if (!v || !visible) return;
    setText('');
    void startTask(v, { mode: 'live' });
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[9vh] flex justify-center px-6">
      <section aria-hidden={!visible}
        className={`relative w-[540px] max-w-full px-9 pb-5 pt-9 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${CARD} ${
          visible ? 'pointer-events-auto visible translate-y-0 scale-100 opacity-100'
            : 'invisible -translate-y-3 scale-[0.98] opacity-0'}`}>
        {/* decoration only, like Wajo's scattered squares */}
        <span className="absolute right-9 top-9 h-1.5 w-1.5 bg-[#0a0a0a]" />
        <span className="absolute right-14 top-14 h-1 w-1 bg-[#cfcfcf]" />

        <FoMark className="h-11 w-11 text-[#0a0a0a]" />
        <h2 className="mt-4 text-[46px] font-bold leading-[1.02] tracking-[-0.05em] text-[#0a0a0a]">Fo handles it.</h2>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#6b6b6b]">
          Ask for an errand. Fo calls the shop, a robot does the walking.
        </p>

        <div className="mt-7">
          <PromptInput size="lg" value={text} onChange={setText} onSubmit={() => send(text)} disabled={!visible}
            placeholder="What should Fo handle?" />
        </div>

        <ul className="mt-4">
          {SUGGESTIONS.map((s, i) => {
            const Icon = ICONS[s.icon];
            return (
              <li key={s.label} className={i > 0 ? 'border-t border-[#e5e5e5]' : ''}>
                <button type="button" title={s.request} disabled={!visible} onClick={() => send(s.request)}
                  className="group flex w-full items-center gap-3 py-3.5 text-left text-[14px] text-[#0a0a0a] transition-colors">
                  <Icon className="h-4 w-4 shrink-0 text-[#6b6b6b]" />
                  <span className="flex-1 group-hover:underline group-hover:decoration-[#c4c4c4] group-hover:underline-offset-4">{s.label}</span>
                  <IconArrowUpRight className="h-4 w-4 shrink-0 text-[#9a9a9a] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#0a0a0a]" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
