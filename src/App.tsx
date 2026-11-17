import WorldCanvas from './world/WorldCanvas';
import Overlay from './ui/Overlay';

export default function App() {
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0b1020] text-white">
      <WorldCanvas />
      <Overlay />
    </div>
  );
}
