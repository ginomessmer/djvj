import { type AudioFeatures, silentFeatures } from '@/domain/audio/audio-features';
import { demoFeatures } from '@/domain/audio/demo-features';
import { idleFeatures } from '@/domain/audio/idle-features';
import { clamp, smoothstep } from '@/domain/math';
import type { ShowSnapshot } from '@/domain/remote/protocol';
import { type RhythmState, RhythmTracker } from '@/domain/rhythm/rhythm-tracker';
import { type Section, SectionTracker } from '@/domain/rhythm/section-tracker';
import type { Director } from '@/domain/show/director';
import { findPalette } from '@/domain/show/palettes';
import type { SceneId } from '@/domain/show/scenes';
import type { Stage } from '@/vfx/stage';
import type { AudioPipeline } from '../audio/audio-pipeline';
import { type ShowStoreApi, toShowState } from '../show/show-store';
import { FrameStats } from './frame-stats';

export interface OutputRuntimeDeps {
  stage: Stage;
  store: ShowStoreApi;
  audio: AudioPipeline;
  director: Director;
}

const SNAPSHOT_INTERVAL_SEC = 0.1;
const BLACKOUT_EASING_PER_SEC = 12;
/** How fast scene travel speeds up with energy. */
const FLOW_BASE_SPEED = 0.2;
const FLOW_ENERGY_SPEED = 1.8;
/** From this confidence on, the beat grid drives scene changes. */
const BEAT_LOCK_CONFIDENCE = 0.5;
/** Between these confidences the visual pulse blends from the raw kick to the beat grid. */
const PULSE_BLEND = { from: 0.3, to: 0.6 };

const NO_RHYTHM: RhythmState = {
  bpm: 0,
  confidence: 0,
  beatPhase: 0,
  beatHit: false,
  beatPulse: 0,
};

type SnapshotListener = (snapshot: ShowSnapshot) => void;

/**
 * The show loop of the output window: each frame it senses audio, follows the rhythm and the
 * structure of the music, lets the director pick the scene and draws it. It publishes snapshots (~10 Hz and on every change) for the UI and for the
 * control window.
 */
export class OutputRuntime {
  private readonly listeners = new Set<SnapshotListener>();
  private readonly stats = new FrameStats();
  private readonly rhythmTracker = new RhythmTracker();
  private readonly sectionTracker = new SectionTracker();
  private features: AudioFeatures = silentFeatures();
  private rhythm: RhythmState = NO_RHYTHM;
  private section: Section = 'quiet';
  private shownSceneId: SceneId;
  private resolution: [number, number] = [0, 0];
  private flow = 0;
  private blackoutLevel = 1;
  private lastFrameSec = 0;
  private lastSnapshotSec = 0;

  constructor(private readonly deps: OutputRuntimeDeps) {
    const { store, audio } = deps;
    this.shownSceneId = store.getState().sceneId;

    audio.onChange = () => this.publish();
    store.subscribe(() => this.publish());
    store.subscribe(
      (state) => state.silenceDb,
      (silenceDb) => audio.setSilenceThreshold(silenceDb),
    );
    store.subscribe(
      (state) => state.deviceId,
      (deviceId) => this.onDeviceSelected(deviceId),
    );
  }

  start(): void {
    const loop = (nowMs: number) => {
      requestAnimationFrame(loop); // schedule first: one bad frame must never stop the show
      try {
        this.renderFrame(nowMs / 1000);
      } catch (error) {
        console.error('[djvj] frame error', error);
      }
    };
    requestAnimationFrame(loop);
  }

  /** Needs a user gesture the first time (browser autoplay policy). */
  async startAudio(deviceId = this.deps.store.getState().deviceId): Promise<void> {
    const { audio, store } = this.deps;
    await audio.start(deviceId);
    if (audio.status === 'running') store.getState().apply({ deviceId: audio.activeDeviceId });
  }

