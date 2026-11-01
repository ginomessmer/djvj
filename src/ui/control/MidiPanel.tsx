import {
  isContinuous,
  MIDI_ACTION_INFO,
  MIDI_ACTIONS,
  type MidiAction,
  unbind,
} from '@/domain/midi/midi-mapping';
import { describeControl } from '@/domain/midi/midi-message';
import type { MidiState, MidiStatus } from '@/domain/midi/midi-status';
import type { ShowPatch, ShowState } from '@/domain/show/show-state';
import { Disclosure } from '../components/Disclosure';
import { hint } from '../components/hint';
import { Toggle } from '../components/Toggle';

const STATUS_TEXT: Record<MidiStatus, string> = {
  off: 'Off.',
  pending: 'Waiting for permission: answer the prompt in the output window.',
  on: '',
  denied:
    'MIDI access was denied. Allow it via the lock icon of the output window, then switch off and on.',
  unsupported: 'This browser has no Web MIDI. Use Chrome.',
  error: 'MIDI could not be started. Switch off and on to retry.',
};

interface MidiPanelProps {
  midi: MidiState;
  show: ShowState;
  onPatch: (patch: ShowPatch) => void;
  onLearn: (action: MidiAction | null) => void;
}

function summaryOf(midi: MidiState, show: ShowState): string {
  if (!show.midiEnabled) return 'Off';
  if (midi.status !== 'on') return midi.status === 'pending' ? 'Waiting…' : 'Not available';
  const mapped = Object.keys(show.midiBindings).length;
  return `${midi.devices[0] ?? 'No controller'} · ${mapped} mapped`;
}

export function MidiPanel({ midi, show, onPatch, onLearn }: MidiPanelProps) {
  const on = midi.status === 'on';
  const devices = midi.devices.length > 0 ? midi.devices.join(', ') : 'no controller connected';

  return (
    <Disclosure title="MIDI controller" summary={summaryOf(midi, show)}>
      <Toggle
        label="Use a MIDI controller"
        checked={show.midiEnabled}
        onChange={(midiEnabled) => onPatch({ midiEnabled })}
      />
      <p class="hint">
        {on ? `${devices} · last: ${midi.lastEvent ?? '–'}` : STATUS_TEXT[midi.status]}
      </p>

      {on && (
        <ul class="midi-map">
          {MIDI_ACTIONS.map((action) => {
            const { label } = MIDI_ACTION_INFO[action];
            const bound = show.midiBindings[action];
            const learning = midi.learning === action;
            const waiting = isContinuous(action) ? 'turn a knob…' : 'press a pad…';
            return (
              <li key={action} class="midi-map__row">
                <span>{label}</span>
                <span class="hint">
                  {learning ? waiting : bound ? describeControl(bound) : '–'}
                </span>
                <button
                  type="button"
                  class={learning ? 'active' : ''}
                  onClick={() => onLearn(learning ? null : action)}
                  {...hint(`Bind the next control you press or move to ${label.toLowerCase()}`)}
                >
                  {learning ? 'Cancel' : 'Learn'}
                </button>
                <button
                  type="button"
                  disabled={!bound}
                  aria-label={`Clear ${label}`}
                  onClick={() => onPatch({ midiBindings: unbind(show.midiBindings, action) })}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p class="hint">
        Read-only: rekordbox keeps the controller. But it hears every control too, so learn pads it
        does not use (a pad mode you never play, or pads you unassigned in rekordbox's MIDI
        mapping), or both will react.
      </p>
    </Disclosure>
  );
}
