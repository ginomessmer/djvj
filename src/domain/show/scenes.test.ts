import { describe, expect, it } from 'vitest';
import {
  IDLE_SCENE_ID,
  nextSceneId,
  SAFE_SCENE_ID,
  SCENE_IDS,
  SCENES,
  SELECTABLE_SCENE_IDS,
  SELECTABLE_SCENES,
} from './scenes';

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
      const suitable = SELECTABLE_SCENES.filter(
        ({ energy: [min, max] }) => energy >= min && energy <= max,
      );
      expect(suitable.length, `energy ${energy}`).toBeGreaterThanOrEqual(2);
    }
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
