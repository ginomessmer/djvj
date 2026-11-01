import { clamp01, fract, wrapPhase } from '../math';

export interface BeatClockOptions {
  /** Onsets this recent decide where the beat is (short: relocks quickly after a change). */
  windowSec: number;
  /** Onsets this recent are used to fit the period (long: more onsets, more precise). */
  fitWindowSec: number;
  /** Resolution of the phase histogram. */
  bins: number;
  /** Share of a small error corrected per evaluation (smooth drift correction). */
  gain: number;
  /** Errors larger than this (fraction of a beat) are corrected at once (relock). */
  jumpThreshold: number;
  evaluateEverySec: number;
  /** Another cluster must be this much stronger than the one on our beat before we move there. */
  relockMargin: number;
  /** The fitted period is trusted while it stays this close to the coarse one (else: new tempo). */
  maxPeriodDeviation: number;
  /** The fit needs at least this many onsets spanning at least this many beats. */
  minFitOnsets: number;
  minFitBeats: number;
}

const DEFAULTS: BeatClockOptions = {
  windowSec: 6,
  fitWindowSec: 10,
  bins: 16,
  gain: 0.25,
  jumpThreshold: 0.25,
  evaluateEverySec: 0.25,
  relockMargin: 1.25,
  maxPeriodDeviation: 0.03,
  minFitOnsets: 6,
  minFitBeats: 4,
};

interface Onset {
  tSec: number;
  strength: number;
}

export interface BeatClockState {
  /** 0..1 position within the current beat; 0 = on the beat. */
  phase: number;
  /** 0..1: how clearly the recent onsets agree on where the beat is. */
  lock: number;
  /** The beat period the grid runs at: fitted to the onsets once possible, else the coarse one. */
  periodSec: number;
}

/**
 * Keeps a running beat grid aligned with the low-end onsets. Each onset is folded onto the grid
 * (its time modulo the beat period); the strongest cluster is where the beat is. Off-beat bass
 * notes form a weaker cluster half a beat away and are ignored.
 *
 * The period comes in coarse (autocorrelation of frame-rate onsets is only good to about ±1 BPM)
 * and is refined by a least-squares fit of the cluster's onset times against their beat numbers:
 * many onsets over several seconds average out the frame quantisation.
 */
export class BeatClock {
  private readonly options: BeatClockOptions;
  private readonly onsets: Onset[] = [];
  private beatStartSec: number | null = null;
  private nextEvaluationSec = Number.NEGATIVE_INFINITY;
  private lock = 0;
  private fittedPeriodSec: number | null = null;

