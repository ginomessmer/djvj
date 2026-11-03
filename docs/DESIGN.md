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
| Windows | One `index.html`. `/` is the control view (laptop); it opens `/?view=output` (renders, owns audio and state) as a popup. They talk over `BroadcastChannel`. | The DJ never needs to focus the output window, and output still works with no control window. One page, with each view loaded as its own chunk, replaces three HTML files. |

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
 audio input ──▶ FeatureExtractor ──▶ RhythmTracker ─┐
 (service)       (domain)          └▶ SectionTracker ─┴▶ OutputRuntime ──▶ Director ──▶ Stage ──▶ screen
                                       (domain)            (features)        (domain)     (vfx)
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

**Note:** `kick` (and `u_kick`) is a _low-end onset_, not a kick detector. Measured with a synthetic 128 BPM track: kick only gives 21 hits per 10 s (21.3 beats, exact); kick plus a 55 Hz off-beat bass stab gives 43 (2×). The beat tracker handles this with the range-limited autocorrelation and the punch-weighted beat grid described below; scenes use the beat-locked `u_pulse`.

### Rhythm and structure (`domain/rhythm`)

Built and tuned against a structured test song (groove, breakdown with snare roll and riser, drop) played through the real browser audio path. The measurements that shaped it:

- **Tempo, two stages.** Autocorrelation of the kick-band onset strength over 8 s (range 115–160 BPM, which also rules out reading a kick plus an off-beat bass as double tempo) is robust but coarse: measured up to ±0.9 BPM, because onsets come at frame rate. The beat clock then **fits the period by least squares** to the kick onsets of the last 10 s: ±0.1 BPM in tests with frame jitter and off-beat bass. A coarse estimate more than 3% away means a new tempo and resets the fit.
- **Beat grid.** Onsets are folded onto the grid; the strongest cluster is the beat. Through the real pipeline, kick and off-beat bass had **equal** low-end flux, and the grid flipped between them (beat hits every ~0.26 s). What separates them is the jump in overall loudness, `punch`: kick +14.5 dB, bass +8.3 dB. The grid weighs onsets by punch and only moves to another cluster when it is 1.25× stronger (hysteresis). Result: 38 beats in 18 s (expected 38), all gaps 0.466–0.483 s, beats on the kick.
- **Kick band 40–100 Hz.** The 60–250 Hz band did not change between groove and breakdown (a pad chord at 220 Hz sits there), and the sub band below 60 Hz is out of reach of a laptop microphone. 40–100 Hz holds kick and bassline and excludes most pads.
- **Sections.** Bass presence is the kick band relative to the overall loudness (so the DJ changing the volume is not a breakdown), with fast attack (drop recognised in under 0.25 s) and slow release (bass must be gone 2 s). Highs for the build are averaged in power over 1.5 s: averaged in dB, off-beat hats faked a rise. Measured timeline of the test song: breakdown at 32.2 s (bass left at 30 s, plus the 2 s hold), build at 38.0 s (roll from 37.5 s), drop at 45.4 s (bass back at 45 s), groove 16 beats later.
- **Pulse.** `u_pulse` is the beat grid's pulse when it is trusted and blends to the raw kick when it is not, never jumping. A beat offset (±150 ms, persisted) compensates latency.

### Director (`domain/show/director.ts`)

