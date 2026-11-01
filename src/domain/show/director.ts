import { clamp } from '../math';
import type { Section } from '../rhythm/section-tracker';
import { type SceneMix, SceneMixer } from './scene-mixer';
import { pickScene } from './scene-picker';
import { IDLE_SCENE_ID, isCameraScene, SAFE_SCENE_ID, type SceneId } from './scenes';

export interface DirectorInput {
  auto: boolean;
  panic: boolean;
  /** The scene the DJ (or the director itself) picked. */
  selectedId: SceneId;
  /** True while there is music. */
  live: boolean;
  section: Section;
  /** Overall energy 0..1: picks scenes during a groove. */
  energy: number;
  /** A camera is running and delivering frames: camera scenes may be rotated in. */
  camera: boolean;
  beat: {
    /** True on the frame a beat starts. */
    hit: boolean;
    /** Whether the beat grid can be trusted. Without it, changes fall back to a timer. */
    locked: boolean;
    /** Beat length, for timing crossfades in bars. */
    periodSec: number;
  };
}

export interface DirectorFrame extends SceneMix<SceneId> {
  /** The selection after this frame; changes when the director moved on. */
  selectedId: SceneId;
  /** Why the director changed the scene this frame, or null. */
  change: ChangeReason | null;
}

export interface DirectorOptions {
  /** In a groove, a new scene every this many beats (64 = 16 bars, ~30 s at 128 BPM). */
  phraseBeats: number;
  /** Without a beat grid, a new scene this often instead. */
  fallbackIntervalSec: number;
  /** A section change waits until this many beats have passed since the last scene change. */
  minBeatsBetweenChanges: number;
  rng: () => number;
}

const DEFAULTS: DirectorOptions = {
  phraseBeats: 64,
  fallbackIntervalSec: 45,
  minBeatsBetweenChanges: 8,
  rng: Math.random,
};

/** Scene energy that suits each section; a groove follows the music's own energy. */
const SECTION_ENERGY: Record<Exclude<Section, 'groove'>, number> = {
  quiet: 0.15,
  breakdown: 0.25,
  build: 0.6,
  drop: 0.95,
};
const GROOVE_ENERGY = { min: 0.45, max: 0.85 };
/** Beat length assumed for spacing changes when there is no beat grid. */
const FALLBACK_BEAT_SEC = 60 / 128;
/** The current scene and the ones before it are not picked again. */
const RECENT_SCENES = 3;

/**
 * Why the director moved on. `camera`: the camera of the current camera scene went away, so it
 * leaves on the next beat instead of showing the stand-in for the rest of the phrase.
 */
export type ChangeReason = 'phrase' | 'section' | 'drop' | 'camera';

/** Crossfade lengths: the director's own changes last a bar, everything else a moment. */
const TRANSITION_BEATS = 4;
const FALLBACK_TRANSITION_SEC = 2;
const OTHER_TRANSITION_SEC = 1.5;
const PRIORITY: Record<ChangeReason, number> = { phrase: 1, section: 2, camera: 3, drop: 4 };

function strongest(a: ChangeReason | null, b: ChangeReason | null): ChangeReason | null {
  if (!a) return b;
  if (!b) return a;
  return PRIORITY[a] >= PRIORITY[b] ? a : b;
}

/**
 * Decides which scene is on screen. In auto mode it follows the music: a new scene every phrase
 * in a groove, calm scenes for breakdowns, an instant cut to a peak scene on the drop. Changes
 * land on the beat. Changes crossfade over a bar; the drop and panic cut. It also handles the idle
 * fallback.
 */
export class Director {
  private readonly options: DirectorOptions;
  private readonly mixer: SceneMixer<SceneId>;
  /** Most recent first; `recent[0]` is the current selection. */
  private recent: SceneId[];
  private beatsSinceChange = 0;
  private secondsSinceChange = 0;
  private pending: ChangeReason | null = null;
  private lastSection: Section | null = null;

