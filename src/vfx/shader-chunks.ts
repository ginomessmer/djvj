/**
 * Every scene is a GLSL file that only defines `vec3 render(vec2 uv, vec2 p)`. The header adds the
 * shared uniforms and helpers; the footer adds tone mapping, vignette, master level and dither.
 * three.js supplies `#version 300 es` and precision (GLSL3 mode); the fragment output is ours.
 */

export const VERTEX_SHADER = /* glsl */ `
void main() {
  // The quad already spans -1..1: skip the camera matrices.
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const FRAGMENT_HEADER = /* glsl */ `
out vec4 fragColor;

uniform vec2  u_res;        // render target size in pixels
uniform float u_time;       // wall-clock seconds
uniform float u_flow;       // travel distance: time integrated with audio energy, always smooth
uniform float u_bands[5];   // sub, bass, mid, high-mid, high   (0..1, smoothed)
uniform float u_energy;     // overall energy (0..1, slow)
uniform float u_kick;       // 1 on a low-end onset, decays in ~150 ms
uniform float u_onset;      // same for percussive onsets
uniform vec3  u_palette[4];
uniform float u_intensity;  // master brightness * fades

// Smoothly cycle through the four palette colours: t wraps at 1.
vec3 pal(float t) {
  float x = fract(t) * 4.0;
  int i = int(floor(x));
  float f = smoothstep(0.0, 1.0, fract(x));
  return mix(u_palette[i & 3], u_palette[(i + 1) & 3], f);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
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

export const FRAGMENT_FOOTER = /* glsl */ `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;   // centred, height = 1
  vec3 col = render(uv, p);

  col = 1.0 - exp(-1.4 * max(col, 0.0));                 // soft clip instead of hard white
  col *= 1.0 - 0.45 * dot(uv - 0.5, uv - 0.5);            // gentle vignette
  col *= u_intensity;                                      // master level and scene fades
  col += (hash21(gl_FragCoord.xy + fract(u_time)) - 0.5) / 255.0;   // dither against banding
  fragColor = vec4(col, 1.0);
}
`;
