import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCENE_ID,
  IDLE_SCENE_ID,
  isCameraScene,
  nextSceneId,
  SAFE_SCENE_ID,
  SCENE_IDS,
  SCENES,
  SELECTABLE_SCENE_IDS,
  SELECTABLE_SCENES,
  sceneTextStyle,
} from './scenes';
import { TEXT_STYLES } from './texts';

describe('scene catalog', () => {
  it('describes every scene id exactly once, with unique names', () => {
    expect(SCENES.map((scene) => scene.id).sort()).toEqual([...SCENE_IDS].sort());
    const names = SCENES.map((scene) => scene.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has sensible energy ranges', () => {
    for (const {
      id,
      energy: [min, max],
    } of SCENES) {
      expect(min, id).toBeGreaterThanOrEqual(0);
      expect(max, id).toBeLessThanOrEqual(1);
      expect(min, id).toBeLessThan(max);
    }
  });

  it('offers at least two scenes at every energy level, so rotation always has a choice', () => {
    for (let step = 0; step <= 10; step++) {
      const energy = step / 10;
      // Without the camera scenes: rotation must have a choice when there is no camera, too.
      const suitable = SELECTABLE_SCENES.filter(
        ({ energy: [min, max], camera }) => !camera && energy >= min && energy <= max,
      );
      expect(suitable.length, `energy ${energy}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps the safe and the idle scene independent of the camera', () => {
    expect(isCameraScene(SAFE_SCENE_ID)).toBe(false);
    expect(isCameraScene(IDLE_SCENE_ID)).toBe(false);
    expect(isCameraScene(DEFAULT_SCENE_ID)).toBe(false);
  });

  it('keeps the safe scene out of the rotation and the idle scene inside it', () => {
    expect(SELECTABLE_SCENE_IDS).not.toContain(SAFE_SCENE_ID);
    expect(SELECTABLE_SCENE_IDS).toContain(IDLE_SCENE_ID);
  });

  it('cycles through every selectable scene and wraps around', () => {
    const visited = new Set<string>();
    let id = SELECTABLE_SCENE_IDS[0];
    for (let i = 0; i < SELECTABLE_SCENE_IDS.length; i++) {
      visited.add(id);
      id = nextSceneId(id);
    }
    expect(visited.size).toBe(SELECTABLE_SCENE_IDS.length);
    expect(id).toBe(SELECTABLE_SCENE_IDS[0]);
  });
});

describe('text styles', () => {
  it('gives every text style to at least one scene, so auto shows them all', () => {
    const used = new Set(SCENES.map((scene) => sceneTextStyle(scene.id)));
    expect([...used].sort()).toEqual([...TEXT_STYLES].sort());
  });
});
