import type { Section } from '../rhythm/section-tracker';
import {
  messageContent,
  type TextContent,
  type TextCue,
  type TextMessage,
  type TextStyle,
  type TextStyleChoice,
} from './texts';

/** How a text enters and moves while it is on screen. Each cue has its own. */
export type TextMotion = 'slam' | 'type' | 'drift' | 'wave';

export const CUE_MOTION: Record<TextCue, TextMotion> = {
  drop: 'slam',
  build: 'type',
  breakdown: 'drift',
  groove: 'wave',
};

export type { TextContent } from './texts';

export interface TextDirectorInput {
  /** Texts are switched on. Off: whatever shows leaves. */
  enabled: boolean;
  /** True while there is music. Without it, automatic texts leave; one fired by hand stays. */
  live: boolean;
  section: Section;
  /** Beat length in seconds (an assumed one without a tempo): text timing is in beats. */
  beatSec: number;
  messages: readonly TextMessage[];
  /** Ids of the images that are stored and can be drawn; entries with any other image wait. */
  images: ReadonlySet<string>;
  /** Text style of the scene on screen, after this frame's scene change. */
  sceneStyle: TextStyle;
  styleChoice: TextStyleChoice;
}

export interface TextFrame {
  content: TextContent | null;
  /** Counts up whenever a new text starts, so a repeated text still starts over. */
  serial: number;
  style: TextStyle;
  motion: TextMotion;
  /** Beats since the text started. */
  beats: number;
  /** 0 while it is on screen, rising to 1 as it leaves. */
  exit: number;
}

export interface TextDirectorOptions {
  /** In a groove, a text every this many seconds (counted from the last text of any kind). */
  grooveEverySec: number;
  /** A breakdown text waits this many beats, so it does not land on the cut. */
  breakdownDelayBeats: number;
}

const DEFAULTS: TextDirectorOptions = { grooveEverySec: 90, breakdownDelayBeats: 4 };

interface Timing {
  /** Longest stay, in beats. */
  holdBeats: number;
  /** How long leaving takes, in beats. */
  exitBeats: number;
  /** Leaves as soon as the music moves on from this cue's section. */
  followsSection: boolean;
}

const TIMING: Record<TextCue, Timing> = {
  drop: { holdBeats: 16, exitBeats: 2, followsSection: false },
  build: { holdBeats: 64, exitBeats: 1, followsSection: true },
  breakdown: { holdBeats: 32, exitBeats: 4, followsSection: true },
  groove: { holdBeats: 16, exitBeats: 2, followsSection: false },
};
/** Fired by hand: the cue's motion, a fixed stay, and it ignores the music. */
const MANUAL_TIMING: Timing = { holdBeats: 16, exitBeats: 2, followsSection: false };
/** Leaving because texts were switched off or the music stopped. */
const QUICK_EXIT_BEATS = 1;

interface Showing {
  content: TextContent;
  cue: TextCue;
  manual: boolean;
  style: TextStyle;
  timing: Timing;
  beats: number;
  /** Beats into leaving, or null while it stays. */
  leaving: number | null;
  exitBeats: number;
}

/**
 * Decides which text (or image) is on screen, when, and how it moves. It follows the music like the scene
 * director: a slam on the drop, letters typed out over the build-up, a slow drift into the
 * breakdown, and now and then a wave in the groove. Each cue rotates through its own texts.
 */
export class TextDirector {
  private readonly options: TextDirectorOptions;
  private showing: Showing | null = null;
  private serial = 0;
  private lastSection: Section | null = null;
  private readonly rotation: Record<TextCue, number> = {
    drop: 0,
    build: 0,
    breakdown: 0,
    groove: 0,
  };
  private secondsSinceText = 0;
  private breakdownWaitBeats: number | null = null;
  private requested: number | null = null;

