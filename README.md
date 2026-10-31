# djvj

Automated, audio-reactive generative visuals for a solo DJ set: one laptop, one big screen behind you, almost no hands-on control. Free, local, offline.

Runs in the browser (Chrome): WebGL2 shaders driven by live audio analysis. No content to license, since everything is generated.

> **Status: phase 1 (audio in → analysis → 3 scenes → output + control windows).** Beat tracking, the energy-aware director, logo/name overlay and MIDI come next, see [docs/DESIGN.md](docs/DESIGN.md).

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

## Getting audio in

The app analyses whatever input device the browser offers. It never plays the input back (no feedback).

| Source | How | Notes |
|---|---|---|
| **MacBook microphone** | Default. Allow microphone access for Chrome (System Settings → Privacy & Security → Microphone). | Easiest. Hears the room, so keep the Mac near a speaker. Raise the *silence threshold* if room noise keeps it "on". |
| **USB audio interface** | Split the controller's spare master/booth out into the interface's line-in; pick it in the control window. | Cleanest signal and independent of rekordbox. Needs a cheap interface and cable. |
| **BlackHole** (virtual device) | Pick "BlackHole" in the control window. | Only works if you can route audio *into* BlackHole (e.g. a Multi-Output Device). With a Pioneer controller, rekordbox usually sends audio straight to the controller's own interface, so this may not work. Not tested. |

Browser voice processing (echo cancellation, noise suppression, auto gain) is switched off, since it would mangle music. Input level is normalised automatically, so no gain staging is needed.

## Keys

Work in the output window, and (except `F`) also in the control window.

| Key | Action |
|---|---|
| `F` | Fullscreen (output window only) |
| `A` | Auto-rotate scenes on/off. Picking a scene manually locks it. |
| `N` / `C` | Next scene / next palette |
| `B` | Blackout (fast fade to black) |
| `P` | **Panic**: instantly switch to the safe ambient scene, which ignores audio |
| `M` | Simulated demo signal on/off |
| `D` | Debug overlay (fps, levels) |

## Behaviour worth knowing

- With **no signal** and auto on, the output shows a calm idle scene instead of going dark. Scenes only rotate while there is music.
- Scene changes dip through black (no hard flashes). A broken shader falls back to the ambient scene instead of crashing.
- If the audio device disappears (USB unplugged), it keeps rendering and retries every 2 s.
- The output window keeps working with **no control window** open. Control only sends commands.
- Keep the output window **visible** on the second display: browsers throttle hidden windows.
- Resolution is capped at a **1080p pixel budget** (adjustable in control) so the GPU stays free for rekordbox's audio.

## Develop

```bash
npm test            # unit tests (DSP, rotator, settings)
npm run typecheck
npm run build
```

```
src/
  audio/      input (Web Audio), DSP building blocks, feature extraction, demo signal
  director/   scene rotation (phase 2: energy-aware director)
  render/     WebGL2 renderer + shared shader header/footer
  scenes/     one GLSL file per scene (define `vec3 render(vec2 uv, vec2 p)`)
  output/     the fullscreen window: owns audio, state and rendering
  control/    the laptop panel: sends commands, shows state
```

Adding a scene = drop a `.frag` file in `src/scenes/`, register it in `src/scenes/index.ts`. Available uniforms are documented in `src/render/shader-common.ts`.
