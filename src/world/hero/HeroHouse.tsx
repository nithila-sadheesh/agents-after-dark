// Hero townhouse (brick + brownstone trim) in HOME_LOT; facade at HOME_FACADE_Z facing +Z, door at x=-40.
// Simplified build (deadline): boxes only. Keeps the stoop foot (z<-9.85), walkway and robot pad clear.
import { Text } from '@react-three/drei';
import numFont from '@fontsource/inter/files/inter-latin-700-normal.woff?url';
import { useFoStore } from '../../store';
import { onSelect, useHover } from '../worldState';
import { SIDEWALK_TOP } from '../city/roads/layout';
import { B, BrickBox, Boxes, LightPool, Windows, windowSet, type Bx, type Win } from './common';

const Z = -11; // facade plane
const BRICK = '#7a3f2e';
const STONE = '#5c4334';
const TRIM = '#e9e2d4';
const IRON = '#161616';
const GLASS = '#232a31';

const LIME = '#cdbd9f';
const WIN: Win[] = [
  // x, sill, w, h, lit
  [-44.2, 1.6, 1.1, 2.5, true], [-42.3, 1.6, 1.1, 2.5, false],
  [-44.2, 5.2, 1.1, 2.1, false], [-42.3, 5.2, 1.1, 2.1, true], [-40, 5.2, 1.1, 2.1, false],
  [-44.2, 8.35, 1.0, 1.9, false], [-42.3, 8.35, 1.0, 1.9, false], [-40, 8.35, 1.0, 1.9, true],
  [-37.9, 8.35, 1.0, 1.9, false], [-35.9, 8.35, 1.0, 1.9, true],
  [-36.9, 1.6, 2.6, 2.5, true, Z + 0.8], [-36.9, 5.2, 2.6, 2.1, false, Z + 0.8], // bay
];
const WINS = windowSet(WIN, Z);

// paneled door slab + raised panels + transom bar
const DOOR: Bx[] = [[-40.7, -39.3, 1, 3.45, Z + 0.1, Z + 0.16],
  ...[-40.33, -39.67].flatMap((cx): Bx[] => [[1.15, 1.8], [1.95, 2.6], [2.75, 3.3]].map(([a, b]): Bx => [cx - 0.24, cx + 0.24, a, b, Z + 0.16, Z + 0.19]))];
// cornice: frieze, bed, crown, brackets, dentils
const CORNICE: Bx[] = [[-45.6, -34.4, 10.55, 11, Z, Z + 0.1], [-45.6, -34.4, 11, 11.45, Z - 0.3, Z + 0.4], [-45.75, -34.25, 11.45, 11.8, Z - 0.3, Z + 0.65],
  ...Array.from({ length: 12 }, (_, i): Bx => { const x = -45.3 + i * (10.6 / 11); return [x - 0.08, x + 0.08, 10.45, 11.45, Z, Z + 0.55]; }),
  ...Array.from({ length: 52 }, (_, i): Bx => { const x = -45.5 + i * 0.21; return [x - 0.05, x + 0.05, 10.92, 11.02, Z + 0.4, Z + 0.47]; })];
// stoop: 4 steps of 0.25 rise x 0.28 run, foot at z=-9.88
const STEPS: Bx[] = [0, 1, 2, 3].map((k): Bx => [-41, -39, 0, 1 - k * 0.25, Z, Z + 0.28 * (k + 1)]);
const stepTop = (z: number) => 1 - 0.25 * Math.min(3, Math.floor((z - Z) / 0.28));
function railing(): Bx[] {
  const out: Bx[] = [];
  const zA = Z + 0.05, yA = 1.95, zB = Z + 1.05, yB = 1.1, L = Math.hypot(zB - zA, yA - yB), a = Math.atan2(yA - yB, zB - zA);
  for (const x of [-40.95, -39.05]) {
    const cz = (zA + zB) / 2, cy = (yA + yB) / 2;
    out.push([x - 0.03, x + 0.03, cy - 0.025, cy + 0.025, cz - L / 2, cz + L / 2, -a]);
    out.push([x - 0.045, x + 0.045, 0.25, 1.25, zB - 0.045, zB + 0.045]); // newel
    for (let z = zA + 0.1; z < zB - 0.04; z += 0.11) {
      const ry = yA + ((z - zA) * (yB - yA)) / (zB - zA);
      out.push([x - 0.012, x + 0.012, stepTop(z), ry, z - 0.012, z + 0.012]);
    }
  }
  // front yard fence: rails + pickets (gap for walkway + robot)
  for (const [a0, a1] of [[-45.95, -40.95], [-37.35, -34.05]]) {
    out.push([a0, a1, 0.12, 0.17, -8.1, -8.06], [a0, a1, 0.92, 0.98, -8.11, -8.05]);
    for (let x = a0 + 0.04; x < a1; x += 0.12) out.push([x - 0.012, x + 0.012, 0, 1.05, -8.09, -8.07]);
  }
  return out;
}
const IRONS = railing();

