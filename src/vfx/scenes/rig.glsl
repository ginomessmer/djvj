// Light rig: a festival stage seen from inside the crowd. Moving heads on the truss cut beams
// through the haze and switch between fans, crosses and sweeps; a head that aims at you flares.
// Behind them a wall of LED battens runs chases, strobes on the truss fire on the beat at peak
// energy, and the crowd in front is backlit, jumping and with hands up on the kicks.
// The strobes are small fixtures, not the whole screen, and ride the beat pulse, so the flash
// guard damps them like any other pulse.
const int HEADS = 8;
const float TRUSS_Y = 7.0;
const float TRUSS_Z = 12.0;
const float WALL_Z = 16.0;

float sdBox(vec2 p, vec2 size) {
  vec2 d = abs(p) - size;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float capsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

vec3 headPos(int i) {
  return vec3((float(i) - 3.5) * 2.2, TRUSS_Y, TRUSS_Z);
}

// Where head i points in each look: 0 fans down into the crowd, 1 crosses up into the sky,
// 2 sweeps all together.
vec3 look(int pattern, int i, float t) {
  float fi = float(i);
  float k = (fi - 3.5) / 3.5;
  if (pattern == 0) return vec3(k * 0.45 + 0.15 * sin(t + fi), -0.95 + 0.25 * sin(t * 0.7 + fi * 0.5), -1.0);
  if (pattern == 1) return vec3(-sign(k) * (0.45 + 0.2 * sin(t * 0.8)), 1.0, -0.3 + 0.2 * sin(t + fi));
  return vec3(0.6 * sin(t * 0.9) + 0.1 * k, -0.8 + 0.2 * sin(t * 0.6), -1.0);
}

vec3 headDir(int i) {
  float t = u_flow * 0.45;
  float phase = u_flow * 0.035;
  float a = floor(phase);
  float blend = smoothstep(0.7, 1.0, fract(phase));
  vec3 from = look(int(mod(a, 3.0)), i, t);
  vec3 to = look(int(mod(a + 1.0, 3.0)), i, t);
  return normalize(mix(from, to, blend));
}

vec3 headTint(int i) {
  return mix(pal(float(i) / float(HEADS) * 0.5 + u_flow * 0.01), vec3(1.0), 0.15);
}

// How hard head i plays: a chase through the rig below the peak, all on at the peak.
float headLevel(int i) {
  float chase = 0.5 + 0.5 * cos((float(i) / float(HEADS) - u_flow * 0.1) * 6.2831);
  float all = smoothstep(0.5, 0.8, u_energy);
  return mix(0.2 + 0.8 * chase, 1.0, all) * (0.7 + 0.5 * u_bands[i % 5]) + 0.3 * u_pulse;
}

// Light scattered towards the eye by one beam in the haze, from the closest approach of the view
// ray to the beam's axis.
vec3 beam(vec3 ro, vec3 rd, int i) {
  vec3 o = headPos(i);
  vec3 d = headDir(i);
  vec3 w = ro - o;
  float b = dot(rd, d);
  float denom = max(1.0 - b * b, 1e-4);
  float rw = dot(rd, w);
  float e = dot(d, w);
  float t = max((b * e - rw) / denom, 0.0);
  float s = max((e - b * rw) / denom, 0.0);
  vec3 pb = o + d * s;
  float dist = length(ro + rd * t - pb);
  float width = 0.06 + s * 0.035;
  float core = exp(-dist * dist / (width * width)) * (0.11 / width);
  float atten = exp(-s * 0.04);
  if (d.y < 0.0) atten *= smoothstep(-o.y / d.y, -o.y / d.y - 1.5, s);   // the floor stops it
  float haze = 0.35 + 0.9 * vnoise(vec2(pb.x * 0.3 + pb.z * 0.2, pb.y * 0.3) + vec2(u_flow * 0.25, 0.0));
  float glare = pow(max(dot(-rd, d), 0.0), 24.0);                      // looking down the beam
  return headTint(i) * core * atten * haze * (1.0 + 5.0 * glare) * headLevel(i);
}

// Screen-space offset of direction rd from the direction towards point x (both seen from ro).
vec2 offsetTo(vec3 ro, vec3 rd, vec3 x) {
  vec3 to = x - ro;
  return rd.xy / rd.z - to.xy / to.z;
}

// The LED wall: vertical battens of pixels on the back wall, with bloom.
vec3 battens(vec3 ro, vec3 rd) {
  if (rd.z <= 0.0) return vec3(0.0);
  vec3 hit = ro + rd * ((WALL_Z - ro.z) / rd.z);
  if (hit.y < 0.0 || hit.y > 6.4 || abs(hit.x) > 11.0) return vec3(0.0);
  float bx = hit.x / 1.25 + 0.5;
  float id = floor(bx);
  float dx = (fract(bx) - 0.5) * 1.25;
  float px = fract(hit.y * 4.0);
  float pixel = smoothstep(0.5, 0.3, abs(px - 0.5));
  float core = exp(-dx * dx / 0.018) * pixel * 1.6;
  float bloom = exp(-abs(dx) * 3.0) * 0.22;
  float seg = floor(hit.y * 4.0);
  // Two chases: one rising up the battens, one sweeping across them.
  float rise = pow(fract(hit.y * 0.12 - u_flow * 0.28 + id * 0.04), 5.0);
  float across = pow(0.5 + 0.5 * cos(id * 0.6 - u_flow * 0.9), 6.0);
  float level = 0.08 + 0.9 * max(rise, across * 0.8) * (0.5 + 0.7 * u_bands[int(mod(abs(id), 5.0))]);
  float sparkle = step(0.985, hash21(vec2(id * 7.0 + seg, floor(u_time * 10.0)))) * smoothstep(0.6, 0.9, u_energy);
  vec3 tint = pal(0.45 + hit.y * 0.06 + id * 0.02 + u_flow * 0.015);
  return tint * level * (core + bloom) + vec3(1.0) * sparkle * core * 0.8;
}

// One row of the crowd as a signed distance: heads, shoulders, some hands up (a phone or two).
float crowd(vec2 p, float rowY, float scale, float seed, float jump, out float phone) {
  phone = 0.0;
  float x = p.x / scale + seed * 13.0;
  float id = floor(x);
  float d = 1e3;
  for (int k = -1; k <= 1; k++) {
    float c = id + float(k);
    float h = hash21(vec2(c, seed));
    float cx = (c + 0.5 + (h - 0.5) * 0.5 - seed * 13.0) * scale;
    float bounce = jump * (0.4 + 0.6 * hash21(vec2(c, seed + 3.0))) * scale * 0.35;
    vec2 head = vec2(cx, rowY + scale * (0.5 + 0.3 * h) + bounce);
    d = smin(d, length((p - head) * vec2(1.0, 0.85)) - scale * 0.36, scale * 0.15);
    d = smin(d, sdBox(p - vec2(cx, rowY - scale * 1.6 + bounce), vec2(scale * 0.5, scale * 1.6)) - scale * 0.25, scale * 0.3);
    if (h > 0.5) {
      float side = h > 0.75 ? 1.0 : -1.0;
      vec2 shoulder = vec2(cx + side * scale * 0.42, rowY + scale * 0.05 + bounce);
      float wave = 0.25 * sin(u_time * 1.7 + h * 40.0);
      vec2 hand = shoulder + vec2(side * scale * (0.3 + wave), scale * (1.3 + 0.5 * jump));
      d = smin(d, capsule(p, shoulder, hand, scale * 0.1), scale * 0.08);
      if (hash21(vec2(c, seed + 7.0)) > 0.8) {
        phone = max(phone, step(sdBox(p - hand - vec2(0.0, scale * 0.2), vec2(scale * 0.1, scale * 0.17)), 0.0));
      }
    }
  }
  return d;
}

vec3 render(vec2 uv, vec2 p) {
  vec3 ro = vec3(0.25 * sin(u_time * 0.21), 1.7 + 0.05 * u_pulse * u_energy, 0.0);
  vec3 rd = normalize(vec3(p.x, p.y + 0.12, 1.1));

  vec3 col = pal(0.7) * 0.012 + vec3(0.004, 0.002, 0.01);
  col += battens(ro, rd);
  // Haze lit by the wall: a soft glow over the stage.
  col += pal(0.5) * 0.12 * exp(-abs(p.y + 0.02) * 4.0) * (0.6 + 0.5 * u_energy)
       * (0.6 + 0.6 * vnoise(p * 3.0 + vec2(u_flow * 0.1, 0.0)));

  // Truss: a dark lattice bar with the heads hanging under it.
  vec2 truss = offsetTo(ro, rd, vec3(0.0, TRUSS_Y + 0.35, TRUSS_Z));
  float bar = sdBox(truss, vec2(0.86, 0.022));
  if (bar < 0.0) {
    float lattice = smoothstep(0.08, 0.0, abs(fract((truss.x + abs(truss.y)) * 30.0) - 0.5) - 0.38);
    col = vec3(0.012) + pal(0.4) * 0.04 * lattice;
  }

  for (int i = 0; i < HEADS; i++) {
    col += beam(ro, rd, i);
    // The head itself: a hot lens, flaring wide (with a streak) when it aims at you.
    vec3 o = headPos(i);
    vec2 off = offsetTo(ro, rd, o - vec3(0.0, 0.25, 0.0));
    float aim = pow(max(dot(headDir(i), normalize(ro - o)), 0.0), 6.0);
    float r = length(off);
    vec3 tint = headTint(i) * headLevel(i);
    col += mix(tint, vec3(1.0), 0.6) * smoothstep(0.012, 0.006, r);
    col += tint * (exp(-r * 45.0) * 0.35 + exp(-r * 9.0) * 0.6 * aim);
    col += tint * exp(-abs(off.y) * 300.0) * exp(-abs(off.x) * 4.0) * 0.5 * aim;
  }

  // Strobes between the heads: they fire on the beat at peak energy, a few at a time.
  float gate = smoothstep(0.45, 0.75, u_energy) * (0.5 + 0.5 * u_bands[4]);
  float flash = u_pulse * u_pulse * u_pulse * gate;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 off = offsetTo(ro, rd, vec3((fi - 1.5) * 4.4, TRUSS_Y + 0.35, TRUSS_Z - 0.3));
    float panel = sdBox(off, vec2(0.03, 0.011));
    float f = flash * step(0.4, hash21(vec2(fi, floor(u_flow * 0.5))));
    float grille = 0.75 + 0.25 * step(0.5, fract(off.x * 180.0));
    col = panel < 0.0 ? (vec3(0.1) + vec3(1.8) * f) * grille : col;
    col += vec3(0.92, 0.96, 1.0) * f * (exp(-max(panel, 0.0) * 28.0) * 0.6 + exp(-max(panel, 0.0) * 6.0) * 0.12);
  }

  // The crowd: a far row in the haze and a near row in silhouette, rim-lit by the stage.
  float jump = u_pulse * smoothstep(0.4, 0.8, u_energy);
  float aa = 1.5 / u_res.y;
  float phone;
  float far = crowd(p, -0.31, 0.045, 0.37, jump * 0.6, phone);
  col = mix(col, pal(0.5) * 0.04 + vec3(0.01), smoothstep(aa, -aa, far));
  col += vec3(0.7, 0.85, 1.0) * phone * 0.6;
  float near = crowd(p, -0.42, 0.085, 0.81, jump, phone);
  float body = smoothstep(aa, -aa, near);
  vec3 rim = pal(0.45 + p.x * 0.2) * exp(-abs(near) * 260.0) * 0.35 * (0.6 + 0.6 * u_energy);
  rim *= smoothstep(-0.48, -0.36, p.y);
  col = mix(col, vec3(0.004), body) + rim * step(-0.004, near) * (1.0 - body * 0.5);
  col += vec3(0.75, 0.88, 1.0) * phone * 0.9;
  return col;
}
