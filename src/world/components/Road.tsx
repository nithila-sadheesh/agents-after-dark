import { useMemo } from 'react';
import { HOME_ANCHOR, ROAD_WIDTH, ROAD_X_EXTENT, ROAD_Z, SHOP_ANCHOR, WAYPOINTS } from '../../../shared/world';
import { getGlowTexture } from '../worldState';
import * as THREE from 'three';

const SIDEWALK_W = 0.9;
const ROAD_LEN = ROAD_X_EXTENT[1] - ROAD_X_EXTENT[0];
const ROAD_CX = (ROAD_X_EXTENT[0] + ROAD_X_EXTENT[1]) / 2;
const ROAD_N = ROAD_Z - ROAD_WIDTH / 2; // north edge (toward buildings)
const ROAD_S = ROAD_Z + ROAD_WIDTH / 2;

/** Main road along X with dashes, sidewalks, crosswalk, house driveway, store plaza and robot dock. */
export default function Road({ accent = '#7c9cff' }: { accent?: string }) {
  const dashes = useMemo(() => {
    const xs: number[] = [];
    for (let x = ROAD_X_EXTENT[0] + 1; x <= ROAD_X_EXTENT[1] - 1; x += 2) if (Math.abs(x) > 1.6) xs.push(x);
    return xs;
  }, []);
  const stripes = useMemo(() => {
    const zs: number[] = [];
    for (let z = ROAD_N + 0.35; z < ROAD_S - 0.2; z += 0.58) zs.push(z);
    return zs;
  }, []);
  const dock = WAYPOINTS.home;

  return (
    <group>
      {/* asphalt */}
      <mesh position={[ROAD_CX, 0.02, ROAD_Z]} receiveShadow>
        <boxGeometry args={[ROAD_LEN, 0.04, ROAD_WIDTH]} />
        <meshStandardMaterial color="#454a66" roughness={0.9} />
      </mesh>
      {/* sidewalks */}
      {[ROAD_N - SIDEWALK_W / 2, ROAD_S + SIDEWALK_W / 2].map((z) => (
        <mesh key={z} position={[ROAD_CX, 0.035, z]} receiveShadow>
          <boxGeometry args={[ROAD_LEN, 0.07, SIDEWALK_W]} />
          <meshStandardMaterial color="#c9cfdb" roughness={0.85} />
        </mesh>
      ))}
      {/* lane dashes */}
      {dashes.map((x) => (
        <mesh key={x} position={[x, 0.045, ROAD_Z]}>
          <boxGeometry args={[1, 0.01, 0.12]} />
          <meshStandardMaterial color="#f7e3a3" roughness={0.6} />
        </mesh>
      ))}
      {/* crosswalk at the intersection (x = 0) */}
      {stripes.map((z) => (
        <mesh key={z} position={[0, 0.045, z]}>
          <boxGeometry args={[1.8, 0.01, 0.3]} />
          <meshStandardMaterial color="#f4f1fb" roughness={0.6} />
        </mesh>
      ))}
      {/* house driveway */}
      <mesh position={[WAYPOINTS.driveway[0], 0.03, (HOME_ANCHOR[2] + 1.4 + ROAD_N) / 2]} receiveShadow>
        <boxGeometry args={[1.8, 0.06, ROAD_N - (HOME_ANCHOR[2] + 1.4)]} />
        <meshStandardMaterial color="#c4bccf" roughness={0.9} />
      </mesh>
      {/* front walk from the porch to the sidewalk */}
      <mesh position={[HOME_ANCHOR[0], 0.025, -0.35]} receiveShadow>
        <boxGeometry args={[1.3, 0.05, 2.1]} />
        <meshStandardMaterial color="#e6d6c3" roughness={0.9} />
      </mesh>
      {/* store plaza */}
      <mesh position={[SHOP_ANCHOR[0] + 0.2, 0.03, (SHOP_ANCHOR[2] + 2.2 + ROAD_N) / 2]} receiveShadow>
        <boxGeometry args={[6.4, 0.06, ROAD_N - (SHOP_ANCHOR[2] + 2.2)]} />
        <meshStandardMaterial color="#ead9cc" roughness={0.9} />
      </mesh>
      {/* robot dock pad */}
      <group position={[dock[0], 0.065, dock[2]]}>
        <mesh rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.95, 40]} />
          <meshStandardMaterial color="#363b57" roughness={0.7} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position-y={0.005}>
          <ringGeometry args={[0.8, 0.9, 48]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position-y={0.008}>
          <planeGeometry args={[3, 3]} />
          <meshBasicMaterial map={getGlowTexture()} color={accent} transparent opacity={0.25} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    </group>
  );
}
