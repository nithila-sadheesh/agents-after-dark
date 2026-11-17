import type { ReactNode } from 'react';
import { useFoStore } from '../store';
import { ROBOT_ID } from '../../shared/world';
import { GLASS, itemKindLabel, locationLabel, stepText, titleCase } from './format';
import { IconTarget, IconX, VerifiedBadge, RichText } from './parts';

const Row = ({ k, children }: { k: string; children: ReactNode }) => (
  <div className="flex items-start justify-between gap-3 py-1">
    <span className="shrink-0 text-[11px] text-white/40">{k}</span>
    <span className="min-w-0 text-right text-[11.5px] text-white/85">{children}</span>
  </div>
);

export default function Inspector() {
  const selected = useFoStore((s) => s.selected);
  const robot = useFoStore((s) => s.robot);
  const item = useFoStore((s) => s.item);
  const scene = useFoStore((s) => s.scene);
  const plan = useFoStore((s) => s.plan);
  const activeStepIndex = useFoStore((s) => s.activeStepIndex);
  const activity = useFoStore((s) => s.activity);

  if (!selected) return null;

  const close = () => useFoStore.setState({ selected: null });
  const kind = itemKindLabel(scene.itemKind);
  const where = locationLabel(item.location, scene.shopLabel);
  const step = plan?.steps[activeStepIndex];

  let title: string;
  let body: ReactNode;
  if (selected === 'robot') {
    title = 'Delivery robot';
    body = (
      <>
        <Row k="ID"><span className="font-mono">{ROBOT_ID}</span></Row>
        <Row k="Status">
          <span className="inline-flex items-center gap-1.5">
            {robot.moving && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300" />}
            {robot.status}
          </span>
        </Row>
        <Row k="Carrying">{item.location === 'robot' ? `${kind}${scene.itemKind === 'laundry_bag' ? (item.clean ? ' (clean)' : ' (dirty)') : ''}` : 'Nothing'}</Row>
        <Row k="Current step"><span className="font-mono text-[10.5px]">{step ? stepText(step) : '—'}</span></Row>
        <button type="button" onClick={() => useFoStore.setState({ camera: { mode: 'follow' } })}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-400/15 py-1.5 text-[11.5px] font-medium text-indigo-100 ring-1 ring-indigo-300/30 transition hover:bg-indigo-400/25">
          <IconTarget className="h-3 w-3" /> Follow
        </button>
      </>
    );
  } else if (selected === 'home') {
    title = 'Your home';
    body = <Row k={kind}>{where}</Row>;
  } else if (selected === 'shop') {
    const lastFo = [...activity].reverse().find((a) => a.source === 'fo');
    title = titleCase(scene.shopLabel);
    body = (
      <>
        <Row k="Coordinated by">Fo</Row>
        {lastFo ? (
          <div className="mt-1.5 rounded-lg bg-white/[0.04] p-2 ring-1 ring-white/[0.06]">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] text-white/45">Last from Fo <VerifiedBadge verified={lastFo.verified} /></div>
            <p className="line-clamp-4 text-[11px] leading-snug text-white/75"><RichText text={lastFo.text} /></p>
          </div>
        ) : (
          <p className="pt-1 text-[11px] text-white/40">No messages from Fo yet.</p>
        )}
      </>
    );
  } else {
    title = kind;
    body = (
      <>
        <Row k="Kind">{kind}</Row>
        {scene.itemKind === 'laundry_bag' && <Row k="Condition">{item.clean ? 'Clean' : 'Dirty'}</Row>}
        <Row k="Location">{where}</Row>
      </>
    );
  }

  return (
    <div key={selected} className={`fw-fade-up pointer-events-auto absolute left-5 top-[9.25rem] w-60 p-3.5 ${GLASS}`}>
      <div className="mb-1.5 flex items-center justify-between">
        <div>
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/40">Inspector</div>
          <div className="text-[13px] font-semibold text-white">{title}</div>
        </div>
        <button type="button" onClick={close} aria-label="Close inspector"
          className="flex h-6 w-6 items-center justify-center rounded-md text-white/50 transition hover:bg-white/10 hover:text-white">
          <IconX className="h-3 w-3" />
        </button>
      </div>
      <div className="divide-y divide-white/[0.05]">{body}</div>
    </div>
  );
}
