// Aurora: slow curtains of light under a sky of faint stars. For intros and breakdowns:
// the music only nudges speed and brightness, never makes it jump.
vec3 render(vec2 uv, vec2 p) {
  float t = u_flow * 0.12;
  vec3 col = pal(0.78) * 0.06 * (1.0 - uv.y);          // night sky, lighter towards the horizon

  // Stars: at most one per cell of a resolution-independent grid, drawn as a soft dot.
  vec2 grid = (p + 20.0) * 90.0;
  vec2 cell = floor(grid);
  vec2 offset = vec2(hash21(cell + 3.1), hash21(cell + 9.7)) * 0.6 + 0.2;
  float starDist = length(fract(grid) - offset);
  float twinkle = 0.5 + 0.5 * sin(u_time * 1.5 + hash21(cell + 7.0) * 6.2831853);
  col += vec3(1.0) * step(0.994, hash21(cell)) * smoothstep(0.2, 0.0, starDist) * (0.4 + 0.6 * twinkle);

  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float x = p.x * (1.3 + fi * 0.4) + t * (1.0 + fi * 0.35) + fi * 4.1;
    float bend = fbm(vec2(x * 0.8, fi * 3.3 + t)) - 0.5;
    float lowerEdge = -0.14 + fi * 0.08 + 0.24 * bend;
    float d = p.y - lowerEdge;
    float body = smoothstep(0.0, 0.02, d) * exp(-d * (4.0 + fi));      // bright edge, fading upwards
    float rays = 0.55 + 0.45 * vnoise(vec2(x * 9.0, t * 2.0 + fi));
    float level = 0.5 + 0.9 * u_bands[1 + i % 3];
    col += pal(fi * 0.23 + bend * 0.5 + 0.1) * body * rays * level;
  }
  return col;
}
