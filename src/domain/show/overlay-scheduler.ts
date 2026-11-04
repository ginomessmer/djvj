export const OVERLAY_MODES = ['off', 'corner', 'reveal'] as const;
/**
 * off; corner: always, small; reveal: big in the centre, as one of the texts (after drops and now
 * and then; see `TextDirector`).
 */
export type OverlayMode = (typeof OVERLAY_MODES)[number];

export interface OverlayInput {
  mode: OverlayMode;
  /** Whether there is a name or a logo to show. */
  hasContent: boolean;
  /** A headline text is on screen: the corner mark steps aside meanwhile. */
  headline: boolean;
}

export interface OverlayFrame {
  /** Opacity of the small corner mark. */
  opacity: number;
}

export interface OverlaySchedulerOptions {
  fadeSec: number;
  cornerOpacity: number;
}

const DEFAULTS: OverlaySchedulerOptions = { fadeSec: 1.5, cornerOpacity: 0.8 };

/** Decides how strongly the DJ name / logo shows in the corner. Fades, never pops. */
export class OverlayScheduler {
  private readonly options: OverlaySchedulerOptions;
  private opacity = 0;

  constructor(options: Partial<OverlaySchedulerOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  update(dtSec: number, input: OverlayInput): OverlayFrame {
    const visible = input.hasContent && input.mode === 'corner' && !input.headline;
    const target = visible ? this.options.cornerOpacity : 0;
    const step = dtSec / this.options.fadeSec;
    this.opacity += Math.max(-step, Math.min(step, target - this.opacity));
    return { opacity: this.opacity };
  }
}