  constructor(initialId: SceneId, options: Partial<DirectorOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.mixer = new SceneMixer(initialId);
    this.recent = [initialId];
  }

  /**
   * Call once per frame. The caller owns the selection: write `selectedId` of the returned frame
   * back into the next input, otherwise the director's own change is mistaken for a manual pick.
   */
  update(dtSec: number, input: DirectorInput): DirectorFrame {
    if (input.selectedId !== this.recent[0]) this.restartWith(input.selectedId); // picked by hand

    let selectedId = input.selectedId;
    let change: ChangeReason | null = null;
    if (input.auto && input.live && !input.panic) {
      this.secondsSinceChange += dtSec;
      if (input.beat.hit) this.beatsSinceChange++;
      this.pending = strongest(this.pending, this.reasonToChange(input));
      if (this.pending && this.mayChangeNow(this.pending, input.beat)) {
        change = this.pending;
        selectedId = pickScene(this.targetEnergy(input), this.recent, this.options.rng, {
          camera: input.camera,
        });
        this.restartWith(selectedId);
      }
    } else {
      this.resetTiming(); // locked, panicking or silent: when auto resumes, wait a full phrase
    }
    this.lastSection = input.section;

    const wantedId = this.wantedScene({ ...input, selectedId });
    const mix = this.mixer.update(wantedId, dtSec, this.transitionSec(input, change));
    return { ...mix, selectedId, change };
  }

  private reasonToChange({
    section,
    beat,
    camera,
    selectedId,
  }: DirectorInput): ChangeReason | null {
    if (!camera && isCameraScene(selectedId)) return 'camera';
    const sectionChanged = this.lastSection !== null && section !== this.lastSection;
    if (sectionChanged && section === 'drop') return 'drop';
    if (sectionChanged && (section === 'breakdown' || section === 'build')) return 'section';
    const phraseOver = beat.locked
      ? this.beatsSinceChange >= this.options.phraseBeats
      : this.secondsSinceChange >= this.options.fallbackIntervalSec;
    return phraseOver ? 'phrase' : null;
  }

  /** Drops cut at once; everything else lands on a beat, and not right after another change. */
  private mayChangeNow(reason: ChangeReason, beat: DirectorInput['beat']): boolean {
    if (reason === 'drop') return true;
    if (beat.locked && !beat.hit) return false;
    if (reason === 'camera') return true; // on the next beat, however recent the last change
    const { minBeatsBetweenChanges } = this.options;
    return beat.locked
      ? this.beatsSinceChange >= minBeatsBetweenChanges
      : this.secondsSinceChange >= minBeatsBetweenChanges * FALLBACK_BEAT_SEC;
  }

  /** How long the crossfade to a newly wanted scene takes; 0 is a cut. */
  private transitionSec({ panic, beat }: DirectorInput, change: ChangeReason | null): number {
    if (panic || change === 'drop') return 0;
    if (change) return beat.locked ? TRANSITION_BEATS * beat.periodSec : FALLBACK_TRANSITION_SEC;
    return OTHER_TRANSITION_SEC; // manual pick, idle fallback, back from panic
  }

  private targetEnergy({ section, energy }: DirectorInput): number {
    return section === 'groove'
      ? clamp(energy, GROOVE_ENERGY.min, GROOVE_ENERGY.max)
      : SECTION_ENERGY[section];
  }

  private wantedScene({ auto, panic, live, selectedId }: DirectorInput): SceneId {
    if (panic) return SAFE_SCENE_ID;
    if (auto && !live) return IDLE_SCENE_ID;
    return selectedId;
  }

  private restartWith(sceneId: SceneId): void {
    this.recent = [sceneId, ...this.recent.filter((id) => id !== sceneId)].slice(0, RECENT_SCENES);
    this.resetTiming();
  }

  private resetTiming(): void {
    this.beatsSinceChange = 0;
    this.secondsSinceChange = 0;
    this.pending = null;
  }
}
