import { describe, expect, it } from 'vitest';
import type { Section } from '../rhythm/section-tracker';
import { TextDirector, type TextDirectorInput, type TextFrame } from './text-director';
import type { TextMessage } from './texts';

const STEP = 1 / 60;
const BEAT_SEC = 60 / 128;

const MESSAGES: TextMessage[] = [
  { text: 'MAKE SOME NOISE', cue: 'drop' },
  { text: 'HANDS UP', cue: 'drop' },
  { text: 'ARE YOU READY', cue: 'build' },
  { text: 'breathe', cue: 'breakdown' },
  { text: '@djvj', cue: 'groove' },
];

function input(overrides: Partial<TextDirectorInput> = {}): TextDirectorInput {
  return {
    enabled: true,
    live: true,
    section: 'groove',
    beatSec: BEAT_SEC,
    messages: MESSAGES,
    images: new Set(['logo']),
    sceneStyle: 'neon',
    styleChoice: 'auto',
    ...overrides,
  };
}

/** Runs for `seconds` and returns every frame. */
function run(director: TextDirector, seconds: number, overrides: Partial<TextDirectorInput> = {}) {
  const frames: TextFrame[] = [];
  for (let t = 0; t < seconds; t += STEP) frames.push(director.update(STEP, input(overrides)));
  return frames;
}

const shown = (frame: TextFrame | undefined) => {
  const content = frame?.content;
  if (!content) return null;
  return content.kind === 'text' ? content.text : `image:${content.imageId}`;
};

/** Plays a groove, then the given section, and returns the frames of that section. */
function enter(director: TextDirector, section: Section, seconds: number, extra = {}) {
  run(director, 1, extra);
  return run(director, seconds, { section, ...extra });
}

