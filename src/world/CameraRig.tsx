// Cinematic camera driven by `useFoStore.camera.mode`. OWNER: env agent.
//   overview  aerial 3/4 view over the robot's route with the city and hazy skyline beyond (slow drift)
//   focus     eases toward camera.target, ~22m away
//   follow    damped chase cam behind/above the robot; swings smoothly through corners and lifts while turning
// The orbit target and the camera offset are damped separately (frame-rate independent), so moves arc instead of
// cutting straight lines. Dragging OrbitControls pauses the rig during the drag and for 3s after; any new camera
// command takes over immediately. `?cam=px,py,pz,tx,ty,tz` pins the camera (debug) and disables the rig.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { robotPose, useFoStore } from '../store';
import { damp, robotDisplay } from './worldState';

const PIN = new URLSearchParams(location.search).get('cam')?.split(',').map(Number);
const PINNED = !!PIN && PIN.length === 6 && PIN.every(Number.isFinite);

// Overview: route area x∈[-50,15], z∈[-30,45]; aim a little behind its center so the far city fills the top of frame.
const OVERVIEW_TARGET = new THREE.Vector3(-19, 0, 2);
const OVERVIEW_AZIM = THREE.MathUtils.degToRad(24);   // from +Z toward +X
const OVERVIEW_ELEV = THREE.MathUtils.degToRad(31);
const OVERVIEW_DIST = 138;
const FOCUS_OFFSET = new THREE.Vector3(7, 15, 14);      // ~21.7m
const FOLLOW_BACK = 15.5, FOLLOW_UP = 10.5;              // chase offset; lifts/pulls in while swinging through turns
const USER_HOLD_MS = 3000;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export default function CameraRig() {
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const st = useMemo(() => ({
    interacting: false, lastEnd: -Infinity, fresh: true,
    yaw: 0, lift: 0, t: 0,
    target: new THREE.Vector3(), off: new THREE.Vector3(), cur: new THREE.Vector3(), robot: new THREE.Vector3(),
  }), []);

  // ?cam= pin (debug), applied once.
  useEffect(() => {
    if (!PINNED) return;
    const [px, py, pz, tx, ty, tz] = PIN!;
    camera.position.set(px, py, pz);
    if (controls) { controls.target.set(tx, ty, tz); controls.update(); } else camera.lookAt(tx, ty, tz);
  }, [camera, controls]);

  // Start in overview framing (no long fly-in on load).
  useEffect(() => {
    if (PINNED || !controls) return;
    const off = new THREE.Vector3(Math.sin(OVERVIEW_AZIM) * Math.cos(OVERVIEW_ELEV), Math.sin(OVERVIEW_ELEV), Math.cos(OVERVIEW_AZIM) * Math.cos(OVERVIEW_ELEV)).multiplyScalar(OVERVIEW_DIST);
    controls.target.copy(OVERVIEW_TARGET);
    camera.position.copy(OVERVIEW_TARGET).add(off);
    controls.update();
  }, [camera, controls]);

  useEffect(() => {
    if (!controls) return;
    const onStart = () => { st.interacting = true; };
    const onEnd = () => { st.interacting = false; st.lastEnd = performance.now(); };
    controls.addEventListener('start', onStart);
    controls.addEventListener('end', onEnd);
    return () => { controls.removeEventListener('start', onStart); controls.removeEventListener('end', onEnd); };
  }, [controls, st]);

  // A new camera command takes over right away, even right after a user drag.
  useEffect(() => useFoStore.subscribe((s, p) => {
    if (s.camera !== p.camera) { st.lastEnd = -Infinity; st.fresh = true; }
  }), [st]);

  useFrame((_, dt) => {
    if (PINNED || !controls) return;
    st.t += dt;
    // keep users from panning off into the void
    const tg = controls.target;
    tg.set(THREE.MathUtils.clamp(tg.x, -150, 150), THREE.MathUtils.clamp(tg.y, 0, 25), THREE.MathUtils.clamp(tg.z, -130, 130));
    if (st.interacting || performance.now() - st.lastEnd < USER_HOLD_MS) return;

    const cam = useFoStore.getState().camera;
    const fit = Math.max(1, (16 / 9) / Math.max(0.3, size.width / Math.max(1, size.height))) ** 0.85;
    let lt = 1.8, lo = 1.6; // target / offset damping rates

    if (cam.mode === 'follow') {
      const rp = robotDisplay.ready ? st.robot.copy(robotDisplay.position) : st.robot.fromArray(robotPose.position);
      const heading = robotDisplay.ready ? robotDisplay.heading : robotPose.heading;
      if (st.fresh) st.yaw = heading;
      st.yaw = wrap(st.yaw + wrap(heading - st.yaw) * damp(1.7, dt));
      const err = Math.abs(wrap(heading - st.yaw));
      st.lift += (THREE.MathUtils.smoothstep(err, 0.12, 0.8) - st.lift) * damp(3, dt);
      const back = FOLLOW_BACK - 3 * st.lift, up = FOLLOW_UP + 8 * st.lift;
      const fx = Math.sin(st.yaw), fz = Math.cos(st.yaw);
      st.target.set(rp.x + fx * 2.5, 0.9, rp.z + fz * 2.5);
      st.off.set(-fx * back, up, -fz * back);
      lt = 5; lo = 3;
    } else if (cam.mode === 'focus' && cam.target) {
      st.target.set(cam.target[0], cam.target[1] + 1, cam.target[2]);
      st.off.copy(FOCUS_OFFSET).multiplyScalar(fit);
      lt = 2.2; lo = 2;
    } else {
      const az = OVERVIEW_AZIM + Math.sin(st.t * 0.05) * 0.07; // slow cinematic drift
      st.target.copy(OVERVIEW_TARGET);
      st.off.set(Math.sin(az) * Math.cos(OVERVIEW_ELEV), Math.sin(OVERVIEW_ELEV), Math.cos(az) * Math.cos(OVERVIEW_ELEV)).multiplyScalar(OVERVIEW_DIST * fit);
    }
    st.fresh = false;

    st.cur.copy(camera.position).sub(tg);
    tg.lerp(st.target, damp(lt, dt));
    st.cur.lerp(st.off, damp(lo, dt));
    camera.position.copy(tg).add(st.cur);
  });

  return null;
}
