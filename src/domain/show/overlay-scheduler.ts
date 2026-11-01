import type { Section } from '../rhythm/section-tracker';

export const OVERLAY_MODES = ['off', 'corner', 'reveal'] as const;
/** off; corner: always, small; reveal: big in the centre after each drop and now and then. */
export type OverlayMode = (typeof OVERLAY_MODES)[number];
export type OverlayLayout = 'corner' | 'centre';

export interface OverlayInput {
  mode: OverlayMode;
  /** Whether there is a name or a logo to show. */
  hasContent: boolean;
  live: boolean;
  section: Section;
  beatHit: boolean;
}

export interface OverlayFrame {
  opacity: number;
  layout: OverlayLayout;
}

export interface OverlaySchedulerOptions {
  /** A reveal lasts this many beats after a drop... */
  revealBeats: number;
  /** ...but never longer than this. */
  revealMaxSec: number;
  /** Without a drop, reveal anyway this often, for `revealSec`. */
  revealEverySec: number;
  revealSec: number;
  fadeSec: number;
  cornerOpacity: number;
}

const DEFAULTS: OverlaySchedulerOptions = {
  revealBeats: 16,
  revealMaxSec: 12,
  revealEverySec: 120,
  revealSec: 8,
  fadeSec: 1.5,
  cornerOpacity: 0.8,
};

/** Decides when the DJ name / logo is visible, and how strongly. Fades, never pops. */
export class OverlayScheduler {
  private readonly options: OverlaySchedulerOptions;
  private opacity = 0;
  private revealBeatsLeft = 0;
  private revealSecLeft = 0;
  private sinceRevealSec = 0;
  private lastSection: Section | null = null;

  constructor(options: Partial<OverlaySchedulerOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  update(dtSec: number, input: OverlayInput): OverlayFrame {
    const target = input.hasContent ? this.target(dtSec, input) : 0;
    const step = dtSec / this.options.fadeSec;
    this.opacity += Math.max(-step, Math.min(step, target - this.opacity));
    this.lastSection = input.section;
    return { opacity: this.opacity, layout: input.mode === 'reveal' ? 'centre' : 'corner' };
  }

  private target(dtSec: number, input: OverlayInput): number {
    if (input.mode === 'corner') return this.options.cornerOpacity;
    if (input.mode !== 'reveal' || !input.live) return 0;

    const { revealBeats, revealMaxSec, revealEverySec, revealSec } = this.options;
    if (input.section === 'drop' && this.lastSection !== 'drop') {
      this.revealBeatsLeft = revealBeats;
      this.revealSecLeft = revealMaxSec;
      this.sinceRevealSec = 0;
    }
    this.sinceRevealSec += dtSec;
    if (this.sinceRevealSec >= revealEverySec) {
      this.revealSecLeft = revealSec;
      this.revealBeatsLeft = Number.POSITIVE_INFINITY; // time decides this one
      this.sinceRevealSec = 0;
    }

    if (input.beatHit) this.revealBeatsLeft--;
    this.revealSecLeft = Math.max(0, this.revealSecLeft - dtSec);
    const revealing = this.revealBeatsLeft > 0 && this.revealSecLeft > 0;
    return revealing ? 1 : 0;
  }
}
