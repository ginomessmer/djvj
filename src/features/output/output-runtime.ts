import { type AudioFeatures, silentFeatures } from '@/domain/audio/audio-features';
import { demoFeatures } from '@/domain/audio/demo-features';
import { idleFeatures } from '@/domain/audio/idle-features';
import { clamp, smoothstep } from '@/domain/math';
import { ResolutionGovernor } from '@/domain/performance/resolution-governor';
import {
  PREVIEW_INTERVAL_SEC,
  PREVIEW_WATCH_SEC,
  type PreviewFrame,
} from '@/domain/remote/preview';
import { MAX_LOGO_DATA_URL_LENGTH, type ShowSnapshot } from '@/domain/remote/protocol';
import { type RhythmState, RhythmTracker } from '@/domain/rhythm/rhythm-tracker';
import { type Section, SectionTracker } from '@/domain/rhythm/section-tracker';
import { FlashGuard } from '@/domain/safety/flash-guard';
import type { Director, DirectorFrame } from '@/domain/show/director';
import { type OverlayFrame, OverlayScheduler } from '@/domain/show/overlay-scheduler';
import { PaletteRotation } from '@/domain/show/palette-rotation';
import { findPalette, nextPalette } from '@/domain/show/palettes';
import type { SceneId } from '@/domain/show/scenes';
import type { LogoStorage } from '@/services/logo-storage';
import type { Stage } from '@/vfx/stage';
import type { AudioPipeline } from '../audio/audio-pipeline';
import { type ShowStoreApi, toShowState } from '../show/show-store';
import { FrameStats } from './frame-stats';

export interface OutputRuntimeDeps {
  stage: Stage;
  store: ShowStoreApi;
  audio: AudioPipeline;
  director: Director;
  logoStorage: LogoStorage;
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
/** Assumed beat length while there is no tempo yet. */
const FALLBACK_BEAT_SEC = 60 / 128;
/** While the flash guard is fully on: pulses lose this share, the image this much brightness. */
const FLASH_GUARD = { pulseDamping: 0.85, dimming: 0.25 };

const NO_RHYTHM: RhythmState = {
  bpm: 0,
  confidence: 0,
  beatPhase: 0,
  beatHit: false,
  beatPulse: 0,
  source: 'auto',
};

type SnapshotListener = (snapshot: ShowSnapshot) => void;
type FrameListener = (frame: PreviewFrame) => void;

/**
 * The show loop of the output window. Each frame it senses audio, follows the rhythm and the
 * structure of the music, lets the director pick the scenes, keeps the output safe (flash guard)
 * and light enough for the GPU (adaptive resolution), and draws. It publishes snapshots (~10 Hz
 * and on every change) for the UI and the control window.
 */
export class OutputRuntime {
  private readonly listeners = new Set<SnapshotListener>();
  private readonly frameListeners = new Set<FrameListener>();
  private readonly stats = new FrameStats();
  private readonly rhythmTracker = new RhythmTracker();
  private readonly sectionTracker = new SectionTracker();
  private readonly paletteRotation = new PaletteRotation();
  private readonly overlayScheduler = new OverlayScheduler();
  private readonly flashGuard = new FlashGuard();
  private readonly governor = new ResolutionGovernor();
  private features: AudioFeatures = silentFeatures();
  private rhythm: RhythmState = NO_RHYTHM;
  private section: Section = 'quiet';
  private shownSceneId: SceneId;
  private overlay: OverlayFrame = { opacity: 0, layout: 'corner' };
  private logoUrl: string;
  private calm = 0;
  private resolution: [number, number] = [0, 0];
  private flow = 0;
  private blackoutLevel = 1;
  private lastFrameSec = 0;
  private lastSnapshotSec = 0;
  private lastLuminanceSec = Number.NEGATIVE_INFINITY;
  private previewWatchedUntilSec = Number.NEGATIVE_INFINITY;
  private lastPreviewSec = Number.NEGATIVE_INFINITY;

