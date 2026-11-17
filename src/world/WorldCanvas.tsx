// World composition root. OWNER: atmosphere/camera agent (may restyle freely, but keep the module slots, the
// per-module ErrorBoundary, and the ?only= / ?cam= debug params working — other agents rely on them).
//   ?only=roads,buildings,hero,actors,life   render only those modules (env always renders)
//   ?cam=px,py,pz,tx,ty,tz                   pin the camera (handled in CameraRig)
import { Component, Suspense, type ReactNode } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { select } from './worldState';
import CameraRig from './CameraRig';
import Atmosphere from './env/Atmosphere';
import Effects from './env/Effects';
import Roads from './city/Roads';
import CityBuildings from './city/Buildings';
import HeroHouse from './hero/HeroHouse';
import HeroShop from './hero/HeroShop';
import Actors from './actors/Actors';
import CityLife from './life/CityLife';

class Guard extends Component<{ name: string; children: ReactNode }, { err: unknown }> {
  state = { err: null as unknown };
  static getDerivedStateFromError(err: unknown) { return { err }; }
  componentDidCatch(err: unknown) { console.error(`[world:${this.props.name}] crashed`, err); }
  render() { return this.state.err ? null : this.props.children; }
}

const only = new URLSearchParams(location.search).get('only')?.split(',');
const show = (k: string) => !only || only.includes(k);

function Slot({ name, children }: { name: string; children: ReactNode }) {
  if (!show(name)) return null;
  return <Guard name={name}><Suspense fallback={null}>{children}</Suspense></Guard>;
}

export default function WorldCanvas() {
  return (
    <div className="absolute inset-0">
      <Canvas
        shadows="percentage"
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1 }}
        camera={{ fov: 35, near: 1, far: 1600, position: [40, 70, 110] }}
        onPointerMissed={() => select(null)}
      >
        <Slot name="env"><Atmosphere /></Slot>
        <Slot name="roads"><Roads /></Slot>
        <Slot name="buildings"><CityBuildings /></Slot>
        <Slot name="hero"><HeroHouse /><HeroShop /></Slot>
        <Slot name="actors"><Actors /></Slot>
        <Slot name="life"><CityLife /></Slot>
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={8} maxDistance={320} minPolarAngle={0.12} maxPolarAngle={1.32}
          zoomSpeed={0.9} rotateSpeed={0.6} panSpeed={0.8} screenSpacePanning={false} />
        <CameraRig />
        <Slot name="env"><Effects /></Slot>
      </Canvas>
    </div>
  );
}
