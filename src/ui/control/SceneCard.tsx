import { PALETTES } from '@/domain/show/palettes';
import type { SceneId } from '@/domain/show/scenes';
import { SELECTABLE_SCENES } from '@/domain/show/scenes';
import { lockScene, shortcutPatch } from '@/domain/show/shortcuts';
import type { ShowPatch, ShowState } from '@/domain/show/show-state';
import { Card } from '../components/Card';
import { Toggle } from '../components/Toggle';

interface SceneCardProps {
  show: ShowState;
  shownSceneId: SceneId;
  onPatch: (patch: ShowPatch) => void;
}

export function SceneCard({ show, shownSceneId, onPatch }: SceneCardProps) {
  const nextPalette = shortcutPatch('c', show);

  return (
    <Card title="Scene">
      <div class="scene-grid">
        {SELECTABLE_SCENES.map((scene) => (
          <button
            key={scene.id}
            type="button"
            class={scene.id === shownSceneId ? 'active' : ''}
            title={show.auto ? 'Click to lock this scene' : 'Locked scene'}
            onClick={() => onPatch(lockScene(scene.id))}
          >
            {scene.name}
          </button>
        ))}
      </div>
      <Toggle
        label="Auto-rotate scenes"
        checked={show.auto}
        onChange={(auto) => onPatch({ auto })}
      />
      <div class="row">
        <select
          aria-label="Palette"
          value={show.paletteId}
          onChange={(event) => onPatch({ paletteId: event.currentTarget.value })}
        >
          {PALETTES.map((palette) => (
            <option key={palette.id} value={palette.id}>
              {palette.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => nextPalette && onPatch(nextPalette)}>
          Next palette (C)
        </button>
      </div>
    </Card>
  );
}
