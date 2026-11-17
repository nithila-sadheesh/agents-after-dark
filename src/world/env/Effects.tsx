// Post stack: N8AO ambient occlusion -> bloom (bright emissives only) -> AgX tone mapping + slight grade -> SMAA ->
// subtle vignette. Drops to a cheaper path (half-res AO, dpr 1) if the frame rate sags. OWNER: env agent.
import { useState } from 'react';
import { useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { BrightnessContrast, Bloom, EffectComposer, HueSaturation, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

export default function Effects() {
  const [low, setLow] = useState(false);
  const setDpr = useThree((s) => s.setDpr);
  return (
    <>
      <PerformanceMonitor bounds={() => [44, 120]} flipflops={1} onDecline={() => { setLow(true); setDpr(1); }} />
      <EffectComposer multisampling={0}>
        <N8AO aoRadius={3.2} distanceFalloff={1.1} intensity={2.6} quality={low ? 'performance' : 'medium'} halfRes={low} />
        <Bloom mipmapBlur luminanceThreshold={1.15} luminanceSmoothing={0.25} intensity={0.5} radius={0.7} />
        <ToneMapping mode={ToneMappingMode.AGX} />
        <HueSaturation saturation={0.12} />
        <BrightnessContrast contrast={0.06} />
        <SMAA />
        <Vignette offset={0.32} darkness={0.42} />
      </EffectComposer>
    </>
  );
}
