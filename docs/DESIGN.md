# djvj design

## Goal

A solo DJ plays on a Pioneer **DDJ-FLX10** with **rekordbox** on a MacBook. One large screen behind them. Visuals should run almost entirely by themselves, follow the music, and never be the thing that breaks the set. Off-the-shelf VJ software is too expensive, so this is a custom, free, local app.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Platform | Web app in Chrome (TypeScript, Vite) | Free, WebGL2 + Web Audio + Web MIDI built in, shaders hot-reload, runs offline from a local server. Can be wrapped in Electron/Tauri later. |
| Rendering | Raw WebGL2, one fullscreen fragment shader per scene | Smallest dependency surface, full shader control. |
| Content | Generative only | No video clips, so no licensing risk. Logo/name overlay is optional (phase 3). |
| First audio source | MacBook mic or any input device (incl. BlackHole) | Zero hardware to start. A hardware tap (USB interface fed from a spare controller output) is the robust upgrade. |
| Windows | `/output` (renders, owns audio) + `/control` (laptop) over `BroadcastChannel` | The DJ must never need to focus the output window; output still works with no control window. |

## Architecture

```
 INPUTS            ANALYSIS                  DIRECTOR                      RENDER           OUTPUT
 ──────            ────────                  ────────                      ──────           ──────
 Audio input ───▶  5 bands (adaptive gain),  phase 1: timer rotation       GLSL scenes      /output window,
 (mic/device)      energy, low-end onset,    phase 2: energy state         shared header    fullscreen on the
                   hat onset, signal gate    machine + phrase-aligned      + tone-map,      big screen
 MIDI (phase 4) ─▶ phase 2: BPM + beat       scene/palette changes         dip-to-black
                   phase                                                   transitions            ▲
                                                                                                  │ BroadcastChannel
                                                                           /control: meters, scene lock, panic, blackout
```

### Audio analysis (`src/audio`)

- `AnalyserNode` FFT (2048, no smoothing) → per band power → **auto-ranging in dB** (`AdaptiveRange`): rises instantly, decays over ~12 s, so quiet mics and hot line-ins both fill 0..1. The range's top never drops below a floor, so a band that is genuinely quiet reads low instead of being blown up.
- Per-band attack/release **envelopes**; a bass-weighted **energy**; **flow** (energy integrated over time, so speed changes are always smooth).
- `OnsetDetector` (spectral flux over an adaptive threshold + refractory period) on the low end and on mids/highs.
- `SignalGate`: on after 0.4 s of signal, off after 3 s of silence, with hysteresis. Drives the idle fallback.
- Browser voice processing is disabled; input is analysed only, never played back.

**Known limitation:** `kick` is a *low-end onset*, not a kick detector. Measured with a synthetic 128 BPM track: kick only → 21 hits / 10 s (21.3 beats, exact); kick + 55 Hz off-beat bass stab → 43 hits (2×). Fine for pulses, but the phase-2 beat tracker must derive tempo from onsets with autocorrelation and not count them as beats.

### Rendering (`src/render`, `src/scenes`)

A scene is a GLSL file defining `vec3 render(vec2 uv, vec2 p)`. The shared header provides uniforms (`u_bands[5]`, `u_energy`, `u_kick`, `u_onset`, `u_flow`, `u_time`, `u_palette[4]`) and helpers (`pal`, `fbm`, `hash21`); the footer applies soft-clip tone mapping, vignette, master level and dither.

Safety and resilience: lazy compile with fallback to the ambient scene, WebGL context-loss recovery, render errors caught per frame so the loop never dies, a pixel budget (1080p default) so the GPU stays free for rekordbox, dip-to-black on every scene change.

### Controls

Output and control both accept keys; only `F` (fullscreen) needs the output window because of the browser gesture rule. **Panic** instantly shows the ambient scene, which depends on wall-clock time only.

FLX10 MIDI (phase 4) will be **read-only** and must not map pads/jogs that rekordbox also uses, or both would react.

## Roadmap

| Phase | Result | State |
|---|---|---|
| 0 | Vite + TypeScript + Vitest scaffold, CI | done |
| 1 | Audio in, features, 3 scenes, output + control, idle/panic/blackout | **done** |
| 2 | Beat tracker (BPM + phase), beat-synced scenes, transitions, energy-aware Director (QUIET → BUILD → DROP → GROOVE → BREAKDOWN) | next |
| 3 | More scenes (8–10), palette drift, logo/name overlay, global flash limiter, adaptive resolution | |
| 4 | Passive FLX10 MIDI (EQ / filter / crossfader shape the visuals), mood presets, offline packaging, gig checklist | |

## Testing

- **Unit (Vitest):** envelope, auto-range, onset detector, signal gate, feature extraction on synthetic spectra (band mapping, silence, gap hysteresis, kick count at 128 BPM), rotator, settings sanitising, palettes.
- **End to end (headless Chromium, run manually in development):** a synthetic 128 BPM WAV is fed in as the "microphone" via Chrome's fake-audio-capture flag; the built app is driven through the control window; screenshots are inspected. Covered: audio start, signal detection, ~55 fps in software GL, scene switching over the bus, panic, blackout, silent input → idle scene, demo mode, missing device.
- **Not testable without the real rig:** real input latency, CPU/GPU/thermal load next to rekordbox, the physical audio tap, and the wording of a genuine microphone *permission denial* (only the "no device" error was exercised). Do a 60–90 minute soak test at home before a gig.

## Open questions

- Genres and BPM range (affects the tempo estimator; drum & bass needs half-time handling).
- MacBook model and typical screen resolution (default pixel budget).
- Logo/name assets for the optional overlay.
- DDJ-FLX10 outputs are from memory (XLR + RCA master, TRS booth): verify in the manual which carries the master mix at the same time before buying cables.
