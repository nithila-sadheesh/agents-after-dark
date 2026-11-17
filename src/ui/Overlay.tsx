import './overlay.css';
import ActivityFeed from './ActivityFeed';
import ApprovalCard from './ApprovalCard';
import Brand from './Brand';
import ChatPanel from './ChatPanel';
import Controls from './Controls';
import HeroHint from './HeroHint';
import Inspector from './Inspector';
import TaskPanel from './TaskPanel';
import Toast from './Toast';

// Root is click-through so the 3D scene stays orbitable; each panel opts back in with pointer-events-auto.
export default function Overlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-white">
      <HeroHint />
      <Brand />
      <Inspector />
      <ChatPanel />
      <div className="pointer-events-none absolute bottom-[4.75rem] right-5 top-5 flex w-[330px] flex-col gap-3">
        <TaskPanel />
        <ActivityFeed />
      </div>
      <ApprovalCard />
      <Toast />
      <Controls />
    </div>
  );
}
