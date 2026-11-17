// Store-driven actors: the robot (pose from mutable `robotPose`) and the carried item (arc between spots).
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ITEM_SPOTS } from '../../shared/world';
import { robotPose, useFoStore, type ItemLocation } from '../store';
import DeliveryRobot from './components/DeliveryRobot';
import FloatingLabel from './components/FloatingLabel';
import { LaundryBag, PackageBox } from './components/Items';
import { damp, itemDisplay, onSelect, robotCargoAnchor, robotDisplay, useHover } from './worldState';

const ROBOT_SCALE = 1.35;
const ITEM_SCALE = 1.3;
const tmpV = new THREE.Vector3();
const setCargo = (o: THREE.Object3D | null) => { robotCargoAnchor.current = o; };

const shortestAngle = (from: number, to: number) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export function RobotActor({ accent }: { accent: string }) {
  const g = useRef<THREE.Group>(null);
  const status = useFoStore((s) => s.robot.status);
  const moving = useFoStore((s) => s.robot.moving);
  const { bind } = useHover();

  useFrame((_, dt) => {
    const [x, y, z] = robotPose.position;
    if (!robotDisplay.ready) {
      robotDisplay.position.set(x, y, z);
      robotDisplay.heading = robotPose.heading;
      robotDisplay.ready = true;
    } else {
      robotDisplay.position.lerp(tmpV.set(x, y, z), damp(16, dt));
      robotDisplay.heading += shortestAngle(robotDisplay.heading, robotPose.heading) * damp(10, dt);
    }
    if (!g.current) return;
    g.current.position.copy(robotDisplay.position);
    g.current.position.y += 0.06;
    g.current.rotation.y = robotDisplay.heading;
  });

  return (
    <group ref={g} onClick={onSelect('robot')} {...bind}>
      <group scale={ROBOT_SCALE}>
        <DeliveryRobot accent={accent} cargoRef={setCargo} />
      </group>
      <FloatingLabel text={status} position={[0, 2.6, 0]} live={moving} />
    </group>
  );
}

const ARC_TIME = 0.65;
const REST_YAW: Record<'home' | 'shop', number> = { home: 0.35, shop: -0.25 };
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function ItemActor() {
  const kind = useFoStore((s) => s.scene.itemKind);
  const clean = useFoStore((s) => s.item.clean);
  const g = useRef<THREE.Group>(null);
  const { bind } = useHover();
  const st = useRef({
    loc: null as ItemLocation | null,
    t: 1,
    land: 1,
    from: new THREE.Vector3(),
    fromQ: new THREE.Quaternion(),
    target: new THREE.Vector3(),
    targetQ: new THREE.Quaternion(),
    e: new THREE.Euler(),
  });

  useFrame((_, dt) => {
    const grp = g.current;
    if (!grp) return;
    const s = st.current;
    const loc = useFoStore.getState().item.location;

    // where the item should be right now
    const anchor = robotCargoAnchor.current;
    if (loc === 'robot' && anchor) {
      anchor.updateWorldMatrix(true, false);
      anchor.getWorldPosition(s.target);
      anchor.getWorldQuaternion(s.targetQ);
    } else {
      const spot = ITEM_SPOTS[loc === 'shop' ? 'shop' : 'home'];
      s.target.set(spot[0], spot[1] + 0.06, spot[2]);
      s.targetQ.setFromEuler(s.e.set(0, REST_YAW[loc === 'shop' ? 'shop' : 'home'], 0));
    }

    if (s.loc === null) {
      s.loc = loc;
      grp.position.copy(s.target);
      grp.quaternion.copy(s.targetQ);
    } else if (loc !== s.loc) {
      s.loc = loc;
      s.t = 0;
      s.from.copy(grp.position);
      s.fromQ.copy(grp.quaternion);
    }

    if (s.t < 1) {
      s.t = Math.min(1, s.t + dt / ARC_TIME);
      const e = easeInOut(s.t);
      const hop = 0.9 + 0.12 * s.from.distanceTo(s.target);
      grp.position.lerpVectors(s.from, s.target, e);
      grp.position.y += Math.sin(Math.PI * s.t) * hop;
      grp.quaternion.slerpQuaternions(s.fromQ, s.targetQ, e);
      grp.rotateZ(Math.sin(Math.PI * s.t) * 0.35);
      grp.scale.set(1, 1 + Math.sin(Math.PI * s.t) * 0.12, 1);
      if (s.t >= 1) s.land = 0;
    } else {
      grp.position.copy(s.target);
      grp.quaternion.copy(s.targetQ);
      // landing squash
      if (s.land < 1) {
        s.land = Math.min(1, s.land + dt / 0.3);
        const q = Math.sin(Math.PI * s.land) * (1 - s.land);
        grp.scale.set(1 + q * 0.35, 1 - q * 0.45, 1 + q * 0.35);
      } else grp.scale.set(1, 1, 1);
    }
    itemDisplay.position.copy(grp.position);
  });

  return (
    <group ref={g} onClick={onSelect('item')} {...bind}>
      <group scale={ITEM_SCALE}>
        {kind === 'package' ? <PackageBox clean={clean} /> : <LaundryBag clean={clean} />}
      </group>
    </group>
  );
}
