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
import { Card } from '../components/Card';
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

interface MidiCardProps {
  midi: MidiState;
  show: ShowState;
  onPatch: (patch: ShowPatch) => void;
  onLearn: (action: MidiAction | null) => void;
}

export function MidiCard({ midi, show, onPatch, onLearn }: MidiCardProps) {
  const on = midi.status === 'on';
  const devices = midi.devices.length > 0 ? midi.devices.join(', ') : 'no controller connected';

  return (
    <Card title="MIDI controller">
      <Toggle
        label="Use a MIDI controller (read-only, next to rekordbox)"
        checked={show.midiEnabled}
        onChange={(midiEnabled) => onPatch({ midiEnabled })}
      />
      <p class="muted">
        {on ? `${devices} · last: ${midi.lastEvent ?? '–'}` : STATUS_TEXT[midi.status]}
      </p>

      {on && (
        <ul class="midi-map">
          {MIDI_ACTIONS.map((action) => {
            const bound = show.midiBindings[action];
            const learning = midi.learning === action;
            const hint = isContinuous(action) ? 'turn a knob…' : 'press a pad…';
            return (
              <li key={action} class="midi-map__row">
                <span>{MIDI_ACTION_INFO[action].label}</span>
                <span class="muted">{learning ? hint : bound ? describeControl(bound) : '–'}</span>
                <button
                  type="button"
                  class={learning ? 'active' : ''}
                  onClick={() => onLearn(learning ? null : action)}
                >
                  {learning ? 'Cancel' : 'Learn'}
                </button>
                <button
                  type="button"
                  disabled={!bound}
                  aria-label={`Clear ${MIDI_ACTION_INFO[action].label}`}
                  onClick={() => onPatch({ midiBindings: unbind(show.midiBindings, action) })}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p class="muted">
        rekordbox hears the same controller: learn controls it does not use (e.g. a pad mode or
        Shift + pad you removed in rekordbox's MIDI settings), or both will react.
      </p>
    </Card>
  );
}
