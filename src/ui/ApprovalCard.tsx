import { useFoStore } from '../store';
import { approve, decline } from '../sim/orchestrator';
import { CARD } from './format';

const SOURCE_TAG = {
  fo_quote: 'Quote from Fo',
  demo: 'Estimated quote',
} as const;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export default function ApprovalCard() {
  const approval = useFoStore((s) => s.approval);
  if (!approval) return null;

  const tag = SOURCE_TAG[approval.source];
  // Skip the detail line if it just repeats the source tag.
  const showDetail = approval.detail && norm(approval.detail) !== norm(tag);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
      <div className={`fw-pop pointer-events-auto w-[360px] p-6 ${CARD}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#0a0a0a]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0a0a0a]" />
            Approval needed
          </span>
          <span className="rounded-full bg-[#f3f3f3] px-2.5 py-0.5 text-[11px] font-medium text-[#525252]">{tag}</span>
        </div>
        <h3 className="mt-4 text-[14px] text-[#6b6b6b]">{approval.title}</h3>
        <div className="mt-1 text-[52px] font-bold leading-none tracking-[-0.05em] text-[#0a0a0a] tabular-nums">{approval.amount}</div>
        {showDetail && <p className="mt-2.5 text-[12.5px] leading-snug text-[#8a8a8a]">{approval.detail}</p>}
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={decline}
            className="h-11 flex-1 rounded-full bg-white text-[13.5px] font-medium text-[#0a0a0a] ring-1 ring-inset ring-[#e0e0e0] transition-colors hover:bg-[#f7f7f7]">
            Decline
          </button>
          <button type="button" onClick={approve}
            className="h-11 flex-[1.6] rounded-full bg-[#0a0a0a] text-[13.5px] font-semibold text-white transition hover:bg-[#262626] active:scale-[0.98]">
            Approve {approval.amount}
          </button>
        </div>
      </div>
    </div>
  );
}
