import { findPalette, PALETTES } from '@/domain/show/palettes';
import type { SceneId, SceneInfo } from '@/domain/show/scenes';
import { SELECTABLE_SCENES } from '@/domain/show/scenes';
import { lockPalette, lockScene, sceneKey, shortcutPatch } from '@/domain/show/shortcuts';
import type { ShowPatch, ShowState } from '@/domain/show/show-state';
import { hint } from '../components/hint';
import { Panel } from '../components/Panel';
import { Toggle } from '../components/Toggle';

interface ScenesPanelProps {
  show: ShowState;
  shownSceneId: SceneId;
  /** A camera delivers frames; without one, camera scenes show a stand-in and are not rotated in. */
  cameraReady: boolean;
  onPatch: (patch: ShowPatch) => void;
}

const GENERATED_SCENES = SELECTABLE_SCENES.filter((scene) => !scene.camera);
const CAMERA_SCENES = SELECTABLE_SCENES.filter((scene) => scene.camera);

interface PadProps {
  scene: SceneInfo;
  shown: boolean;
  /** Camera scene without a live camera. */
  standIn: boolean;
  onPatch: (patch: ShowPatch) => void;
}

function Pad({ scene, shown, standIn, onPatch }: PadProps) {
  const key = sceneKey(scene.id);
  const [low, high] = scene.energy;
  const note = standIn ? ' No camera is live: it shows a stand-in and is not rotated in.' : '';
  return (
    <button
      type="button"
      class={standIn ? 'pad pad--standin' : 'pad'}
      aria-pressed={shown}
      aria-keyshortcuts={key ?? undefined}
      onClick={() => onPatch(lockScene(scene.id))}
      {...hint(
        `Lock ${scene.name}${key ? ` (key ${key})` : ''}. The bar shows how calm to intense it is.${note}`,
      )}
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
}

export function ScenesPanel({ show, shownSceneId, cameraReady, onPatch }: ScenesPanelProps) {
  const nextPalette = shortcutPatch('c', show);
  const tint = `linear-gradient(90deg, ${findPalette(show.paletteId).colors.join(', ')})`;

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
      {/* Each pad carries a slim strip in the colours of the palette that is playing. */}
      <fieldset class="group pads" style={{ '--tint': tint }}>
        <legend class="sr-only">Scenes</legend>
        {GENERATED_SCENES.map((scene) => (
          <Pad
            key={scene.id}
            scene={scene}
            shown={scene.id === shownSceneId}
            standIn={false}
            onPatch={onPatch}
          />
        ))}
      </fieldset>
      <h3 class="subtitle">
        Camera
        <span class="subtitle__note">{cameraReady ? 'live, in rotation' : 'no camera live'}</span>
      </h3>
      <fieldset class="group pads" style={{ '--tint': tint }}>
        <legend class="sr-only">Camera scenes</legend>
        {CAMERA_SCENES.map((scene) => (
          <Pad
            key={scene.id}
            scene={scene}
            shown={scene.id === shownSceneId}
            standIn={!cameraReady}
            onPatch={onPatch}
          />
        ))}
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
            {...hint(`Use the ${palette.name} palette`)}
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
