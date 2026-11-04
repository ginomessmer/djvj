import type { AudioDevice, AudioStatus } from '../audio/audio-device';
import type { CameraDevice, CameraStatus } from '../camera/camera-device';
import type { Section } from '../rhythm/section-tracker';
import type { SceneId } from '../show/scenes';
import type { ShowPatch, ShowState } from '../show/show-state';
import type { TextStyle } from '../show/texts';
import type { PreviewFrame } from './preview';

/**
 * The output window owns all state and rendering and keeps working with no control window open.
 * The control window only sends messages and shows the snapshots it receives.
 */
export const CHANNEL_NAME = 'djvj';

export interface ShowSnapshot {
  show: ShowState;
  audio: {
    status: AudioStatus;
    error: string | null;
    devices: AudioDevice[];
    activeDeviceId: string;
  };
  camera: {
    status: CameraStatus;
    error: string | null;
    devices: CameraDevice[];
    activeDeviceId: string;
    /** Delivering frames: the director may rotate camera scenes in. */
    ready: boolean;
  };
  signal: {
    present: boolean;
    bands: number[];
    energy: number;
    kick: number;
    loudnessDb: number;
  };
  rhythm: {
    /** 0 until a tempo was found. */
    bpm: number;
    /** 0..1: how far the beat grid can be trusted. */
    confidence: number;
    /** 0..1 position in the beat (0 = on the beat). */
    beatPhase: number;
    section: Section;
    /** Where the tempo comes from: the music, or the DJ tapping it. */
    source: 'auto' | 'tap';
  };
  safety: {
    /** 0..1: how hard the flash guard is damping the pulses right now. */
    flashGuard: number;
    /** Factor the adaptive resolution applies to the pixel budget (1 = none). */
    resolutionScale: number;
  };
  /** Ids of the stored images (an entry whose image is missing here cannot be shown). */
  images: string[];
  /** The text on screen right now, as drawn (capitals included), or an image's label. */
  text: {
    showing: string | null;
    kind: 'text' | 'image' | null;
    style: TextStyle | null;
  };
  /** What is on screen right now (differs from `show.sceneId` while idle, panicking or fading). */
  shownSceneId: SceneId;
  performance: {
    fps: number;
    frameMs: number;
    resolution: [width: number, height: number];
  };
}

/** Longest image data URL accepted (the control window scales images down well below this). */
export const MAX_IMAGE_DATA_URL_LENGTH = 3_000_000;

export type ControlMessage =
  /** The control window opened: publish a snapshot now. */
  | { type: 'hello' }
  | { type: 'patch'; patch: ShowPatch }
  | { type: 'refresh-devices' }
  /** A tap on the beat (tap tempo); timed when it arrives in the output window. */
  | { type: 'tap' }
  | { type: 'clear-tap' }
  /** Stores an image for a list entry, before the entry referring to it is added. */
  | { type: 'set-image'; id: string; dataUrl: string }
  /** Show the text at this index of `show.texts` now. */
  | { type: 'show-text'; index: number }
  /** The preview pane is visible: keep sending frames for a few more seconds. Repeat to keep it. */
  | { type: 'watch-preview' };

export type OutputMessage =
  | { type: 'snapshot'; snapshot: ShowSnapshot }
  /** A small copy of the screen, only sent while a control window is watching. */
  | { type: 'frame'; frame: PreviewFrame };
