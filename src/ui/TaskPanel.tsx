import { useState } from 'react';
import { useFoStore, type ChecklistItem } from '../store';
import { GLASS, isRunning, STAGE_META, stepArg, TONE_DOT, TONE_PILL } from './format';
import { IconCheck, IconChevron, IconX, Spinner } from './parts';

const SOURCE_BADGE = {
  claude: { text: 'Plan by Claude', cls: 'bg-orange-300/10 text-orange-200 ring-orange-300/30' },
  fallback: { text: 'Fallback plan', cls: 'bg-amber-400/10 text-amber-200 ring-amber-400/30' },
  demo: { text: 'Demo plan', cls: 'bg-white/8 text-white/65 ring-white/15' },
} as const;

function CheckIcon({ status }: { status: ChecklistItem['status'] }) {
  if (status === 'done')
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-400/40">
        <IconCheck className="h-2.5 w-2.5" />
      </span>
    );
  if (status === 'error')
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-400/20 text-rose-300 ring-1 ring-rose-400/40">
        <IconX className="h-2.5 w-2.5" />
      </span>
    );
  if (status === 'active')
    return (
      <span className="flex h-4 w-4 items-center justify-center text-sky-300">
        <Spinner className="h-3.5 w-3.5" />
      </span>
    );
  return <span className="m-0.5 h-3 w-3 rounded-full ring-1 ring-white/25" />;
}

export default function TaskPanel() {
  const task = useFoStore((s) => s.task);
  const stage = useFoStore((s) => s.stage);
  const checklist = useFoStore((s) => s.checklist);
  const plan = useFoStore((s) => s.plan);
  const planSource = useFoStore((s) => s.planSource);
  const activeStepIndex = useFoStore((s) => s.activeStepIndex);
  const [planOpen, setPlanOpen] = useState(true);

  if (!task) return null;

  const meta = STAGE_META[stage];
  const active = isRunning(stage);
  const allDone = stage === 'COMPLETED';

  return (
    <div className={`fw-fade-down pointer-events-auto flex min-h-0 shrink flex-col overflow-hidden ${GLASS}`}>
      <div className="fw-scroll min-h-0 overflow-y-auto p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Current task</span>
          <span className={`rounded-full px-2 py-px text-[10px] font-medium ring-1 ${
            task.mode === 'demo' ? 'bg-violet-400/10 text-violet-200 ring-violet-300/30' : 'bg-sky-400/10 text-sky-200 ring-sky-300/30'
          }`}>
            {task.mode === 'demo' ? 'Presentation mode' : 'Live'}
          </span>
        </div>

        <h3 className="mt-1.5 text-[14.5px] font-semibold leading-snug text-white">{task.title}</h3>

        <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 transition-colors duration-500 ${TONE_PILL[meta.tone]}`}>
          <span className="relative flex h-1.5 w-1.5">
            {active && <span className={`absolute inset-0 animate-ping rounded-full opacity-75 ${TONE_DOT[meta.tone]}`} />}
            <span className={`relative h-1.5 w-1.5 rounded-full ${TONE_DOT[meta.tone]}`} />
          </span>
          {meta.label}
        </div>

        {checklist.length > 0 && (
          <ul className="mt-3.5 space-y-2">
            {checklist.map((c) => (
              <li key={c.id} className="flex items-center gap-2.5">
                <CheckIcon status={c.status} />
                <span className={`text-[12px] leading-tight transition-colors duration-300 ${
                  c.status === 'active' ? 'font-medium text-white'
                    : c.status === 'done' ? 'text-white/65'
                      : c.status === 'error' ? 'text-rose-200' : 'text-white/40'
                }`}>
                  {c.label}
                </span>
              </li>
            ))}
          </ul>
        )}

        {!plan && stage === 'PLANNING' && (
          <div className="mt-3.5 flex items-center gap-2 text-[11.5px] text-white/50">
            <Spinner className="h-3 w-3 text-violet-300" /> Drafting the robot plan…
          </div>
        )}

        {plan && (
          <div className="mt-3.5 border-t border-white/[0.07] pt-3">
            <button type="button" onClick={() => setPlanOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
              <IconChevron className={`h-3 w-3 text-white/45 transition-transform duration-300 ${planOpen ? '' : '-rotate-90'}`} />
              <span className="text-[11.5px] font-medium text-white/80">Robot plan</span>
              <span className="text-[10.5px] text-white/35">{plan.steps.length} steps</span>
              {planSource && (
                <span className={`ml-auto rounded-full px-2 py-px text-[10px] font-medium ring-1 ${SOURCE_BADGE[planSource].cls}`}>
                  {SOURCE_BADGE[planSource].text}
                </span>
              )}
            </button>

            <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${planOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <ol className="min-h-0 space-y-0.5 overflow-hidden">
                <li className="h-2" aria-hidden />
                {plan.steps.map((step, i) => {
                  const done = allDone || i < activeStepIndex;
                  const current = !allDone && i === activeStepIndex;
                  return (
                    <li key={i} className={`flex items-start gap-2 rounded-lg px-2 py-1 transition-all duration-300 ${
                      current ? 'bg-indigo-400/15 ring-1 ring-indigo-300/35' : done ? 'opacity-45' : 'opacity-80'
                    }`}>
                      <span className="mt-px w-4 shrink-0 text-right font-mono text-[10px] text-white/35">
                        {done ? <IconCheck className="ml-auto h-3 w-3 text-emerald-300" /> : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-[11px]">
                          <span className={current ? 'text-indigo-200' : 'text-white/85'}>{step.action}</span>
                          {stepArg(step) && <span className="text-white/45"> {stepArg(step)}</span>}
                        </div>
                        {step.message && <div className="truncate text-[10.5px] text-white/40">{step.message}</div>}
                      </div>
                      {current && <span className="mt-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-indigo-300 shadow-[0_0_8px_rgba(165,180,252,0.9)]" />}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
