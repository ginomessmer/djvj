import '../style.css';
import { demoFeatures } from '../audio/demo';
import { BAND_COUNT, FeatureExtractor, silentFeatures, type AudioFeatures } from '../audio/features';
import { AudioInput, type InputDevice } from '../audio/input';
import { openBus, type AudioStatus, type Command, type OutputState } from '../bus';
import { SceneRotator } from '../director/rotator';
import { PALETTES, findPalette, nextPalette, paletteToUniform } from '../palettes';
import { Renderer } from '../render/renderer';
import { AMBIENT_ID, IDLE_SCENE_ID, VISIBLE_SCENES, findScene } from '../scenes';
import { loadSettings, saveSettings } from '../settings';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const smooth = (x: number): number => x * x * (3 - 2 * x);

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
}

/** Gentle breathing visuals for when the input is silent. */
function idleFeatures(t: number): AudioFeatures {
  const base = [0.18, 0.24, 0.2, 0.14, 0.1];
  return {
    bands: base.map((v, i) => v + 0.08 * Math.sin(t * (0.3 + i * 0.11) + i)),
    energy: 0.18 + 0.1 * (0.5 + 0.5 * Math.sin(t * 0.35)),
    loudnessDb: -120,
    kick: 0,
    onset: 0,
    kickHit: false,
    onsetHit: false,
    signal: false,
  };
}

function describeAudioError(err: unknown): string {
  const name = (err as { name?: string }).name;
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Microphone access was denied. Allow it via the lock icon in the address bar, then click again.';
  if (name === 'NotFoundError') return 'No audio input device found.';
  if (name === 'NotReadableError') return 'The audio input is busy or unavailable (used by another app?).';
  return err instanceof Error ? err.message : String(err);
}

class OutputApp {
  private readonly canvas = byId<HTMLCanvasElement>('stage');
  private readonly overlay = byId('overlay');
  private readonly statusText = byId('status');
  private readonly hud = byId('hud');
  private readonly renderer = new Renderer(this.canvas);
  private readonly audio = new AudioInput();
  private readonly bus = openBus();
  private readonly settings = loadSettings();
  private readonly seed = Math.random() * 100;
  private readonly rotator: SceneRotator;

  private extractor: FeatureExtractor | null = null;
  private features: AudioFeatures = silentFeatures();
  private devices: InputDevice[] = [];
  private audioStatus: AudioStatus = 'idle';
  private error: string | null = null;
  private starting = false;
  private retryTimer: number | undefined;

  private sceneId: string;
  private shownId: string;
  private fade = 0;
  private blackoutLevel = 1;
  private auto: boolean;
  private paletteId: string;
  private blackout = false;
  private panic = false;
  private demo = false;

  private flow = 0;
  private lastT = 0;
  private lastPost = 0;
  private fps = 60;
  private frameMs = 16;
  private resolution: [number, number] = [0, 0];
  private cursorTimer: number | undefined;

