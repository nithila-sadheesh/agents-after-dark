// Maps a SceneSpec (PRD §10.2 "dynamic 3D generation") onto the procedural component library.
import type { ReactNode } from 'react';
import type { SceneObject, SceneSpec, Vec3 } from '../../shared/types';
import { HOME_ANCHOR, SHOP_ANCHOR } from '../../shared/world';
import { useFoStore, type Selectable } from '../store';
import House from './components/House';
import Store from './components/Store';
import { Bench, Bush, Car, Lamp, Mailbox, Tree } from './components/Props';
import FloatingLabel from './components/FloatingLabel';
import { hash2, onSelect, useHover } from './worldState';

function Pickable({ kind, label, labelY, children }: { kind: Selectable; label: string; labelY: number; children: ReactNode }) {
  const { hovered, bind } = useHover();
  const selected = useFoStore((s) => s.selected === kind);
  return (
    <group onClick={onSelect(kind)} {...bind}>
      {children}
      {(hovered || selected) && <FloatingLabel text={label} position={[0, labelY, 0]} dim={!selected} />}
    </group>
  );
}

function SceneItem({ o, spec, shopActive }: { o: SceneObject; spec: SceneSpec; shopActive: boolean }) {
  const accent = spec.accent ?? '#7c9cff';
  const pos: Vec3 = o.id === 'home' ? HOME_ANCHOR : o.id === 'shop' ? SHOP_ANCHOR : o.position;
  const variant = Math.floor(hash2(o.position[0], o.position[2]) * 100);
  let node: ReactNode = null;
  switch (o.type) {
    case 'house':
      node = <House color={o.color} />;
      if (o.id === 'home') node = <Pickable kind="home" label="Home" labelY={5.4}>{node}</Pickable>;
      break;
    case 'store': {
      const label = (o.id === 'shop' ? spec.shopLabel || o.label : o.label || spec.shopLabel) ?? 'DRY CLEANERS';
      node = <Store label={label} color={o.color} accent={accent} active={o.id === 'shop' && shopActive} />;
      if (o.id === 'shop') node = <Pickable kind="shop" label={label} labelY={5.6}>{node}</Pickable>;
      break;
    }
    case 'tree': node = <Tree color={o.color} variant={variant} />; break;
    case 'bush': node = <Bush color={o.color} />; break;
    case 'lamp': node = <Lamp color={o.color} />; break;
    case 'car': node = <Car color={o.color} />; break;
    case 'bench': node = <Bench color={o.color} />; break;
    case 'mailbox': node = <Mailbox color={o.color} />; break;
  }
  return (
    <group position={pos} rotation-y={o.rotation ?? 0} scale={o.scale ?? 1}>
      {node}
    </group>
  );
}

export default function SceneRenderer({ scene }: { scene: SceneSpec }) {
  const shopActive = useFoStore((s) => s.shopActive);
  return (
    <group>
      {scene.objects.map((o) => <SceneItem key={o.id} o={o} spec={scene} shopActive={shopActive} />)}
    </group>
  );
}
