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
