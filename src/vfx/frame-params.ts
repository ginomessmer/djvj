import type { AudioFeatures } from '@/domain/audio/audio-features';
import type { Palette } from '@/domain/show/palettes';
import type { TextContent } from '@/domain/show/text-director';
import type { TextLook } from '@/domain/show/text-motion';
import type { TextStyle } from '@/domain/show/texts';

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
  camera: {
    /** The playing camera, or null: camera scenes then show a generated stand-in. */
    video: HTMLVideoElement | null;
    /** Mirror it like a selfie. */
    mirror: boolean;
  };
}

/** The DJ name / logo mark. Small in the corner, or as a headline (`TextParams`, kind 'mark'). */
export interface OverlayParams {
  name: string;
  /** Image data URL, or '' for none. */
  logoUrl: string;
  /** Opacity of the corner mark. */
  opacity: number;
}

/** The headline text in the middle of the screen, styled with the scene behind it. */
export interface TextParams {
  /** Null: no text. */
  content: TextContent | null;
  style: TextStyle;
  look: TextLook;
}
