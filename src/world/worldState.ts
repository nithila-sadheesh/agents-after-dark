// Module-level, non-reactive state shared between world components (read/written inside useFrame).
import * as THREE from 'three';
import { useState } from 'react';
import { useCursor } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useFoStore, type Selectable } from '../store';

/** Smoothed robot pose as actually displayed (follows `robotPose`). */
export const robotDisplay = { position: new THREE.Vector3(), heading: 0, ready: false };
/** Anchor inside the robot's cargo bed (set by DeliveryRobot). The item parks here when location==='robot'. */
export const robotCargoAnchor: { current: THREE.Object3D | null } = { current: null };
/** Displayed item position (for highlight rings). */
export const itemDisplay = { position: new THREE.Vector3() };

export const select = (s: Selectable | null) => useFoStore.setState({ selected: s });

/** onClick handler that selects `kind`, ignoring drags. */
export const onSelect = (kind: Selectable | null) => (e: ThreeEvent<MouseEvent>) => {
  e.stopPropagation();
  if (e.delta > 6) return;
  select(kind);
};

/** Hover state + pointer cursor. Spread `bind` onto a group. */
export function useHover() {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  return {
    hovered,
    bind: {
      onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(true); },
      onPointerOut: () => setHovered(false),
    },
  };
}

let glowTex: THREE.Texture | null = null;
/** Soft radial white gradient, used for light pools and halos. */
export function getGlowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** Deterministic 0..1 hash from a position, for per-instance variation. */
export const hash2 = (x: number, z: number) => {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

export const damp = (lambda: number, dt: number) => 1 - Math.exp(-lambda * Math.min(dt, 0.1));
