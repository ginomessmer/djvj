import type { AudioFeatures } from '@/domain/audio/audio-features';
import type { OverlayLayout } from '@/domain/show/overlay-scheduler';
import type { Palette } from '@/domain/show/palettes';

/** Everything the stage needs to draw one frame. */
export interface FrameParams {
  /** Wall-clock seconds. */
  time: number;
  /** Time integrated with audio energy: use it for travel so speed changes stay smooth. */
  flow: number;
  features: Pick<AudioFeatures, 'bands' | 'energy' | 'kick' | 'onset'>;
  rhythm: {
    /** 0..1 position in the beat (0 = on the beat). */
    beatPhase: number;
    /** Beat-locked pulse; falls back to the raw kick without a tempo lock. */
    pulse: number;
  };
  palette: Palette;
  /** Final brightness 0..1 (master level, fades, blackout). */
  intensity: number;
}

/** The DJ name / logo mark laid over the scenes. */
export interface OverlayParams {
  name: string;
  /** Image data URL, or '' for none. */
  logoUrl: string;
  opacity: number;
  layout: OverlayLayout;
}
