import { z } from 'zod';
import { DEFAULT_SCENE_ID, SCENE_IDS, type SceneId } from './scenes';
import { DEFAULT_SETTINGS, type Settings, settingsFields } from './settings';

/** Everything the DJ can change during a show: persisted settings plus session-only switches. */
export interface ShowState extends Settings {
  sceneId: SceneId;
  /** Instantly show the safe scene. */
  panic: boolean;
  /** Fade to black. */
  blackout: boolean;
  /** Use a simulated signal instead of the audio input. */
  demo: boolean;
}

export const INITIAL_SHOW_STATE: ShowState = {
  ...DEFAULT_SETTINGS,
  sceneId: DEFAULT_SCENE_ID,
  panic: false,
  blackout: false,
  demo: false,
};

/** A partial update. Also validates patches that arrive from the other window. */
export const showPatchSchema = z
  .object({
    ...settingsFields,
    sceneId: z.enum(SCENE_IDS),
    panic: z.boolean(),
    blackout: z.boolean(),
    demo: z.boolean(),
  })
  .partial();

export type ShowPatch = z.infer<typeof showPatchSchema>;
