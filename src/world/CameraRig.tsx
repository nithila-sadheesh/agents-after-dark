// Drives OrbitControls target + camera position from `useFoStore.camera`, yielding to the user while they interact.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useFoStore } from '../store';
import { damp, robotDisplay } from './worldState';

export const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 1.2);
export const OVERVIEW_OFFSET = new THREE.Vector3(6, 34, 39);
const FOCUS_OFFSET = new THREE.Vector3(5, 11.5, 14.5);
const FOLLOW_OFFSET = new THREE.Vector3(5.5, 10, 12.5);
const USER_HOLD_MS = 3000;

export default function CameraRig() {
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const st = useRef({ interacting: false, lastEnd: -Infinity, target: new THREE.Vector3(), pos: new THREE.Vector3() });

  useEffect(() => {
    if (!controls) return;
    const onStart = () => { st.current.interacting = true; };
    const onEnd = () => { st.current.interacting = false; st.current.lastEnd = performance.now(); };
    controls.addEventListener('start', onStart);
    controls.addEventListener('end', onEnd);
    return () => {
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', onEnd);
    };
  }, [controls]);

  // A new camera command from the app should take effect right away, even right after a user drag.
  useEffect(() => useFoStore.subscribe((s, p) => {
    if (s.camera !== p.camera) st.current.lastEnd = -Infinity;
  }), []);

  useFrame((_, dt) => {
    if (!controls) return;
    const s = st.current;
    if (s.interacting || performance.now() - s.lastEnd < USER_HOLD_MS) return;
    const cam = useFoStore.getState().camera;
    // keep the whole diorama in frame on narrow viewports
    const fit = Math.max(1, 1.55 / (size.width / Math.max(1, size.height)));
    let lambda = 2.2;
    if (cam.mode === 'follow') {
      s.target.copy(robotDisplay.position).setY(0.6);
      s.pos.copy(s.target).add(FOLLOW_OFFSET);
      lambda = 3;
    } else if (cam.mode === 'focus' && cam.target) {
      s.target.set(cam.target[0], cam.target[1] + 0.6, cam.target[2]);
      s.pos.copy(s.target).add(FOCUS_OFFSET);
    } else {
      s.target.copy(OVERVIEW_TARGET);
      s.pos.copy(OVERVIEW_OFFSET).multiplyScalar(fit).add(OVERVIEW_TARGET);
    }
    const k = damp(lambda, dt);
    controls.target.lerp(s.target, k);
    camera.position.lerp(s.pos, k);
  });

  return null;
}
