// Lava: glowing blobs that merge and split. Each blob swells with its own frequency band.
vec3 render(vec2 uv, vec2 p) {
  float t = u_flow * 0.25;
  float field = 0.0;

  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 centre = vec2(
      sin(t * (0.7 + 0.13 * fi) + fi * 2.1) * 0.55,
      cos(t * (0.5 + 0.11 * fi) + fi * 1.7) * 0.32
    );
    float radius = 0.12 + 0.07 * u_bands[i % 5] + (i == 0 ? 0.03 * u_kick : 0.0);
    vec2 d = p - centre;
    field += (radius * radius) / (dot(d, d) + 1e-4);
  }

  float body = smoothstep(0.9, 1.15, field);
  float glow = smoothstep(0.5, 0.9, field) * (1.0 - body);

  float shade = 1.0 - exp(-field * 0.5);                 // tames the huge values at blob centres
  vec3 col = pal(0.78) * 0.05;
  col += pal(0.05 + shade * 0.35 + u_flow * 0.01) * body * (0.7 + 0.5 * u_energy);
  col += pal(0.55 + shade * 0.1) * glow * 0.4;
  return col;
}
