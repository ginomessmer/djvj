# djvj design

## Goal

A solo DJ plays on a Pioneer **DDJ-FLX10** with **rekordbox** on a MacBook. One large screen behind them. Visuals should run almost entirely by themselves, follow the music, and never be the thing that breaks the set. Off-the-shelf VJ software is too expensive, so this is a custom, free, local app.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Platform | Web app in Chrome (TypeScript, Vite) | Free, WebGL + Web Audio + Web MIDI built in, shaders hot-reload, runs offline from a local server. Can be wrapped in Electron/Tauri later. |
| Rendering | `three` with one fullscreen fragment shader per scene | Replaces a hand-written renderer, gives context-loss recovery, and render targets for later transitions and post effects. |
| UI | `preact` | Small, declarative, familiar. The control panel was imperative DOM code before. |
| State | `zustand` (vanilla store + `persist`) | One source of truth, change subscriptions, and persistence that tolerates missing storage. |
| Validation | `zod` | Settings type, range and default are defined once; messages from the other window are validated, not trusted. |
| Content | Generative only | No video clips, so no licensing risk. A logo/name overlay is optional (phase 3). |
| First audio source | MacBook mic or any input device (incl. BlackHole) | Zero hardware to start. A hardware tap (USB interface fed from a spare controller output) is the robust upgrade. |
| Windows | `/output` (renders, owns audio and state) and `/control` (laptop) over `BroadcastChannel` | The DJ never needs to focus the output window, and output still works with no control window. |

## Architecture

### Layers

```
 app        entry points; wires objects together (composition roots) and hooks UI to features
  │
  ├── ui         presentational Preact components, props in / events out
  └── features   show store, audio pipeline, output runtime, link to the control window
        │
        ├── vfx        three.js stage, GLSL scenes
        ├── services   browser adapters: Web Audio input, BroadcastChannel, keyboard
        └── domain     pure logic and types, no browser APIs
```

Dependencies only point downwards (`ui` sees only `domain`; `features` cannot see `ui`). Third-party packages are restricted too: `zod` in domain, `three` in vfx, `zustand` in features, `preact` in ui and app. `src/architecture.test.ts` checks every source file against these rules; it was verified to fail when a violation is injected.

### Data flow

```
 audio input ──▶ FeatureExtractor ──▶ OutputRuntime ──▶ Director ──▶ Stage ──▶ screen
 (service)       (domain)             (features)        (domain)     (vfx)
                                          │  ▲
                              snapshots   │  │  validated patches
                                          ▼  │
                       control window  (ui + app/control, over BroadcastChannel)
```

- **Domain** holds all decisions: band analysis, silence gate, onset detection, which scene is shown (`Director` = rotation + idle fallback + panic + dip-to-black), shortcuts, settings schema and the message protocol. All of it is unit-tested without a browser.
- **Features** adds the effects: the zustand `ShowStore` (single source of truth; persists only settings), `AudioPipeline` (errors become a status message; a lost device is retried every 2 s), `OutputRuntime` (the frame loop, publishes snapshots at ~10 Hz and on every change), `linkOutputToBus`.
- **Control** is a pure view of the last snapshot. Its only output is a `ShowPatch` or `refresh-devices`; the output validates every patch with the same zod schema.

### Audio analysis (`domain/audio`)

- `AnalyserNode` FFT (2048, no smoothing) → per-band power → **auto-ranging in dB** (`AdaptiveRange`): rises instantly, decays over ~12 s, so quiet mics and hot line-ins both fill 0..1. The top of the range never drops below a floor, so a genuinely quiet band reads low.
- Per-band attack/release envelopes; a bass-weighted energy; `flow` (energy integrated over time, so speed changes are smooth).
- `OnsetDetector` (spectral flux over an adaptive threshold, with a refractory period) on the low end and on mids/highs.
- `SignalGate`: on after 0.4 s of signal, off after 3 s of silence, with hysteresis. Drives the idle fallback.
- Browser voice processing is disabled; input is analysed only, never played back.

