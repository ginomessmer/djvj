import type { AudioDevice, AudioStatus } from '../audio/audio-device';
import type { Section } from '../rhythm/section-tracker';
import type { SceneId } from '../show/scenes';
import type { ShowPatch, ShowState } from '../show/show-state';

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
  };
  /** What is on screen right now (differs from `show.sceneId` while idle, panicking or fading). */
  shownSceneId: SceneId;
  performance: {
    fps: number;
    frameMs: number;
    resolution: [width: number, height: number];
  };
}

export type ControlMessage =
  /** The control window opened: publish a snapshot now. */
  { type: 'hello' } | { type: 'patch'; patch: ShowPatch } | { type: 'refresh-devices' };

export type OutputMessage = { type: 'snapshot'; snapshot: ShowSnapshot };
