export interface SignalGateOptions {
  thresholdDb: number;
  /** Signal must stay above the threshold this long to switch on. */
  onDelaySec: number;
  /** Silence must last this long to switch off (a breakdown or a short gap must not trigger idle). */
  offDelaySec: number;
  /** Dead zone below the threshold where neither counter runs. */
  hysteresisDb: number;
}

const DEFAULTS: SignalGateOptions = {
  thresholdDb: -52,
  onDelaySec: 0.4,
  offDelaySec: 3,
  hysteresisDb: 3,
};

/** Decides whether there is "music" or just a silent or noisy input. */
export class SignalGate {
  present = false;
  private readonly options: SignalGateOptions;
  private secondsAbove = 0;
  private secondsBelow = 0;

  constructor(options: Partial<SignalGateOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  setThreshold(thresholdDb: number): void {
    this.options.thresholdDb = thresholdDb;
  }

  update(levelDb: number, dtSec: number): boolean {
    const { thresholdDb, onDelaySec, offDelaySec, hysteresisDb } = this.options;

    if (levelDb > thresholdDb) {
      this.secondsAbove += dtSec;
      this.secondsBelow = 0;
    } else if (levelDb < thresholdDb - hysteresisDb) {
      this.secondsBelow += dtSec;
      this.secondsAbove = 0;
    }

    if (!this.present && this.secondsAbove >= onDelaySec) this.present = true;
    else if (this.present && this.secondsBelow >= offDelaySec) this.present = false;
    return this.present;
  }
}
