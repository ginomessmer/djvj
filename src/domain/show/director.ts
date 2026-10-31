import { clamp } from '../math';
import type { Section } from '../rhythm/section-tracker';
import { SceneFader } from './scene-fader';
import { pickScene } from './scene-picker';
import { IDLE_SCENE_ID, SAFE_SCENE_ID, type SceneId } from './scenes';

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
  beat: {
    /** True on the frame a beat starts. */
    hit: boolean;
    /** Whether the beat grid can be trusted. Without it, changes fall back to a timer. */
    locked: boolean;
  };
}

export interface DirectorFrame {
  /** What to draw this frame (differs from `selectedId` while idle, panicking or fading). */
  shownId: SceneId;
  brightness: number;
  /** The selection after this frame; changes when the director moved on. */
  selectedId: SceneId;
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

type ChangeReason = 'phrase' | 'section' | 'drop';
const PRIORITY: Record<ChangeReason, number> = { phrase: 1, section: 2, drop: 3 };

function strongest(a: ChangeReason | null, b: ChangeReason | null): ChangeReason | null {
  if (!a) return b;
  if (!b) return a;
  return PRIORITY[a] >= PRIORITY[b] ? a : b;
}

/**
 * Decides which scene is on screen. In auto mode it follows the music: a new scene every phrase
 * in a groove, calm scenes for breakdowns, an instant cut to a peak scene on the drop. Changes
 * land on the beat. It also handles the idle fallback, panic and the dip-to-black fades.
 */
export class Director {
  private readonly options: DirectorOptions;
  private readonly fader: SceneFader<SceneId>;
  /** Most recent first; `recent[0]` is the current selection. */
  private recent: SceneId[];
  private beatsSinceChange = 0;
  private secondsSinceChange = 0;
  private pending: ChangeReason | null = null;
  private lastSection: Section | null = null;

  constructor(initialId: SceneId, options: Partial<DirectorOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.fader = new SceneFader(initialId);
    this.recent = [initialId];
  }

  /**
   * Call once per frame. The caller owns the selection: write `selectedId` of the returned frame
   * back into the next input, otherwise the director's own change is mistaken for a manual pick.
   */
  update(dtSec: number, input: DirectorInput): DirectorFrame {
    if (input.selectedId !== this.recent[0]) this.restartWith(input.selectedId); // picked by hand

    let selectedId = input.selectedId;
    let cut = false;
    if (input.auto && input.live && !input.panic) {
      this.secondsSinceChange += dtSec;
      if (input.beat.hit) this.beatsSinceChange++;
      this.pending = strongest(this.pending, this.reasonToChange(input));
      if (this.pending && this.mayChangeNow(this.pending, input.beat)) {
        cut = this.pending === 'drop';
        selectedId = pickScene(this.targetEnergy(input), this.recent, this.options.rng);
        this.restartWith(selectedId);
      }
    } else {
      this.resetTiming(); // locked, panicking or silent: when auto resumes, wait a full phrase
    }
    this.lastSection = input.section;

    const wantedId = this.wantedScene({ ...input, selectedId });
    const { shownId, brightness } = this.fader.update(wantedId, dtSec, input.panic || cut);
    return { shownId, brightness, selectedId };
  }

  private reasonToChange({ section, beat }: DirectorInput): ChangeReason | null {
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
    const { minBeatsBetweenChanges } = this.options;
    return beat.locked
      ? this.beatsSinceChange >= minBeatsBetweenChanges
      : this.secondsSinceChange >= minBeatsBetweenChanges * FALLBACK_BEAT_SEC;
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
