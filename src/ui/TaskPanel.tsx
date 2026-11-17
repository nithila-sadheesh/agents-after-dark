import { useState } from 'react';
import { useFoStore, type ChecklistItem } from '../store';
import { CARD, isRunning, STAGE_META, stepArg, TONE_DOT, TONE_PILL } from './format';
import { IconCheck, IconChevron, IconX, Spinner } from './parts';

const SOURCE_BADGE = {
  claude: 'Plan by Claude',
  fallback: 'Fallback plan',
  demo: 'Validated plan',
} as const;

function CheckIcon({ status }: { status: ChecklistItem['status'] }) {
  if (status === 'done')
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] text-white">
        <IconCheck className="h-2.5 w-2.5" />
      </span>
    );
  if (status === 'error')
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[#0a0a0a] ring-1 ring-[#0a0a0a]">
        <IconX className="h-2.5 w-2.5" />
      </span>
    );
  if (status === 'active')
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[#0a0a0a]">
        <Spinner className="h-3.5 w-3.5" />
      </span>
    );
  return <span className="h-4 w-4 shrink-0 rounded-full ring-1 ring-inset ring-[#d4d4d4]" />;
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
    <div className={`fw-fade-down pointer-events-auto flex min-h-0 shrink flex-col overflow-hidden ${CARD}`}>
      <div className="fw-scroll min-h-0 overflow-y-auto p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11.5px] font-medium text-[#8a8a8a]">Current task</span>
          {task.mode === 'live' && (
            <span className="rounded-full px-2 py-px text-[10.5px] font-medium text-[#0a0a0a] ring-1 ring-[#d4d4d4]">Live task</span>
          )}
        </div>

        <h3 className="mt-0.5 text-[18px] font-bold leading-tight tracking-[-0.03em] text-[#0a0a0a]">{task.title}</h3>

        <div className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-500 ${TONE_PILL[meta.tone]}`}>
          {allDone ? <IconCheck className="h-3 w-3" /> : (
            <span className="relative flex h-1.5 w-1.5">
              {active && <span className={`absolute inset-0 animate-ping rounded-full opacity-60 ${TONE_DOT[meta.tone]}`} />}
              <span className={`relative h-1.5 w-1.5 rounded-full ${TONE_DOT[meta.tone]}`} />
            </span>
          )}
          {meta.label}
        </div>

        {checklist.length > 0 && (
          <ul className="mt-3.5 space-y-2">
            {checklist.map((c) => (
              <li key={c.id} className="flex items-center gap-2.5">
                <CheckIcon status={c.status} />
                <span className={`text-[12.5px] leading-tight transition-colors duration-300 ${
                  c.status === 'active' ? 'font-semibold text-[#0a0a0a]'
                    : c.status === 'done' ? 'text-[#0a0a0a]'
                      : c.status === 'error' ? 'text-[#0a0a0a] line-through decoration-[#a3a3a3]' : 'text-[#a3a3a3]'
                }`}>
                  {c.label}
                </span>
              </li>
            ))}
          </ul>
        )}

        {!plan && stage === 'PLANNING' && (
          <div className="mt-4 flex items-center gap-2 text-[12px] text-[#8a8a8a]">
            <Spinner className="h-3 w-3 text-[#0a0a0a]" /> Drafting the robot plan…
          </div>
        )}

        {plan && (
          <div className="mt-3.5 border-t border-[#e5e5e5] pt-3">
            <button type="button" onClick={() => setPlanOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
              <IconChevron className={`h-3.5 w-3.5 text-[#0a0a0a] transition-transform duration-300 ${planOpen ? '' : '-rotate-90'}`} />
              <span className="text-[12.5px] font-semibold text-[#0a0a0a]">Robot plan</span>
              <span className="text-[11.5px] text-[#a3a3a3]">{plan.steps.length} steps</span>
              {planSource && (
                <span className="ml-auto rounded-full bg-[#f3f3f3] px-2 py-0.5 text-[10.5px] font-medium text-[#525252]">
                  {SOURCE_BADGE[planSource]}
                </span>
              )}
            </button>

            <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${planOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <ol className="min-h-0 space-y-px overflow-hidden">
                <li className="h-2" aria-hidden />
                {plan.steps.map((step, i) => {
                  const done = allDone || i < activeStepIndex;
                  const current = !allDone && i === activeStepIndex;
                  return (
                    <li key={i} className={`flex items-start gap-2.5 rounded-lg px-2 py-1 transition-colors duration-300 ${
                      current ? 'bg-[#f3f3f3]' : ''
                    }`}>
                      <span className="mt-px flex w-4 shrink-0 justify-end font-mono text-[10.5px] text-[#a3a3a3]">
                        {done ? <IconCheck className="h-3 w-3 text-[#0a0a0a]" /> : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-[11px]">
                          <span className={current ? 'font-semibold text-[#0a0a0a]' : done ? 'text-[#8a8a8a]' : 'text-[#0a0a0a]'}>{step.action}</span>
                          {stepArg(step) && <span className="text-[#a3a3a3]"> {stepArg(step)}</span>}
                        </div>
                        {step.message && <div className="truncate text-[11px] text-[#a3a3a3]">{step.message}</div>}
                      </div>
                      {current && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#0a0a0a]" />}
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
