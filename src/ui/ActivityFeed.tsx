import { useMemo, useState } from 'react';
import { useFoStore, type ActivityEntry } from '../store';
import { CARD, timeLabel } from './format';
import { FoMark, IconCheck, IconRobot, IconSparkle, IconSystem, IconX, Spinner, VerifiedBadge, RichText } from './parts';

const MAX_VISIBLE = 3;
const FADE = [1, 0.8, 0.6];

const SOURCE_META: Record<ActivityEntry['source'], { label: string; icon: typeof IconSystem }> = {
  fo: { label: 'Fo', icon: FoMark },
  claude: { label: 'Claude', icon: IconSparkle },
  robot: { label: 'Robot', icon: IconRobot },
  system: { label: 'System', icon: IconSystem },
};

function StatusIcon({ status }: { status: ActivityEntry['status'] }) {
  if (status === 'pending') return <Spinner className="h-3 w-3 text-[#0a0a0a]" />;
  if (status === 'error') return <IconX className="h-3.5 w-3.5 text-[#0a0a0a]" />;
  return <IconCheck className="h-3.5 w-3.5 text-[#a3a3a3]" />;
}

function ActivityItem({ entry, opacity }: { entry: ActivityEntry; opacity: number }) {
  const [expanded, setExpanded] = useState(false);
  const meta = SOURCE_META[entry.source];
  const Icon = meta.icon;
  const long = entry.text.length > 90 || entry.text.split('\n').length > 2;

  return (
    <li className="fw-fade-down border-t border-[#e5e5e5] py-2.5 first:border-t-0 first:pt-0.5">
      <div style={{ opacity }} className="transition-opacity duration-500">
        <div className="flex items-center gap-2">
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#f3f3f3] text-[#0a0a0a]">
            <Icon className={entry.source === 'fo' ? 'h-4 w-4' : 'h-3 w-3'} />
          </span>
          <span className="text-[12.5px] font-semibold text-[#0a0a0a]">{meta.label}</span>
          <VerifiedBadge verified={entry.verified} />
          <span className="ml-auto text-[10.5px] tabular-nums text-[#a3a3a3]">{timeLabel(entry.ts)}</span>
          <StatusIcon status={entry.status} />
        </div>
        <p
          onClick={long ? () => setExpanded((e) => !e) : undefined}
          className={`mt-1 whitespace-pre-wrap break-words pl-[30px] text-[12.5px] leading-snug text-[#3a3a3a] ${
            long ? 'cursor-pointer' : ''
          } ${long && !expanded ? 'line-clamp-2' : ''}`}
        >
          <RichText text={entry.text} />
        </p>
        {long && (
          <button type="button" onClick={() => setExpanded((e) => !e)}
            className="mt-1 pl-[30px] text-[11.5px] font-medium text-[#0a0a0a] underline decoration-[#d4d4d4] underline-offset-[3px] hover:decoration-[#0a0a0a]">
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    </li>
  );
}

export default function ActivityFeed() {
  const activity = useFoStore((s) => s.activity);
  const visible = useMemo(
    () => [...activity].reverse().sort((a, b) => b.ts - a.ts).slice(0, MAX_VISIBLE),
    [activity],
  );
  if (visible.length === 0) return null;

  return (
    <div className={`fw-fade-down pointer-events-auto flex min-h-0 shrink-0 flex-col px-5 pb-2 pt-4 ${CARD}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12.5px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">Agent activity</span>
        <span className="text-[11px] text-[#a3a3a3]">{activity.length} events</span>
      </div>
      <ul className="flex flex-col">
        {visible.map((e, i) => <ActivityItem key={e.id} entry={e} opacity={FADE[i] ?? 0.6} />)}
      </ul>
    </div>
  );
}
