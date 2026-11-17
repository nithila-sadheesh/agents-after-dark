import { useFoStore } from '../store';
import { approve, decline } from '../sim/orchestrator';
import { GLASS } from './format';

const SOURCE_TAG = {
  fo_quote: { text: 'Quote from Fo', cls: 'bg-sky-400/15 text-sky-200 ring-sky-300/35' },
  demo: { text: 'Demo quote · no real charge', cls: 'bg-amber-400/10 text-amber-200 ring-amber-400/30' },
} as const;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export default function ApprovalCard() {
  const approval = useFoStore((s) => s.approval);
  if (!approval) return null;

  const tag = SOURCE_TAG[approval.source];
  // Skip the detail line if it just repeats the source tag.
  const showDetail = approval.detail && norm(approval.detail) !== norm(tag.text);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
      <div className={`fw-pop pointer-events-auto relative w-[340px] overflow-hidden p-5 ${GLASS} ring-1 ring-indigo-300/15`}>
        <div className="pointer-events-none absolute -top-16 left-1/2 h-32 w-56 -translate-x-1/2 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/90">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
              Approval needed
            </span>
            <span className={`rounded-full px-2 py-px text-[10px] font-medium ring-1 ${tag.cls}`}>{tag.text}</span>
          </div>
          <h3 className="mt-3 text-[13.5px] font-medium text-white/85">{approval.title}</h3>
          <div className="mt-1 text-[38px] font-semibold leading-none tracking-tight text-white tabular-nums">{approval.amount}</div>
          {showDetail && <p className="mt-2 text-[11.5px] leading-snug text-white/55">{approval.detail}</p>}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={decline}
              className="flex-1 rounded-xl bg-white/[0.06] py-2 text-[12.5px] font-medium text-white/75 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white">
              Decline
            </button>
            <button type="button" onClick={approve}
              className="flex-[1.6] rounded-xl bg-linear-to-r from-indigo-500 to-violet-500 py-2 text-[12.5px] font-semibold text-white shadow-[0_6px_20px_-6px_rgba(129,140,248,0.9)] transition hover:brightness-110 active:scale-[0.98]">
              Approve {approval.amount}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
