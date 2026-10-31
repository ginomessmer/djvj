import { AMBIENT_ID, findScene, type SceneDef } from '../scenes';
import { FRAG_FOOTER, FRAG_HEADER, VERT_SRC } from './shader-common';

/** Default pixel budget: 1080p. Bigger screens are upscaled; this keeps the GPU (and rekordbox) calm. */
const PIXEL_BUDGET = 1920 * 1080;

const UNIFORM_NAMES = [
  'u_res',
  'u_time',
  'u_flow',
  'u_bands',
  'u_energy',
  'u_kick',
  'u_onset',
  'u_palette',
  'u_intensity',
  'u_seed',
] as const;
type UniformName = (typeof UNIFORM_NAMES)[number];

interface Compiled {
  program: WebGLProgram;
  loc: Record<UniformName, WebGLUniformLocation | null>;
}

export interface FrameUniforms {
  time: number;
  flow: number;
  bands: number[];
  energy: number;
  kick: number;
  onset: number;
  palette: Float32Array;
  intensity: number;
  seed: number;
}

export class Renderer {
  private readonly gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject | null = null;
  private readonly cache = new Map<string, Compiled>();
  private lost = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;
    this.init();

    // GPUs reset (sleep/wake, display hot-plug). Recover instead of freezing on stage.
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.cache.clear();
      this.init();
      this.lost = false;
    });
  }

  private init(): void {
    this.vao = this.gl.createVertexArray();
  }

  /** Match the backing store to the displayed size, capped to a pixel budget relative to 1080p. */
  resize(budgetScale: number): [number, number] {
    const dpr = window.devicePixelRatio || 1;
    let w = this.canvas.clientWidth * dpr;
    let h = this.canvas.clientHeight * dpr;
    const maxPixels = PIXEL_BUDGET * budgetScale;
    if (w * h > maxPixels) {
      const s = Math.sqrt(maxPixels / (w * h));
      w *= s;
      h *= s;
    }
    w = Math.max(2, Math.round(w));
    h = Math.max(2, Math.round(h));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return [w, h];
  }

  render(scene: SceneDef, u: FrameUniforms): void {
    if (this.lost) return;
    const { gl } = this;
    const c = this.compiled(scene);

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(c.program);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(c.loc.u_res, this.canvas.width, this.canvas.height);
    gl.uniform1f(c.loc.u_time, u.time);
    gl.uniform1f(c.loc.u_flow, u.flow);
    gl.uniform1fv(c.loc.u_bands, u.bands);
    gl.uniform1f(c.loc.u_energy, u.energy);
    gl.uniform1f(c.loc.u_kick, u.kick);
    gl.uniform1f(c.loc.u_onset, u.onset);
    gl.uniform3fv(c.loc.u_palette, u.palette);
    gl.uniform1f(c.loc.u_intensity, u.intensity);
    gl.uniform1f(c.loc.u_seed, u.seed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Compile lazily. A broken scene falls back to the ambient one instead of taking the show down. */
  private compiled(scene: SceneDef): Compiled {
    const cached = this.cache.get(scene.id);
    if (cached) return cached;
    try {
      const compiled = this.compile(scene);
      this.cache.set(scene.id, compiled);
      return compiled;
    } catch (err) {
      if (scene.id === AMBIENT_ID) throw err;
      console.error(`[djvj] scene "${scene.id}" failed to compile, using ambient instead`, err);
      const fallback = this.compiled(findScene(AMBIENT_ID));
      this.cache.set(scene.id, fallback);
      return fallback;
    }
  }

  private compile(scene: SceneDef): Compiled {
    const { gl } = this;
    const vs = this.shader(gl.VERTEX_SHADER, VERT_SRC, 'vertex');
    const fs = this.shader(gl.FRAGMENT_SHADER, FRAG_HEADER + scene.source + FRAG_FOOTER, scene.id);
    const program = gl.createProgram();
    if (!program) throw new Error('createProgram failed');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Link error in "${scene.id}": ${log}`);
    }
    const loc = {} as Record<UniformName, WebGLUniformLocation | null>;
    for (const name of UNIFORM_NAMES) loc[name] = gl.getUniformLocation(program, name);
    return { program, loc };
  }

  private shader(type: number, source: string, label: string): WebGLShader {
    const { gl } = this;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('createShader failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader error in "${label}": ${log}`);
    }
    return shader;
  }
}
