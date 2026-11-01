import * as THREE from 'three';
import { BAND_COUNT } from '@/domain/audio/bands';
import { SAFE_SCENE_ID, type SceneId } from '@/domain/show/scenes';
import type { FrameParams } from './frame-params';
import { SCENE_SHADERS } from './scenes';
import { FRAGMENT_FOOTER, FRAGMENT_HEADER, VERTEX_SHADER } from './shader-chunks';

// Palette hex values are used as-is by the shaders, without three.js colour conversion.
THREE.ColorManagement.enabled = false;

/** Default pixel budget: 1080p. Bigger screens are upscaled; this keeps the GPU calm. */
const PIXEL_BUDGET = 1920 * 1080;
const PALETTE_SIZE = 4;

/**
 * Draws one fullscreen fragment-shader scene per frame into a canvas it appends to `container`.
 * Shader compile errors fall back to the safe scene instead of leaving the screen dead.
 */
export class Stage {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh;
  private readonly materials = new Map<SceneId, THREE.ShaderMaterial>();
  private readonly brokenScenes = new Set<SceneId>();
  private readonly drawingBufferSize = new THREE.Vector2();
  private activeSceneId: SceneId = SAFE_SCENE_ID;
  private paletteId = '';

  /** Shared by all scene materials: set once per frame. */
  private readonly uniforms = {
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
    this.renderer.debug.onShaderError = (gl, program, _vertex, fragment) => {
      this.brokenScenes.add(this.activeSceneId);
      console.error(
        `[djvj] scene "${this.activeSceneId}" failed to compile, using the safe scene instead`,
        gl.getProgramInfoLog(program),
        gl.getShaderInfoLog(fragment),
      );
    };
    container.appendChild(this.renderer.domElement);

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  /**
   * Match the drawing buffer to the displayed size, capped at the pixel budget (1080p x scale).
   * @returns the drawing buffer size in pixels
   */
  resize(budgetScale: number): [width: number, height: number] {
    const dpr = window.devicePixelRatio || 1;
    let width = this.container.clientWidth * dpr;
    let height = this.container.clientHeight * dpr;
    const maxPixels = PIXEL_BUDGET * budgetScale;
    if (width * height > maxPixels) {
      const shrink = Math.sqrt(maxPixels / (width * height));
      width *= shrink;
      height *= shrink;
    }
    width = Math.max(2, Math.round(width));
    height = Math.max(2, Math.round(height));

    this.renderer.getDrawingBufferSize(this.drawingBufferSize);
    if (this.drawingBufferSize.x !== width || this.drawingBufferSize.y !== height) {
      this.renderer.setSize(width, height, false);
    }
    this.uniforms.u_res.value.set(width, height);
    return [width, height];
  }

  render(sceneId: SceneId, frame: FrameParams): void {
    this.applyFrame(frame);
    this.draw(this.brokenScenes.has(sceneId) ? SAFE_SCENE_ID : sceneId);
    // The scene may have failed to compile during that draw: show the safe one right away.
    if (this.activeSceneId !== SAFE_SCENE_ID && this.brokenScenes.has(this.activeSceneId)) {
      this.draw(SAFE_SCENE_ID);
    }
  }

  dispose(): void {
    for (const material of this.materials.values()) material.dispose();
    this.quad.geometry.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private draw(sceneId: SceneId): void {
    this.activeSceneId = sceneId;
    this.quad.material = this.materialFor(sceneId);
    this.renderer.render(this.scene, this.camera);
  }

  private applyFrame({ time, flow, features, rhythm, palette, intensity }: FrameParams): void {
    const { uniforms } = this;
    uniforms.u_time.value = time;
    uniforms.u_flow.value = flow;
    uniforms.u_energy.value = features.energy;
    uniforms.u_kick.value = features.kick;
    uniforms.u_onset.value = features.onset;
    uniforms.u_beat.value = rhythm.beatPhase;
    uniforms.u_pulse.value = rhythm.pulse;
    uniforms.u_intensity.value = intensity;
    features.bands.forEach((level, band) => {
      uniforms.u_bands.value[band] = level;
    });

    if (palette.id !== this.paletteId) {
      this.paletteId = palette.id;
      palette.colors.forEach((hex, index) => {
        uniforms.u_palette.value[index].set(hex);
      });
    }
  }

  private materialFor(sceneId: SceneId): THREE.ShaderMaterial {
    let material = this.materials.get(sceneId);
    if (!material) {
      material = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: this.uniforms,
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
