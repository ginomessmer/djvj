/**
 * Every scene is a GLSL file that only defines `vec3 render(vec2 uv, vec2 p)`. The header adds the
 * shared uniforms and helpers, the footer a soft clip. Scenes render into textures; the composite
 * pass blends two of them (crossfade), styles the headline text with them, lays the corner mark on
 * top and applies vignette, master level and dither. three.js supplies `#version 300 es` and precision (GLSL3); the outputs are ours.
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
// Auto gain lifts a dark booth to a usable level (from the mean of the frame, its smallest mip).
vec3 cameraColor(vec2 uv, float lod) {
  vec3 frame = textureLod(u_camera, cameraUv(uv), lod).rgb;
  vec3 mean = textureLod(u_camera, vec2(0.5), 16.0).rgb;
  float gain = clamp(0.42 / max(dot(mean, vec3(0.2126, 0.7152, 0.0722)), 0.02), 1.0, 5.0);
  vec3 live = clamp(frame * gain, 0.0, 1.0);
  return mix(vec3(cameraStandIn(uv)), live, u_cameraOn);
}

float cameraLuma(vec2 uv, float lod) {
  return dot(cameraColor(uv, lod), vec3(0.2126, 0.7152, 0.0722));
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

/**
 * Blends two rendered scenes, styles the headline text with them, adds the corner mark, then
 * vignette, master level and dither.
 */
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
uniform vec3      u_palette[4];
uniform float     u_pulse;          // beat-locked pulse, damped by the flash guard
uniform float     u_bass;
uniform float     u_beat;           // 0..1 position in the beat

// Headline text: a texture with fill (r), outline (g) and logo detail (b), mipmapped for glow.
uniform sampler2D u_text;
uniform float u_textOpacity;
uniform int   u_textStyle;          // 0 neon, 1 chrome, 2 glass, 3 soft, 4 glitch, 5 invert
uniform vec4  u_textRect;           // the text box in screen uv
uniform float u_textLod;            // mip level that matches the box's size on screen
uniform float u_textScale;
uniform float u_textShake;
uniform float u_textSplit;
uniform float u_textDissolve;
uniform float u_textGlow;
uniform int   u_glyphCount;
uniform float u_glyphEdge[41];      // where letter i starts (box x), last = end
uniform float u_glyphLift[40];      // per letter, in box heights
uniform float u_glyphAlpha[40];

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}

vec3 pal(float t) {
  float x = fract(t) * 4.0;
  int i = int(floor(x));
  float f = smoothstep(0.0, 1.0, fract(x));
  return mix(u_palette[i & 3], u_palette[(i + 1) & 3], f);
}

vec3 sceneAt(vec2 uv) {
  return mix(texture(u_from, uv).rgb, texture(u_to, uv).rgb, u_mix);
}

// Which letter column x (box coordinates) falls into.
int glyphAt(float x) {
  int g = 0;
  for (int i = 1; i < 40; i++) {
    if (i >= u_glyphCount) break;
    if (x >= u_glyphEdge[i]) g = i;
  }
  return g;
}

// Fill, outline and detail of letter g at o (box coordinates); lod > base blurs.
vec3 textAt(vec2 o, float lod, int g) {
  o.y -= u_glyphLift[g];
  return textureLod(u_text, o, lod).rgb * u_glyphAlpha[g];
}

// A wide soft halo around the letters, from blurred mip levels.
float haloAt(vec2 o, int g) {
  return 0.35 * textAt(o, u_textLod + 3.0, g).r
       + 0.45 * textAt(o, u_textLod + 4.5, g).r
       + 0.55 * textAt(o, u_textLod + 6.0, g).r;
}

