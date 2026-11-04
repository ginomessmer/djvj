// Voxels: a flight over a landscape built from blocks, with pixel-textured faces, blocky clouds
// and a square sun. Speed follows the music, the bass pushes single columns up block by block,
// and the beat lights the block edges near the camera like a dance floor.
const float SKY_TOP = 16.0;
const float WATER = 3.0;

// Height of the column at an integer cell: two octaves of noise, rounded to whole blocks.
float columnHeight(vec2 cell) {
  float n = 0.65 * vnoise(cell * 0.055) + 0.35 * vnoise(cell * 0.17 + 7.3);
  float h = floor(n * 17.0 - 3.5);
  // Bass pops random columns up, a whole block at a time.
  h += floor(u_bands[1] * 3.2 * step(0.82, hash21(cell + 0.5)));
  return h;
}

// 8x8 pixels per face: a little colour noise, as on a hand-painted block.
float pixels(vec2 faceUv, vec3 cell) {
  vec2 px = floor(faceUv * 8.0);
  return hash21(px + cell.xz * 13.1 + cell.y * 7.7);
}

vec3 sky(vec3 rd) {
  vec3 col = mix(pal(0.55) * 0.55, pal(0.7) * 0.12, clamp(rd.y * 2.2 + 0.2, 0.0, 1.0));
  // A square sun.
  vec3 sunDir = normalize(vec3(0.35, 0.28, 1.0));
  vec3 q = rd - sunDir * dot(rd, sunDir);
  float sq = max(abs(q.x), abs(q.y));
  col += pal(0.1) * (smoothstep(0.075, 0.07, sq) * 1.4 + exp(-sq * 9.0) * 0.25);
  // Flat, blocky clouds on a plane above the world.
  if (rd.y > 0.02) {
    float t = (SKY_TOP + 8.0) / rd.y;
    vec2 c = floor((rd.xz * t + vec2(u_flow * 0.6, u_flow * 2.0)) / 6.0);
    float cloud = step(0.62, vnoise(c * 0.45)) * smoothstep(400.0, 120.0, t);
    col = mix(col, mix(vec3(1.0), pal(0.55), 0.25), cloud * 0.75);
  }
  return col;
}

vec3 render(vec2 uv, vec2 p) {
  float z = u_flow * 3.0;
  vec3 ro = vec3(4.0 * sin(u_flow * 0.07), 13.5 + 0.4 * sin(u_flow * 0.3), z);
  float yaw = 0.25 * sin(u_flow * 0.05);
  vec3 rd = normalize(vec3(p.x, p.y, 1.25));
  rd.yz = mat2(cos(0.38), sin(0.38), -sin(0.38), cos(0.38)) * rd.yz;   // look down a little
  rd.xz = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw)) * rd.xz;

  // Walk the ray through the block grid one cell at a time (DDA).
  vec3 cell = floor(ro);
  vec3 stepDir = sign(rd);
  vec3 delta = abs(1.0 / max(abs(rd), 1e-4));
  vec3 side = (stepDir * (cell - ro) + stepDir * 0.5 + 0.5) * delta;
  vec3 mask = vec3(0.0);
  bool hit = false;
  bool water = false;
  for (int i = 0; i < 110; i++) {
    float h = columnHeight(cell.xz);
    if (cell.y < h) { hit = true; break; }
    if (cell.y < WATER) { hit = true; water = true; break; }
    if (cell.y > SKY_TOP && rd.y > 0.0) break;
    mask = step(side.xyz, side.yzx) * step(side.xyz, side.zxy);
    side += mask * delta;
    cell += mask * stepDir;
  }
  if (!hit) return sky(rd);

  float t = dot(side - delta, mask);
  vec3 pos = ro + rd * t;
  vec3 normal = -mask * stepDir;
  vec3 f = fract(pos);
  vec2 faceUv = mask.x > 0.5 ? f.zy : mask.y > 0.5 ? f.xz : f.xy;
  float noise = pixels(faceUv, cell);

  // Grass on top, earth on the sides with a grass fringe, stone deep down, sand by the water.
  float top = columnHeight(cell.xz) - 1.0;
  vec3 grass = pal(0.32) * (0.75 + 0.35 * noise);
  vec3 earth = pal(0.05) * 0.45 * (0.7 + 0.5 * noise);
  vec3 stone = vec3(0.32) * (0.75 + 0.45 * noise) + pal(0.7) * 0.05;
  vec3 sand = mix(pal(0.12), vec3(1.0, 0.9, 0.7), 0.5) * (0.8 + 0.25 * noise);
  vec3 albedo;
  if (water) {
    albedo = pal(0.58) * (0.55 + 0.25 * vnoise(pos.xz * 1.5 + u_time * 0.6));
  } else if (cell.y < top - 2.0) {
    albedo = stone;
  } else if (top < WATER + 0.5) {
    albedo = sand;
  } else if (mask.y > 0.5) {
    albedo = grass;
  } else {
    float fringe = step(0.78 - 0.1 * step(0.5, noise), faceUv.y) * step(top - 0.5, cell.y);
    albedo = mix(earth, grass * 0.85, fringe);
  }

  // Light: fixed shade per face direction, like the classic block look, plus a little sun.
  float shade = mask.y > 0.5 ? (normal.y > 0.0 ? 1.0 : 0.4) : (mask.x > 0.5 ? 0.72 : 0.58);
  vec3 col = albedo * shade * (0.9 + 0.2 * u_energy);
  if (water) col += pal(0.55) * 0.25 * pow(1.0 - abs(rd.y), 6.0);

  // Block edges near the camera light up on the beat, in a ring that runs outwards.
  vec2 e = min(faceUv, 1.0 - faceUv);
  float edge = 1.0 - smoothstep(0.0, 0.06 + t * 0.002, min(e.x, e.y));
  float ring = exp(-abs(t - (4.0 + u_beat * 34.0)) * 0.35);
  col += pal(0.5 + 0.1 * cell.y) * edge * (0.12 * u_bands[2] + 0.9 * u_pulse * ring)
       * smoothstep(60.0, 10.0, t);

  // Distance fog into the sky.
  return mix(col, sky(rd), smoothstep(30.0, 95.0, t));
}