export default function HeroHouse() {
  const on = useFoStore((s) => s.highlights.includes('home'));
  const { bind } = useHover();
  return (
    <group position-y={SIDEWALK_TOP}>
      {/* click/hover proxy (building only, not the yard where the robot parks) */}
      <mesh position={[-40, 6, -18]} onClick={onSelect('home')} {...bind}>
        <boxGeometry args={[11, 12, 14.2]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {/* body + brownstone base + water table */}
      <BrickBox x={[-45.5, -34.5]} y={[1, 11]} z={[-25, Z]} c={BRICK} />
      <B x={[-45.5, -34.5]} y={[0, 1]} z={[-25, Z + 0.05]} c={STONE} r={0.9} />
      <B x={[-45.6, -34.4]} y={[0.95, 1.08]} z={[-11.2, Z + 0.12]} c={STONE} />
      {/* cornice with brackets + dentils */}
      <Boxes items={CORNICE}><meshStandardMaterial color="#2e2723" roughness={0.6} /></Boxes>
      {/* windows: trim, sills, lintels, glass / warm interiors */}
      <Windows set={WINS} trim={TRIM} stone={LIME} />
      {/* bay window (parlor + 2nd floor) */}
      <BrickBox x={[-38.6, -35.2]} y={[1, 7.8]} z={[Z, Z + 0.8]} c={BRICK} />
      <B x={[-38.6, -35.2]} y={[0, 1]} z={[Z, Z + 0.85]} c={STONE} r={0.9} />
      <B x={[-38.75, -35.05]} y={[7.8, 8.1]} z={[Z, Z + 0.95]} c="#2e2723" />
      {/* recessed door with surround, transom, number */}
      <B x={[-41.05, -38.95]} y={[1, 4.25]} z={[Z, Z + 0.1]} c={STONE} />
      <Boxes items={DOOR}><meshStandardMaterial color="#3a1d14" roughness={0.4} /></Boxes>
      <B x={[-39.5, -39.42]} y={[2.2, 2.28]} z={[Z + 0.19, Z + 0.25]} c="#d8b25a" r={0.3} m={0.9} cast={false} />
      <B x={[-40.7, -39.3]} y={[3.5, 3.9]} z={[Z + 0.1, Z + 0.14]} c="#3a2c20" r={0.1} e="#ffcf8a" ei={0.8} cast={false} />
      <Text font={numFont} position={[-40, 3.7, Z + 0.15]} fontSize={0.2} anchorX="center" anchorY="middle">
        347
        <meshStandardMaterial color="#d8b25a" metalness={0.8} roughness={0.3} />
      </Text>
      <pointLight position={[-40, 3.2, -10.4]} color="#ffc27a" intensity={2} distance={5} decay={2} />
      {/* stoop: 4 risers, foot at z=-9.88; iron railings + yard fence (instanced pickets) */}
      <Boxes items={STEPS}><meshStandardMaterial color={STONE} roughness={0.9} /></Boxes>
      <Boxes items={IRONS}><meshStandardMaterial color={IRON} roughness={0.45} metalness={0.7} /></Boxes>
      {/* yard: paving, planting bed, tree, low iron fence (gap x∈[-40.9,-37.4] for walkway + robot) */}
      <B x={[-45.5, -34.5]} y={[0, 0.04]} z={[Z, -8.05]} c="#6f747a" r={0.95} cast={false} />
      <B x={[-45.5, -42.2]} y={[0, 0.2]} z={[-10.9, -8.3]} c="#3e2f22" r={1} cast={false} />
      <B x={[-44.15, -44.0]} y={[0, 2.4]} z={[-9.7, -9.55]} c="#4a3a2c" />
      <mesh position={[-44.1, 3.0, -9.6]} castShadow>
        <icosahedronGeometry args={[1.1, 1]} />
        <meshStandardMaterial color="#4f7a34" roughness={0.9} flatShading />
      </mesh>
      <LightPool position={[-40, 0.07, -6.8]} size={[11, 5]} on={on} />
    </group>
  );
}
