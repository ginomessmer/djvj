import { nextPalette } from './palettes';
import { nextSceneId, type SceneId } from './scenes';
import type { ShowPatch, ShowState } from './show-state';

/** One-shot show actions, shared by the keyboard (both windows) and MIDI. */
export const SHOW_COMMANDS = [
  'auto',
  'next-scene',
  'next-palette',
  'blackout',
  'panic',
  'demo',
] as const;
export type ShowCommand = (typeof SHOW_COMMANDS)[number];

/** The change a command makes to the current show. */
export function commandPatch(command: ShowCommand, show: ShowState): ShowPatch {
  switch (command) {
    case 'auto':
      return { auto: !show.auto };
    case 'next-scene':
      return { sceneId: nextSceneId(show.sceneId) };
    case 'next-palette':
      return { paletteId: nextPalette(show.paletteId).id };
    case 'blackout':
      return { blackout: !show.blackout };
    case 'panic':
      return { panic: !show.panic };
    case 'demo':
      return { demo: !show.demo };
  }
}

const KEY_COMMANDS: Record<string, ShowCommand> = {
  a: 'auto',
  n: 'next-scene',
  c: 'next-palette',
  b: 'blackout',
  p: 'panic',
  m: 'demo',
};

/** Single-key actions, shared by the output and control windows. `null` = not a shortcut. */
export function shortcutPatch(key: string, show: ShowState): ShowPatch | null {
  const command = KEY_COMMANDS[key.toLowerCase()];
  return command ? commandPatch(command, show) : null;
}

/** Picking a palette by hand locks it: auto palette turns off. */
export function lockPalette(paletteId: string): ShowPatch {
  return { paletteId, autoPalette: false };
}

/** Picking a scene by hand locks it: auto-rotation turns off. */
export function lockScene(sceneId: SceneId): ShowPatch {
  return { sceneId, auto: false };
}
