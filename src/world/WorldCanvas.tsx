import { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useFoStore } from '../store';
import Ground from './components/Ground';
import Road from './components/Road';
import RoutePath from './components/RoutePath';
import Highlights from './components/Highlights';
import SceneRenderer from './SceneRenderer';
import CameraRig, { OVERVIEW_OFFSET, OVERVIEW_TARGET } from './CameraRig';
import { ItemActor, RobotActor } from './Actors';
import { select } from './worldState';

const START_POS = OVERVIEW_OFFSET.clone().multiplyScalar(1.45).add(OVERVIEW_TARGET).add(new THREE.Vector3(10, 4, 0));

function SkyDome() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color('#1a1740') },
      uHorizon: { value: new THREE.Color('#6a4a8c') },
      uMid: { value: new THREE.Color('#2c2660') },
      uBottom: { value: new THREE.Color('#0d0c22') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uMid; uniform vec3 uBottom;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 c = h > 0.0 ? mix(uHorizon, uTop, smoothstep(0.0, 0.5, h))
                         : mix(mix(uHorizon, uMid, smoothstep(0.0, 0.35, -h)), uBottom, smoothstep(0.35, 1.0, -h));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  }), []);
  return (
    <mesh material={mat} renderOrder={-1}>
      <sphereGeometry args={[260, 32, 16]} />
    </mesh>
  );
}

function Lights() {
  return (
    <>
      <hemisphereLight args={['#a9b2ff', '#4a3358', 0.75]} />
      <ambientLight intensity={0.12} color="#9aa4ff" />
      <directionalLight
        position={[-16, 26, 16]}
        color="#ffcf9e"
        intensity={3.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={4}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={1}
        shadow-camera-far={90}
      />
      <directionalLight position={[14, 10, -26]} color="#7f9dff" intensity={1.3} />
    </>
  );
}

function World() {
  const scene = useFoStore((s) => s.scene);
  const route = useFoStore((s) => s.route);
  const accent = scene.accent ?? '#7c9cff';
  return (
    <>
      <SkyDome />
      <Stars radius={120} depth={40} count={1500} factor={4} saturation={0.4} fade speed={0.4} />
      <fog attach="fog" args={['#2a2458', 70, 150]} />
      <Lights />
      <Ground />
      <Road accent={accent} />
      <SceneRenderer scene={scene} />
      <RobotActor accent={accent} />
      <ItemActor />
      <RoutePath points={route} color={accent} />
      <Highlights accent={accent} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={7}
        maxDistance={85}
        minPolarAngle={0.15}
        maxPolarAngle={1.22}
      />
      <CameraRig />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.25} intensity={0.85} radius={0.7} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <Vignette offset={0.3} darkness={0.55} />
      </EffectComposer>
    </>
  );
}

export default function WorldCanvas() {
  return (
    <div className="absolute inset-0">
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        camera={{ fov: 34, near: 0.5, far: 600, position: START_POS.toArray() }}
        onPointerMissed={() => select(null)}
      >
        <Suspense fallback={null}>
          <World />
        </Suspense>
      </Canvas>
    </div>
  );
}
