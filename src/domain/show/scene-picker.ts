import { type SceneId, type SceneInfo, SELECTABLE_SCENES } from './scenes';

export interface PickOptions {
  /** A camera is running: camera scenes may be picked too. */
  camera?: boolean;
}

/**
 * Picks a scene that suits the target energy, avoiding the recent ones (`avoid[0]` is the
 * current scene). Camera scenes only come up while a camera is running, and never two in a row:
 * the camera is the spice, not the meal. Relaxes the rules step by step rather than ever
 * returning nothing.
 */
export function pickScene(
  targetEnergy: number,
  avoid: readonly SceneId[],
  rng: () => number = Math.random,
  { camera = false }: PickOptions = {},
): SceneId {
  const afterCamera = SELECTABLE_SCENES.some((scene) => scene.id === avoid[0] && scene.camera);
  const available = SELECTABLE_SCENES.filter((scene) => camera || !scene.camera);
  const varied = available.filter((scene) => !(afterCamera && scene.camera));
  const suits = ({ energy: [min, max] }: SceneInfo) => targetEnergy >= min && targetEnergy <= max;
  const candidates =
    [
      varied.filter((scene) => suits(scene) && !avoid.includes(scene.id)),
      available.filter((scene) => suits(scene) && !avoid.includes(scene.id)),
      available.filter((scene) => suits(scene) && scene.id !== avoid[0]),
      available.filter((scene) => scene.id !== avoid[0]),
    ].find((pool) => pool.length > 0) ?? available;
  return candidates[Math.floor(rng() * candidates.length) % candidates.length].id;
}
