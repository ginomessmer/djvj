import {
  bind,
  learnedControl,
  type MidiAction,
  type MidiCommand,
  MidiRouter,
} from '@/domain/midi/midi-mapping';
import { describeEvent, parseMidi } from '@/domain/midi/midi-message';
import type { MidiState, MidiStatus } from '@/domain/midi/midi-status';
import { commandPatch } from '@/domain/show/shortcuts';
import type { MidiConnection, MidiInput } from '@/services/midi-input';
import type { ShowStoreApi } from '../show/show-store';

const isPermissionError = (error: unknown): boolean => {
  const name = (error as { name?: string } | null)?.name;
  return name === 'NotAllowedError' || name === 'SecurityError';
};

/**
 * MIDI in the output window, so it works without the control window: follows the `midiEnabled`
 * setting, routes messages to show actions through the learned bindings, and runs MIDI learn.
 */
export class MidiController {
  /** Called after the status, the devices or the learning state changed. */
  onChange: (() => void) | null = null;
  /** Called on a tap, with its time on the `performance.now()` clock in seconds. */
  onTap: ((tSec: number) => void) | null = null;
  onClearTap: (() => void) | null = null;

  private status: MidiStatus = 'off';
  private connection: MidiConnection | null = null;
  private learning: MidiAction | null = null;
  private lastEvent: string | null = null;
  private readonly router = new MidiRouter();
  /** Bumped on every enable and disable, so a permission answer that arrives late is dropped. */
  private generation = 0;

  constructor(
    private readonly input: MidiInput,
    private readonly store: ShowStoreApi,
  ) {}

  /** Starts following the `midiEnabled` setting (enables right away when it is on). */
  start(): () => void {
    return this.store.subscribe(
      (state) => state.midiEnabled,
      (enabled) => (enabled ? void this.enable() : this.disable()),
      { fireImmediately: true },
    );
  }

  get state(): MidiState {
    return {
      status: this.status,
      devices: this.connection?.devices ?? [],
      learning: this.learning,
      lastEvent: this.lastEvent,
    };
  }

  /** The next control that is pressed or moved gets bound to `action`; null cancels. */
  learn(action: MidiAction | null): void {
    this.learning = this.status === 'on' ? action : null;
    this.onChange?.();
  }

  /** Handles one raw message; `tSec` is when it arrived. */
  receive(data: ArrayLike<number>, tSec: number): void {
    const event = parseMidi(data);
    if (!event) return;
    this.lastEvent = describeEvent(event);

    const show = this.store.getState();
    if (this.learning) {
      this.router.route(event, {}); // keeps the CC history right for the next press
      const control = learnedControl(this.learning, event);
      if (!control) return;
      show.apply({ midiBindings: bind(show.midiBindings, this.learning, control) });
      this.learning = null;
      this.onChange?.();
      return;
    }

    const command = this.router.route(event, show.midiBindings);
    if (command) this.run(command, tSec);
  }

  private run({ effect, level }: MidiCommand, tSec: number): void {
    const show = this.store.getState();
    switch (effect.type) {
      case 'command':
        show.apply(commandPatch(effect.command, show));
        break;
      case 'level':
        show.apply(effect.patch(level));
        break;
      case 'tap':
        this.onTap?.(tSec);
        break;
      case 'clear-tap':
        this.onClearTap?.();
        break;
    }
  }

  private async enable(): Promise<void> {
    if (this.connection || this.status === 'pending') return;
    if (!this.input.supported) return this.setStatus('unsupported');
    const generation = ++this.generation;
    this.setStatus('pending');
    try {
      const connection = await this.input.open((data, ms) => this.receive(data, ms / 1000));
      if (generation !== this.generation) return connection.close();
      connection.onDevicesChange = () => this.onChange?.();
      this.connection = connection;
      this.setStatus('on');
    } catch (error) {
      if (generation !== this.generation) return;
      if (!isPermissionError(error)) console.warn('[djvj] MIDI unavailable', error);
      this.setStatus(isPermissionError(error) ? 'denied' : 'error');
    }
  }

  private disable(): void {
    this.generation++;
    this.connection?.close();
    this.connection = null;
    this.learning = null;
    this.setStatus('off');
  }

  private setStatus(status: MidiStatus): void {
    this.status = status;
    this.onChange?.();
  }
}
