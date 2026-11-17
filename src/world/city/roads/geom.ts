// Geometry helpers (OWNER: roads).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Part = { g: THREE.BufferGeometry; c?: string | THREE.Color };

/** Merge parts into one non-indexed geometry, baking an optional per-part vertex colour. */
export function mergeParts(parts: Part[], withColor = parts.some((p) => p.c !== undefined)) {
  const gs = parts.map(({ g, c }) => {
    const ng = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(ng.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) ng.deleteAttribute(k);
    if (!ng.attributes.uv) ng.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
    if (withColor && !ng.attributes.color) {
      const col = new THREE.Color(c ?? '#ffffff'), n = ng.attributes.position.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
      ng.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
    }
    ng.clearGroups();
    return ng;
  });
  const m = mergeGeometries(gs, false)!;
  gs.forEach((g) => g.dispose());
  return m;
}

/** Transform helper: returns g after translate/rotate (mutates). */
export function at(g: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}
export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt: number, rb: number, h: number, seg = 12, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);

/** Overwrite UVs with world-space XZ / tile (after the geometry is in world coords). */
export function worldUV(g: THREE.BufferGeometry, tile: number, ox = 0, oz = 0) {
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - ox) / tile; uv[i * 2 + 1] = (p.getZ(i) - oz) / tile; }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

export type Xf = { x: number; y?: number; z: number; ry?: number; s?: number | [number, number, number]; color?: string };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export function fillInstances(mesh: THREE.InstancedMesh, xs: Xf[]) {
  xs.forEach((t, i) => {
    _q.setFromEuler(_e.set(0, t.ry ?? 0, 0));
    const s = t.s ?? 1;
    if (typeof s === 'number') _s.setScalar(s); else _s.set(...s);
    _m.compose(_p.set(t.x, t.y ?? 0, t.z), _q, _s);
    mesh.setMatrixAt(i, _m);
    if (t.color) mesh.setColorAt(i, new THREE.Color(t.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}
