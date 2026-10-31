/** The part of a track that is playing, as far as the visuals care. */
export type Section = 'quiet' | 'groove' | 'breakdown' | 'build' | 'drop';

export interface SectionInput {
  signal: boolean;
  /**
   * Level of the kick band (40-100 Hz) in dB, unnormalised. Kick and bassline live there; pads and
   * chords mostly do not (measured: a breakdown pad left 60-250 Hz unchanged).
   */
  lowDb: number;
  /** Loudest of the two highest bands, in dB (unnormalised). */
  highDb: number;
  /** Overall loudness in dBFS. */
  loudnessDb: number;
  beatHit: boolean;
}

export interface SectionTrackerOptions {
  /** Bass counts as present within this many dB of its recent reference level. */
  presentMarginDb: number;
  /** Bass counts as gone this many dB below the reference (hysteresis with the above). */
  absentMarginDb: number;
  /** How fast the bass reference forgets a loud passage (dB per second). */
  referenceDecayDbPerSec: number;
  /** Bass must be gone this long before it is a breakdown (EQ kills and fills are shorter). */
  breakdownAfterSec: number;
  /** A breakdown must have lasted this long for the bass coming back to be a drop. */
  dropAfterSec: number;
  /** Bass must be back this long to count (fast: the drop is the moment that matters). */
  bassReturnSec: number;
  /** Smoothing of the bass level when it rises: short, so a drop is recognised quickly. */
  bassAttackSec: number;
  /** Rise of the highs during a breakdown that makes it a build (risers, snare rolls). */
  buildRiseDb: number;
  /** A drop lasts this many beats, then it is groove. */
  dropBeats: number;
  /** ...or this long without a beat grid. */
  dropMaxSec: number;
  smoothingSec: number;
  /** Highs are averaged in power over this long, so hats coming and going do not look like a rise. */
  highSmoothingSec: number;
}

const DEFAULTS: SectionTrackerOptions = {
  presentMarginDb: 8,
  absentMarginDb: 14,
  referenceDecayDbPerSec: 0.15,
  breakdownAfterSec: 2,
  dropAfterSec: 4,
  bassReturnSec: 0.1,
  bassAttackSec: 0.08,
  buildRiseDb: 6,
  dropBeats: 16,
  dropMaxSec: 10,
  smoothingSec: 0.5,
  highSmoothingSec: 1.5,
};

/**
 * Follows the structure of the music from the bass: groove while the bass plays, breakdown when
 * it leaves, build when the highs rise without it, drop when it comes back after a breakdown.
 * Bass is measured relative to the overall loudness, so the DJ changing the volume does not
 * look like a breakdown.
 */
export class SectionTracker {
  section: Section = 'quiet';
  private readonly options: SectionTrackerOptions;
  private bassRelDb: number | null = null;
  private bassReferenceDb = Number.NEGATIVE_INFINITY;
  private highPower: number | null = null;
  private highFloorDb = Number.POSITIVE_INFINITY;
  private bassPresentSec = 0;
  private bassAbsentSec = 0;
  private withoutBassSec = 0;
  private dropBeatCount = 0;
  private dropSec = 0;

  constructor(options: Partial<SectionTrackerOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  update(dtSec: number, input: SectionInput): Section {
    if (!input.signal) {
      this.section = 'quiet';
      return this.section;
    }
    this.measure(dtSec, input);

    switch (this.section) {
      case 'quiet':
        this.enter('groove');
        break;
      case 'groove':
        if (this.bassAbsentSec >= this.options.breakdownAfterSec) this.enter('breakdown');
        break;
      case 'breakdown':
      case 'build':
        this.withoutBassSec += dtSec;
        // The bass coming back wins over a build: the highs return with it.
        if (this.bassPresentSec >= this.options.bassReturnSec) {
          this.enter(this.withoutBassSec >= this.options.dropAfterSec ? 'drop' : 'groove');
        } else if (this.section === 'breakdown' && this.bassPresentSec === 0 && this.highsRose()) {
          this.enter('build');
        }
        break;
      case 'drop':
        this.dropSec += dtSec;
        if (input.beatHit) this.dropBeatCount++;
        if (this.bassAbsentSec >= this.options.breakdownAfterSec) this.enter('breakdown');
        else if (
          this.dropBeatCount >= this.options.dropBeats ||
          this.dropSec >= this.options.dropMaxSec
        ) {
          this.enter('groove');
        }
        break;
    }
    return this.section;
  }

  private measure(dtSec: number, { lowDb, highDb, loudnessDb }: SectionInput): void {
    const { smoothingSec, bassAttackSec, referenceDecayDbPerSec, presentMarginDb, absentMarginDb } =
      this.options;
    const blend = (timeConstantSec: number) => 1 - Math.exp(-dtSec / timeConstantSec);
    const bassRel = lowDb - loudnessDb;
    if (this.bassRelDb === null) this.bassRelDb = bassRel;
    const bassBlend = blend(bassRel > this.bassRelDb ? bassAttackSec : smoothingSec);
    this.bassRelDb += (bassRel - this.bassRelDb) * bassBlend;
    // Highs are averaged in power, not dB: hats swinging between silence and -60 dB every beat
    // would otherwise move a dB average by more than a real build does.
    const highPower = 10 ** (highDb / 10);
    this.highPower =
      this.highPower === null
        ? highPower
        : this.highPower + (highPower - this.highPower) * blend(this.options.highSmoothingSec);
    this.bassReferenceDb = Math.max(
      this.bassRelDb,
      this.bassReferenceDb - referenceDecayDbPerSec * dtSec,
    );

    if (this.bassRelDb > this.bassReferenceDb - presentMarginDb) {
      this.bassPresentSec += dtSec;
      this.bassAbsentSec = 0;
    } else if (this.bassRelDb < this.bassReferenceDb - absentMarginDb) {
      this.bassAbsentSec += dtSec;
      this.bassPresentSec = 0;
    }
  }

  private highsRose(): boolean {
    const high = 10 * Math.log10((this.highPower ?? 0) + 1e-12);
    this.highFloorDb = Math.min(this.highFloorDb, high);
    return high - this.highFloorDb >= this.options.buildRiseDb;
  }

  private enter(section: Section): void {
    if (section === 'breakdown') {
      this.withoutBassSec = 0;
      this.highFloorDb = Number.POSITIVE_INFINITY;
    }
    if (section === 'drop') {
      this.dropBeatCount = 0;
      this.dropSec = 0;
    }
    this.section = section;
  }
}