describe('TextDirector', () => {
  it('slams a drop text in on the drop, holds it 16 beats, then dissolves it', () => {
    const director = new TextDirector();
    const frames = enter(director, 'drop', 16 * BEAT_SEC + 2);
    expect(shown(frames[0])).toBe('MAKE SOME NOISE');
    expect(frames[0]).toMatchObject({ motion: 'slam', exit: 0, style: 'neon' });

    const leaving = frames.find((frame) => frame.exit > 0);
    expect(leaving?.beats).toBeGreaterThanOrEqual(16);
    expect(shown(frames.at(-1))).toBeNull();
  });

  it('rotates through the texts of a cue, drop after drop', () => {
    const director = new TextDirector();
    const texts: Array<string | null> = [];
    for (let drop = 0; drop < 3; drop++) {
      texts.push(shown(enter(director, 'drop', 0.5)[0]));
      run(director, 10, { section: 'groove' });
    }
    expect(texts).toEqual(['MAKE SOME NOISE', 'HANDS UP', 'MAKE SOME NOISE']);
  });

  it('types the build text and lets the drop text take over at once', () => {
    const director = new TextDirector();
    const build = enter(director, 'build', 4);
    expect(build.every((frame) => shown(frame) === 'ARE YOU READY')).toBe(true);
    expect(build[0].motion).toBe('type');

    const drop = run(director, 0.1, { section: 'drop' });
    expect(shown(drop[0])).toBe('MAKE SOME NOISE');
    expect(drop[0].exit).toBe(0);
  });

  it('lets a build text leave when the build ends without a drop text', () => {
    const director = new TextDirector();
    const messages = MESSAGES.filter((message) => message.cue !== 'drop');
    enter(director, 'build', 4, { messages });
    const after = run(director, 2 * BEAT_SEC, { section: 'drop', messages });
    expect(after[5].exit).toBeGreaterThan(0);
    expect(shown(after.at(-1))).toBeNull();
  });

  it('waits a bar into the breakdown, then drifts in and stays until it ends', () => {
    const director = new TextDirector();
    const frames = enter(director, 'breakdown', 12 * BEAT_SEC);
    const first = frames.findIndex((frame) => frame.content !== null);
    expect(first * STEP).toBeCloseTo(4 * BEAT_SEC, 1);
    expect(shown(frames.at(-1))).toBe('breathe');
    expect(frames.at(-1)?.motion).toBe('drift');

    const after = run(director, 0.2, { section: 'build' });
    expect(shown(after.at(-1))).toBe('ARE YOU READY'); // the build text replaces it
  });

  it('shows a groove text now and then, never right after another text', () => {
    const director = new TextDirector({ grooveEverySec: 20 });
    const frames = run(director, 19);
    expect(frames.every((frame) => frame.content === null)).toBe(true);
    const next = run(director, 2);
    expect(shown(next.at(-1))).toBe('@djvj');
    expect(next.at(-1)?.motion).toBe('wave');
  });

  it('rotates images with the texts of their moment', () => {
    const director = new TextDirector();
    const messages: TextMessage[] = [
      { text: 'logo', cue: 'drop', imageId: 'logo' },
      { text: 'MAKE SOME NOISE', cue: 'drop' },
    ];
    expect(shown(enter(director, 'drop', 0.1, { messages })[0])).toBe('image:logo');
    run(director, 10, { messages });
    expect(shown(enter(director, 'drop', 0.1, { messages })[0])).toBe('MAKE SOME NOISE');
  });

  it('skips an image that is not stored, also when fired by hand', () => {
    const director = new TextDirector();
    const messages: TextMessage[] = [
      { text: 'gone', cue: 'drop', imageId: 'gone' },
      { text: 'HANDS UP', cue: 'drop' },
    ];
    expect(shown(enter(director, 'drop', 0.1, { messages })[0])).toBe('HANDS UP');
    director.request(0);
    expect(shown(run(director, 0.1, { messages, section: 'groove' })[0])).toBe('HANDS UP');
  });

  it('keeps the style it started with, even when the scene changes', () => {
    const director = new TextDirector();
    enter(director, 'drop', 1, { sceneStyle: 'glass' });
    const later = run(director, 1, { section: 'drop', sceneStyle: 'glitch' });
    expect(later.at(-1)?.style).toBe('glass');
  });

  it('uses the forced style instead of the scene style', () => {
    const director = new TextDirector();
    const frames = enter(director, 'drop', 0.1, { styleChoice: 'chrome' });
    expect(frames[0].style).toBe('chrome');
  });

  it('shows a text fired by hand at once, with its cue motion, even without music', () => {
    const director = new TextDirector();
    run(director, 1, { live: false });
    director.request(2);
    const frames = run(director, 4, { live: false });
    expect(shown(frames[0])).toBe('ARE YOU READY');
    expect(frames[0].motion).toBe('type');
    expect(frames.at(-1)?.exit).toBe(0);
  });

  it('ignores a request for a missing or empty text', () => {
    const director = new TextDirector();
    director.request(42);
    expect(run(director, 0.1)[0].content).toBeNull();
    director.request(0);
    expect(run(director, 0.1, { messages: [{ text: '  ', cue: 'drop' }] })[0].content).toBeNull();
  });

  it('lets automatic texts leave when the music stops, and everything when switched off', () => {
    const director = new TextDirector();
    enter(director, 'drop', 1);
    expect(shown(run(director, 2 * BEAT_SEC, { section: 'drop', live: false }).at(-1))).toBeNull();

    director.request(0);
    run(director, 1);
    const off = run(director, 2 * BEAT_SEC, { enabled: false });
    expect(off[5].exit).toBeGreaterThan(0);
    expect(shown(off.at(-1))).toBeNull();
  });

  it('starts a repeated text over: the serial changes with every new text', () => {
    const director = new TextDirector();
    director.request(0);
    const first = run(director, 0.1)[0].serial;
    director.request(0);
    expect(run(director, 0.1)[0].serial).toBe(first + 1);
  });
});
