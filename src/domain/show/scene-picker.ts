import { type SceneId, type SceneInfo, SELECTABLE_SCENES } from './scenes';

/**
 * Picks a scene that suits the target energy, avoiding the recent ones (`avoid[0]` is the
 * current scene). Relaxes the rules step by step rather than ever returning nothing.
 */
export function pickScene(
  targetEnergy: number,
  avoid: readonly SceneId[],
  rng: () => number = Math.random,
): SceneId {
  const suits = ({ energy: [min, max] }: SceneInfo) => targetEnergy >= min && targetEnergy <= max;
  const candidates =
    [
      SELECTABLE_SCENES.filter((scene) => suits(scene) && !avoid.includes(scene.id)),
      SELECTABLE_SCENES.filter((scene) => suits(scene) && scene.id !== avoid[0]),
      SELECTABLE_SCENES.filter((scene) => scene.id !== avoid[0]),
    ].find((pool) => pool.length > 0) ?? SELECTABLE_SCENES;
  return candidates[Math.floor(rng() * candidates.length) % candidates.length].id;
}
