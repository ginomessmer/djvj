import type { ShowSnapshot } from '@/domain/remote/protocol';
import type { ShowPatch, ShowState } from '@/domain/show/show-state';
import { Led } from '../components/Led';
import { isTempoKnown, SECTION_LABELS } from './rhythm-display';

interface TopBarProps {
  connected: boolean;
  snapshot: ShowSnapshot | null;
  onPatch: (patch: ShowPatch) => void;
  onOpenOutput: () => void;
  onOpenAppearance: () => void;
  onOpenShortcuts: () => void;
}

function ThemeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
    </svg>
  );
}

/** Always visible: where the show stands, and the two switches you reach for in a hurry. */
export function TopBar({
  connected,
  snapshot,
  onPatch,
  onOpenOutput,
  onOpenAppearance,
  onOpenShortcuts,
}: TopBarProps) {
  const show: ShowState | undefined = snapshot?.show;
  const rhythm = snapshot?.rhythm;
  const known = rhythm ? isTempoKnown(rhythm) : false;

  return (
    <header class="topbar">
      <div class="topbar__group">
        <h1 class="brand">djvj</h1>
        <button type="button" class="status" onClick={onOpenOutput} aria-keyshortcuts="O">
          <span class={connected ? 'dot dot--ok' : 'dot dot--warn'} aria-hidden="true" />
          <span role="status">{connected ? 'Output live' : 'No output window'}</span>
          <span class="status__action">{connected ? 'Show' : 'Open'}</span>
        </button>
      </div>

      <div class="topbar__group topbar__tempo">
        <span class="bpm" aria-live="off">
          {known && rhythm ? rhythm.bpm.toFixed(1) : '–––'}
          <small> BPM</small>
        </span>
        <Led on={known && (rhythm?.beatPhase ?? 1) < 0.25} label="beat" />
        {rhythm && (
          <span class={`section-tag section-tag--${rhythm.section}`}>
            {SECTION_LABELS[rhythm.section]}
          </span>
        )}
      </div>

      <div class="topbar__group topbar__live">
        <button
          type="button"
          class="live live--blackout"
          aria-pressed={show?.blackout ?? false}
          aria-keyshortcuts="B"
          disabled={!show}
          onClick={() => show && onPatch({ blackout: !show.blackout })}
        >
          Blackout <kbd>B</kbd>
        </button>
        <button
          type="button"
          class="live live--panic"
          aria-pressed={show?.panic ?? false}
          aria-keyshortcuts="P"
          disabled={!show}
          onClick={() => show && onPatch({ panic: !show.panic })}
        >
          Panic <kbd>P</kbd>
        </button>
      </div>

      <div class="topbar__group topbar__tools">
        <button type="button" class="icon-button" onClick={onOpenAppearance}>
          <ThemeIcon />
          <span class="sr-only">Appearance: theme and accent colour</span>
        </button>
        <button
          type="button"
          class="icon-button"
          onClick={onOpenShortcuts}
          aria-keyshortcuts="Shift+?"
        >
          <span aria-hidden="true">?</span>
          <span class="sr-only">Keyboard shortcuts</span>
        </button>
      </div>
    </header>
  );
}
