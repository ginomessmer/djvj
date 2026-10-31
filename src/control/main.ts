import '../style.css';
import { openBus, type Command, type OutputState } from '../bus';

const BAND_LABELS = ['sub', 'bass', 'mid', 'hi-mid', 'high'];

const bus = openBus();
const root = document.getElementById('app') as HTMLElement;

root.innerHTML = `
  <header class="top">
    <h1>djvj <small>control</small></h1>
    <span id="conn" class="pill warn">waiting for output window…</span>
  </header>

  <section class="card">
    <h2>Audio input</h2>
    <div class="row">
      <select id="device" aria-label="Audio input device"></select>
      <button id="refresh" type="button">Refresh</button>
    </div>
    <p id="audioStatus" class="muted"></p>
    <label>Silence threshold <output id="silenceOut"></output>
      <input id="silence" type="range" min="-80" max="-20" step="1" />
    </label>
    <label class="check"><input id="demo" type="checkbox" /> Demo signal (simulated 128 BPM, no audio needed)</label>
  </section>

  <section class="card">
    <h2>Signal</h2>
    <div id="meters"></div>
    <div class="row leds">
      <span id="signalLed" class="led"></span><span>signal</span>
      <span id="kickLed" class="led"></span><span>kick</span>
      <span id="loud" class="muted"></span>
    </div>
  </section>

  <section class="card">
    <h2>Scene</h2>
    <div id="scenes" class="grid"></div>
    <label class="check"><input id="auto" type="checkbox" /> Auto-rotate scenes</label>
    <div class="row">
      <select id="palette" aria-label="Palette"></select>
      <button id="nextPalette" type="button">Next palette (C)</button>
    </div>
  </section>

  <section class="card">
    <h2>Output</h2>
    <label>Brightness
      <input id="intensity" type="range" min="0" max="1" step="0.01" />
    </label>
    <label>Resolution budget <output id="scaleOut"></output>
      <input id="scale" type="range" min="0.25" max="2" step="0.05" />
    </label>
    <div class="row">
      <button id="blackout" type="button">Blackout (B)</button>
      <button id="panic" type="button" class="danger">Panic (P)</button>
    </div>
    <p id="perf" class="muted"></p>
  </section>

  <footer class="muted">
    Keys here and in the output window: <kbd>A</kbd> auto · <kbd>N</kbd> next · <kbd>C</kbd> palette ·
    <kbd>B</kbd> blackout · <kbd>P</kbd> panic · <kbd>M</kbd> demo. <kbd>F</kbd> (fullscreen) only works in the output window.
  </footer>
`;

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}
const send = (command: Command): void => bus.post({ kind: 'command', command });

const conn = el('conn');
const device = el<HTMLSelectElement>('device');
const palette = el<HTMLSelectElement>('palette');
const scenes = el('scenes');
const meters = el('meters');
const sliders = {
  silence: el<HTMLInputElement>('silence'),
  intensity: el<HTMLInputElement>('intensity'),
  scale: el<HTMLInputElement>('scale'),
};

// meters
meters.innerHTML = [...BAND_LABELS, 'energy']
  .map((label, i) => `<div class="meter"><span>${label}</span><div class="bar"><i id="m${i}"></i></div></div>`)
  .join('');
const meterBars = [...BAND_LABELS, 'energy'].map((_, i) => el(`m${i}`));

// controls -> commands
el('refresh').addEventListener('click', () => send({ type: 'refresh-devices' }));
device.addEventListener('change', () => send({ type: 'set-device', id: device.value }));
palette.addEventListener('change', () => send({ type: 'set-palette', id: palette.value }));
el('nextPalette').addEventListener('click', () => send({ type: 'next-palette' }));
el<HTMLInputElement>('auto').addEventListener('change', (e) =>
  send({ type: 'set-auto', on: (e.target as HTMLInputElement).checked }),
);
el<HTMLInputElement>('demo').addEventListener('change', (e) =>
  send({ type: 'set-demo', on: (e.target as HTMLInputElement).checked }),
);
el('blackout').addEventListener('click', () => send({ type: 'blackout' }));
el('panic').addEventListener('click', () => send({ type: 'panic' }));
sliders.silence.addEventListener('input', () => send({ type: 'set-silence-db', value: Number(sliders.silence.value) }));
sliders.intensity.addEventListener('input', () => send({ type: 'set-intensity', value: Number(sliders.intensity.value) }));
sliders.scale.addEventListener('input', () => send({ type: 'set-render-scale', value: Number(sliders.scale.value) }));

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).tagName === 'SELECT') return;
  const keys: Record<string, Command> = {
    a: { type: 'set-auto', on: !lastState?.auto },
    n: { type: 'next-scene' },
    c: { type: 'next-palette' },
    b: { type: 'blackout' },
    p: { type: 'panic' },
    m: { type: 'set-demo', on: !lastState?.demo },
  };
  const command = keys[e.key.toLowerCase()];
  if (command) send(command);
});

