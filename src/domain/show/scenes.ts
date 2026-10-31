/**
 * Which scenes exist. How they look lives in `vfx/scenes`; the compiler checks that every id
 * listed here has a shader there.
 */
export const SCENE_IDS = [
  'aurora',
  'lava',
  'fluid',
  'rings',
  'grid',
  'orb',
  'kaleidoscope',
  'tunnel',
  'starfield',
  'lasers',
  'ambient',
] as const;
export type SceneId = (typeof SCENE_IDS)[number];

export interface SceneInfo {
  id: SceneId;
  name: string;
  /** Rough energy range this scene suits (0 = calm, 1 = peak). */
  energy: readonly [min: number, max: number];
  /** Whether it can be picked and rotated into. The safe fallback is not selectable. */
  selectable: boolean;
}

/** Ordered from calm to intense, which is also the order of the control panel. */
export const SCENES: readonly SceneInfo[] = [
  { id: 'aurora', name: 'Aurora', energy: [0, 0.4], selectable: true },
  { id: 'lava', name: 'Lava', energy: [0.1, 0.6], selectable: true },
  { id: 'fluid', name: 'Fluid', energy: [0, 0.8], selectable: true },
  { id: 'rings', name: 'Rings', energy: [0.2, 0.9], selectable: true },
  { id: 'grid', name: 'Grid', energy: [0.3, 0.8], selectable: true },
  { id: 'orb', name: 'Orb', energy: [0.3, 0.9], selectable: true },
  { id: 'kaleidoscope', name: 'Kaleidoscope', energy: [0.4, 0.9], selectable: true },
  { id: 'tunnel', name: 'Tunnel', energy: [0.4, 1], selectable: true },
  { id: 'starfield', name: 'Starfield', energy: [0.5, 1], selectable: true },
  { id: 'lasers', name: 'Lasers', energy: [0.6, 1], selectable: true },
  { id: 'ambient', name: 'Ambient (safe)', energy: [0, 0.3], selectable: false },
];

export const SELECTABLE_SCENES: readonly SceneInfo[] = SCENES.filter((scene) => scene.selectable);
export const SELECTABLE_SCENE_IDS: readonly SceneId[] = SELECTABLE_SCENES.map((scene) => scene.id);

export const DEFAULT_SCENE_ID: SceneId = 'tunnel';
/** Panic switches to this: it never reacts to audio. */
export const SAFE_SCENE_ID: SceneId = 'ambient';
/** Shown while the input is silent and auto mode is on. */
export const IDLE_SCENE_ID: SceneId = 'fluid';

export function nextSceneId(current: SceneId): SceneId {
  const index = SELECTABLE_SCENE_IDS.indexOf(current);
  return SELECTABLE_SCENE_IDS[(index + 1) % SELECTABLE_SCENE_IDS.length];
}