Section energy picks the scene (breakdown 0.25, build 0.6, drop 0.95, groove follows the music's energy), avoiding the last three scenes. When: a groove changes every 64 beats; a breakdown or build changes on the next beat, but not within 8 beats of the last change; the drop cuts at once. Without a beat lock it falls back to a 45 s timer. Picking a scene by hand locks it.

### Show polish and safety (phase 3)

- **Render pipeline.** Each scene renders into its own target; a composite pass blends two of them (crossfade), lays the name/logo on top and applies vignette, master level and dither. Scenes only soft-clip. The composite is also drawn into a 32×18 probe that is read back asynchronously (`readRenderTargetPixelsAsync`), giving the measured brightness of what the audience sees without stalling the GPU.
- **Transitions** (`SceneMixer`, replacing the dip-to-black fader): the director's changes crossfade over one bar (4 beats, 2 s without a beat lock), the drop and panic cut, everything else (manual pick, idle fallback) crossfades over 1.5 s. A crossfade renders two scenes for its duration.
- **Flash guard** (`domain/safety`): WCAG 2.3.1 "general flash": a flash is a pair of opposing changes of at least 10 % relative luminance, at most three per second. The measured luminance is tracked as a zig-zag; more than six changes within any second turns the guard on (pulses damped by 85 %, image dimmed by 25 %), held 3 s and released over 3 s. Beat pulses up to 160 BPM stay under the limit (tested); a pulse at twice the beat (the raw kick on an off-beat bass) triggers it (tested).
- **Adaptive resolution** (`domain/performance`): frame time averaged over 0.5 s; above 20 ms for a second, the share of pixels drawn drops by 20 % (to 35 % at most); below 17.5 ms for 6 s it goes back up. It scales the actual drawing size, not just the budget cap: a first version only lowered the cap and did nothing below 1080p, which the browser test caught. In the VM it went from 768×432 at 51 fps to 614×346 at 60 fps.
- **Palette drift**: a new palette on every drop and every third phrase; palettes blend over ~0.7 s.
- **Overlay**: DJ name and/or logo drawn into a canvas texture. Corner (always, 80 %) or reveal (centre, for 16 beats after each drop and for 8 s every 2 minutes), fading over 1.5 s. The logo is scaled down in the control window, sent once, and stored under its own key: it never travels in snapshots or with settings updates.
- **Tap tempo**: a least-squares fit over the last taps (4 to 8); it sets the period and anchors the beat grid. While tapped, the grid may be fine-tuned by onsets but never relocks to another cluster, so a mic that hears the off-beat louder cannot pull it away.
- **Typing is not a shortcut.** Found by the browser test: typing the DJ name triggered tap, panic and the rest. Shortcuts now ignore text fields (tested).

### Rendering (`vfx`)

A scene is a GLSL file defining `vec3 render(vec2 uv, vec2 p)`. The shared header provides uniforms (`u_bands[5]`, `u_energy`, `u_kick`, `u_onset`, `u_flow`, `u_time`, `u_palette[4]`) and helpers (`pal`, `fbm`, `hash21`); the footer applies soft-clip tone mapping, vignette, master level and dither. Which scenes exist is declared in the domain (`SCENE_IDS`); `vfx/scenes` maps every id to a shader and the type checker enforces completeness.

Resilience: a scene that fails to compile falls back to the safe scene (three's `onShaderError`), the frame loop catches errors per frame so it never dies, resolution is capped at a 1080p pixel budget, and every scene change dips through black.

Scenes (calm to intense): aurora, lava, fluid, rings, grid, orb, kaleidoscope, tunnel, starfield, lasers, the camera scenes halftone, glyphs, neon and glitch, plus the hidden safe scene. Design rules: nothing strobes (kicks change size or soft brightness, never flash), the orb only marches rays that touch a bounding sphere, and a catalog test requires at least two scenes for every energy level so rotation always has a choice. In software GL on a CPU the heaviest were lasers, aurora and grid (about 40–60 ms at 960×540) and the lightest kaleidoscope and tunnel (frame-rate capped): this ranks them only relatively; real GPU cost is not measured.

### Live camera (camera scenes)

Inspired by VJs who point a camera at the DJ and blend it with generative looks (Resolume's live camera FX). Step 1: scenes built on the camera. Step 2 (the camera as a layer blended over any scene) and step 3 (person segmentation, e.g. MediaPipe, bundled for offline use) are not done.

- **Pipeline.** `services/camera-input` opens the camera (asks for 1280×720 at 30 fps: plenty behind effects, cheap to upload) into a muted, invisible `<video>` that stays in the document so browsers keep decoding it. `features/camera/CameraPipeline` adds the show rules: status and readable errors, retry every 2 s after a loss or a missing/busy camera (not after a denied permission), newest start wins. With no camera picked it prefers an iPhone (Continuity Camera, `domain/camera/preferredCameraId`), which needs a second open because labels only exist after permission.
- **Stage.** A `THREE.VideoTexture` with mipmaps. Uploads follow `requestVideoFrameCallback`, with a forced upload if it stays silent for 0.25 s. `u_cameraOn` eases in and out over ~0.4 s, so a camera that drops fades on its last frame instead of cutting. Shader helpers: `cameraUv` (crop to fill, mirror), `cameraColor(uv, lod)` and `cameraLuma`. The mip level is the noise filter: a dark booth means a noisy sensor, and edges and glyphs read a blurred level. Auto gain divides by the frame's mean (its smallest mip) up to 5×, so the image sits around mid grey, and highlights roll off (`1 - exp(-1.6x)`) instead of clipping. `cameraContrast` stretches around that mean and `cameraLumaDetail` adds an unsharp mask (the image minus a copy 3 mip levels blurrier); both scale with the DJ's *camera presence* setting (`u_cameraPresence`). Without a camera, `cameraStandIn` draws a soft head-and-shoulders figure.
- **Director.** `SceneInfo.camera` marks camera scenes. `pickScene` only offers them while `camera.ready`, and never two in a row. A camera scene whose camera went away is left on the next beat (`ChangeReason 'camera'`, ignoring the spacing rule). A camera scene picked by hand stays, with the stand-in. They come after the generated scenes in the catalog, so the number keys stay the same; `Q W E R` pick them. The catalog test requires two scenes at every energy level *without* the camera scenes.
- **First rig test:** Halftone and Glyphs were too subtle to recognise the DJ. Reproduced with a generated dark-booth clip (lit face, dark shirt, screen glow, jog wheels, sensor noise) fed to Chrome's fake camera (`--use-file-for-fake-video-capture`). Auto gain lifted everything evenly and clipped the lit face, so dots and symbols carried the outline but no features. Fixed with the highlight roll-off, the contrast stretch and unsharp mask above, a finer dot grid (70–92 rows instead of 44–64), denser and brighter symbols inside the figure with the rain stepping back there, a soft image underlay in both scenes, and the presence slider. In the clip, eyes, mouth, headphones and jog wheels are now readable in Halftone, and the figure (with its eyes) in Glyphs.
- **Second rig test (Glyphs at 100 %):** in front of a lit wall the DJ was a dark hole. Glyphs picked "the figure" as whatever was brighter than the frame's mean, nearly binary, so the brighter room lit up and the face had no shades. Now it works like an ASCII-art camera: every symbol's density and brightness follow the image at its cell (`cameraLumaLocal`: detail-boosted luma, partly balanced against a heavily blurred surround, retinex-style), colour comes from the column and runs to white in the brightest cells (tone-mapped palette hues had made a lit face look dark), and the rain runs mostly where the image is dark. Tuned on a second clip with a dark face in front of a lit wall, and checked against the dark-booth clip, where the lit face is now brighter and sharper than before. Limit: a face that is darker than the room stays darker than the room (no image filter can tell a person from a wall); a light on the DJ, or person segmentation (step 3), fixes that.
- **Verified in headless Chromium** with Chrome's fake camera (`--use-fake-device-for-media-stream`): all four shaders compile, the camera goes live, `Q`–`R` and the pads switch, turning the camera off makes auto mode leave a camera scene, and the flash-guard probe agrees with the screenshot's mean luminance (within 0.015). **Not verified:** a real iPhone via Continuity Camera, low-light behaviour, and GPU cost on the MacBook next to rekordbox.

### Control UI (issue #6)

- **Entry.** `app/main.ts` picks the view from `?view=output` and imports only that view. The control view tries to open the output popup 1.2 s after load, but only if no output answered the hello (naming the window and re-opening its URL would reload a running output). Browsers allow popups only from a gesture, so the automatic attempt can be blocked; the welcome screen then asks for a click, and `O` works as a gesture too.
- **Preview.** The stage renders the composite into a 384 px target and reads it back asynchronously (like the flash-guard probe), so the preview shows overlay, blackout and master level. It only runs while a control window sends `watch-preview` (every second, and only when visible); the output stops three seconds after the last one. Frames are raw RGBA in the message, not part of the snapshot.
- **Themes.** Colour tokens are CSS (`themes.css`), and `themes.test.ts` reads that file and checks WCAG contrast for every theme. The accent is the only runtime value: `applyPreferences` derives the ink colour on it and a readable variant for text. Found by the browser test: minified CSS writes `#ffffff` as `#fff`, so the colour parser accepts both.
- **Preferences** (theme, accent) live in the control window's own `localStorage` key, apart from the show settings, because they must never reach the output.
- **Shortcuts.** `SHORTCUT_GROUPS` feeds the help dialog; a test fails when a key handled by `shortcutPatch` is missing from it.
- **Native-app feel.** The control window is built like a desktop app, not a page: a fixed shell (toolbar, status bar, three docks that scroll on their own; only a phone scrolls the whole workspace), soft grouped panels on a darker backdrop with an 8 px gutter, a monitor that takes the leftover height, an LCD-style tempo readout and segmented level meters. One density, tuned against misclicks: 14 px text, 34 px controls, scene pads about 80 px high with 10 px gaps, five to a row, each with a strip in the colours of the playing palette; Blackout and Panic sit apart from the settings buttons. A touch screen gets 15 px text and 44 px targets and no key hints. The signal panel is a compact strip (the levels are a check, not something to operate). Explanations moved out of the layout: `hint()` marks a control, and the status bar shows the text while the pointer or keyboard focus is on it (screen readers get it as the description). Chrome cannot be selected or dragged and has no browser context menu (`services/native-shell.ts`; text fields keep theirs). A web app manifest lets Chrome install it into its own window without browser chrome; with the title-bar overlay (`display_override`) the toolbar doubles as the title bar. Not verified: the installed window and title-bar overlay (headless Chromium cannot install apps).
- **Not done:** placing the output window on the external screen automatically (needs the Window Management API and a permission prompt).

### Controls

Shortcuts are a pure function (`shortcutPatch`) used by both windows; only `F` (fullscreen) needs the output window because of the browser gesture rule. **Panic** instantly shows the ambient scene, which depends on wall-clock time only.

FLX10 MIDI (phase 4) will be **read-only** and must not map pads/jogs that rekordbox also uses, or both would react.

## Roadmap

| Phase | Result | State |
| --- | --- | --- |
| 0 | Vite + TypeScript + Vitest scaffold, CI | done |
| 1 | Audio in, features, 10 scenes, output + control, idle/panic/blackout | **done** |
| 2 | Beat tracker (BPM + phase), beat-synced scenes, section tracking (groove, breakdown, build, drop), director that follows them, beat offset | **done** |
| 3 | Crossfade transitions, palette drift, name/logo overlay, flash guard, adaptive resolution, tap tempo | **done** |
| 3+ | Live camera, step 1: camera scenes (halftone, glyphs, neon edges, glitch) | **done** |
| 3+ | Live camera, step 2: camera blended over any scene; step 3: person segmentation | |
| 3+ | Feedback trails and particles | next |
| 4 | Passive FLX10 MIDI (EQ / filter / crossfader shape the visuals), mood presets, offline packaging, gig checklist | |

## Testing

- **Unit (Vitest):** live camera: preferred camera (iPhone, never Desk View), the camera pipeline (iPhone switch after permission, denied without retry, lost and retried, stop cancels retries, newest start wins), camera scenes only in rotation with a camera and never back to back, leaving a camera scene on the next beat when the camera goes, Q–R keys, and the runtime wiring (settings open, switch and close the camera; the video and mirror reach the stage). Control UI (issue #6): colour maths and contrast, preference parsing, theme contrast, preview framing and gating, shortcut table. Earlier: phase 3: scene mixer, palette rotation, overlay scheduling, flash guard (allowed and forbidden flash rates, small flicker, release), luminance, resolution governor, tap tempo, a tapped grid holding against a louder off-beat, typing in text fields, and the runtime wiring (crossfades reach the stage, palette on the drop only in auto, pulses damped under flashing, resolution reduced at 30 fps, overlay, logo validation and never in the snapshot). Phase 2: tempo (±0.1 BPM at 120–150 with frame jitter and off-beat bass, tempo changes, silence, random onsets), beat grid (on the kick, not the off-beat bass, no flip-flopping, relock after a phase shift, latency offset), sections (build/drop sequence, drop within 0.25 s, short gaps, volume changes, hats are not a build), director (phrases on the beat, drop cut, calm breakdowns, spacing, fallback timer, no repeats), and DSP and feature extraction on synthetic spectra (band mapping, silence, gap hysteresis, onsets at 128 BPM), director, fader, rotator, shortcuts, settings and patch validation; the zustand store with a fake `localStorage` (including corrupted and missing storage); the audio pipeline with a fake input (permission denied, device lost and retried); the output runtime with a fake stage (scene choice, idle, locked, blackout, panic, rotation, snapshots surviving `structuredClone`, which `postMessage` requires); the link to the bus; the scene catalog and shaders, and the architecture rules.
- **End to end, rhythm (headless Chromium):** a generated 75 s song played through the browser microphone path. Tempo 128.0 in the groove, sections and scene choices on time (see above). The BPM read 127.6–128.0 between runs; the audio as delivered by Chrome's fake device in this VM measured 127.8–128.0, so part of that is the test environment. Real audio hardware is clocked, so the rig should do better, but that is not verified.
- **End to end (headless Chromium, run manually in development):** a synthetic 128 BPM WAV is fed in as the "microphone" with Chrome's fake-audio-capture flag, and the app is driven through both windows. Covered: launcher page, audio start, signal detection, ~55 fps in software GL, scene switching, keyboard shortcuts in both windows, panic, blackout, settings surviving a reload, silent input → idle scene, demo mode, debug HUD, missing device. Screenshots are inspected by hand.
- **Not testable without the real rig:** real input latency, CPU/GPU/thermal load next to rekordbox, the physical audio tap, and the wording of a genuine microphone _permission denial_ (the unit test covers the mapping of the error name; no browser denial was exercised). Do a 60–90 minute soak test at home before a gig.

## Open questions

- **Microphone bass response.** The kick band is 40–100 Hz; a laptop mic rolls off around there. The first thing to check on the rig: does the Rhythm card lock (BPM, beat light, sections) with the mic? If not, use line-in or BlackHole.
- ~~Genres~~: techno, electronic and trance. A steady 4/4 at roughly 120–150 BPM, so the tempo estimator can use a narrow range and no half-time handling (that was the drum & bass concern). Hard techno or psytrance above ~150 BPM is the edge case to test.
- MacBook model and typical screen resolution (default pixel budget). The user reports 60 FPS with the first three scenes; the seven added later have not been tried on the real GPU yet.
- Logo/name assets for the optional overlay.
- DDJ-FLX10 outputs are from memory (XLR + RCA master, TRS booth): verify in the manual which carries the master mix at the same time before buying cables.
