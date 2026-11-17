import { useMemo, useState } from 'react';
import { useFoStore, type ActivityEntry } from '../store';
import { GLASS, timeLabel } from './format';
import { IconChat, IconCheck, IconRobot, IconSparkle, IconSystem, IconX, Spinner, VerifiedBadge, RichText } from './parts';

const MAX_VISIBLE = 5;
const FADE = [1, 0.85, 0.7, 0.55, 0.42];

const SOURCE_META: Record<ActivityEntry['source'], { label: string; icon: typeof IconChat; cls: string }> = {
  fo: { label: 'Fo', icon: IconChat, cls: 'bg-sky-400/15 text-sky-200 ring-sky-300/30' },
  claude: { label: 'Claude', icon: IconSparkle, cls: 'bg-orange-300/15 text-orange-200 ring-orange-300/30' },
  robot: { label: 'Robot', icon: IconRobot, cls: 'bg-violet-400/15 text-violet-200 ring-violet-300/30' },
  system: { label: 'System', icon: IconSystem, cls: 'bg-white/8 text-white/60 ring-white/15' },
};

function StatusIcon({ status }: { status: ActivityEntry['status'] }) {
  if (status === 'pending') return <Spinner className="h-3 w-3 text-white/50" />;
  if (status === 'error') return <IconX className="h-3 w-3 text-rose-300" />;
  return <IconCheck className="h-3 w-3 text-emerald-300/80" />;
}

function ActivityItem({ entry, opacity }: { entry: ActivityEntry; opacity: number }) {
  const [expanded, setExpanded] = useState(false);
  const meta = SOURCE_META[entry.source];
  const Icon = meta.icon;
  const long = entry.text.length > 160 || entry.text.split('\n').length > 4;

  return (
    <li className="fw-fade-down">
      {/* opacity lives on the blurred element itself: an ancestor with opacity < 1 would disable its backdrop blur */}
      <div style={{ opacity }} className={`pointer-events-auto px-3 py-2.5 transition-opacity duration-500 ${GLASS}`}>
        <div className="flex items-center gap-1.5">
          <span className={`flex h-5 w-5 items-center justify-center rounded-md ring-1 ${meta.cls}`}>
            <Icon className="h-3 w-3" />
          </span>
          <span className="text-[11.5px] font-semibold text-white/90">{meta.label}</span>
          <VerifiedBadge verified={entry.verified} />
          <span className="ml-auto font-mono text-[9.5px] text-white/30">{timeLabel(entry.ts)}</span>
          <StatusIcon status={entry.status} />
        </div>
        <p
          onClick={long ? () => setExpanded((e) => !e) : undefined}
          className={`mt-1.5 whitespace-pre-wrap break-words text-[11.5px] leading-snug text-white/75 ${
            long ? 'cursor-pointer' : ''
          } ${long && !expanded ? 'line-clamp-4' : ''}`}
        >
          <RichText text={entry.text} />
        </p>
        {long && (
          <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-1 text-[10.5px] font-medium text-indigo-300/90 hover:text-indigo-200">
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
    <div className="flex min-h-0 shrink-0 flex-col">
      <div className="fw-text-shadow mb-1.5 flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
        Agent activity
        <span className="h-px flex-1 bg-linear-to-r from-white/15 to-transparent" />
      </div>
      <ul className="flex flex-col gap-1.5">
        {visible.map((e, i) => <ActivityItem key={e.id} entry={e} opacity={FADE[i] ?? 0.4} />)}
      </ul>
    </div>
  );
}
