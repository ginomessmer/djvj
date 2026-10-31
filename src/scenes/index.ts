import tunnel from './tunnel.frag?raw';
import rings from './rings.frag?raw';
import fluid from './fluid.frag?raw';
import ambient from './ambient.frag?raw';

export interface SceneDef {
  id: string;
  name: string;
  /** Rough energy range this scene suits (0 = calm, 1 = peak). Used by the phase-2 director. */
  energy: readonly [number, number];
  /** GLSL body defining `vec3 render(vec2 uv, vec2 p)`. */
  source: string;
  /** Hidden scenes are never offered for rotation or selection (safe fallback). */
  hidden?: boolean;
}

export const AMBIENT_ID = 'ambient';
/** Shown while the input is silent and auto mode is on. */
export const IDLE_SCENE_ID = 'fluid';

export const SCENES: readonly SceneDef[] = [
  { id: 'tunnel', name: 'Tunnel', energy: [0.4, 1], source: tunnel },
  { id: 'rings', name: 'Rings', energy: [0.2, 0.9], source: rings },
  { id: 'fluid', name: 'Fluid', energy: [0, 0.8], source: fluid },
  { id: AMBIENT_ID, name: 'Ambient (safe)', energy: [0, 0.3], source: ambient, hidden: true },
];

export const VISIBLE_SCENES: readonly SceneDef[] = SCENES.filter((s) => !s.hidden);

export function findScene(id: string): SceneDef {
  return SCENES.find((s) => s.id === id) ?? (SCENES.find((s) => s.id === AMBIENT_ID) as SceneDef);
}
