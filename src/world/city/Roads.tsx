// Street network (OWNER: roads): asphalt, raised sidewalks + curbs, block paving, paint markings.
import * as THREE from 'three';
import { useMemo } from 'react';
import { CITY_BOUNDS, STREETS_X, STREETS_Z } from '../../../shared/world';
import { BLOCKS, CURB_R, CURB_W, HALF_ROAD, SIDEWALK_TOP, type Block } from './roads/layout';
import { mergeParts, worldUV } from './roads/geom';
import Furniture from './roads/Furniture';
import { ASPHALT_TILE, PAINT_TILE, PLAZA_TILE, SIDEWALK_TILE, asphaltTextures, concreteTexture, paintWearTexture, plazaTextures, sidewalkTextures } from './roads/textures';

// Shape coords: (x, -z); after rotateX(-PI/2) a shape point (x, y) at depth d lands at world (x, d, -y).
function rrect(s: THREE.Path, b: { minX: number; maxX: number; minZ: number; maxZ: number }, r: [number, number, number, number]) {
  const { minX, maxX } = b, y0 = -b.maxZ, y1 = -b.minZ;
  s.moveTo(minX + r[0], y0);
  s.lineTo(maxX - r[1], y0); if (r[1]) s.absarc(maxX - r[1], y0 + r[1], r[1], -Math.PI / 2, 0, false);
  s.lineTo(maxX, y1 - r[2]); if (r[2]) s.absarc(maxX - r[2], y1 - r[2], r[2], 0, Math.PI / 2, false);
  s.lineTo(minX + r[3], y1); if (r[3]) s.absarc(minX + r[3], y1 - r[3], r[3], Math.PI / 2, Math.PI, false);
  s.lineTo(minX, y0 + r[0]); if (r[0]) s.absarc(minX + r[0], y0 + r[0], r[0], Math.PI, Math.PI * 1.5, false);
}
// corner radii in shape order: (minX,maxZ) (maxX,maxZ) (maxX,minZ) (minX,minZ)
const radii = (b: Block, R: number): [number, number, number, number] =>
  [b.sx0 && b.sz1 ? R : 0, b.sx1 && b.sz1 ? R : 0, b.sx1 && b.sz0 ? R : 0, b.sx0 && b.sz0 ? R : 0];
const inset = (b: Block, d: number, all = false) => ({
  minX: b.minX + (all || b.sx0 ? d : 0), maxX: b.maxX - (all || b.sx1 ? d : 0),
  minZ: b.minZ + (all || b.sz0 ? d : 0), maxZ: b.maxZ - (all || b.sz1 ? d : 0),
});
const flat = (g: THREE.BufferGeometry, y: number) => { g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; };

function buildGround() {
  const curbs: THREE.BufferGeometry[] = [], walks: THREE.BufferGeometry[] = [], plazas: THREE.BufferGeometry[] = [];
  for (const b of BLOCKS) {
    const outer = new THREE.Shape(); rrect(outer, b, radii(b, CURB_R));
    const ci = inset(b, CURB_W), cr = radii(b, CURB_R - CURB_W);
    const hole = new THREE.Path(); rrect(hole, ci, cr); outer.holes.push(hole);
    const cg = new THREE.ExtrudeGeometry(outer, { depth: SIDEWALK_TOP, bevelEnabled: false, curveSegments: 10 });
    cg.rotateX(-Math.PI / 2);
    const p = cg.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const v = 0.55 + 0.45 * (p.getY(i) / SIDEWALK_TOP); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v; }
    cg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    curbs.push(cg.toNonIndexed ? (cg.index ? cg.toNonIndexed() : cg) : cg);
    const ws = new THREE.Shape(); rrect(ws, ci, cr);
    const inner = inset(b, 3); const ih = new THREE.Path(); rrect(ih, inner, [0, 0, 0, 0]); ws.holes.push(ih);
    walks.push(worldUV(flat(new THREE.ShapeGeometry(ws, 10), SIDEWALK_TOP), SIDEWALK_TILE, b.minX, b.minZ));
    const ps = new THREE.Shape(); rrect(ps, inner, [0, 0, 0, 0]);
    plazas.push(worldUV(flat(new THREE.ShapeGeometry(ps), SIDEWALK_TOP), PLAZA_TILE));
  }
  const W = CITY_BOUNDS.maxX - CITY_BOUNDS.minX, D = CITY_BOUNDS.maxZ - CITY_BOUNDS.minZ;
  const asphalt = worldUV(flat(new THREE.PlaneGeometry(W, D), 0).translate((CITY_BOUNDS.minX + CITY_BOUNDS.maxX) / 2, 0, (CITY_BOUNDS.minZ + CITY_BOUNDS.maxZ) / 2), ASPHALT_TILE);
  return { asphalt, curb: mergeParts(curbs.map((g) => ({ g }))), walk: mergeParts(walks.map((g) => ({ g })), false), plaza: mergeParts(plazas.map((g) => ({ g })), false) };
}

