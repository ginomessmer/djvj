import { nextPalette } from './palettes';
import { nextSceneId, type SceneId, SELECTABLE_SCENE_IDS } from './scenes';
import type { ShowPatch, ShowState } from './show-state';

/**
 * Keys 1..9 and 0 pick the ten generated scenes, Q W E R (the row below) the camera scenes; both
 * in the same order as the pads.
 */
const SCENE_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'q', 'w', 'e', 'r'] as const;

export function sceneKey(sceneId: SceneId): string | null {
  return SCENE_KEYS[SELECTABLE_SCENE_IDS.indexOf(sceneId)]?.toUpperCase() ?? null;
}

/** Single-key actions, shared by the output and control windows. `null` = not a shortcut. */
export function shortcutPatch(key: string, show: ShowState): ShowPatch | null {
  const lower = key.toLowerCase();
  const sceneIndex = SCENE_KEYS.indexOf(lower as (typeof SCENE_KEYS)[number]);
  if (sceneIndex >= 0) {
    const sceneId = SELECTABLE_SCENE_IDS[sceneIndex];
    return sceneId ? lockScene(sceneId) : null;
  }
  switch (lower) {
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

export type ShortcutWindow = 'both' | 'output' | 'control';

export interface ShortcutInfo {
  /** What is pressed, as shown on a key cap. */
  keys: readonly string[];
  action: string;
  where: ShortcutWindow;
}

export interface ShortcutGroup {
  title: string;
  shortcuts: readonly ShortcutInfo[];
}

/** Everything the help dialog lists. A test keeps the entries that use `shortcutPatch` honest. */
export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    title: 'Live',
    shortcuts: [
      { keys: ['B'], action: 'Blackout: fast fade to black', where: 'both' },
      { keys: ['P'], action: 'Panic: instantly show the safe ambient scene', where: 'both' },
      { keys: ['T'], action: 'Tap tempo (four taps on the kick)', where: 'both' },
    ],
  },
  {
    title: 'Scenes and colours',
    shortcuts: [
      { keys: ['1', '…', '0'], action: 'Pick scene 1 to 10 (locks it)', where: 'both' },
      { keys: ['Q', 'W', 'E', 'R'], action: 'Pick a camera scene (locks it)', where: 'both' },
      { keys: ['N'], action: 'Next scene (locks it)', where: 'both' },
      { keys: ['A'], action: 'Auto-rotate scenes on or off', where: 'both' },
      { keys: ['C'], action: 'Next palette', where: 'both' },
    ],
  },
  {
    title: 'Windows',
    shortcuts: [
      { keys: ['O'], action: 'Open or focus the output window', where: 'control' },
      { keys: ['F'], action: 'Fullscreen', where: 'output' },
      { keys: ['D'], action: 'Debug overlay', where: 'output' },
      { keys: ['M'], action: 'Simulated demo signal on or off', where: 'both' },
      { keys: ['?'], action: 'Show this list', where: 'control' },
    ],
  },
];
