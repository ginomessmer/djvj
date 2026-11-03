import * as THREE from 'three';
import { BAND_COUNT } from '@/domain/audio/bands';
import { flipRows, PREVIEW_WIDTH, type PreviewFrame, previewHeight } from '@/domain/remote/preview';
import { meanRelativeLuminance } from '@/domain/safety/luminance';
import type { SceneMix } from '@/domain/show/scene-mixer';
import { SAFE_SCENE_ID, type SceneId } from '@/domain/show/scenes';
import type { FrameParams, OverlayParams } from './frame-params';
import { OVERLAY_ASPECT, OverlayTexture } from './overlay-texture';
import { SCENE_SHADERS } from './scenes';
import { COMPOSITE_SHADER, FRAGMENT_FOOTER, FRAGMENT_HEADER, VERTEX_SHADER } from './shader-chunks';

// Palette hex values are used as-is by the shaders, without three.js colour conversion.
THREE.ColorManagement.enabled = false;

/** Default pixel budget: 1080p. Bigger screens are upscaled; this keeps the GPU calm. */
const PIXEL_BUDGET = 1920 * 1080;
const PALETTE_SIZE = 4;
/** Palette changes blend over about this long. */
const PALETTE_BLEND_SEC = 0.7;
/** The brightness probe: a tiny copy of the output, read back without stalling the GPU. */
const PROBE_WIDTH = 32;
const PROBE_HEIGHT = 18;
/** The camera fades in when frames arrive and out when it goes, over about this long. */
const CAMERA_FADE_SEC = 0.4;
/**
 * New camera frames are announced by `requestVideoFrameCallback`. Should that ever stay silent
 * for longer than this while the video plays, the frame is uploaded anyway.
 */
const CAMERA_STALL_SEC = 0.25;
/** Where the overlay sits, in fractions of the screen width. */
const OVERLAY_LAYOUT = {
  corner: { width: 0.2, marginX: 0.03, marginY: 0.04 },
  centre: { width: 0.55 },
};

export interface LuminanceSample {
  tSec: number;
  /** Mean relative luminance (0..1) of what was on screen at `tSec`. */
  value: number;
}

