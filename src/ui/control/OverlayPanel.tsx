import type { ShowSnapshot } from '@/domain/remote/protocol';
import type { OverlayMode } from '@/domain/show/overlay-scheduler';
import type { ShowPatch, ShowState } from '@/domain/show/show-state';
import { Disclosure } from '../components/Disclosure';

const MODE_LABELS: Record<OverlayMode, string> = {
  off: 'Off',
  corner: 'Corner (always)',
  reveal: 'Big, among the texts',
};

interface OverlayPanelProps {
  show: ShowState;
  overlay: ShowSnapshot['overlay'];
  onPatch: (patch: ShowPatch) => void;
  onLogoFile: (file: File) => void;
  onRemoveLogo: () => void;
}

export function OverlayPanel({
  show,
  overlay,
  onPatch,
  onLogoFile,
  onRemoveLogo,
}: OverlayPanelProps) {
  return (
    <Disclosure title="Name and logo" summary={MODE_LABELS[show.overlayMode]}>
      <label class="field">
        <span class="field__label">Show</span>
        <select
          value={show.overlayMode}
          onChange={(event) => onPatch({ overlayMode: event.currentTarget.value as OverlayMode })}
        >
          {(Object.keys(MODE_LABELS) as OverlayMode[]).map((mode) => (
            <option key={mode} value={mode}>
              {MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>
      <label class="field">
        <span class="field__label">DJ name</span>
        <input
          type="text"
          maxLength={40}
          value={show.overlayName}
          placeholder="optional"
          onInput={(event) => onPatch({ overlayName: event.currentTarget.value })}
        />
      </label>
      <div class="row">
        <label class="button file-button">
          {overlay.hasLogo ? 'Replace logo' : 'Add logo'}
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) onLogoFile(file);
              event.currentTarget.value = '';
            }}
          />
        </label>
        {overlay.hasLogo && (
          <button type="button" onClick={onRemoveLogo}>
            Remove logo
          </button>
        )}
      </div>
      <p class="hint">
        A transparent PNG works best. Big, it comes after drops and now and then, in the look of the
        texts.
      </p>
    </Disclosure>
  );
}