**Known limitation:** `kick` is a _low-end onset_, not a kick detector. Measured with a synthetic 128 BPM track: kick only gives 21 hits per 10 s (21.3 beats, exact); kick plus a 55 Hz off-beat bass stab gives 43 (2×). Fine for pulses, but a phase-2 beat tracker must derive tempo from onsets with autocorrelation and not count them as beats.

### Rendering (`vfx`)

A scene is a GLSL file defining `vec3 render(vec2 uv, vec2 p)`. The shared header provides uniforms (`u_bands[5]`, `u_energy`, `u_kick`, `u_onset`, `u_flow`, `u_time`, `u_palette[4]`) and helpers (`pal`, `fbm`, `hash21`); the footer applies soft-clip tone mapping, vignette, master level and dither. Which scenes exist is declared in the domain (`SCENE_IDS`); `vfx/scenes` maps every id to a shader and the type checker enforces completeness.

Resilience: a scene that fails to compile falls back to the safe scene (three's `onShaderError`), the frame loop catches errors per frame so it never dies, resolution is capped at a 1080p pixel budget, and every scene change dips through black.

### Controls

Shortcuts are a pure function (`shortcutPatch`) used by both windows; only `F` (fullscreen) needs the output window because of the browser gesture rule. **Panic** instantly shows the ambient scene, which depends on wall-clock time only.

FLX10 MIDI (phase 4) will be **read-only** and must not map pads/jogs that rekordbox also uses, or both would react.

## Roadmap

| Phase | Result | State |
| --- | --- | --- |
| 0 | Vite + TypeScript + Vitest scaffold, CI | done |
| 1 | Audio in, features, 3 scenes, output + control, idle/panic/blackout | **done** |
| 2 | Beat tracker (BPM + phase), beat-synced scenes, transitions, energy-aware director (QUIET → BUILD → DROP → GROOVE → BREAKDOWN) | next |
| 3 | More scenes (8–10), palette drift, logo/name overlay, global flash limiter, adaptive resolution | |
| 4 | Passive FLX10 MIDI (EQ / filter / crossfader shape the visuals), mood presets, offline packaging, gig checklist | |

## Testing

- **Unit (Vitest, 130 tests):** DSP and feature extraction on synthetic spectra (band mapping, silence, gap hysteresis, onsets at 128 BPM), director, fader, rotator, shortcuts, settings and patch validation; the zustand store with a fake `localStorage` (including corrupted and missing storage); the audio pipeline with a fake input (permission denied, device lost and retried); the output runtime with a fake stage (scene choice, idle, locked, blackout, panic, rotation, snapshots surviving `structuredClone`, which `postMessage` requires); the link to the bus; and the architecture rules.
- **End to end (headless Chromium, run manually in development):** a synthetic 128 BPM WAV is fed in as the "microphone" with Chrome's fake-audio-capture flag, and the app is driven through both windows. Covered: launcher page, audio start, signal detection, ~55 fps in software GL, scene switching, keyboard shortcuts in both windows, panic, blackout, settings surviving a reload, silent input → idle scene, demo mode, debug HUD, missing device. Screenshots are inspected by hand.
- **Not testable without the real rig:** real input latency, CPU/GPU/thermal load next to rekordbox, the physical audio tap, and the wording of a genuine microphone _permission denial_ (the unit test covers the mapping of the error name; no browser denial was exercised). Do a 60–90 minute soak test at home before a gig.

## Open questions

- Genres and BPM range (affects the tempo estimator; drum & bass needs half-time handling).
- MacBook model and typical screen resolution (default pixel budget).
- Logo/name assets for the optional overlay.
- DDJ-FLX10 outputs are from memory (XLR + RCA master, TRS booth): verify in the manual which carries the master mix at the same time before buying cables.
