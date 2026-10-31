const SMOOTHING = 0.05;

/** Smoothed frame rate and frame time, for the performance readout. */
export class FrameStats {
  fps = 60;
  frameMs = 1000 / 60;

  record(dtSec: number): void {
    this.fps += (1 / dtSec - this.fps) * SMOOTHING;
    this.frameMs += (dtSec * 1000 - this.frameMs) * SMOOTHING;
  }
}