function sceneTarget(): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(2, 2, {
    depthBuffer: false,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
}

/**
 * Draws the show: each frame one or two fullscreen fragment-shader scenes, blended by a composite
 * pass that also adds the overlay. Shader compile errors fall back to the safe scene instead of
 * leaving the screen dead. It also measures how bright the output is, for the flash guard.
 */
export class Stage {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly sceneQuad: THREE.Mesh;
  private readonly sceneScene = new THREE.Scene();
  private readonly compositeScene = new THREE.Scene();
  private readonly materials = new Map<SceneId, THREE.ShaderMaterial>();
  private readonly brokenScenes = new Set<SceneId>();
  private readonly targets = { from: sceneTarget(), to: sceneTarget() };
  private readonly probe = new THREE.WebGLRenderTarget(PROBE_WIDTH, PROBE_HEIGHT, {
    depthBuffer: false,
    generateMipmaps: false,
  });
  private readonly probePixels = new Uint8Array(PROBE_WIDTH * PROBE_HEIGHT * 4);
  private readonly overlay = new OverlayTexture();
  private readonly drawingBufferSize = new THREE.Vector2();
  private readonly paletteTarget = Array.from({ length: PALETTE_SIZE }, () => new THREE.Color());
  private activeSceneId: SceneId = SAFE_SCENE_ID;
  private paletteId = '';
  private lastTimeSec: number | null = null;
  private probing = false;
  private latestLuminance: LuminanceSample | null = null;
  private previewWanted = false;
  private previewTarget: THREE.WebGLRenderTarget | null = null;
  private previewReading = false;
  private previewReady: PreviewFrame | null = null;
  /** Bound while there is no camera: one black texel. */
  private readonly noCamera = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  private cameraTexture: THREE.VideoTexture | null = null;
  private cameraVersion = -1;
  private cameraVersionSec = 0;

  /** Shared by all scene materials: set once per frame. */
  private readonly sceneUniforms = {
    u_res: { value: new THREE.Vector2(1, 1) },
    u_time: { value: 0 },
    u_flow: { value: 0 },
    u_bands: { value: new Array<number>(BAND_COUNT).fill(0) },
    u_energy: { value: 0 },
    u_kick: { value: 0 },
    u_onset: { value: 0 },
    u_beat: { value: 0 },
    u_pulse: { value: 0 },
    u_palette: { value: Array.from({ length: PALETTE_SIZE }, () => new THREE.Color()) },
    u_camera: { value: this.noCamera as THREE.Texture },
    u_cameraOn: { value: 0 },
    u_cameraRes: { value: new THREE.Vector2(16, 9) },
    u_cameraMirror: { value: 0 },
    u_cameraPresence: { value: 0.6 },
  };

  private readonly compositeUniforms = {
    u_res: { value: new THREE.Vector2(1, 1) },
    u_time: { value: 0 },
    u_from: { value: this.targets.from.texture },
    u_to: { value: this.targets.to.texture },
    u_mix: { value: 0 },
    u_overlay: { value: this.overlay.texture as THREE.Texture },
    u_overlayOpacity: { value: 0 },
    u_overlayRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    u_intensity: { value: 1 },
  };

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(1);
    this.noCamera.needsUpdate = true;
    this.renderer.debug.onShaderError = (gl, program, _vertex, fragment) => {
      this.brokenScenes.add(this.activeSceneId);
      console.error(
        `[djvj] scene "${this.activeSceneId}" failed to compile, using the safe scene instead`,
        gl.getProgramInfoLog(program),
        gl.getShaderInfoLog(fragment),
      );
    };
    container.appendChild(this.renderer.domElement);

    this.sceneQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.sceneQuad.frustumCulled = false;
    this.sceneScene.add(this.sceneQuad);

    const composite = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: this.compositeUniforms,
        vertexShader: VERTEX_SHADER,
        fragmentShader: COMPOSITE_SHADER,
        depthTest: false,
        depthWrite: false,
      }),
    );
    composite.frustumCulled = false;
    this.compositeScene.add(composite);
  }

  /**
   * Match the drawing buffer to the displayed size, capped at the pixel budget (1080p x scale),
   * then reduced by `quality` (adaptive resolution: a share of the pixels actually drawn).
   * @returns the drawing buffer size in pixels
   */
  resize(budgetScale: number, quality = 1): [width: number, height: number] {
    const dpr = window.devicePixelRatio || 1;
    let width = this.container.clientWidth * dpr;
    let height = this.container.clientHeight * dpr;
    const maxPixels = PIXEL_BUDGET * budgetScale;
    if (width * height > maxPixels) {
      const shrink = Math.sqrt(maxPixels / (width * height));
      width *= shrink;
      height *= shrink;
    }
    width *= Math.sqrt(quality);
    height *= Math.sqrt(quality);
    width = Math.max(2, Math.round(width));
    height = Math.max(2, Math.round(height));

    this.renderer.getDrawingBufferSize(this.drawingBufferSize);
    if (this.drawingBufferSize.x !== width || this.drawingBufferSize.y !== height) {
      this.renderer.setSize(width, height, false);
      this.targets.from.setSize(width, height);
      this.targets.to.setSize(width, height);
    }
    this.sceneUniforms.u_res.value.set(width, height);
    return [width, height];
  }

  render(mix: SceneMix<SceneId>, frame: FrameParams, overlay: OverlayParams): void {
    this.applyFrame(frame);
    this.drawScene(mix.mix >= 1 ? mix.toId : mix.fromId, this.targets.from);
    const blending = mix.mix > 0 && mix.mix < 1 && mix.toId !== mix.fromId;
    if (blending) this.drawScene(mix.toId, this.targets.to);

    const uniforms = this.compositeUniforms;
    uniforms.u_time.value = frame.time;
    uniforms.u_mix.value = blending ? mix.mix : 0;
    uniforms.u_intensity.value = frame.intensity;
    this.applyOverlay(overlay);

    this.renderer.getDrawingBufferSize(this.drawingBufferSize);
    uniforms.u_res.value.copy(this.drawingBufferSize);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.compositeScene, this.camera);
    this.measure(frame.time);
    if (this.previewWanted) this.capturePreview();
  }

  /** Turns the preview on or off. Off costs nothing: no extra pass, no read-back. */
  setPreviewWanted(wanted: boolean): void {
    this.previewWanted = wanted;
    if (!wanted) this.previewReady = null;
  }

  /** The newest preview frame that finished reading back, once. Arrives a frame or two late. */
  takePreviewFrame(): PreviewFrame | null {
    const frame = this.previewReady;
    this.previewReady = null;
    return frame;
  }

  /** The most recent brightness measurement (arrives a frame or two after it was drawn). */
  luminance(): LuminanceSample | null {
    return this.latestLuminance;
  }

  dispose(): void {
    for (const material of this.materials.values()) material.dispose();
    this.targets.from.dispose();
    this.targets.to.dispose();
    this.probe.dispose();
    this.previewTarget?.dispose();
    this.overlay.dispose();
    this.cameraTexture?.dispose();
    this.noCamera.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private drawScene(sceneId: SceneId, target: THREE.WebGLRenderTarget): void {
    this.drawSceneOnce(this.brokenScenes.has(sceneId) ? SAFE_SCENE_ID : sceneId, target);
    // The scene may have failed to compile during that draw: show the safe one right away.
    if (this.activeSceneId !== SAFE_SCENE_ID && this.brokenScenes.has(this.activeSceneId)) {
      this.drawSceneOnce(SAFE_SCENE_ID, target);
    }
  }

  private drawSceneOnce(sceneId: SceneId, target: THREE.WebGLRenderTarget): void {
    this.activeSceneId = sceneId;
    this.sceneQuad.material = this.materialFor(sceneId);
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.sceneScene, this.camera);
  }

  /** Renders the composite into the tiny probe and reads it back asynchronously. */
  private measure(tSec: number): void {
    if (this.probing) return;
    this.probing = true;
    this.compositeUniforms.u_res.value.set(PROBE_WIDTH, PROBE_HEIGHT);
    this.renderer.setRenderTarget(this.probe);
    this.renderer.render(this.compositeScene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer
      .readRenderTargetPixelsAsync(this.probe, 0, 0, PROBE_WIDTH, PROBE_HEIGHT, this.probePixels)
      .then(() => {
        this.latestLuminance = { tSec, value: meanRelativeLuminance(this.probePixels) };
      })
      .catch(() => undefined)
      .finally(() => {
        this.probing = false;
      });
  }

  /** Renders the composite (overlay and master level included) small, and reads it back async. */
  private capturePreview(): void {
    if (this.previewReading) return;
    const width = PREVIEW_WIDTH;
    const height = previewHeight(this.drawingBufferSize.x, this.drawingBufferSize.y);
    if (!this.previewTarget) {
      this.previewTarget = new THREE.WebGLRenderTarget(width, height, {
        depthBuffer: false,
        generateMipmaps: false,
      });
    } else if (this.previewTarget.height !== height) {
      this.previewTarget.setSize(width, height);
    }
    const target = this.previewTarget;
    const pixels = new Uint8Array(width * height * 4);

    this.previewReading = true;
    this.compositeUniforms.u_res.value.set(width, height);
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.compositeScene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer
      .readRenderTargetPixelsAsync(target, 0, 0, width, height, pixels)
      .then(() => {
        this.previewReady = { width, height, pixels: flipRows(pixels, width, height) };
      })
      .catch(() => undefined)
      .finally(() => {
        this.previewReading = false;
      });
  }

  private applyFrame({ time, flow, features, rhythm, palette, camera }: FrameParams): void {
    const uniforms = this.sceneUniforms;
    const dtSec = this.lastTimeSec === null ? 1 : Math.min(1, Math.max(0, time - this.lastTimeSec));
    this.lastTimeSec = time;
    this.applyCamera(camera, time, dtSec);

    uniforms.u_time.value = time;
    uniforms.u_flow.value = flow;
    uniforms.u_energy.value = features.energy;
    uniforms.u_kick.value = features.kick;
    uniforms.u_onset.value = features.onset;
    uniforms.u_beat.value = rhythm.beatPhase;
    uniforms.u_pulse.value = rhythm.pulse;
    features.bands.forEach((level, band) => {
      uniforms.u_bands.value[band] = level;
    });

    const firstPalette = this.paletteId === '';
    if (palette.id !== this.paletteId) {
      this.paletteId = palette.id;
      palette.colors.forEach((hex, index) => {
        this.paletteTarget[index].set(hex);
      });
    }
    const blend = firstPalette ? 1 : 1 - Math.exp(-dtSec / PALETTE_BLEND_SEC);
    uniforms.u_palette.value.forEach((color, index) => {
      color.lerp(this.paletteTarget[index], blend);
    });
  }

  /**
   * Keeps the camera texture on the current video and fades it in and out. A camera that goes
   * away fades out on its last frame, then its texture is released.
   */
  private applyCamera(
    { video, mirror, presence }: FrameParams['camera'],
    time: number,
    dtSec: number,
  ): void {
    const uniforms = this.sceneUniforms;
    if (video && this.cameraTexture?.image !== video) {
      this.cameraTexture?.dispose();
      const texture = new THREE.VideoTexture(video);
      texture.generateMipmaps = true; // blur levels against sensor noise, and the frame's mean
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      this.cameraTexture = texture;
      this.cameraVersion = -1;
    }

    const texture = this.cameraTexture;
    const playing = !!video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
    if (texture && playing) {
      if (texture.version !== this.cameraVersion) {
        this.cameraVersion = texture.version;
        this.cameraVersionSec = time;
      } else if (time - this.cameraVersionSec > CAMERA_STALL_SEC) {
        texture.needsUpdate = true;
      }
      if (video.videoWidth > 0) uniforms.u_cameraRes.value.set(video.videoWidth, video.videoHeight);
    }

    const fade = 1 - Math.exp(-dtSec / CAMERA_FADE_SEC);
    const target = playing ? 1 : 0;
    const on = uniforms.u_cameraOn.value + (target - uniforms.u_cameraOn.value) * fade;
    uniforms.u_cameraOn.value = on < 0.002 && target === 0 ? 0 : on;
    uniforms.u_cameraMirror.value = mirror ? 1 : 0;
    uniforms.u_cameraPresence.value = presence;

    if (!video && texture && uniforms.u_cameraOn.value === 0) {
      texture.dispose();
      this.cameraTexture = null;
    }
    uniforms.u_camera.value = this.cameraTexture ?? this.noCamera;
  }

  private applyOverlay({ name, logoUrl, opacity, layout }: OverlayParams): void {
    const uniforms = this.compositeUniforms;
    uniforms.u_overlayOpacity.value = opacity;
    if (opacity <= 0) return;
    this.overlay.update(name, logoUrl);

    const screenAspect = this.drawingBufferSize.x / Math.max(1, this.drawingBufferSize.y);
    if (layout === 'corner') {
      const { width, marginX, marginY } = OVERLAY_LAYOUT.corner;
      const height = (width * screenAspect) / OVERLAY_ASPECT;
      uniforms.u_overlayRect.value.set(1 - marginX - width, marginY, width, height);
    } else {
      const { width } = OVERLAY_LAYOUT.centre;
      const height = (width * screenAspect) / OVERLAY_ASPECT;
      uniforms.u_overlayRect.value.set((1 - width) / 2, (1 - height) / 2, width, height);
    }
  }

  private materialFor(sceneId: SceneId): THREE.ShaderMaterial {
    let material = this.materials.get(sceneId);
    if (!material) {
      material = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: this.sceneUniforms,
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_HEADER + SCENE_SHADERS[sceneId] + FRAGMENT_FOOTER,
        depthTest: false,
        depthWrite: false,
      });
      this.materials.set(sceneId, material);
    }
    return material;
  }
}
