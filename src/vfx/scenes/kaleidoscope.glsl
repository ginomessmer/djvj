// Kaleidoscope: a drifting wave pattern folded into eight mirrored wedges. Kicks pulse the zoom.
vec3 render(vec2 uv, vec2 p) {
  const float WEDGE = 6.2831853 / 8.0;

  float r = length(p);
  float a = atan(p.y, p.x) + u_flow * 0.05;
  a = abs(mod(a, WEDGE) - 0.5 * WEDGE);                      // mirror-fold into one wedge
  vec2 q = vec2(cos(a), sin(a)) * r * (2.8 - 0.35 * u_kick);

  vec2 w = q + 0.35 * vec2(sin(q.y * 2.3 + u_flow * 0.7), cos(q.x * 2.1 - u_flow * 0.6));
  float v = sin(w.x * 3.0 + u_flow) + sin(w.y * 3.4 - u_flow * 0.8) + sin(length(w) * 5.0 - u_flow * 1.2);
  v = v / 6.0 + 0.5 + 0.12 * (u_bands[2] - 0.3);

  float toContour = 0.5 - abs(fract(v * 4.0) - 0.5);        // distance to the nearest contour line
  vec3 col = pal(v + u_flow * 0.02) * (0.22 + 0.9 * smoothstep(0.3, 0.9, v));
  col += pal(v + 0.5) * smoothstep(0.07, 0.0, toContour) * 0.8;

  col *= 0.6 + 0.8 * exp(-r * 1.6);
  col *= 0.7 + 0.5 * u_energy;
  return col;
}
