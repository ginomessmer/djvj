import { nextPalette } from './palettes';
import { nextSceneId, type SceneId } from './scenes';
import type { ShowPatch, ShowState } from './show-state';

/** Single-key actions, shared by the output and control windows. `null` = not a shortcut. */
export function shortcutPatch(key: string, show: ShowState): ShowPatch | null {
  switch (key.toLowerCase()) {
    case 'a':
      return { auto: !show.auto };
    case 'n':
      return { sceneId: nextSceneId(show.sceneId) };
    case 'c':
      return { paletteId: nextPalette(show.paletteId).id };
    case 'b':
      return { blackout: !show.blackout };
    case 'p':
      return { panic: !show.panic };
    case 'm':
      return { demo: !show.demo };
    default:
      return null;
  }
}

/** Picking a palette by hand locks it: auto palette turns off. */
export function lockPalette(paletteId: string): ShowPatch {
  return { paletteId, autoPalette: false };
}

/** Picking a scene by hand locks it: auto-rotation turns off. */
export function lockScene(sceneId: SceneId): ShowPatch {
  return { sceneId, auto: false };
}
