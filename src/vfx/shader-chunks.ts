/**
 * Every scene is a GLSL file that only defines `vec3 render(vec2 uv, vec2 p)`. The header adds the
 * shared uniforms and helpers, the footer a soft clip. Scenes render into textures; the composite
 * pass blends two of them (crossfade), lays the overlay on top and applies vignette, master level
 * and dither. three.js supplies `#version 300 es` and precision (GLSL3); the outputs are ours.
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
uniform float u_kick;       // raw: 1 on a low-end onset, decays in ~150 ms (off-beat bass too)
uniform float u_onset;      // same for percussive onsets
uniform float u_beat;       // 0..1 position in the beat, 0 = on the beat
uniform float u_pulse;      // beat-locked: 1 on every beat, ~120 ms decay; u_kick without a lock
uniform vec3  u_palette[4];
uniform sampler2D u_camera;     // live camera frame, with mipmaps
uniform float u_cameraOn;       // 0..1: eases in when frames arrive, out when the camera goes
uniform vec2  u_cameraRes;      // camera frame size in pixels
uniform float u_cameraMirror;   // 1 = mirrored like a selfie
uniform float u_cameraPresence; // 0..1: how strongly camera scenes show the camera (DJ's setting)

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

// ---- camera ---------------------------------------------------------------------------------

// Screen uv to camera uv: cropped to fill the screen (no bars), optionally mirrored.
vec2 cameraUv(vec2 uv) {
  float screenAspect = u_res.x / u_res.y;
  float cameraAspect = u_cameraRes.x / max(u_cameraRes.y, 1.0);
  vec2 c = uv - 0.5;
  if (cameraAspect > screenAspect) c.x *= screenAspect / cameraAspect;
  else c.y *= cameraAspect / screenAspect;
  c += 0.5;
  if (u_cameraMirror > 0.5) c.x = 1.0 - c.x;
  return c;
}

// What camera scenes show without a camera: a soft head-and-shoulders figure in drifting haze,
// so a scene picked by hand (or the preview) is never just black.
float cameraStandIn(vec2 uv) {
  vec2 q = vec2((uv.x - 0.5) * u_res.x / u_res.y, uv.y);
  q.x += 0.03 * sin(u_time * 0.7);
  float head = smoothstep(0.15, 0.12, length((q - vec2(0.0, 0.62)) * vec2(1.0, 0.85)));
  float body = smoothstep(0.36, 0.32, length((q - vec2(0.0, 0.08)) * vec2(0.85, 1.25)));
  float haze = fbm(uv * 3.0 + vec2(0.0, u_time * 0.05));
  return 0.12 + 0.25 * haze + 0.55 * max(head, body) * (0.6 + 0.4 * haze);
}

// Camera colour at screen uv. lod > 0 blurs (a mip level): smooths out sensor noise in the dark.
// Auto gain lifts a dark booth to a usable level (from the mean of the frame, its smallest mip);
// highlights roll off instead of clipping, so a face lit by an LED keeps its eyes and mouth.
vec3 cameraColor(vec2 uv, float lod) {
  vec3 frame = textureLod(u_camera, cameraUv(uv), lod).rgb;
  vec3 mean = textureLod(u_camera, vec2(0.5), 16.0).rgb;
  float gain = clamp(0.42 / max(dot(mean, vec3(0.2126, 0.7152, 0.0722)), 0.02), 1.0, 5.0);
  vec3 live = 1.0 - exp(-1.6 * frame * gain);
  return mix(vec3(cameraStandIn(uv)), live, u_cameraOn);
}

float cameraLuma(vec2 uv, float lod) {
  return dot(cameraColor(uv, lod), vec3(0.2126, 0.7152, 0.0722));
}

// Stretches a camera value around the frame's mean (~0.45 after auto gain): darker parts drop
// away, lit parts stand out. More presence, more contrast, so the DJ reads from across the room.
float cameraContrast(float luma) {
  return clamp(0.45 + (luma - 0.45) * mix(1.0, 2.0, u_cameraPresence), 0.0, 1.0);
}

// Luma with local detail boosted (an unsharp mask: the image minus a blurred copy). Eyes,
// headphones and the edge of a jog wheel are local differences; this keeps them readable when a
// scene breaks the image into dots or symbols. More presence, more detail.
float cameraLumaDetail(vec2 uv, float lod) {
  float sharp = cameraLuma(uv, lod);
  float soft = cameraLuma(uv, lod + 3.0);
  return sharp + (sharp - soft) * mix(0.6, 2.2, u_cameraPresence);
}

// Luma balanced against its surroundings (retinex-style): each spot is compared with a heavily
// blurred copy, not with the whole frame. A face in front of a bright wall, which the camera
// exposes for the wall, comes up to a readable level and keeps its features; flat areas settle
// in the middle. Presence decides how much of this replaces the plain image.
float cameraLumaLocal(vec2 uv, float lod) {
  float plain = clamp(cameraLumaDetail(uv, lod), 0.0, 1.0);
  float surround = cameraLuma(uv, lod + 4.5);
  float balanced = clamp(0.42 * (plain + 0.03) / (surround + 0.03), 0.0, 1.0);
  return mix(plain, balanced, mix(0.05, 0.3, u_cameraPresence));
}

vec3 render(vec2 uv, vec2 p);
`;

export const FRAGMENT_FOOTER = /* glsl */ `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;   // centred, height = 1
  vec3 col = render(uv, p);
  fragColor = vec4(1.0 - exp(-1.4 * max(col, 0.0)), 1.0);   // soft clip instead of hard white
}
`;

/** Blends two rendered scenes, adds the overlay, then vignette, master level and dither. */
export const COMPOSITE_SHADER = /* glsl */ `
out vec4 fragColor;

uniform vec2      u_res;
uniform float     u_time;
uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float     u_mix;            // 0 = from, 1 = to
uniform sampler2D u_overlay;
uniform float     u_overlayOpacity;
uniform vec4      u_overlayRect;    // x, y, width, height in screen uv (origin bottom left)
uniform float     u_intensity;      // master level, start-up fade, blackout, flash guard

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec3 col = mix(texture(u_from, uv).rgb, texture(u_to, uv).rgb, u_mix);

  vec2 o = (uv - u_overlayRect.xy) / u_overlayRect.zw;
  if (u_overlayOpacity > 0.0 && o.x >= 0.0 && o.y >= 0.0 && o.x <= 1.0 && o.y <= 1.0) {
    vec4 mark = texture(u_overlay, o);
    col = mix(col, mark.rgb, mark.a * u_overlayOpacity);
  }

  col *= 1.0 - 0.45 * dot(uv - 0.5, uv - 0.5);                      // gentle vignette
  col *= u_intensity;
  col += (hash21(gl_FragCoord.xy + fract(u_time)) - 0.5) / 255.0;   // dither against banding
  fragColor = vec4(col, 1.0);
}
`;
