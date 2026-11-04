import { describe, expect, it } from 'vitest';
import { PALETTES } from './palettes';
import { SELECTABLE_SCENE_IDS, SELECTABLE_SCENES } from './scenes';
import { lockPalette, lockScene, SHORTCUT_GROUPS, sceneKey, shortcutPatch } from './shortcuts';
import { INITIAL_SHOW_STATE } from './show-state';

const show = INITIAL_SHOW_STATE;

describe('shortcutPatch', () => {
  it('toggles switches', () => {
    expect(shortcutPatch('a', show)).toEqual({ auto: !show.auto });
    expect(shortcutPatch('b', show)).toEqual({ blackout: true });
    expect(shortcutPatch('p', show)).toEqual({ panic: true });
    expect(shortcutPatch('m', show)).toEqual({ demo: true });
    expect(shortcutPatch('p', { ...show, panic: true })).toEqual({ panic: false });
  });

  it('cycles scenes and wraps around', () => {
    const last = SELECTABLE_SCENE_IDS[SELECTABLE_SCENE_IDS.length - 1];
    expect(shortcutPatch('n', { ...show, sceneId: last })).toEqual({
      sceneId: SELECTABLE_SCENE_IDS[0],
    });
    expect(shortcutPatch('n', { ...show, sceneId: SELECTABLE_SCENE_IDS[0] })).toEqual({
      sceneId: SELECTABLE_SCENE_IDS[1],
    });
  });

  it('cycles palettes', () => {
    expect(shortcutPatch('c', { ...show, paletteId: PALETTES[0].id })).toEqual({
      paletteId: PALETTES[1].id,
    });
  });

  it('ignores case and unknown keys', () => {
    expect(shortcutPatch('A', show)).toEqual({ auto: !show.auto });
    expect(shortcutPatch('z', show)).toBeNull();
    expect(shortcutPatch('Enter', show)).toBeNull();
  });

  it('number keys pick the scenes in pad order and lock them', () => {
    expect(shortcutPatch('1', show)).toEqual(lockScene(SELECTABLE_SCENE_IDS[0]));
    expect(shortcutPatch('9', show)).toEqual(lockScene(SELECTABLE_SCENE_IDS[8]));
    expect(shortcutPatch('0', show)).toEqual(lockScene(SELECTABLE_SCENE_IDS[9]));
  });

  it('G H J pick the generated scenes after the first ten', () => {
    const generatedIds = SELECTABLE_SCENES.filter((scene) => !scene.camera).map(
      (scene) => scene.id,
    );
    expect(['g', 'h', 'j'].map((key) => shortcutPatch(key, show))).toEqual(
      generatedIds.slice(10, 13).map(lockScene),
    );
  });

  it('Q W E R pick the camera scenes', () => {
    const cameraIds = SELECTABLE_SCENES.filter((scene) => scene.camera).map((scene) => scene.id);
    expect(['q', 'w', 'e', 'r'].map((key) => shortcutPatch(key, show))).toEqual(
      cameraIds.map(lockScene),
    );
  });

  it('every selectable scene has exactly one key that picks it', () => {
    const keys = SELECTABLE_SCENE_IDS.map((id) => sceneKey(id));
    expect(new Set(keys).size).toBe(SELECTABLE_SCENE_IDS.length);
    SELECTABLE_SCENE_IDS.forEach((id) => {
      const key = sceneKey(id) as string;
      expect(shortcutPatch(key, show)).toEqual(lockScene(id));
    });
  });

  it('picking a palette by hand locks it', () => {
    expect(lockPalette('ice')).toEqual({ paletteId: 'ice', autoPalette: false });
  });

  it('picking a scene by hand locks it', () => {
    expect(lockScene('rings')).toEqual({ sceneId: 'rings', auto: false });
  });
});

describe('SHORTCUT_GROUPS', () => {
  const singleKeys = SHORTCUT_GROUPS.flatMap((group) => group.shortcuts).filter(
    (shortcut) => shortcut.keys.length === 1,
  );

  it('lists no key twice', () => {
    const keys = singleKeys.map((shortcut) => shortcut.keys[0]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('documents every key that shortcutPatch handles', () => {
    const documented = new Set(singleKeys.map((shortcut) => shortcut.keys[0].toLowerCase()));
    for (const key of ['a', 'n', 'c', 'b', 'p', 'm']) {
      expect(shortcutPatch(key, show), key).not.toBeNull();
      expect(documented.has(key), key).toBe(true);
    }
  });
});