function buildMarkings() {
  const pos: number[] = [], colr: number[] = [];
  const W = new THREE.Color('#e4e1d8'), Y = new THREE.Color('#d9a91e');
  const quad = (cx: number, cz: number, sx: number, sz: number, c: THREE.Color) => {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, y = 0.012;
    pos.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
    for (let i = 0; i < 6; i++) colr.push(c.r, c.g, c.b);
  };
  const xs = [CITY_BOUNDS.minX, ...STREETS_X, CITY_BOUNDS.maxX], zs = [CITY_BOUNDS.minZ, ...STREETS_Z, CITY_BOUNDS.maxZ];
  // center lines + stop lines along each street segment
  for (const X of STREETS_X) for (let j = 0; j < zs.length - 1; j++) {
    const a = zs[j] + (j > 0 ? 9.5 : 0), b = zs[j + 1] - (j < zs.length - 2 ? 9.5 : 0), m = (a + b) / 2, L = b - a;
    quad(X - 0.11, m, 0.12, L, Y); quad(X + 0.11, m, 0.12, L, Y);
  }
  for (const Z of STREETS_Z) for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i] + (i > 0 ? 9.5 : 0), b = xs[i + 1] - (i < xs.length - 2 ? 9.5 : 0), m = (a + b) / 2, L = b - a;
    quad(m, Z - 0.11, L, 0.12, Y); quad(m, Z + 0.11, L, 0.12, Y);
  }
  for (const X of STREETS_X) for (const Z of STREETS_Z) {
    // zebra crosswalks on all four legs (centre 6.5 from the intersection, 3m wide)
    for (let k = -4; k <= 4; k++) {
      const o = k * 1.1;
      quad(X - 6.5, Z + o, 3, 0.55, W); quad(X + 6.5, Z + o, 3, 0.55, W);
      quad(X + o, Z - 6.5, 0.55, 3, W); quad(X + o, Z + 6.5, 0.55, 3, W);
    }
    // stop lines on the approach lanes (right-hand traffic)
    quad(X - 8.6, Z + 2.6, 0.45, 4.6, W); quad(X + 8.6, Z - 2.6, 0.45, 4.6, W);
    quad(X - 2.6, Z - 8.6, 4.6, 0.45, W); quad(X + 2.6, Z + 8.6, 4.6, 0.45, W);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.computeVertexNormals();
  return worldUV(g, PAINT_TILE);
}

export default function Roads() {
  const r = useMemo(() => {
    const ground = buildGround(), marks = buildMarkings();
    const at = asphaltTextures(), sw = sidewalkTextures(), pz = plazaTextures();
    const asphaltMat = new THREE.MeshStandardMaterial({ ...at, color: '#ffffff', normalScale: new THREE.Vector2(0.6, 0.6) });
    const walkMat = new THREE.MeshStandardMaterial({ ...sw, normalScale: new THREE.Vector2(0.5, 0.5) });
    const plazaMat = new THREE.MeshStandardMaterial({ ...pz, color: '#d8d4cc' });
    const ct = concreteTexture();
    const curbMat = new THREE.MeshStandardMaterial({ map: ct, vertexColors: true, roughness: 0.85, color: '#d6d3cc' });
    const paintMat = new THREE.MeshStandardMaterial({ vertexColors: true, alphaMap: paintWearTexture(), alphaTest: 0.45, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    return { ground, marks, asphaltMat, walkMat, plazaMat, curbMat, paintMat };
  }, []);
  return (
    <group>
      <mesh geometry={r.ground.asphalt} material={r.asphaltMat} receiveShadow />
      <mesh geometry={r.ground.curb} material={r.curbMat} receiveShadow />
      <mesh geometry={r.ground.walk} material={r.walkMat} receiveShadow />
      <mesh geometry={r.ground.plaza} material={r.plazaMat} receiveShadow />
      <mesh geometry={r.marks} material={r.paintMat} receiveShadow />
      <Furniture />
    </group>
  );
}

export { HALF_ROAD };
