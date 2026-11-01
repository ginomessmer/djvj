import { describe, expect, it } from 'vitest';
import { pickScene } from './scene-picker';
import { SCENES, SELECTABLE_SCENE_IDS } from './scenes';

const energyOf = (id: string) => SCENES.find((scene) => scene.id === id)?.energy ?? [0, 0];
const suits = (id: string, target: number) => {
  const [min, max] = energyOf(id);
  return target >= min && target <= max;
};

describe('pickScene', () => {
  it('picks scenes that suit the target energy', () => {
    for (const target of [0.1, 0.25, 0.6, 0.95]) {
      for (let i = 0; i < 20; i++)
        expect(
          suits(
            pickScene(target, [], () => i / 20),
            target,
          ),
        ).toBe(true);
    }
  });

  it('avoids the recent scenes', () => {
    const avoid = ['tunnel', 'starfield'] as const;
    for (let i = 0; i < 20; i++) expect(avoid).not.toContain(pickScene(0.95, avoid, () => i / 20));
  });

  it('never picks the current scene, even when every suitable one was shown recently', () => {
    const peak = SELECTABLE_SCENE_IDS.filter((id) => suits(id, 1));
    for (let i = 0; i < 20; i++) expect(pickScene(1, peak, () => i / 20)).not.toBe(peak[0]);
  });

  it('never picks the safe scene', () => {
    for (let i = 0; i < 50; i++) expect(pickScene(0.15, [], () => i / 50)).not.toBe('ambient');
  });
});

describe('pickScene with a camera', () => {
  const cameraIds = SCENES.filter((scene) => scene.camera).map((scene) => scene.id);
  const draws = (pick: (rng: () => number) => string, n = 100) =>
    Array.from({ length: n }, (_, i) => pick(() => i / n));

  it('never picks a camera scene without a camera', () => {
    for (const target of [0.25, 0.6, 0.95]) {
      for (const id of draws((rng) => pickScene(target, [], rng))) {
        expect(cameraIds).not.toContain(id);
      }
    }
  });

  it('includes camera scenes while a camera is running', () => {
    const picked = new Set(
      [0.25, 0.6, 0.95].flatMap((target) =>
        draws((rng) => pickScene(target, [], rng, { camera: true })),
      ),
    );
    for (const id of cameraIds) expect(picked).toContain(id);
  });

  it('does not follow a camera scene with another one', () => {
    for (const current of cameraIds) {
      for (const id of draws((rng) => pickScene(0.8, [current], rng, { camera: true }))) {
        expect(cameraIds).not.toContain(id);
      }
    }
  });
});
