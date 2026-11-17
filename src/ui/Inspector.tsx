import type { ReactNode } from 'react';
import { useFoStore } from '../store';
import { ROBOT_ID } from '../../shared/world';
import { CARD, itemKindLabel, locationLabel, stepText, titleCase } from './format';
import { IconTarget, IconX, VerifiedBadge, RichText } from './parts';

const Row = ({ k, children }: { k: string; children: ReactNode }) => (
  <div className="flex items-start justify-between gap-3 py-2">
    <span className="shrink-0 text-[12px] text-[#8a8a8a]">{k}</span>
    <span className="min-w-0 text-right text-[12.5px] text-[#0a0a0a]">{children}</span>
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
            {robot.moving && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0a0a0a]" />}
            {robot.status}
          </span>
        </Row>
        <Row k="Carrying">{item.location === 'robot' ? `${kind}${scene.itemKind === 'laundry_bag' ? (item.clean ? ' (clean)' : ' (dirty)') : ''}` : 'Nothing'}</Row>
        <Row k="Current step"><span className="font-mono text-[11px]">{step ? stepText(step) : '—'}</span></Row>
        <button type="button" onClick={() => useFoStore.setState({ camera: { mode: 'follow' } })}
          className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-[#0a0a0a] text-[12.5px] font-semibold text-white transition-colors hover:bg-[#262626]">
          <IconTarget className="h-3.5 w-3.5" /> Follow robot
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
          <div className="mt-2 rounded-2xl bg-[#f3f3f3] p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-[#6b6b6b]">Last from Fo <VerifiedBadge verified={lastFo.verified} /></div>
            <p className="line-clamp-4 text-[12px] leading-snug text-[#0a0a0a]"><RichText text={lastFo.text} /></p>
          </div>
        ) : (
          <p className="pt-2 text-[12px] text-[#a3a3a3]">No messages from Fo yet.</p>
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
    <div key={selected} className={`fw-fade-up pointer-events-auto absolute left-5 top-[5.25rem] w-64 p-5 ${CARD}`}>
      <div className="mb-2 flex items-start justify-between">
        <div>
          <div className="text-[11.5px] font-medium text-[#8a8a8a]">Inspector</div>
          <div className="mt-0.5 text-[17px] font-bold tracking-[-0.03em] text-[#0a0a0a]">{title}</div>
        </div>
        <button type="button" onClick={close} aria-label="Close inspector"
          className="-mr-1.5 -mt-1 flex h-7 w-7 items-center justify-center rounded-full text-[#8a8a8a] transition-colors hover:bg-[#f3f3f3] hover:text-[#0a0a0a]">
          <IconX className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="divide-y divide-[#ededed]">{body}</div>
    </div>
  );
}