// state -> DOM
let lastState: OutputState | null = null;
let lastSeen = 0;
let deviceKey = '';
let paletteKey = '';
let sceneKey = '';

function setOptions(select: HTMLSelectElement, items: Array<{ id: string; label: string }>, selected: string): void {
  select.innerHTML = '';
  for (const item of items) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.label;
    select.appendChild(option);
  }
  select.value = selected;
}

function setSlider(input: HTMLInputElement, value: number): void {
  if (document.activeElement !== input) input.value = String(value);
}

function render(s: OutputState): void {
  const nextDeviceKey = JSON.stringify([s.devices, s.deviceId]);
  if (nextDeviceKey !== deviceKey && document.activeElement !== device) {
    deviceKey = nextDeviceKey;
    setOptions(
      device,
      s.devices.length ? s.devices.map((d) => ({ id: d.id, label: d.label })) : [{ id: '', label: '(start audio in the output window)' }],
      s.deviceId,
    );
  }
  const nextPaletteKey = JSON.stringify([s.palettes, s.paletteId]);
  if (nextPaletteKey !== paletteKey && document.activeElement !== palette) {
    paletteKey = nextPaletteKey;
    setOptions(palette, s.palettes.map((p) => ({ id: p.id, label: p.name })), s.paletteId);
  }
  const nextSceneKey = JSON.stringify([s.scenes, s.sceneId, s.shownSceneId, s.auto]);
  if (nextSceneKey !== sceneKey) {
    sceneKey = nextSceneKey;
    scenes.innerHTML = '';
    for (const scene of s.scenes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = scene.name;
      button.classList.toggle('active', scene.id === s.shownSceneId);
      button.title = s.auto ? 'Click to lock this scene' : 'Locked scene';
      button.addEventListener('click', () => send({ type: 'select-scene', id: scene.id }));
      scenes.appendChild(button);
    }
  }

  el('audioStatus').textContent =
    s.audio === 'running' ? 'Listening.' : s.audio === 'error' ? `⚠ ${s.error ?? 'audio error'}` : 'Not started: click the output window once to allow audio.';
  el('silenceOut').textContent = `${s.silenceDb} dB`;
  el('scaleOut').textContent = `${s.renderScale.toFixed(2)}× 1080p`;
  setSlider(sliders.silence, s.silenceDb);
  setSlider(sliders.intensity, s.intensity);
  setSlider(sliders.scale, s.renderScale);
  el<HTMLInputElement>('auto').checked = s.auto;
  el<HTMLInputElement>('demo').checked = s.demo;
  el('blackout').classList.toggle('active', s.blackout);
  el('panic').classList.toggle('active', s.panic);

  [...s.bands, s.energy].forEach((v, i) => {
    const bar = meterBars[i];
    if (bar) bar.style.transform = `scaleX(${Math.min(1, Math.max(0, v)).toFixed(3)})`;
  });
  el('signalLed').classList.toggle('on', s.signal);
  el('kickLed').classList.toggle('on', s.kick > 0.5);
  el('loud').textContent = `${s.loudnessDb.toFixed(0)} dBFS`;
  el('perf').textContent = `${s.fps.toFixed(0)} fps · ${s.frameMs.toFixed(1)} ms/frame · ${s.resolution.join('×')} px`;
}

bus.onMessage((m) => {
  if (m.kind !== 'state') return;
  lastState = m.state;
  lastSeen = performance.now();
  render(m.state);
});

setInterval(() => {
  const connected = performance.now() - lastSeen < 2500;
  conn.textContent = connected ? 'output connected' : 'waiting for output window…';
  conn.classList.toggle('warn', !connected);
  conn.classList.toggle('ok', connected);
  if (!connected) send({ type: 'request-state' });
}, 1000);

send({ type: 'request-state' });