vec3 applyText(vec3 col, vec2 uv) {
  vec2 o = (uv - u_textRect.xy) / u_textRect.zw;
  o = (o - 0.5) / u_textScale + 0.5;
  float jitter = floor(u_time * 24.0);
  o += (vec2(hash21(vec2(jitter, 1.0)), hash21(vec2(jitter, 2.0))) - 0.5)
     * u_textShake * vec2(0.012, 0.05);
  if (o.x < -0.05 || o.x > 1.05 || o.y < -0.1 || o.y > 1.1) return col;

  bool glitch = u_textStyle == 4;
  if (glitch) {
    // Slices slip sideways, more on the bass.
    float row = floor(o.y * 14.0);
    float h = hash21(vec2(row, floor(u_time * 9.0)));
    o.x += step(0.72, h) * (h - 0.86) * (0.15 + 0.35 * u_bass + 0.3 * u_textGlow);
  }

  int g = glyphAt(o.x);
  vec3 t = textAt(o, u_textLod, g);
  float halo = haloAt(o, g);

  // Leaving: noise eats the letters, starting with the thin parts.
  float grain = vnoise(o * vec2(64.0, 16.0)) * 0.7 + vnoise(o * vec2(9.0, 2.5)) * 0.3;
  float keep = 1.0 - smoothstep(grain - 0.06, grain + 0.06, u_textDissolve * 1.15);
  float a = u_textOpacity * keep;
  float fill = t.r * a;
  float line = t.g * a;
  float glow = halo * a;

  // A soft shadow behind the letters keeps them readable over a busy scene.
  float scrim = u_textStyle == 2 || u_textStyle == 5 ? 0.25 : 0.55;
  col *= 1.0 - scrim * clamp(halo * 1.4, 0.0, 1.0) * u_textOpacity;

  if (u_textStyle == 0) {
    // neon: white-hot tubes along the outline, the colour walks along the word
    vec3 tube = pal(o.x * 0.45 + u_time * 0.03);
    col += tube * fill * 0.1;
    col += mix(tube, vec3(1.0), 0.55) * line * 1.25;
    col += tube * glow * (0.7 + 1.1 * u_textGlow);
  } else if (u_textStyle == 1) {
    // chrome: sky above the horizon line, ground below, a highlight sweeps on every beat
    float y = clamp((o.y - u_glyphLift[g] - 0.3) / 0.4, 0.0, 1.0);
    vec3 sky = mix(mix(u_palette[1], vec3(1.0), 0.5), vec3(1.0), smoothstep(0.55, 1.0, y));
    vec3 ground = mix(u_palette[3] * 0.35, mix(u_palette[2], vec3(1.0), 0.25), y * 2.0);
    vec3 metal = y > 0.5 ? sky : ground;
    metal += smoothstep(0.035, 0.0, abs(y - 0.5)) * 0.9;
    float sweep = fract(o.x * 0.5 - o.y * 0.25 - u_beat);
    metal += smoothstep(0.06, 0.0, abs(sweep - 0.5)) * 0.6 * (0.4 + u_textGlow);
    col = mix(col, metal, fill);
    col += mix(u_palette[0], vec3(1.0), 0.4) * line * 0.6;
    col += u_palette[1] * glow * (0.12 + 0.35 * u_textGlow);
  } else if (u_textStyle == 2) {
    // glass: the letters bend the scene behind them like thick glass, lit from the top left
    float e = 0.004;
    float lod = u_textLod + 3.0;
    vec2 n = vec2(
      textAt(o + vec2(e, 0.0), lod, g).r - textAt(o - vec2(e, 0.0), lod, g).r,
      textAt(o + vec2(0.0, 4.0 * e), lod, g).r - textAt(o - vec2(0.0, 4.0 * e), lod, g).r);
    vec2 bend = n * vec2(1.0, 0.25) * (0.05 + 0.04 * u_textGlow);
    // Frosted: a tint of its own, so the glass still reads over a black part of the scene.
    vec3 frost = mix(u_palette[1], vec3(1.0), 0.55);
    vec3 through = sceneAt(uv - bend) * 1.3 + frost * 0.2;
    float spec = smoothstep(0.15, 0.6, dot(n, vec2(-0.6, 0.8)));
    col = mix(col, through + spec * 0.8, fill);
    col += frost * line * 0.55 + u_palette[1] * glow * 0.2 * (0.5 + u_textGlow);
  } else if (u_textStyle == 3) {
    // soft: light letters tinted by the palette, breathing in a wide glow
    vec3 ink = mix(vec3(1.0), pal(0.15 + o.x * 0.2), 0.3);
    col = mix(col, ink, fill * 0.92);
    col += ink * glow * (0.35 + 0.35 * u_textGlow);
  } else if (glitch) {
    // glitch: red and blue copies pulled apart on the bass, over scanlines
    vec2 d = vec2(0.006 + 0.02 * u_bass + 0.01 * u_textGlow, 0.0);
    float r = textAt(o + d, u_textLod, g).r * a;
    float b = textAt(o - d, u_textLod, g).r * a;
    vec3 ink = vec3(r, fill, b) * mix(vec3(1.0), pal(0.1), 0.25);
    float scan = 0.75 + 0.25 * sin(gl_FragCoord.y * 1.7);
    col = col * (1.0 - max(max(r, b), fill)) + ink * scan * 1.15;
    col += pal(0.6) * glow * 0.25;
  } else {
    // invert: the letters turn the scene inside out
    vec3 inside = clamp(vec3(1.0) - col * 1.2, 0.0, 1.0) + u_palette[2] * 0.1;
    col = mix(col, inside, fill);
    col += vec3(1.0) * line * 0.25;
  }

  if (u_textSplit > 0.001) {
    // Colour fringes, for the slam of a drop.
    vec2 d = vec2(0.03 * u_textSplit, 0.0);
    float l = textAt(o + d, u_textLod, g).r;
    float r = textAt(o - d, u_textLod, g).r;
    col += a * u_textSplit * (u_palette[0] * l + u_palette[2] * r) * 0.8;
  }
  return col;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec3 col = sceneAt(uv);

  if (u_textOpacity > 0.0) col = applyText(col, uv);

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
