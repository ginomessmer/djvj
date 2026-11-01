# djvj

Automated, audio-reactive generative visuals for a solo DJ set: one laptop, one big screen behind you, almost no hands-on control. Free, local, offline.

Runs in the browser (Chrome): WebGL shaders driven by live audio analysis. Everything is generated, so there is no content to license.

> **Status: phase 1** (audio in → analysis → 10 scenes → output + control windows). Beat tracking, the energy-aware director, a logo/name overlay and MIDI come next, see [docs/DESIGN.md](docs/DESIGN.md).

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

1. Open **`/output.html`** (the "Open output" button on the launcher). Drag that window onto the big screen.
2. Click once in it to allow audio input, then press **`F`** for fullscreen.
3. Open **`/control.html`** on the laptop screen to pick the audio input, scenes and palette.
4. No audio yet? Press **`M`** for a simulated 128 BPM demo signal.

For a gig, build once and serve the static files locally (no internet needed):

```bash
npm run build && npm run preview
```

## Scenes

Ordered from calm to intense. The energy range is what the phase 2 director will use to pick scenes for builds, drops and breakdowns.

| Scene | Look | Energy |
| --- | --- | --- |
| Aurora | slow curtains of light under faint stars | calm |
| Lava | glowing blobs that merge and split | calm to mid |
| Fluid | domain-warped noise (also the idle scene) | calm to high |
| Rings | one ring per frequency band | low to high |
| Grid | retro perspective floor, striped sun, mountains | mid to high |
| Orb | raymarched sphere deformed by the bass | mid to high |
| Kaleidoscope | folded wave pattern, kicks pulse the zoom | mid to high |
| Tunnel | checkered tunnel, speed follows the music | mid to peak |
| Starfield | streaks out of the centre, longer with energy | high to peak |
| Lasers | two fans of beams, soft pulses (no strobing) | high to peak |

## Getting audio in

The app analyses whatever input device the browser offers. It never plays the input back (no feedback).

| Source                         | How                                                                                                        | Notes                                                                                                                                                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MacBook microphone**         | Default. Allow microphone access for Chrome (System Settings → Privacy & Security → Microphone).           | Easiest. Hears the room, so keep the Mac near a speaker. Raise the _silence threshold_ if room noise keeps it "on".                                                                                                       |
| **USB audio interface**        | Split the controller's spare master/booth out into the interface's line-in; pick it in the control window. | Cleanest signal and independent of rekordbox. Needs a cheap interface and cable.                                                                                                                                          |
| **BlackHole** (virtual device) | Pick "BlackHole" in the control window.                                                                    | Only works if you can route audio _into_ BlackHole (e.g. a Multi-Output Device). With a Pioneer controller, rekordbox usually sends audio straight to the controller's own interface, so this may not work. Not tested.   |

Browser voice processing (echo cancellation, noise suppression, auto gain) is switched off, since it would mangle music. Input level is normalised automatically, so no gain staging is needed.

## Keys

Work in the output window, and (except `F`) also in the control window.

| Key       | Action                                                                     |
| --------- | -------------------------------------------------------------------------- |
| `F`       | Fullscreen (output window only)                                            |
| `A`       | Auto-rotate scenes on/off. Picking a scene manually locks it.              |
| `N` / `C` | Next scene / next palette                                                  |
| `B`       | Blackout (fast fade to black)                                              |
| `P`       | **Panic**: instantly switch to the safe ambient scene, which ignores audio |
| `M`       | Simulated demo signal on/off                                               |
| `D`       | Debug overlay (fps, levels)                                                |

## Behaviour worth knowing

- With **no signal** and auto on, the output shows a calm idle scene instead of going dark. Scenes only rotate while there is music.
- Scene changes dip through black (no hard flashes). A shader that fails to compile falls back to the safe scene.
- If the audio device disappears (USB unplugged), it keeps rendering and retries every 2 s.
- The output window keeps working with **no control window** open. Control only sends messages.
- Keep the output window **visible** on the second display: browsers throttle hidden windows.
- Resolution is capped at a **1080p pixel budget** (adjustable in control) so the GPU stays free for rekordbox's audio.
- Settings (device, palette, brightness, resolution, auto) are remembered per browser.

## Code structure

Five layers plus the entry points. A layer may only import the ones below it; `src/architecture.test.ts` enforces this, including which packages each layer may use.

| Layer         | Responsibility                                                                                               | May use                          |
| ------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `domain/`     | Pure logic and types: audio analysis, scene director, settings, palettes, shortcuts, message protocol        | `zod`                            |
| `services/`   | Thin adapters to browser APIs: Web Audio input, `BroadcastChannel`, keyboard                                 | domain                           |
| `vfx/`        | The three.js stage and the GLSL scenes                                                                       | domain, `three`                  |
| `features/`   | Use cases that wire the above together: show store, audio pipeline, output runtime, link to the control window | domain, services, vfx, `zustand` |
| `ui/`         | Presentational Preact components and styles: props in, events out, no business logic                         | domain, `preact`                 |
| `app/`        | Entry points (composition roots) and the hooks that connect UI to features                                   | everything                       |

```
src/
  domain/    audio/ (features, extractor, DSP)   show/ (scenes, director, settings)   remote/ (protocol)
  services/  audio-input   message-bus   keyboard
  vfx/       stage   shader-chunks   scenes/*.glsl
  features/  audio/   show/ (zustand store)   output/ (runtime)   remote/ (output-link)
  ui/        components/   control/   output/   styles/
  app/       output/   control/
```

Data flow: audio input → `FeatureExtractor` (domain) → `OutputRuntime` (features) → `Director` picks the scene (domain) → `Stage` draws it (vfx). The output window owns all state; the control window sends validated patches and renders the snapshots it gets back.

**Dependencies** (each replaces code that would otherwise be hand-written): `three` renderer and context handling, `preact` UI, `zustand` state with persistence, `zod` settings types and message validation, `biome` lint and format.

**Adding a scene:** add its id to `SCENE_IDS` and an entry in `SCENES` (`domain/show/scenes.ts`), and drop a `.glsl` file in `vfx/scenes/` that defines `vec3 render(vec2 uv, vec2 p)`; the compiler refuses a scene without a shader. Available uniforms are listed in `vfx/shader-chunks.ts`.

## Develop

```bash
npm test            # unit tests, including the architecture rules
npm run lint        # biome (npm run format to fix)
npm run typecheck
npm run build
```
