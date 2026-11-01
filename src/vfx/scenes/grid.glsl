// Grid: a retro perspective floor under a striped sun and mountains. The floor scrolls with
// the music, bass lights the grid lines and lifts the mountains.
vec3 render(vec2 uv, vec2 p) {
  const float HORIZON = 0.06;
  float above = p.y - HORIZON;
  vec3 col;

  if (above >= 0.0) {
    // Sky
    col = mix(pal(0.0) * 0.3, pal(0.78) * 0.05, smoothstep(0.0, 0.55, above));

    // Sun with horizontal slits that widen towards its lower edge
    vec2 sunCentre = vec2(0.0, HORIZON + 0.2);
    float sunRadius = 0.17 + 0.012 * u_pulse;
    float sunDist = length(p - sunCentre);
    float down = clamp((sunCentre.y + sunRadius - p.y) / (2.0 * sunRadius), 0.0, 1.0);
    float slit = step(fract(p.y * 34.0), 0.7 * down) * step(0.35, down);
    float sun = smoothstep(sunRadius, sunRadius - 0.004, sunDist) * (1.0 - slit);
    col += pal(0.1) * 0.25 * exp(-sunDist * 6.0);
    col = mix(col, mix(pal(0.2), pal(0.0), down) * 1.3, sun);

    // Mountains
    float ridge = HORIZON + 0.025 + 0.1 * fbm(vec2(p.x * 2.6 + 3.0, 1.7)) + 0.05 * u_bands[1];
    col = mix(col, pal(0.75) * 0.5, smoothstep(ridge + 0.002, ridge - 0.002, p.y));
    col += pal(0.5) * smoothstep(0.012, 0.0, abs(p.y - ridge)) * 0.6;
  } else {
    // Floor: lines at integer world coordinates, seen in perspective
    float depth = 0.3 / (-above + 0.003);
    vec2 g = vec2(p.x * depth * 7.0, (depth - u_flow * 0.55) * 7.0);
    vec2 aa = fwidth(g);
    vec2 toLine = 0.5 - abs(fract(g) - 0.5);
    vec2 line = 1.0 - smoothstep(vec2(0.0), vec2(0.04) + aa * 1.2, toLine);
    float fade = smoothstep(26.0, 3.0, depth);

    col = pal(0.75) * 0.35 * (1.0 - fade * 0.3);
    col += pal(0.5) * max(line.x, line.y) * fade * (0.8 + 0.8 * u_bands[1]);
    col += pal(0.0) * 0.5 * exp(above * 18.0);        // glow along the horizon
  }
  return col;
}
