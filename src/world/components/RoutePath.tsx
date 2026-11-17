import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Vec3 } from '../../../shared/types';
import { getGlowTexture } from '../worldState';

const HALF_W = 0.32;
const LIFT = 0.08;

/** Flat ribbon along the polyline with per-vertex distance + side attributes (mitered corners). */
function buildRibbon(points: Vec3[]) {
  const pts: THREE.Vector2[] = [];
  for (const p of points) {
    const v = new THREE.Vector2(p[0], p[2]);
    if (!pts.length || pts[pts.length - 1].distanceTo(v) > 1e-3) pts.push(v);
  }
  if (pts.length < 2) return null;
  const pos: number[] = [], dist: number[] = [], side: number[] = [], idx: number[] = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const d0 = i > 0 ? p.clone().sub(pts[i - 1]).normalize() : null;
    const d1 = i < pts.length - 1 ? pts[i + 1].clone().sub(p).normalize() : null;
    const n0 = d0 ? new THREE.Vector2(-d0.y, d0.x) : null;
    const n1 = d1 ? new THREE.Vector2(-d1.y, d1.x) : null;
    const miter = n0 && n1 ? n0.clone().add(n1).normalize() : (n0 ?? n1)!;
    const scale = 1 / Math.max(0.35, miter.dot(n1 ?? n0!));
    if (i > 0) acc += p.distanceTo(pts[i - 1]);
    for (const s of [-1, 1]) {
      pos.push(p.x + miter.x * HALF_W * scale * s, 0, p.y + miter.y * HALF_W * scale * s);
      dist.push(acc);
      side.push(s);
    }
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDist', new THREE.Float32BufferAttribute(dist, 1));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(idx);
  return { geometry: g, length: acc, end: pts[pts.length - 1] };
}

const vert = /* glsl */ `
  attribute float aDist; attribute float aSide;
  varying float vDist; varying float vSide;
  void main() { vDist = aDist; vSide = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const frag = /* glsl */ `
  uniform float uTime; uniform float uLen; uniform vec3 uColor;
  varying float vDist; varying float vSide;
  void main() {
    float s = abs(vSide);
    float chev = fract((vDist + s * 0.3) * 0.9 - uTime * 1.3);
    float arrow = smoothstep(0.0, 0.08, chev) * (1.0 - smoothstep(0.3, 0.42, chev));
    float rim = smoothstep(0.72, 0.9, s) * (1.0 - smoothstep(0.92, 1.0, s));
    float fade = smoothstep(0.0, 0.8, vDist) * smoothstep(0.0, 0.5, uLen - vDist);
    float a = (0.18 + arrow * 0.75 + rim * 0.7) * fade;
    gl_FragColor = vec4(uColor * (0.9 + arrow * 2.6 + rim * 1.4), a);
  }
`;

/** Glowing animated route along `points`. Renders nothing when null. */
export default function RoutePath({ points, color = '#7c9cff' }: { points: Vec3[] | null; color?: string }) {
  const ribbon = useMemo(() => (points ? buildRibbon(points) : null), [points]);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: { uTime: { value: 0 }, uLen: { value: 1 }, uColor: { value: new THREE.Color(color) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const marker = useRef<THREE.Group>(null);

  useEffect(() => { mat.uniforms.uColor.value.set(color); }, [color, mat]);
  useEffect(() => { if (ribbon) mat.uniforms.uLen.value = ribbon.length; }, [ribbon, mat]);
  useEffect(() => () => ribbon?.geometry.dispose(), [ribbon]);

  useFrame(({ clock }, dt) => {
    mat.uniforms.uTime.value += dt;
    if (marker.current) {
      const k = (clock.elapsedTime * 0.8) % 1;
      marker.current.children[0].scale.setScalar(0.6 + k * 0.9);
      ((marker.current.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - k;
    }
  });

  if (!ribbon) return null;
  return (
    <group>
      <mesh geometry={ribbon.geometry} material={mat} position-y={LIFT} renderOrder={3} />
      <group ref={marker} position={[ribbon.end.x, LIFT + 0.01, ribbon.end.y]}>
        <mesh rotation-x={-Math.PI / 2} renderOrder={3}>
          <ringGeometry args={[0.55, 0.7, 40]} />
          <meshBasicMaterial color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} renderOrder={3}>
          <planeGeometry args={[2.2, 2.2]} />
          <meshBasicMaterial map={getGlowTexture()} color={color} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    </group>
  );
}