  refreshDevices(): Promise<void> {
    return this.deps.audio.refreshDevices();
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): ShowSnapshot {
    const { audio, store } = this.deps;
    const { features } = this;
    return {
      show: toShowState(store.getState()),
      audio: {
        status: audio.status,
        error: audio.error,
        devices: audio.devices,
        activeDeviceId: audio.activeDeviceId,
      },
      signal: {
        present: features.signal || store.getState().demo,
        bands: features.bands,
        energy: features.energy,
        kick: features.kick,
        loudnessDb: features.loudnessDb,
      },
      rhythm: {
        bpm: this.rhythm.bpm,
        confidence: this.rhythm.confidence,
        beatPhase: this.rhythm.beatPhase,
        section: this.section,
      },
      shownSceneId: this.shownSceneId,
      performance: {
        fps: this.stats.fps,
        frameMs: this.stats.frameMs,
        resolution: this.resolution,
      },
    };
  }

  /** Internals of the last frame, for diagnosing on the real rig (exposed in dev builds only). */
  inspect(): { features: AudioFeatures; rhythm: RhythmState; section: Section } {
    return { features: this.features, rhythm: this.rhythm, section: this.section };
  }

  /** One frame. `start()` drives it from `requestAnimationFrame`; tests call it directly. */
  renderFrame(tSec: number): void {
    const { stage, store, director } = this.deps;
    const dtSec = this.lastFrameSec === 0 ? 1 / 60 : clamp(tSec - this.lastFrameSec, 0.001, 0.1);
    this.lastFrameSec = tSec;
    this.stats.record(dtSec);

    const show = store.getState();
    this.features = this.senseAudio(show.demo, tSec);
    const live = this.features.signal;
    this.followMusic(tSec, dtSec, show.beatOffsetMs / 1000);
    const view = live ? this.features : idleFeatures(tSec);
    this.flow += dtSec * (FLOW_BASE_SPEED + FLOW_ENERGY_SPEED * view.energy);

    const frame = director.update(dtSec, {
      auto: show.auto,
      panic: show.panic,
      selectedId: show.sceneId,
      live,
      section: this.section,
      energy: view.energy,
      beat: { hit: this.rhythm.beatHit, locked: this.rhythm.confidence >= BEAT_LOCK_CONFIDENCE },
    });
    if (frame.selectedId !== show.sceneId) show.apply({ sceneId: frame.selectedId });
    this.shownSceneId = frame.shownId;

    const blackoutTarget = show.blackout ? 0 : 1;
    this.blackoutLevel +=
      (blackoutTarget - this.blackoutLevel) * Math.min(1, dtSec * BLACKOUT_EASING_PER_SEC);

    this.resolution = stage.resize(show.renderScale);
    stage.render(frame.shownId, {
      time: tSec,
      flow: this.flow,
      features: view,
      rhythm: { beatPhase: this.rhythm.beatPhase, pulse: live ? this.pulse(view.kick) : 0 },
      palette: findPalette(show.paletteId),
      intensity: show.intensity * frame.brightness * this.blackoutLevel,
    });

    if (tSec - this.lastSnapshotSec >= SNAPSHOT_INTERVAL_SEC) {
      this.lastSnapshotSec = tSec;
      this.publish();
    }
  }

  private followMusic(tSec: number, dtSec: number, beatOffsetSec: number): void {
    const { features } = this;
    this.rhythm = this.rhythmTracker.update(tSec, features, beatOffsetSec);
    this.section = this.sectionTracker.update(dtSec, {
      signal: features.signal,
      lowDb: features.lowEndDb,
      highDb: Math.max(features.bandsDb[3], features.bandsDb[4]),
      loudnessDb: features.loudnessDb,
      beatHit: this.rhythm.beatHit,
    });
  }

  /** The beat grid's pulse once it is trusted, the raw kick before that; blended, never a jump. */
  private pulse(kick: number): number {
    const trust = smoothstep(PULSE_BLEND.from, PULSE_BLEND.to, this.rhythm.confidence);
    return kick + (this.rhythm.beatPulse - kick) * trust;
  }

  private senseAudio(demo: boolean, tSec: number): AudioFeatures {
    if (demo) return demoFeatures(tSec);
    return this.deps.audio.analyse(tSec) ?? silentFeatures();
  }

  private onDeviceSelected(deviceId: string): void {
    const { audio } = this.deps;
    if (audio.status === 'running' && deviceId !== audio.activeDeviceId) {
      void this.startAudio(deviceId);
    }
  }

  private publish(): void {
    if (this.listeners.size === 0) return;
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
