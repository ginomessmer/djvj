import { SceneFader } from './scene-fader';
import { SceneRotator, type SceneRotatorOptions } from './scene-rotator';
import { IDLE_SCENE_ID, SAFE_SCENE_ID, type SceneId, SELECTABLE_SCENE_IDS } from './scenes';

export interface DirectorInput {
  auto: boolean;
  panic: boolean;
  /** The scene the DJ (or the rotation) picked. */
  selectedId: SceneId;
  /** True while there is music. */
  live: boolean;
}

export interface DirectorFrame {
  /** What to draw this frame (differs from `selectedId` while idle, panicking or fading). */
  shownId: SceneId;
  brightness: number;
  /** The selection after this frame; changes when the rotation moved on. */
  selectedId: SceneId;
}

/** Decides which scene is on screen: rotation, idle fallback, panic and fades. */
export class Director {
  private readonly rotator: SceneRotator<SceneId>;
  private readonly fader: SceneFader<SceneId>;

  constructor(initialId: SceneId, rotation: Partial<SceneRotatorOptions> = {}) {
    this.rotator = new SceneRotator(SELECTABLE_SCENE_IDS, initialId, rotation);
    this.fader = new SceneFader(initialId);
  }

  /**
   * Call once per frame. The caller owns the selection: write `selectedId` of the returned frame
   * back into the next input, otherwise a rotation is mistaken for a manual pick and undone.
   */
  update(tSec: number, dtSec: number, input: DirectorInput): DirectorFrame {
    this.rotator.sync(input.selectedId);
    const rotatedTo = this.rotator.tick(tSec, input.auto && input.live && !input.panic);
    const selectedId = rotatedTo ?? input.selectedId;

    const wantedId = this.wantedScene({ ...input, selectedId });
    const { shownId, brightness } = this.fader.update(wantedId, dtSec, input.panic);
    return { shownId, brightness, selectedId };
  }

  private wantedScene({ auto, panic, live, selectedId }: DirectorInput): SceneId {
    if (panic) return SAFE_SCENE_ID;
    if (auto && !live) return IDLE_SCENE_ID;
    return selectedId;
  }
}
