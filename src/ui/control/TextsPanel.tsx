import type { ShowSnapshot } from '@/domain/remote/protocol';
import type { ShowPatch, ShowState } from '@/domain/show/show-state';
import {
  MAX_TEXT_LENGTH,
  MAX_TEXTS,
  TEXT_STYLE_CHOICES,
  type TextCue,
  type TextMessage,
  type TextStyleChoice,
} from '@/domain/show/texts';
import { hint } from '../components/hint';
import { Panel } from '../components/Panel';
import { Toggle } from '../components/Toggle';

const CUE_LABELS: Record<TextCue, string> = {
  drop: 'Drop',
  build: 'Build',
  breakdown: 'Break',
  groove: 'Groove',
};

const CUE_HINTS: Record<TextCue, string> = {
  drop: 'Slams in on the drop and pumps on the beat for 16 beats.',
  build: 'Typed out letter by letter over the build-up, shaking harder as the riser climbs.',
  breakdown: 'Drifts in slowly a bar into the breakdown and stays until it ends.',
  groove: 'Ripples in now and then during a groove (every 90 s or so).',
};

const STYLE_LABELS: Record<TextStyleChoice, string> = {
  auto: 'Auto look',
  neon: 'Neon',
  chrome: 'Chrome',
  glass: 'Glass',
  soft: 'Soft glow',
  glitch: 'Glitch',
  invert: 'Invert',
};

/** Ideas for an empty list, one per moment. */
const SUGGESTIONS: readonly TextMessage[] = [
  { text: 'MAKE SOME NOISE', cue: 'drop' },
  { text: 'ARE YOU READY?', cue: 'build' },
  { text: 'HANDS UP', cue: 'drop' },
  { text: 'breathe', cue: 'breakdown' },
];

interface TextsPanelProps {
  show: ShowState;
  text: ShowSnapshot['text'];
  onPatch: (patch: ShowPatch) => void;
  onShowText: (index: number) => void;
}

/**
 * Texts that appear with the music. Each belongs to a moment of the track, which also decides how
 * it moves; ▶ shows one right away. The look follows the scene unless one is picked.
 */
export function TextsPanel({ show, text, onPatch, onShowText }: TextsPanelProps) {
  const { texts } = show;
  const setTexts = (next: TextMessage[]) => onPatch({ texts: next });
  const change = (index: number, patch: Partial<TextMessage>) =>
    setTexts(texts.map((message, i) => (i === index ? { ...message, ...patch } : message)));
  const remove = (index: number) => setTexts(texts.filter((_, i) => i !== index));
  const add = (message: TextMessage) => setTexts([...texts, message].slice(0, MAX_TEXTS));
  const ideas =
    texts.length < MAX_TEXTS
      ? SUGGESTIONS.filter((idea) => !texts.some((message) => message.text === idea.text))
      : [];

  return (
    <Panel
      title="Texts"
      class="panel--texts"
      actions={
        <Toggle
          label="Show"
          hint="X"
          checked={show.textsOn}
          onChange={(textsOn) => onPatch({ textsOn })}
        />
      }
    >
      <p class="texts__now" aria-live="polite" {...hint('The text on the big screen right now.')}>
        <span
          class={text.showing ? 'texts__dot texts__dot--on' : 'texts__dot'}
          aria-hidden="true"
        />
        {text.showing ? (
          <>
            <strong class="texts__live">{text.showing}</strong>
            <span class="texts__style">{text.style && STYLE_LABELS[text.style]}</span>
          </>
        ) : (
          <span class="texts__idle">
            {show.textsOn ? 'Waiting for its moment' : 'Texts are off'}
          </span>
        )}
      </p>

      {texts.length > 0 && (
        <ul class="texts__list">
          {texts.map((message, index) => (
            <li key={index} class="texts__row">
              <button
                type="button"
                class="texts__fire"
                disabled={message.text.trim() === ''}
                aria-label={`Show “${message.text}” now`}
                onClick={() => onShowText(index)}
                {...hint('Show this text now, with the motion of its moment.')}
              >
                ▶
              </button>
              <input
                type="text"
                class="texts__input"
                maxLength={MAX_TEXT_LENGTH}
                value={message.text}
                placeholder="Text"
                aria-label={`Text ${index + 1}`}
                onInput={(event) => change(index, { text: event.currentTarget.value })}
              />
              <select
                class="texts__cue"
                value={message.cue}
                aria-label={`When text ${index + 1} appears`}
                onChange={(event) => change(index, { cue: event.currentTarget.value as TextCue })}
                {...hint(CUE_HINTS[message.cue])}
              >
                {(Object.keys(CUE_LABELS) as TextCue[]).map((cue) => (
                  <option key={cue} value={cue}>
                    {CUE_LABELS[cue]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                class="texts__remove"
                aria-label={`Remove text ${index + 1}`}
                onClick={() => remove(index)}
                {...hint('Remove this text.')}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {ideas.length > 0 && (
        <div class="texts__ideas">
          <span class="field__label">Ideas</span>
          <div class="texts__chips">
            {ideas.map((idea) => (
              <button
                key={idea.text}
                type="button"
                class="texts__chip"
                onClick={() => add(idea)}
                {...hint(`Add “${idea.text}”. ${CUE_HINTS[idea.cue]}`)}
              >
                {idea.text}
                <small>{CUE_LABELS[idea.cue]}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <div class="row">
        <button
          type="button"
          disabled={texts.length >= MAX_TEXTS}
          onClick={() => add({ text: '', cue: 'drop' })}
          {...hint(`Up to ${MAX_TEXTS} texts. Each moment takes its texts in turn.`)}
        >
          Add text
        </button>
        <select
          value={show.textStyle}
          aria-label="Text look"
          onChange={(event) => onPatch({ textStyle: event.currentTarget.value as TextStyleChoice })}
          {...hint(
            'How texts look. Auto: neon over the tunnel, chrome over the grid, glass over the orb, and so on.',
          )}
        >
          {TEXT_STYLE_CHOICES.map((choice) => (
            <option key={choice} value={choice}>
              {STYLE_LABELS[choice]}
            </option>
          ))}
        </select>
      </div>
    </Panel>
  );
}
