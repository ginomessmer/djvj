import type { AudioFeatures } from '../audio/audio-features';
import { fract } from '../math';
import { BeatClock } from './beat-clock';
import { TapTempo } from './tap-tempo';
import { TempoEstimator } from './tempo-estimator';

export interface RhythmState {
  /** 0 until a tempo was found. */
  bpm: number;
  /** 0..1: the tempo is periodic and the beat grid is locked. Below ~0.5, don't trust the grid. */
  confidence: number;
  /** 0..1 position in the current beat (0 = on the beat), latency offset applied. */
  beatPhase: number;
  /** True on the frame a beat starts. */
  beatHit: boolean;
  /** 1 on the beat, decays in ~120 ms: a clean, regular pulse for the visuals. */
  beatPulse: number;
  /** Where the tempo comes from: the music, or the DJ tapping it. */
  source: 'auto' | 'tap';
}

/** Assumed until a tempo is found: typical for the genres. */
const DEFAULT_BPM = 128;
const PULSE_DECAY_SEC = 0.12;
/** A tapped tempo is trusted at least this much. */
const TAPPED_CONFIDENCE = 0.8;
/** Two beats closer than this (fraction of a beat) mean the grid re-aligned: only one counts. */
const MIN_BEAT_SPACING = 0.75;

/** Tempo plus a beat grid locked to the music. Feed it the audio features once per frame. */
export class RhythmTracker {
  private readonly tempo = new TempoEstimator();
  private readonly clock = new BeatClock();
  private readonly tapTempo = new TapTempo();
  private tappedPeriodSec: number | null = null;
  private previousPhase = 0;
  private lastBeatSec = Number.NEGATIVE_INFINITY;

  /**
   * A tap on the beat. After a few taps the tapped tempo and phase take over (the onsets still
   * fine-tune them) until `clearTap()`: a fallback when the input is too weak or misleading.
   */
  tap(tSec: number): void {
    const tapped = this.tapTempo.tap(tSec);
    if (!tapped) return;
    this.tappedPeriodSec = tapped.periodSec;
    this.clock.anchor(tapped.beatSec);
  }

  clearTap(): void {
    this.tappedPeriodSec = null;
  }

  /** @param offsetSec display latency compensation: positive shows beats earlier */
  update(tSec: number, features: AudioFeatures, offsetSec = 0): RhythmState {
    const tempo = this.tempo.update(tSec, features.lowEndFlux);
    const tapped = this.tappedPeriodSec !== null;
    const coarsePeriodSec = this.tappedPeriodSec ?? 60 / (tempo.bpm || DEFAULT_BPM);
    // The grid weighs onsets by their punch: the kick, not an equally "bassy" off-beat note.
    const clock = this.clock.update(
      tSec,
      coarsePeriodSec,
      features.kickHit ? features.punch : 0,
      !tapped,
    );
    const { periodSec } = clock;

    const beatPhase = fract(clock.phase + offsetSec / periodSec);
    const wrapped = beatPhase < this.previousPhase;
    this.previousPhase = beatPhase;
    const beatHit = wrapped && tSec - this.lastBeatSec >= MIN_BEAT_SPACING * periodSec;
    if (beatHit) this.lastBeatSec = tSec;

    return {
      bpm: tapped || tempo.bpm > 0 ? 60 / periodSec : 0,
      confidence: tapped
        ? Math.max(TAPPED_CONFIDENCE, tempo.confidence * clock.lock)
        : tempo.confidence * clock.lock,
      beatPhase,
      beatHit,
      beatPulse: Math.exp(-(beatPhase * periodSec) / PULSE_DECAY_SEC),
      source: tapped ? 'tap' : 'auto',
    };
  }
}
