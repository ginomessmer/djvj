import { PALETTES } from '@/domain/show/palettes';
import type { SceneId } from '@/domain/show/scenes';
import { SELECTABLE_SCENES } from '@/domain/show/scenes';
import { lockPalette, lockScene, sceneKey, shortcutPatch } from '@/domain/show/shortcuts';
import type { ShowPatch, ShowState } from '@/domain/show/show-state';
import { Panel } from '../components/Panel';
import { Toggle } from '../components/Toggle';

interface ScenesPanelProps {
  show: ShowState;
  shownSceneId: SceneId;
  onPatch: (patch: ShowPatch) => void;
}

export function ScenesPanel({ show, shownSceneId, onPatch }: ScenesPanelProps) {
  const nextPalette = shortcutPatch('c', show);

  return (
    <Panel
      title="Scenes"
      class="panel--scenes"
      actions={
        <Toggle
          label="Auto-rotate"
          hint="A"
          checked={show.auto}
          onChange={(auto) => onPatch({ auto })}
        />
      }
    >
      <fieldset
        class="group pads"
        title={
          show.auto
            ? 'The director picks scenes from the music. Press a pad to lock one. The bar under each name shows how calm to intense the scene is.'
            : 'Scene locked. Switch Auto-rotate back on to let the music decide.'
        }
      >
        <legend class="sr-only">Scenes</legend>
        {SELECTABLE_SCENES.map((scene) => {
          const key = sceneKey(scene.id);
          const shown = scene.id === shownSceneId;
          const [low, high] = scene.energy;
          return (
            <button
              key={scene.id}
              type="button"
              class="pad"
              aria-pressed={shown}
              aria-keyshortcuts={key ?? undefined}
              onClick={() => onPatch(lockScene(scene.id))}
            >
              {key && <kbd class="pad__key">{key}</kbd>}
              <span class="pad__name">{scene.name}</span>
              <span class="pad__energy" aria-hidden="true">
                <i style={{ left: `${low * 100}%`, width: `${(high - low) * 100}%` }} />
              </span>
              <span class="sr-only">
                {`, energy ${low < 0.3 ? 'calm' : 'mid'} to ${high > 0.8 ? 'peak' : 'high'}`}
              </span>
            </button>
          );
        })}
      </fieldset>
      <h3 class="subtitle">Palette</h3>
      <fieldset class="group swatches">
        <legend class="sr-only">Palette</legend>
        {PALETTES.map((palette) => (
          <button
            key={palette.id}
            type="button"
            class="swatch"
            aria-pressed={palette.id === show.paletteId}
            onClick={() => onPatch(lockPalette(palette.id))}
          >
            <span
              class="swatch__colors"
              aria-hidden="true"
              style={{ background: `linear-gradient(90deg, ${palette.colors.join(', ')})` }}
            />
            <span class="swatch__name">{palette.name}</span>
          </button>
        ))}
      </fieldset>
      <div class="row">
        <Toggle
          label="Auto palette"
          checked={show.autoPalette}
          onChange={(autoPalette) => onPatch({ autoPalette })}
        />
        <button
          type="button"
          class="row__end"
          aria-keyshortcuts="C"
          onClick={() => nextPalette && onPatch(nextPalette)}
        >
          Next palette <kbd>C</kbd>
        </button>
      </div>
    </Panel>
  );
}
