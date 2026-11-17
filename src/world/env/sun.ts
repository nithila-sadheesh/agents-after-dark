// Golden-hour lighting constants shared by the env modules. OWNER: env agent.
import * as THREE from 'three';

const ELEV = THREE.MathUtils.degToRad(19);   // low sun -> long shadows across streets
const AZIM = THREE.MathUtils.degToRad(56);   // from +Z toward +X (matches the HDRI's sun azimuth)

/** Unit vector pointing from the ground toward the sun. */
export const SUN_DIR = new THREE.Vector3(Math.sin(AZIM) * Math.cos(ELEV), Math.sin(ELEV), Math.cos(AZIM) * Math.cos(ELEV));
export const SUN_COLOR = '#ffcf9e';
export const SUN_INTENSITY = 4.2;

/** Haze / fog color. The sky shader fades to exactly this at the horizon so the outskirts melt into the sky. */
export const HAZE_COLOR = '#d8d6d4';
export const FOG_DENSITY = 0.0019;

export const HDRI_URL = '/assets/env/venice_sunset_1k.hdr'; // Poly Haven, CC0 (Greg Zaal)
