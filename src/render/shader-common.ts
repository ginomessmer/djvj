/**
 * Every scene is a GLSL file that only defines `vec3 render(vec2 uv, vec2 p)`.
 * This header/footer wraps it with the shared uniforms, helpers and the final tone-map / fade.
 */

export const VERT_SRC = `#version 300 es
void main() {
  // One oversized triangle that covers the screen; no vertex buffers needed.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const FRAG_HEADER = `#version 300 es
precision highp float;

uniform vec2  u_res;        // render target size in pixels
uniform float u_time;       // wall-clock seconds
uniform float u_flow;       // "travel" distance: time integrated with audio energy, always smooth
uniform float u_bands[5];   // sub, bass, mid, high-mid, high   (0..1, smoothed)
uniform float u_energy;     // overall energy (0..1, slow)
uniform float u_kick;       // 1 on a kick, decays in ~150 ms
uniform float u_onset;      // same for percussive onsets
uniform vec3  u_palette[4];
uniform float u_intensity;  // master brightness * fades
uniform float u_seed;

out vec4 fragColor;

// Smoothly cycle through the four palette colours: t in [0, 1) wraps.
vec3 pal(float t) {
  float x = fract(t) * 4.0;
  int i = int(floor(x));
  float f = smoothstep(0.0, 1.0, fract(x));
  return mix(u_palette[i & 3], u_palette[(i + 1) & 3], f);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return v;
}

vec3 render(vec2 uv, vec2 p);
`;

export const FRAG_FOOTER = `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;   // centred, height = 1
  vec3 col = render(uv, p);

  col = 1.0 - exp(-1.4 * max(col, 0.0));                 // soft clip instead of hard white
  col *= 1.0 - 0.45 * dot(uv - 0.5, uv - 0.5);            // gentle vignette
  col *= u_intensity;                                      // master level + scene fades
  col += (hash21(gl_FragCoord.xy + fract(u_time)) - 0.5) / 255.0;   // dither against banding
  fragColor = vec4(col, 1.0);
}
`;
