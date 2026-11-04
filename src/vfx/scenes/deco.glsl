// Art deco: a gilded sunburst rising from the bottom edge, framed by fan arcs, fish-scale
// panels and stepped pinstripes, all in gold leaf on lacquer black. Each arc and each group of
// rays follows a frequency band; on every beat a sheen runs outwards along the gold.
const float PI = 3.14159265;

// Gold leaf, tinted by the palette so it still changes with it.
vec3 gold(float t) {
  vec3 leaf = mix(vec3(1.0, 0.78, 0.42), vec3(1.0, 0.92, 0.7), 0.5 + 0.5 * sin(t * 6.2831));
  return mix(leaf, pal(t), 0.22);
}

// Distance to a thin line, as soft coverage (aa = width of a pixel).
float line(float d, float width, float aa) {
  return 1.0 - smoothstep(width, width + aa, abs(d));
}

// Fish-scale panel: rows of half-offset fans, each made of concentric arcs.
float scales(vec2 p, float aa) {
  vec2 s = p * vec2(7.0, 9.0);
  s.x += 0.5 * mod(floor(s.y), 2.0);
  vec2 cell = fract(s) - vec2(0.5, 0.0);
  float r = length(cell * vec2(1.0, 1.3));
  float arcs = line(fract(r * 3.0 + 0.5) - 0.5, 0.06, aa * 18.0) * step(r, 1.0);
  return arcs * step(0.0, cell.y);
}

vec3 render(vec2 uv, vec2 p) {
  float aa = 1.5 / u_res.y;
  vec2 o = vec2(0.0, -0.5);
  vec2 d = p - o;
  float r = length(d);
  float a = atan(d.x, d.y);                                   // 0 = straight up
  float side = abs(p.x);

  vec3 col = mix(pal(0.75) * 0.02, pal(0.6) * 0.05, smoothstep(-0.5, 0.5, p.y));

  // Fish-scale panels behind everything, dim, with a slow sheen drifting across.
  float panel = scales(p + vec2(0.0, u_flow * 0.02), aa) * smoothstep(0.52, 0.8, r);
  float drift = 0.5 + 0.5 * sin(p.x * 3.0 - p.y * 2.0 + u_flow * 0.25);
  col += gold(0.1) * panel * (0.08 + 0.1 * drift);

  // Sunburst: alternating broad and thin rays over the upper half circle.
  float sunR = 0.52 + 0.04 * u_energy + 0.015 * u_pulse;
  float rays = 0.0;
  if (abs(a) < 0.5 * PI && r < sunR) {
    float n = 26.0;
    float k = a / PI * n;                                   // ray coordinate
    float id = floor(k + 0.5);
    float level = u_bands[int(mod(abs(id), 5.0))];
    float broad = mod(id, 2.0) == 0.0 ? 1.0 : 0.0;
    float width = mix(0.08, 0.32, broad) * (0.85 + 0.3 * level);
    float edge = line(k - id, width, aa * n / max(r * PI, 0.01) * 1.5);
    float fade = smoothstep(0.06, 0.16, r) * smoothstep(sunR, sunR - 0.03, r);
    rays = edge * fade * (0.45 + 0.75 * level);
  }
  // The sun's disk: a solid gold half circle with a stepped rim.
  float disk = smoothstep(0.14 + aa, 0.14, r) * step(o.y, p.y);
  float rim = line(r - 0.17, 0.004, aa) + line(r - 0.19, 0.002, aa);

  // Fan arcs: five concentric bands around the sun, one per frequency band.
  float arcs = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float radius = sunR + 0.05 + fi * 0.075 + 0.01 * u_bands[i];
    float w = 0.003 + 0.004 * u_bands[i];
    arcs += line(r - radius, w, aa) * (0.35 + 0.9 * u_bands[i]);
    // Small studs along every other arc, like rivets on a lift door.
    if (i % 2 == 1) {
      float stud = fract(a / PI * 22.0) - 0.5;
      arcs += smoothstep(0.012, 0.006, length(vec2(stud * r * PI / 22.0, r - radius))) * 0.8;
    }
  }
  arcs *= step(o.y, p.y);

  // The sheen: a band of light that leaves the sun on every beat and runs out along the gold.
  float sheen = exp(-abs(r - (0.12 + u_beat * 1.1)) * 22.0) * (0.35 + 0.65 * u_energy);
  float sweep = 0.5 + 0.5 * cos(a * 3.0 - u_flow * 0.4);

  float metal = rays + disk + rim * 0.9 + arcs;
  col = mix(col, vec3(0.0), clamp(metal, 0.0, 1.0) * 0.6);     // gold sits on black, no haze
  col += gold(0.05 + r * 0.25) * metal * (0.75 + 0.35 * sweep + 0.9 * sheen);
  col += gold(0.0) * disk * (0.25 + 0.3 * u_bands[0]);

  // Stepped pinstripes up both sides, like the setbacks of a tower.
  float stripes = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x = 0.62 + fi * 0.03;
    float top = 0.18 + fi * 0.09 + 0.06 * u_bands[1 + i];
    stripes += line(side - x, 0.0025, aa) * step(p.y, top);
    stripes += line(p.y - top, 0.0025, aa) * step(x - 0.03, side) * step(side, x);
  }
  // Stepped chevrons in the outer margin, climbing slowly.
  float climb = fract(p.y * 5.0 + abs(side - 0.8) * 5.0 - u_flow * 0.06);
  stripes += line(climb - 0.5, 0.03, aa * 5.0) * step(0.72, side) * step(side, 0.88) * 0.45;
  col += gold(0.15) * stripes * (0.7 + 0.5 * sheen);

  // A thin double frame along the top edge holds it all together.
  col += gold(0.2) * (line(p.y - 0.47, 0.002, aa) + line(p.y - 0.455, 0.001, aa)) * 0.7;

  return col * (0.92 + 0.08 * u_pulse);
}
