import { PALETTES } from '@/domain/show/palettes';
import type { SceneId } from '@/domain/show/scenes';
import { SELECTABLE_SCENES } from '@/domain/show/scenes';
import { lockPalette, lockScene, sceneKey, shortcutPatch } from '@/domain/show/shortcuts';
import type { ShowPatch, ShowState } from '@/domain/show/show-state';
import { Card } from '../components/Card';
import { Toggle } from '../components/Toggle';

interface ScenesCardProps {
  show: ShowState;
  shownSceneId: SceneId;
  onPatch: (patch: ShowPatch) => void;
}

export function ScenesCard({ show, shownSceneId, onPatch }: ScenesCardProps) {
  const nextPalette = shortcutPatch('c', show);

  return (
    <Card
      title="Scenes"
      class="card--scenes"
      actions={
        <Toggle
          label="Auto-rotate"
          hint="A"
          checked={show.auto}
          onChange={(auto) => onPatch({ auto })}
        />
      }
    >
      <fieldset class="group pads">
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
      <p class="hint">
        {show.auto
          ? 'The director picks scenes from the music. Tap a pad to lock one.'
          : 'Scene locked. Switch Auto-rotate back on to let the music decide.'}{' '}
        The bar under each name shows how calm to intense the scene is.
      </p>

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
    </Card>
  );
}
