import { describe, expect, it } from 'vitest';
import { PALETTES } from './palettes';
import { SELECTABLE_SCENE_IDS } from './scenes';
import { commandPatch, lockPalette, lockScene, SHOW_COMMANDS, shortcutPatch } from './shortcuts';
import { INITIAL_SHOW_STATE } from './show-state';

const show = INITIAL_SHOW_STATE;

describe('commandPatch', () => {
  it('changes something for every command', () => {
    for (const command of SHOW_COMMANDS) {
      expect(Object.keys(commandPatch(command, show)).length).toBeGreaterThan(0);
    }
  });
});

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
    expect(shortcutPatch('x', show)).toBeNull();
    expect(shortcutPatch('Enter', show)).toBeNull();
  });

  it('picking a palette by hand locks it', () => {
    expect(lockPalette('ice')).toEqual({ paletteId: 'ice', autoPalette: false });
  });

  it('picking a scene by hand locks it', () => {
    expect(lockScene('rings')).toEqual({ sceneId: 'rings', auto: false });
  });
});
