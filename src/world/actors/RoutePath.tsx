// AR-style guidance ribbon along store.route: soft-edged emissive line with a flowing pulse in the travel
// direction; the part already driven fades out behind the robot.
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Vec3 } from '../../../shared/types';
import { robotDisplay } from '../worldState';
import { groundY } from '../city/roads/layout'; // sidewalks/lots sit 0.15 above the road

const HALF_W = 0.22;
const LIFT = 0.03;

function buildRibbon(points: Vec3[]) {
  const pts: THREE.Vector2[] = [];
  for (const p of points) {
    const v = new THREE.Vector2(p[0], p[2]);
    if (!pts.length || pts[pts.length - 1].distanceTo(v) > 1e-3) pts.push(v);
  }
  if (pts.length < 2) return null;
  const pos: number[] = [], dist: number[] = [], side: number[] = [], idx: number[] = [], cum: number[] = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const d0 = i > 0 ? p.clone().sub(pts[i - 1]).normalize() : null;
    const d1 = i < pts.length - 1 ? pts[i + 1].clone().sub(p).normalize() : null;
    const n0 = d0 ? new THREE.Vector2(-d0.y, d0.x) : null;
    const n1 = d1 ? new THREE.Vector2(-d1.y, d1.x) : null;
    const miter = n0 && n1 ? n0.clone().add(n1).normalize() : (n0 ?? n1)!;
    const sc = 1 / Math.max(0.4, miter.dot(n1 ?? n0!));
    if (i > 0) acc += p.distanceTo(pts[i - 1]);
    cum.push(acc);
    for (const s of [-1, 1]) {
      pos.push(p.x + miter.x * HALF_W * sc * s, groundY(p.x, p.y) + LIFT, p.y + miter.y * HALF_W * sc * s);
      dist.push(acc);
      side.push(s);
    }
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDist', new THREE.Float32BufferAttribute(dist, 1));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(idx);
  return { geometry: g, length: acc, pts, cum };
}

const vert = /* glsl */ `
  attribute float aDist; attribute float aSide;
  varying float vDist; varying float vSide;
  void main() { vDist = aDist; vSide = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const frag = /* glsl */ `
  uniform float uTime; uniform float uLen; uniform float uProg; uniform vec3 uColor;
  varying float vDist; varying float vSide;
  void main() {
    float s = abs(vSide);
    float core = exp(-s * s * 14.0);
    float body = 1.0 - smoothstep(0.35, 1.0, s);
    float f = fract((vDist - s * 0.35) * 0.5 - uTime * 0.9);
    float chev = smoothstep(0.0, 0.08, f) * (1.0 - smoothstep(0.14, 0.32, f));
    float ends = smoothstep(0.0, 0.6, vDist) * smoothstep(0.0, 0.8, uLen - vDist);
    float ahead = smoothstep(uProg - 0.3, uProg + 0.9, vDist);
    float a = (body * 0.16 + core * 0.45 + chev * body * 0.4) * ends * ahead;
    gl_FragColor = vec4(uColor * (1.0 + core * 0.8 + chev * 1.2), a);
  }
`;

export default function RoutePath({ points, color }: { points: Vec3[] | null; color: string }) {
  const ribbon = useMemo(() => (points ? buildRibbon(points) : null), [points]);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { uTime: { value: 0 }, uLen: { value: 1 }, uProg: { value: 0 }, uColor: { value: new THREE.Color(color) } },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const best = useRef(0);
  useEffect(() => { mat.uniforms.uColor.value.set(color); }, [color, mat]);
  useEffect(() => { best.current = 0; if (ribbon) mat.uniforms.uLen.value = ribbon.length; return () => ribbon?.geometry.dispose(); }, [ribbon, mat]);

  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
    if (!ribbon) return;
    // project the robot onto the polyline (monotonic progress)
    const px = robotDisplay.position.x, pz = robotDisplay.position.z;
    let bd = Infinity, bp = best.current;
    for (let i = 0; i < ribbon.pts.length - 1; i++) {
      const a = ribbon.pts[i], b = ribbon.pts[i + 1];
      const ex = b.x - a.x, ez = b.y - a.y, l2 = ex * ex + ez * ez || 1;
      const t = Math.min(1, Math.max(0, ((px - a.x) * ex + (pz - a.y) * ez) / l2));
      const qx = a.x + ex * t - px, qz = a.y + ez * t - pz, d = qx * qx + qz * qz;
      if (d < bd) { bd = d; bp = ribbon.cum[i] + Math.sqrt(l2) * t; }
    }
    if (bd < 4) best.current = Math.max(best.current, bp);
    mat.uniforms.uProg.value = best.current;
  });

  if (!ribbon) return null;
  return <mesh geometry={ribbon.geometry} material={mat} renderOrder={3} frustumCulled={false} />;
}
