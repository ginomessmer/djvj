// Light rig: a club stage seen from the floor. A truss of par cans throws coloured cones through
// the haze, a wall of LED bars behind it runs level meters and chases, and small strobe panels
// on the truss fire on the beat at peak energy. The strobes are small fixtures, not the whole
// screen, and ride the beat pulse, so the flash guard damps them like any other pulse.
const float TRUSS = 0.42;
const float FLOOR = -0.4;
const int PARS = 6;

float box(vec2 p, vec2 size) {
  vec2 d = abs(p) - size;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float parX(int i) {
  return (float(i) - 2.5) * 0.3;
}

// How loud par i plays: chases through the rig below peak energy, all on at the peak.
float parLevel(int i) {
  float fi = float(i);
  float chase = 0.5 + 0.5 * cos((fi / float(PARS) - u_flow * 0.12) * 6.2831);
  float all = smoothstep(0.55, 0.8, u_energy);
  return mix(0.25 + 0.75 * chase, 1.0, all) * (0.6 + 0.6 * u_bands[i % 5]) + 0.35 * u_pulse;
}

vec2 parDirection(int i) {
  float fi = float(i);
  float swing = sin(u_flow * 0.35 + fi * 1.3) * (0.25 + 0.3 * u_energy);
  float mirror = i < PARS / 2 ? 1.0 : -1.0;              // the halves swing towards each other
  float angle = swing * mirror + (fi - 2.5) * 0.06;
  return vec2(sin(angle), -cos(angle));
}

// Volumetric cone of par i at p, in haze; the floor stops it and gets a pool of light.
vec3 parBeam(int i, vec2 p, float haze) {
  vec2 origin = vec2(parX(i), TRUSS - 0.04);
  vec2 dir = parDirection(i);
  vec2 d = p - origin;
  float along = dot(d, dir);
  float across = dot(d, vec2(-dir.y, dir.x));
  float width = 0.014 + along * 0.22;
  vec3 tint = pal(float(i) / float(PARS) * 0.75 + u_flow * 0.01);
  float level = parLevel(i);

  float cone = exp(-across * across / (width * width) * 2.2) * step(0.0, along);
  cone *= exp(-along * 0.9) * step(FLOOR, p.y) * haze;
  vec3 col = tint * cone * level * 0.95;

  // Pool on the floor where the cone lands, squashed by perspective.
  float reach = (FLOOR - origin.y) / dir.y;
  vec2 spot = origin + dir * reach;
  vec2 q = (p - spot) * vec2(1.0, 4.0);
  col += tint * exp(-dot(q, q) / (0.02 + reach * 0.03)) * level * 0.5 * step(p.y, FLOOR + 0.02);
  return col;
}

// The wall of LED bars behind the stage: ten tubes of segments.
vec3 ledWall(vec2 p) {
  const float BARS = 10.0;
  const float SEGMENTS = 16.0;
  float x = (p.x + 0.8) / 1.6 * BARS;
  if (x < 0.0 || x >= BARS) return vec3(0.0);
  float bar = floor(x);
  float y = (p.y - FLOOR) / (TRUSS - 0.1 - FLOOR);
  if (y < 0.0 || y > 1.0) return vec3(0.0);
  float tube = smoothstep(0.2, 0.12, abs(fract(x) - 0.5));
  float seg = floor(y * SEGMENTS);
  float gap = smoothstep(0.5, 0.36, abs(fract(y * SEGMENTS) - 0.5));

  // Mirrored level meter: the bass in the middle, the highs on the outside.
  int band = int(min(abs(bar - 4.5), 4.0));
  float meter = step(seg / SEGMENTS, 0.12 + 0.85 * u_bands[band]);
  // A chase sweeps up the tubes on top of it, twice a beat at the peak.
  float chase = smoothstep(0.85, 1.0, fract(seg / SEGMENTS - u_flow * 0.4 + bar * 0.07));
  float level = max(meter * 0.8, chase * (0.3 + 0.7 * u_energy));
  vec3 tint = pal(0.15 + bar / BARS * 0.5 + seg / SEGMENTS * 0.15);
  return tint * tube * gap * level * 0.5 + tint * tube * 0.02;
}

vec3 render(vec2 uv, vec2 p) {
  float haze = 0.45 + 0.55 * fbm(p * 2.2 + vec2(u_flow * 0.08, u_flow * 0.03));
  vec3 col = pal(0.75) * 0.015;

  // Back wall and the stage floor, with the LED wall mirrored dimly in the floor.
  vec3 wall = ledWall(p);
  col += wall;
  if (p.y < FLOOR) {
    vec2 m = vec2(p.x, 2.0 * FLOOR - p.y);
    float wet = 0.25 * smoothstep(-0.55, FLOOR, p.y);
    col += ledWall(m + vec2(0.004 * sin(p.y * 90.0 + u_time * 2.0), 0.0)) * wet;
    col += pal(0.7) * 0.02;
  }

  for (int i = 0; i < PARS; i++) col += parBeam(i, p, haze);

  // The truss: a dark bar with a lattice, lit from below by the pars.
  float trussD = box(p - vec2(0.0, TRUSS), vec2(0.9, 0.022));
  if (trussD < 0.0) {
    float lattice = smoothstep(0.004, 0.0, abs(fract((p.x + abs(p.y - TRUSS)) * 22.0) - 0.5) - 0.42);
    col = vec3(0.04) + vec3(0.1) * lattice;
  }

  // Par cans: a can below the truss with a hot lens facing the room.
  for (int i = 0; i < PARS; i++) {
    vec2 c = vec2(parX(i), TRUSS - 0.04);
    vec2 dir = parDirection(i);
    float can = box(p - c - dir * 0.008, vec2(0.022, 0.018));
    if (can < 0.0) col = vec3(0.03);
    float lens = length(p - c - dir * 0.022);
    vec3 tint = pal(float(i) / float(PARS) * 0.75 + u_flow * 0.01);
    float level = parLevel(i);
    col += mix(tint, vec3(1.0), 0.5) * smoothstep(0.016, 0.008, lens) * level;
    col += tint * exp(-lens * 40.0) * level * 0.5;
  }

  // Strobe panels between the pars: they fire on the beat at peak energy, a few at a time.
  float gate = smoothstep(0.45, 0.75, u_energy) * (0.5 + 0.5 * u_bands[4]);
  float flash = u_pulse * u_pulse * u_pulse * gate;
  for (int i = 0; i < PARS - 1; i++) {
    float fi = float(i);
    vec2 c = vec2(parX(i) + 0.15, TRUSS + 0.004);
    float chosen = step(0.45, hash21(vec2(fi, floor(u_flow * 0.5))));
    float panel = box(p - c, vec2(0.032, 0.011));
    float grille = 0.75 + 0.25 * step(0.5, fract((p.x - c.x) * 160.0));
    float f = flash * chosen;
    col = panel < 0.0 ? (vec3(0.16) + vec3(1.6) * f) * grille : col;
    col += vec3(0.9, 0.95, 1.0) * exp(-max(panel, 0.0) * 30.0) * f * 0.6;
  }

  return col;
}
