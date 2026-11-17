// Golden-hour atmosphere: analytic sky, HDRI image-based lighting, a warm low sun whose 4096 shadow frustum follows the
// camera's orbit target (texel-snapped, no shimmer), cool sky fill, aerial-perspective haze and the outskirts.
// OWNER: env agent.
import { Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import SkyDome from './SkyDome';
import Outskirts from './Outskirts';
import { FOG_DENSITY, HAZE_COLOR, HDRI_URL, SUN_COLOR, SUN_DIR, SUN_INTENSITY } from './sun';

const MAP = 4096;
const LIGHT_DIST = 260;
// Light-space basis of the shadow camera (it looks from SUN_DIR toward its target with up = +Y).
const AX_X = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), SUN_DIR).normalize();
const AX_Y = new THREE.Vector3().crossVectors(SUN_DIR, AX_X).normalize();

function Sun() {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null;
  const st = useMemo(() => ({ center: new THREE.Vector3(), width: 0 }), []);

  useFrame(({ camera }) => {
    const l = light.current;
    if (!l) return;
    const c = st.center;
    if (controls) c.copy(controls.target); else c.set(-18, 0, 8);
    c.y = 0;
    // Frustum width tracks zoom (crisp ~100m when close, wider for the aerial overview), quantized so the texel size
    // only changes in steps.
    const dist = camera.position.distanceTo(c);
    const width = THREE.MathUtils.clamp(Math.round((dist * 1.35) / 20) * 20, 100, 260);
    const cam = l.shadow.camera;
    if (width !== st.width) {
      st.width = width;
      cam.left = cam.bottom = -width / 2;
      cam.right = cam.top = width / 2;
      cam.updateProjectionMatrix();
    }
    // Snap the frustum center to whole shadow texels in light space so static shadows don't crawl as the camera moves.
    const texel = width / MAP;
    const u = c.dot(AX_X), v = c.dot(AX_Y);
    c.addScaledVector(AX_X, Math.round(u / texel) * texel - u).addScaledVector(AX_Y, Math.round(v / texel) * texel - v);
    target.position.copy(c);
    target.updateMatrixWorld();
    l.position.copy(c).addScaledVector(SUN_DIR, LIGHT_DIST);
  });

  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        color={SUN_COLOR}
        intensity={SUN_INTENSITY}
        castShadow
        shadow-mapSize={[MAP, MAP]}
        shadow-camera-near={20}
        shadow-camera-far={520}
        shadow-bias={-0.0002}
        shadow-normalBias={0.035}
        shadow-radius={2.5}
      />
    </>
  );
}

export default function Atmosphere() {
  return (
    <>
      <fogExp2 attach="fog" args={[HAZE_COLOR, FOG_DENSITY]} />
      <color attach="background" args={[HAZE_COLOR]} />
      <SkyDome />
      <Suspense fallback={null}><Environment files={HDRI_URL} environmentIntensity={0.55} /></Suspense>
      {/* cool skylight fill so shadowed sides read blue against the warm sun */}
      <hemisphereLight args={['#9ec3ff', '#6d5f52', 0.55]} />
      <Sun />
      <Outskirts />
    </>
  );
}
