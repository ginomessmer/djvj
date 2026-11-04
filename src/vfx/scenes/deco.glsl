// Ocean drive: cruising past art deco beach hotels at dusk. Pastel facades with eyebrow ledges,
// stepped towers and neon fins slide by under a sunset sky, palms sweep past in front, and light
// trails run along the wet street that mirrors it all. The neon and the lit windows follow the
// music; the cruise speeds up with it.
const float STREET = -0.2;
const float KERB = -0.235;

vec3 pastel(float k) {
  int i = int(mod(k, 6.0));
  if (i == 0) return vec3(1.0, 0.62, 0.76);    // flamingo
  if (i == 1) return vec3(0.55, 0.95, 0.84);   // mint
  if (i == 2) return vec3(1.0, 0.9, 0.62);     // lemon
  if (i == 3) return vec3(0.78, 0.68, 1.0);    // lavender
  if (i == 4) return vec3(1.0, 0.76, 0.6);     // peach
  return vec3(0.55, 0.86, 1.0);                // aqua
}

float sdBox(vec2 p, vec2 size) {
  vec2 d = abs(p) - size;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

vec3 sky(vec2 p) {
  float y = p.y - STREET;
  vec3 col = mix(vec3(1.0, 0.56, 0.3), vec3(0.98, 0.3, 0.55), smoothstep(0.0, 0.22, y));
  col = mix(col, vec3(0.2, 0.08, 0.36), smoothstep(0.18, 0.62, y));
  col = mix(col, col * (0.6 + 0.6 * pal(0.65)), 0.35);
  vec2 sun = vec2(0.28, STREET + 0.1);
  float d = length(p - sun);
  col += vec3(1.0, 0.68, 0.4) * (exp(-d * 4.5) * (0.55 + 0.25 * u_bands[0]));
  col = mix(col, vec3(1.0, 0.88, 0.62) * 1.4, smoothstep(0.085, 0.08, d));
  float star = step(0.9965, hash21(floor(p * 260.0))) * smoothstep(0.3, 0.55, y);
  return col + star * 0.5;
}

// Far skyline: towers in the haze, sliding slowly.
vec3 skyline(vec2 p, vec3 col) {
  float x = p.x + u_flow * 0.02;
  float id = floor(x / 0.07);
  float h = hash21(vec2(id, 9.0));
  float top = STREET + 0.06 + 0.2 * h * h;
  if (h < 0.25 || p.y > top) return col;
  vec3 haze = mix(vec3(0.32, 0.14, 0.4), col, 0.45);
  vec2 w = floor(vec2(x * 160.0, p.y * 140.0));
  float lit = step(0.8, hash21(w)) * step(0.5, fract(x * 160.0)) * step(0.5, fract(p.y * 140.0));
  return haze + vec3(1.0, 0.8, 0.55) * lit * 0.35;
}

// The hotels: colour in .rgb, coverage in .a; glow collects the neon light around them.
vec4 hotels(vec2 p, out vec3 glow) {
  const float W = 0.6;
  glow = vec3(0.0);
  float x = p.x + u_flow * 0.06;
  float id = floor(x / W);
  vec2 q = vec2((fract(x / W) - 0.5) * W, p.y - STREET);
  float h1 = hash21(vec2(id, 1.0));
  float h2 = hash21(vec2(id, 2.0));
  float h3 = hash21(vec2(id, 3.0));
  float halfW = W * (0.38 + 0.08 * h1);
  float height = 0.15 + 0.13 * h2;

  // Base block, then a stepped tower with a fin on top of it.
  float d = sdBox(q - vec2(0.0, height * 0.5), vec2(halfW, height * 0.5));
  float tower = step(0.3, h3);
  float spire = height + 0.11;
  if (tower > 0.5) {
    d = min(d, sdBox(q - vec2(0.0, height + 0.02), vec2(0.1, 0.02)));
    d = min(d, sdBox(q - vec2(0.0, height + 0.05), vec2(0.06, 0.03)));
    d = min(d, sdBox(q - vec2(0.0, height + 0.06), vec2(0.008, spire - height - 0.06)));
  }
  float aa = 1.5 / u_res.y;
  float cover = smoothstep(aa, -aa, d) * step(0.0, q.y);

  // Neon: an outline on most roofs and a tube up the fin, softly breathing on the beat.
  vec3 tube = mix(pal(id * 0.37), vec3(1.0, 0.3, 0.7), 0.25);
  float on = max(step(0.3, h1), tower) * (0.9 + 0.3 * u_pulse + 0.2 * u_bands[3]);
  float edge = abs(d) * step(0.004, q.y);
  glow += tube * (exp(-edge * 1100.0) * 1.8 + exp(-edge * 55.0) * 0.25) * on;
  float fin = abs(q.x) - 0.002;
  float finOn = tower * step(height, q.y) * step(q.y, spire);
  glow += mix(tube, vec3(1.0), 0.4) * (exp(-max(fin, 0.0) * 1500.0) * 1.4 + exp(-abs(fin) * 60.0) * 0.12)
        * finOn * (0.9 + 0.35 * u_pulse);

  // Facade: pastel in the last light, a rounded corner at each end, eyebrow ledges over every
  // floor, ribbon windows, and a fluted centre column on the towers.
  vec3 paint = mix(pastel(floor(h2 * 6.0) + id), pal(h3), 0.12);
  vec3 trim = mix(pastel(floor(h2 * 6.0) + id + 3.0), vec3(1.0), 0.35);
  float floorY = q.y / 0.042;
  float f = fract(floorY);
  float sx = abs(q.x) / halfW;
  float curve = 1.0 - 0.5 * smoothstep(0.8, 1.0, sx) + 0.15 * exp(-pow((sx - 0.84) * 30.0, 2.0));
  float light = mix(0.7, 1.15, clamp(q.y / 0.3, 0.0, 1.0));
  vec3 col = paint * light * curve;
  bool body = q.y < height;
  float column = step(abs(q.x), 0.055) * tower;
  if (column > 0.5) col = trim * light * (0.85 + 0.2 * step(0.5, fract(q.x / 0.018)));
  if (body) {
    float ledge = smoothstep(0.86, 0.88, f) * (1.0 - smoothstep(0.94, 0.96, f));
    float shade = 1.0 - 0.4 * (1.0 - smoothstep(0.0, 0.25, f));
    col = mix(col * shade, vec3(1.0, 0.97, 0.94) * light, ledge * 0.85);

    // Ribbon windows: a band per floor, split by thin mullions, lit in groups.
    float band = step(0.32, f) * step(f, 0.7) * step(1.0, floorY) * step(sx, 0.78) * (1.0 - column);
    float mullion = step(abs(fract(q.x / 0.032) - 0.5), 0.42);
    float group = floor(q.x / 0.1);
    float lit = step(0.5 - 0.15 * u_bands[2], hash21(vec2(group + id * 31.0, floor(floorY))));
    vec3 pane = lit > 0.5 ? vec3(1.0, 0.8, 0.52) * (0.85 + 0.35 * u_bands[3]) : sky(p) * 0.5 + 0.05;
    col = mix(col, pane, band * mullion);

    // Ground floor: lit lobbies and a neon band over them.
    float lobby = step(floorY, 0.75) * step(abs(fract(q.x / 0.08) - 0.5), 0.36) * step(sx, 0.9);
    col = mix(col, mix(vec3(1.0, 0.72, 0.52), tube, 0.35), lobby);
    glow += tube * exp(-abs(q.y - 0.036) * 900.0) * step(sx, 0.95) * on * 0.9;
  }

  // A sign blade beside the tower: stacked glowing panels, like letters seen edge on.
  if (tower > 0.5) {
    vec2 s = q - vec2(0.085, height * 0.55);
    float blade = sdBox(s, vec2(0.011, height * 0.4));
    if (blade < 0.0) col = vec3(0.12, 0.05, 0.14);
    float letters = step(abs(fract(s.y / 0.026) - 0.5), 0.3) * step(abs(s.x), 0.006) * step(blade, 0.0);
    vec3 sign = mix(pal(id * 0.37 + 0.5), vec3(1.0, 0.35, 0.75), 0.3);
    col += sign * letters * (1.2 + 0.4 * u_pulse);
    glow += sign * exp(-max(blade, 0.0) * 55.0) * 0.35 * (0.9 + 0.3 * u_pulse);
  }
  return vec4(col, cover);
}

// A palm tree: curved trunk and drooping, feathered fronds. Coverage 0..1.
float palm(vec2 q, float seed) {
  float height = 0.48 + 0.14 * seed;
  float bend = (seed - 0.5) * 0.6;
  float aa = 1.5 / u_res.y;
  float tx = bend * q.y * q.y;
  float trunk = smoothstep(aa, -aa, abs(q.x - tx) - mix(0.009, 0.005, q.y / height))
              * step(0.0, q.y) * step(q.y, height);

  vec2 crown = vec2(bend * height * height, height);
  vec2 v = q - crown;
  float r = length(v);
  float theta = atan(v.y, v.x);
  float sway = sin(u_time * 0.9 + seed * 6.0) * 0.07 * (0.5 + u_energy) + 0.03 * u_pulse;
  float fronds = 0.0;
  const float L = 0.22;
  for (int k = 0; k < 7; k++) {
    float fk = float(k);
    float base = mix(0.1, 3.04, fk / 6.0) + sway + (hash21(vec2(seed, fk)) - 0.5) * 0.25;
    // Each frond arcs out and droops to its own side.
    float target = base < 1.5708 ? -0.9 : 4.04;
    float droop = (target - base) * 0.7 * pow(clamp(r / L, 0.0, 1.0), 1.8);
    float delta = mod(theta - base - droop + 3.14159, 6.28318) - 3.14159;
    float len = clamp(r / L, 0.0, 1.0);
    float width = 0.034 * pow(sin(3.14159 * len), 0.6) * (1.0 - 0.5 * len) * (0.4 + 0.6 * abs(sin(r * 150.0 + fk)));
    fronds = max(fronds, smoothstep(aa, -aa, abs(delta) * r - width) * step(r, L));
  }
  return max(trunk, fronds);
}

vec3 render(vec2 uv, vec2 p) {
  vec3 col = skyline(p, sky(p));
  vec3 glow;
  vec4 hotel = hotels(p, glow);
  if (p.y >= STREET) col = mix(col, hotel.rgb, hotel.a);
  col += glow;

  if (p.y < STREET) {
    if (p.y > KERB) {
      // Sidewalk, lit from the lobbies.
      col = vec3(0.5, 0.36, 0.42) * (0.6 + 0.4 * smoothstep(KERB, STREET, p.y)) + glow * 0.4;
    } else {
      // Wet asphalt mirroring the street above, rippled.
      vec2 m = vec2(p.x + 0.008 * sin(p.y * 110.0 + u_time * 1.4), 2.0 * KERB - p.y + (STREET - KERB));
      vec3 mGlow;
      vec4 mirror = hotels(m, mGlow);
      vec3 above = mix(skyline(m, sky(m)), mirror.rgb, mirror.a) + mGlow;
      float wet = 0.24 * smoothstep(-0.5, KERB, p.y);
      col = vec3(0.025, 0.015, 0.04) + above * wet;

      // Light trails: tail lights drift left in the far lane, head lights right in the near one.
      for (int lane = 0; lane < 2; lane++) {
        float fl = float(lane);
        float y = mix(-0.28, -0.37, fl);
        float dir = lane == 0 ? 1.0 : -1.0;
        float u = p.x * (5.0 - fl) + dir * u_flow * (0.9 + 0.5 * fl);
        float car = step(0.4, hash21(vec2(floor(u), fl)));
        float g = fract(u);
        float streak = smoothstep(0.0, 0.15, g) * smoothstep(0.75, 0.45, g) * car;
        vec3 tint = lane == 0 ? vec3(1.0, 0.18, 0.22) : vec3(1.0, 0.9, 0.75);
        float thick = 0.0025 + 0.002 * fl;
        col += tint * streak * (exp(-pow((p.y - y) / thick, 2.0)) * 1.2 + exp(-abs(p.y - y) * 60.0) * 0.2);
        col += tint * streak * exp(-abs(p.y - (y - 0.03)) * 40.0) * 0.1 * step(p.y, y);
      }
    }
  }

  // Palms in front, passing faster than the hotels.
  const float PW = 0.8;
  float px = p.x + u_flow * 0.14;
  float pid = floor(px / PW);
  float trees = 0.0;
  for (int k = -1; k <= 1; k++) {
    float c = pid + float(k);
    float seed = hash21(vec2(c, 5.0));
    if (seed < 0.15) continue;
    vec2 q = vec2(px - (c + 0.2 + 0.6 * hash21(vec2(c, 6.0))) * PW, p.y - (KERB - 0.03));
    trees = max(trees, palm(q, seed));
  }
  col = mix(col, vec3(0.035, 0.012, 0.05) + sky(p) * 0.04, trees);
  return col;
}