  constructor() {
    const first = (VISIBLE_SCENES[0] ?? findScene(AMBIENT_ID)).id;
    this.sceneId = first;
    this.shownId = first;
    this.auto = this.settings.auto;
    this.paletteId = findPalette(this.settings.paletteId).id;
    this.rotator = new SceneRotator(
      VISIBLE_SCENES.map((s) => s.id),
      Math.random,
      45,
      first,
    );

    this.audio.onLost = () => {
      this.audioStatus = 'error';
      this.error = 'Audio input lost, retrying…';
      this.refreshOverlay();
      this.scheduleRetry();
    };

    this.bus.onMessage((m) => {
      if (m.kind === 'command') this.apply(m.command);
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('mousemove', () => this.showCursor());
    this.overlay.addEventListener('click', () => void this.startAudio(this.settings.deviceId));
    navigator.mediaDevices?.addEventListener('devicechange', () => void this.refreshDevices());

    Object.assign(window, { __djvj: { state: () => this.buildState() } });
    this.refreshOverlay();
    this.postState(true);
    requestAnimationFrame(this.frame);
  }

  // ---- audio -----------------------------------------------------------------------------

  private async startAudio(deviceId: string): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    try {
      await this.audio.start(deviceId);
      this.extractor = new FeatureExtractor({ sampleRate: this.audio.sampleRate, binCount: this.audio.binCount });
      this.extractor.gate.setThreshold(this.settings.silenceDb);
      this.audioStatus = 'running';
      this.error = null;
      this.settings.deviceId = this.audio.deviceId;
      this.persist();
    } catch (err) {
      this.audioStatus = 'error';
      this.error = describeAudioError(err);
    } finally {
      this.starting = false;
    }
    await this.refreshDevices();
    this.refreshOverlay();
    this.postState(true);
  }

  private scheduleRetry(): void {
    window.clearTimeout(this.retryTimer);
    this.retryTimer = window.setTimeout(async () => {
      await this.startAudio(this.settings.deviceId);
      if (this.audioStatus !== 'running') this.scheduleRetry();
    }, 2000);
  }

  private async refreshDevices(): Promise<void> {
    try {
      this.devices = await this.audio.listDevices();
    } catch {
      this.devices = [];
    }
    this.postState(true);
  }

  // ---- commands --------------------------------------------------------------------------

  private apply(c: Command): void {
    switch (c.type) {
      case 'request-state':
        break;
      case 'select-scene':
        if (VISIBLE_SCENES.some((s) => s.id === c.id)) {
          this.sceneId = c.id;
          this.auto = false; // picking a scene locks it
          this.rotator.setCurrent(c.id);
        }
        break;
      case 'next-scene': {
        const i = VISIBLE_SCENES.findIndex((s) => s.id === this.sceneId);
        this.sceneId = (VISIBLE_SCENES[(i + 1) % VISIBLE_SCENES.length] ?? VISIBLE_SCENES[0])!.id;
        this.rotator.setCurrent(this.sceneId);
        break;
      }
      case 'set-auto':
        this.auto = c.on;
        if (c.on) this.rotator.setCurrent(this.sceneId);
        break;
      case 'set-palette':
        this.paletteId = findPalette(c.id).id;
        break;
      case 'next-palette':
        this.paletteId = nextPalette(this.paletteId).id;
        break;
      case 'set-intensity':
        this.settings.intensity = clamp(c.value, 0, 1);
        break;
      case 'set-render-scale':
        this.settings.renderScale = clamp(c.value, 0.25, 2);
        break;
      case 'set-silence-db':
        this.settings.silenceDb = clamp(c.value, -80, -20);
        this.extractor?.gate.setThreshold(this.settings.silenceDb);
        break;
      case 'set-demo':
        this.demo = c.on;
        break;
      case 'blackout':
        this.blackout = c.on ?? !this.blackout;
        break;
      case 'panic':
        this.panic = c.on ?? !this.panic;
        break;
      case 'set-device':
        void this.startAudio(c.id);
        break;
      case 'refresh-devices':
        void this.refreshDevices();
        break;
    }
    this.persist();
    this.refreshOverlay();
    this.postState(true);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key.toLowerCase()) {
      case 'f':
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => undefined);
        break;
      case 'a':
        this.apply({ type: 'set-auto', on: !this.auto });
        break;
      case 'n':
        this.apply({ type: 'next-scene' });
        break;
      case 'c':
        this.apply({ type: 'next-palette' });
        break;
      case 'b':
        this.apply({ type: 'blackout' });
        break;
      case 'p':
        this.apply({ type: 'panic' });
        break;
      case 'm':
        this.apply({ type: 'set-demo', on: !this.demo });
        break;
      case 'd':
        this.hud.hidden = !this.hud.hidden;
        break;
    }
  }

  private persist(): void {
    saveSettings({ ...this.settings, auto: this.auto, paletteId: this.paletteId });
  }

  // ---- frame loop ------------------------------------------------------------------------

  private readonly frame = (nowMs: number): void => {
    requestAnimationFrame(this.frame); // schedule first: one bad frame must never stop the show
    try {
      this.tick(nowMs / 1000);
    } catch (err) {
      console.error('[djvj] frame error', err);
    }
  };

  private tick(t: number): void {
    const dt = this.lastT ? clamp(t - this.lastT, 0.001, 0.1) : 1 / 60;
    this.lastT = t;
    this.fps += (1 / dt - this.fps) * 0.05;
    this.frameMs += (dt * 1000 - this.frameMs) * 0.05;

    // 1. analysis
    let live = false;
    if (this.demo) {
      this.features = demoFeatures(t);
      live = true;
    } else if (this.audioStatus === 'running' && this.extractor) {
      const sample = this.audio.sample();
      if (sample) {
        this.features = this.extractor.process(sample.freq, sample.rms, t);
        live = this.features.signal;
      }
    } else {
      this.features = silentFeatures();
    }
    const view = live ? this.features : idleFeatures(t);
    this.flow += dt * (0.2 + 1.8 * view.energy);

    // 2. automation
    if (this.auto && !this.panic) {
      const next = this.rotator.tick(t, live);
      if (next) this.sceneId = next;
    }
    const wanted = this.panic ? AMBIENT_ID : !live && this.auto ? IDLE_SCENE_ID : this.sceneId;
    this.updateFade(wanted, dt);
    this.blackoutLevel += ((this.blackout ? 0 : 1) - this.blackoutLevel) * Math.min(1, dt * 12);

    // 3. draw
    this.resolution = this.renderer.resize(this.settings.renderScale);
    this.renderer.render(findScene(this.shownId), {
      time: t,
      flow: this.flow,
      bands: view.bands.length === BAND_COUNT ? view.bands : silentFeatures().bands,
      energy: view.energy,
      kick: view.kick,
      onset: view.onset,
      palette: paletteToUniform(findPalette(this.paletteId)),
      intensity: this.settings.intensity * smooth(this.fade) * this.blackoutLevel,
      seed: this.seed,
    });

    this.postState(false, t);
    if (!this.hud.hidden) this.updateHud();
  }

  /** Dip to black on scene changes so cuts never flash. Panic cuts instantly. */
  private updateFade(wanted: string, dt: number): void {
    if (this.panic) {
      this.shownId = wanted;
      this.fade = 1;
      return;
    }
    if (wanted !== this.shownId) {
      this.fade -= dt / 0.25;
      if (this.fade <= 0) {
        this.fade = 0;
        this.shownId = wanted;
      }
    } else if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / 0.3);
    }
  }

  // ---- UI --------------------------------------------------------------------------------

  private refreshOverlay(): void {
    const showOverlay = this.audioStatus !== 'running' && !this.demo;
    this.overlay.classList.toggle('hidden', !showOverlay);
    this.statusText.textContent =
      this.audioStatus === 'error' && this.error ? `⚠ ${this.error}` : 'Click to start audio input';
  }

  private showCursor(): void {
    document.body.classList.remove('idle');
    window.clearTimeout(this.cursorTimer);
    this.cursorTimer = window.setTimeout(() => document.body.classList.add('idle'), 2000);
  }

  private updateHud(): void {
    const f = this.features;
    this.hud.textContent = [
      `${this.fps.toFixed(0)} fps · ${this.frameMs.toFixed(1)} ms · ${this.resolution.join('×')}`,
      `scene ${this.shownId}${this.auto ? ' (auto)' : ' (locked)'} · palette ${this.paletteId}`,
      `signal ${f.signal ? 'yes' : 'no'} · ${f.loudnessDb.toFixed(0)} dBFS · energy ${f.energy.toFixed(2)} · kick ${f.kick.toFixed(2)}`,
      `bands ${f.bands.map((b) => b.toFixed(2)).join(' ')}`,
    ].join('\n');
  }

  private buildState(): OutputState {
    const f = this.features;
    return {
      audio: this.audioStatus,
      error: this.error,
      devices: this.devices,
      deviceId: this.audio.deviceId || this.settings.deviceId,
      scenes: VISIBLE_SCENES.map((s) => ({ id: s.id, name: s.name })),
      sceneId: this.sceneId,
      shownSceneId: this.shownId,
      palettes: PALETTES.map((p) => ({ id: p.id, name: p.name })),
      paletteId: this.paletteId,
      auto: this.auto,
      demo: this.demo,
      blackout: this.blackout,
      panic: this.panic,
      intensity: this.settings.intensity,
      renderScale: this.settings.renderScale,
      silenceDb: this.settings.silenceDb,
      signal: this.demo || f.signal,
      bands: f.bands,
      energy: f.energy,
      kick: f.kick,
      loudnessDb: f.loudnessDb,
      fps: this.fps,
      frameMs: this.frameMs,
      resolution: this.resolution,
    };
  }

  /** State goes out at ~10 Hz, or immediately when forced (after a command). */
  private postState(force: boolean, t = performance.now() / 1000): void {
    if (!force && t - this.lastPost < 0.1) return;
    this.lastPost = t;
    this.bus.post({ kind: 'state', state: this.buildState() });
  }
}

try {
  new OutputApp();
} catch (err) {
  byId('status').textContent = `⚠ ${err instanceof Error ? err.message : String(err)}`;
  byId('overlay').classList.remove('hidden');
}