  constructor(options: Partial<TextDirectorOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** Show the message at this index on the next frame, whatever the music does. */
  request(index: number): void {
    this.requested = index;
  }

  update(dtSec: number, input: TextDirectorInput): TextFrame {
    const beats = dtSec / input.beatSec;
    this.advance(beats);

    if (!input.enabled) {
      this.requested = null;
      this.leave(QUICK_EXIT_BEATS);
    } else {
      this.followRequest(input);
      if (input.live) this.followMusic(dtSec, beats, input);
      else if (this.showing && !this.showing.manual) this.leave(QUICK_EXIT_BEATS);
    }
    this.lastSection = input.section;
    return this.frame(input);
  }

  private followRequest(input: TextDirectorInput): void {
    const index = this.requested;
    this.requested = null;
    const message = index === null ? undefined : input.messages[index];
    const content = message && this.showable(message, input);
    if (message && content) this.start(content, message.cue, input, true);
  }

  /** What an entry would show, if it can be shown now (its image may be missing). */
  private showable(message: TextMessage, input: TextDirectorInput): TextContent | null {
    const content = messageContent(message);
    if (content?.kind === 'image' && !input.images.has(content.imageId)) return null;
    return content;
  }

  private followMusic(dtSec: number, beats: number, input: TextDirectorInput): void {
    const { section } = input;
    const changed = this.lastSection !== null && section !== this.lastSection;
    const showing = this.showing;

    // A build or breakdown text belongs to its section: it leaves when the music moves on.
    if (showing?.timing.followsSection && changed) this.leave(showing.timing.exitBeats);

    if (changed && section === 'drop') this.startNext('drop', input);
    if (changed && section === 'build') this.startNext('build', input);

    if (section !== 'breakdown') this.breakdownWaitBeats = null;
    else if (changed) this.breakdownWaitBeats = this.options.breakdownDelayBeats;
    if (this.breakdownWaitBeats !== null) {
      this.breakdownWaitBeats -= beats;
      if (this.breakdownWaitBeats <= 0) {
        this.breakdownWaitBeats = null;
        this.startNext('breakdown', input);
      }
    }

    if (this.showing) return;
    this.secondsSinceText += dtSec;
    if (section === 'groove' && this.secondsSinceText >= this.options.grooveEverySec) {
      this.startNext('groove', input);
      this.secondsSinceText = 0; // with nothing to show, try again a whole interval later
    }
  }

  /** Starts the next text of this cue, if it has any. */
  private startNext(cue: TextCue, input: TextDirectorInput): void {
    const pool = this.pool(cue, input);
    if (pool.length === 0) return;
    const content = pool[this.rotation[cue] % pool.length];
    this.rotation[cue]++;
    this.start(content, cue, input, false);
  }

  /** The entries of a cue that can be shown, in list order. */
  private pool(cue: TextCue, input: TextDirectorInput): TextContent[] {
    const pool: TextContent[] = [];
    for (const message of input.messages) {
      const content = message.cue === cue ? this.showable(message, input) : null;
      if (content) pool.push(content);
    }
    return pool;
  }

  private start(content: TextContent, cue: TextCue, input: TextDirectorInput, manual: boolean) {
    const timing = manual ? MANUAL_TIMING : TIMING[cue];
    this.serial++;
    this.secondsSinceText = 0;
    this.showing = {
      content,
      cue,
      manual,
      style: input.styleChoice === 'auto' ? input.sceneStyle : input.styleChoice,
      timing,
      beats: 0,
      leaving: null,
      exitBeats: timing.exitBeats,
    };
  }

  private leave(exitBeats: number): void {
    const showing = this.showing;
    if (!showing) return;
    if (showing.leaving === null) {
      showing.leaving = 0;
      showing.exitBeats = exitBeats;
    } else {
      showing.exitBeats = Math.min(showing.exitBeats, exitBeats); // only ever hurry up
    }
  }

  private advance(beats: number): void {
    const showing = this.showing;
    if (!showing) return;
    showing.beats += beats;
    if (showing.leaving === null && showing.beats >= showing.timing.holdBeats) {
      this.leave(showing.timing.exitBeats);
    } else if (showing.leaving !== null) {
      showing.leaving += beats;
      if (showing.leaving >= showing.exitBeats) this.showing = null;
    }
  }

  private frame(input: TextDirectorInput): TextFrame {
    const showing = this.showing;
    if (!showing) {
      return {
        content: null,
        serial: this.serial,
        style: input.styleChoice === 'auto' ? input.sceneStyle : input.styleChoice,
        motion: 'wave',
        beats: 0,
        exit: 1,
      };
    }
    return {
      content: showing.content,
      serial: this.serial,
      style: showing.style,
      motion: CUE_MOTION[showing.cue],
      beats: showing.beats,
      exit: showing.leaving === null ? 0 : Math.min(1, showing.leaving / showing.exitBeats),
    };
  }
}
