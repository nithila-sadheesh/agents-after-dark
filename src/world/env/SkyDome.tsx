// Analytic golden-hour sky: deep blue zenith, warm glow toward the low sun, and a haze band that equals the fog color
// at the horizon so the hazy outskirts blend seamlessly into the sky. OWNER: env agent.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { HAZE_COLOR, SUN_DIR } from './sun';

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = wp.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * wp;
  gl_Position.z = gl_Position.w * 0.99999; // pin to the far plane
}`;

const frag = /* glsl */ `
uniform vec3 uSunDir, uZenith, uMid, uHaze, uWarm, uSun;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  float s = max(dot(d, uSunDir), 0.0);
  // blue gradient, haze band hugging the horizon
  vec3 col = mix(uMid, uZenith, smoothstep(0.0, 0.55, pow(h, 0.7)));
  col = mix(col, uHaze, exp(-h * 9.0));
  // warm golden scatter around the sun, strongest near the horizon
  float warm = pow(s, 3.0) * 0.75 + pow(s, 12.0) * 0.9;
  col += uWarm * warm * (0.35 + 0.65 * exp(-h * 4.0)) * smoothstep(0.0, 0.03, h);
  // sun disk + tight halo
  col += uSun * (smoothstep(0.99985, 0.99993, s) * 40.0 + pow(s, 400.0) * 3.0);
  // below / at the horizon: pure haze so the fogged ground meets the sky without a seam
  col = mix(uHaze, col, smoothstep(-0.005, 0.02, d.y));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export default function SkyDome() {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSunDir: { value: SUN_DIR.clone() },
      uZenith: { value: new THREE.Color('#2f6fc0') },
      uMid: { value: new THREE.Color('#8fb6dc') },
      uHaze: { value: new THREE.Color(HAZE_COLOR) },
      uWarm: { value: new THREE.Color('#ffb070') },
      uSun: { value: new THREE.Color('#fff2d8') },
    },
  }), []);
  useFrame(({ camera }) => { mesh.current?.position.copy(camera.position); });
  return (
    <mesh ref={mesh} material={material} renderOrder={-1000} frustumCulled={false} raycast={() => null}>
      <sphereGeometry args={[900, 48, 24]} />
    </mesh>
  );
}