  constructor(private readonly deps: OutputRuntimeDeps) {
    const { store, audio } = deps;
    this.shownSceneId = store.getState().sceneId;
    this.logoUrl = deps.logoStorage.load();

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

  /** A tap on the beat; timed now, on the same clock as the frames. */
  tap(tSec = performance.now() / 1000): void {
    this.rhythmTracker.tap(tSec);
    this.publish();
  }

  clearTap(): void {
    this.rhythmTracker.clearTap();
    this.publish();
  }

  /** Sets (or with '' removes) the overlay logo. Anything that is not a sane image is ignored. */
  setLogo(dataUrl: string): void {
    const valid =
      dataUrl === '' ||
      (dataUrl.startsWith('data:image/') && dataUrl.length <= MAX_LOGO_DATA_URL_LENGTH);
    if (!valid) {
      console.warn('[djvj] ignored an invalid logo');
      return;
    }
    this.logoUrl = dataUrl;
    this.deps.logoStorage.save(dataUrl);
    this.publish();
  }

  /**
   * A control window shows the preview pane: produce frames for the next few seconds. It has to
   * keep asking, so a closed or hidden control window stops costing the output anything.
   */
  watchPreview(tSec = performance.now() / 1000): void {
    this.previewWatchedUntilSec = tSec + PREVIEW_WATCH_SEC;
  }

  subscribeFrames(listener: FrameListener): () => void {
    this.frameListeners.add(listener);
    return () => {
      this.frameListeners.delete(listener);
    };
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): ShowSnapshot {
    const { audio, store } = this.deps;
    const { features, rhythm } = this;
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
        bpm: rhythm.bpm,
        confidence: rhythm.confidence,
        beatPhase: rhythm.beatPhase,
        section: this.section,
        source: rhythm.source,
      },
      safety: { flashGuard: this.calm, resolutionScale: this.governor.scale },
      overlay: { hasLogo: this.logoUrl !== '', opacity: this.overlay.opacity },
      shownSceneId: this.shownSceneId,
      performance: {
        fps: this.stats.fps,
        frameMs: this.stats.frameMs,
        resolution: this.resolution,
      },
    };
  }

  /** Internals of the last frame, for diagnosing on the real rig (exposed in dev builds only). */
  inspect() {
    return {
      features: this.features,
      rhythm: this.rhythm,
      section: this.section,
      luminance: this.deps.stage.luminance(),
    };
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
      beat: {
        hit: this.rhythm.beatHit,
        locked: this.rhythm.confidence >= BEAT_LOCK_CONFIDENCE,
        periodSec: this.rhythm.bpm > 0 ? 60 / this.rhythm.bpm : FALLBACK_BEAT_SEC,
      },
    });
    this.followDirector(frame);

    this.calm = this.watchForFlashes(tSec);
    const blackoutTarget = show.blackout ? 0 : 1;
    this.blackoutLevel +=
      (blackoutTarget - this.blackoutLevel) * Math.min(1, dtSec * BLACKOUT_EASING_PER_SEC);
    const pulse = live ? this.pulse(view.kick) * (1 - FLASH_GUARD.pulseDamping * this.calm) : 0;

    this.overlay = this.overlayScheduler.update(dtSec, {
      mode: show.overlayMode,
      hasContent: show.overlayName.trim() !== '' || this.logoUrl !== '',
      live,
      section: this.section,
      beatHit: this.rhythm.beatHit,
    });

    const resolutionScale = this.governor.update(dtSec, show.adaptiveResolution);
    this.resolution = stage.resize(show.renderScale, resolutionScale);
    stage.render(
      frame,
      {
        time: tSec,
        flow: this.flow,
        features: view,
        rhythm: { beatPhase: this.rhythm.beatPhase, pulse },
        palette: findPalette(store.getState().paletteId),
        intensity:
          show.intensity *
          frame.brightness *
          this.blackoutLevel *
          (1 - FLASH_GUARD.dimming * this.calm),
      },
      {
        name: show.overlayName,
        logoUrl: this.logoUrl,
        opacity: this.overlay.opacity,
        layout: this.overlay.layout,
      },
    );

    this.forwardPreview(tSec);

    if (tSec - this.lastSnapshotSec >= SNAPSHOT_INTERVAL_SEC) {
      this.lastSnapshotSec = tSec;
      this.publish();
    }
  }

  private forwardPreview(tSec: number): void {
    const { stage } = this.deps;
    const wanted = this.frameListeners.size > 0 && tSec < this.previewWatchedUntilSec;
    stage.setPreviewWanted(wanted);
    if (!wanted) return;
    const frame = stage.takePreviewFrame();
    if (frame && tSec - this.lastPreviewSec >= PREVIEW_INTERVAL_SEC) {
      this.lastPreviewSec = tSec;
      for (const listener of this.frameListeners) listener(frame);
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

  /** Writes the director's choices back: the selected scene, and a new palette when it is time. */
  private followDirector(frame: DirectorFrame): void {
    const { store } = this.deps;
    const show = store.getState();
    if (frame.selectedId !== show.sceneId) show.apply({ sceneId: frame.selectedId });
    if (frame.change && show.autoPalette && this.paletteRotation.onSceneChange(frame.change)) {
      show.apply({ paletteId: nextPalette(show.paletteId).id });
    }
    this.shownSceneId = frame.mix >= 0.5 ? frame.toId : frame.fromId;
  }

  /** Feeds new brightness measurements to the flash guard; returns how hard to damp. */
  private watchForFlashes(tSec: number): number {
    const measured = this.deps.stage.luminance();
    if (measured && measured.tSec > this.lastLuminanceSec) {
      this.lastLuminanceSec = measured.tSec;
      this.flashGuard.observe(measured.tSec, measured.value);
    }
    return this.flashGuard.calm(tSec);
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