  constructor(options: Partial<BeatClockOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** Puts a beat at `beatSec` (e.g. from tap tempo) and forgets the fitted period. */
  anchor(beatSec: number): void {
    this.beatStartSec = beatSec;
    this.fittedPeriodSec = null;
  }

  /**
   * @param coarsePeriodSec the beat period from the tempo estimator
   * @param onsetStrength strength of a low-end onset detected this frame, else 0
   * @param mayRelock false keeps the grid where it is (tapped by hand): onsets only fine-tune it
   */
  update(
    tSec: number,
    coarsePeriodSec: number,
    onsetStrength: number,
    mayRelock = true,
  ): BeatClockState {
    const periodSec = this.periodFor(coarsePeriodSec);
    if (this.beatStartSec === null) this.beatStartSec = tSec;
    if (onsetStrength > 0) this.onsets.push({ tSec, strength: onsetStrength });
    while (this.onsets.length > 0 && tSec - this.onsets[0].tSec > this.options.fitWindowSec) {
      this.onsets.shift();
    }

    if (tSec >= this.nextEvaluationSec) {
      this.nextEvaluationSec = tSec + this.options.evaluateEverySec;
      this.align(tSec, this.beatStartSec, periodSec, mayRelock);
    }

    // Keep the grid's reference beat within one period before now.
    this.beatStartSec += Math.floor((tSec - this.beatStartSec) / periodSec) * periodSec;
    return { phase: (tSec - this.beatStartSec) / periodSec, lock: this.lock, periodSec };
  }

  /** The fitted period while it agrees with the coarse one; a big difference means a new tempo. */
  private periodFor(coarsePeriodSec: number): number {
    const fitted = this.fittedPeriodSec;
    if (
      fitted !== null &&
      Math.abs(fitted - coarsePeriodSec) / coarsePeriodSec <= this.options.maxPeriodDeviation
    ) {
      return fitted;
    }
    this.fittedPeriodSec = null;
    return coarsePeriodSec;
  }

  private align(tSec: number, beatStartSec: number, periodSec: number, mayRelock: boolean): void {
    const { bins, gain, jumpThreshold, relockMargin, windowSec } = this.options;
    const recent = this.onsets.filter((onset) => tSec - onset.tSec <= windowSec);
    if (recent.length < 4) {
      this.lock *= 0.8;
      return;
    }

    const phaseOf = (onset: Onset) => fract((onset.tSec - beatStartSec) / periodSec);
    const histogram = new Array<number>(bins).fill(0);
    let total = 0;
    for (const onset of recent) {
      histogram[Math.floor(phaseOf(onset) * bins) % bins] += onset.strength;
      total += onset.strength;
    }
    const smoothed = histogram.map(
      (_, i) =>
        0.25 * histogram[(i - 1 + bins) % bins] +
        0.5 * histogram[i] +
        0.25 * histogram[(i + 1) % bins],
    );
    const strongestCentre = (smoothed.indexOf(Math.max(...smoothed)) + 0.5) / bins;
    const strongest = this.clusterAt(strongestCentre, phaseOf, recent);
    const onOurBeat = this.clusterAt(0, phaseOf, recent);

    // Hysteresis: only move to a cluster far from our beat when it is clearly stronger.
    // Otherwise two equal clusters (kick and off-beat bass) would make the grid flip-flop.
    const moveAway =
      mayRelock &&
      Math.abs(strongest.phase) > jumpThreshold &&
      strongest.strength > relockMargin * onOurBeat.strength;
    const target = moveAway || onOurBeat.strength === 0 ? strongest : onOurBeat;

    this.lock = clamp01((target.strength / total - 0.3) / 0.4);
    // Fit the period on the same cluster, over the longer window.
    const fitMembers = this.clusterAt(target.phase, phaseOf, this.onsets).members;
    this.fitPeriod(fitMembers, beatStartSec, periodSec, target.phase);
    const relock = mayRelock && Math.abs(target.phase) > jumpThreshold && this.lock > 0.3;
    this.beatStartSec = beatStartSec + (relock ? target.phase : target.phase * gain) * periodSec;
  }

  /** Least-squares slope of onset time over beat number: the beat period, to a fraction of a ms. */
  private fitPeriod(
    members: readonly Onset[],
    beatStartSec: number,
    periodSec: number,
    clusterPhase: number,
  ): void {
    const { minFitOnsets, minFitBeats } = this.options;
    if (members.length < minFitOnsets) return;
    const points = members.map((onset) => ({
      beat: Math.round((onset.tSec - beatStartSec) / periodSec - clusterPhase),
      tSec: onset.tSec,
    }));
    const beats = points.map((point) => point.beat);
    if (Math.max(...beats) - Math.min(...beats) < minFitBeats) return;

    const meanBeat = beats.reduce((sum, beat) => sum + beat, 0) / points.length;
    const meanSec = points.reduce((sum, point) => sum + point.tSec, 0) / points.length;
    let covariance = 0;
    let variance = 0;
    for (const { beat, tSec } of points) {
      covariance += (beat - meanBeat) * (tSec - meanSec);
      variance += (beat - meanBeat) ** 2;
    }
    if (variance > 0 && covariance > 0) this.fittedPeriodSec = covariance / variance;
  }

  /** Strength, exact (circular mean) phase in -0.5..0.5, and members of the cluster at `centre`. */
  private clusterAt(centre: number, phaseOf: (onset: Onset) => number, onsets: readonly Onset[]) {
    const halfWidth = 1.5 / this.options.bins;
    const members: Onset[] = [];
    let x = 0;
    let y = 0;
    let strength = 0;
    for (const onset of onsets) {
      const phase = phaseOf(onset);
      if (Math.abs(wrapPhase(phase - centre)) > halfWidth) continue;
      members.push(onset);
      x += Math.cos(2 * Math.PI * phase) * onset.strength;
      y += Math.sin(2 * Math.PI * phase) * onset.strength;
      strength += onset.strength;
    }
    return { phase: strength > 0 ? Math.atan2(y, x) / (2 * Math.PI) : 0, strength, members };
  }
}
