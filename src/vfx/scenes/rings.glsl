// Rings: one concentric ring per frequency band, wobbling with its own level.
vec3 render(vec2 uv, vec2 p) {
  float r = length(p);
  float a = atan(p.y, p.x);
  vec3 col = pal(u_flow * 0.01 + 0.6) * (0.06 + 0.1 * (1.0 - r));   // dim backdrop

  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float level = u_bands[i];
    float rad = 0.10 + fi * 0.085 + level * 0.07;
    rad += 0.02 * level * sin(a * (3.0 + fi * 2.0) + u_flow * (1.0 + fi * 0.4));
    float d = abs(r - rad);
    float line = smoothstep(0.006 + 0.01 * level, 0.0, d);
    float glow = 0.0035 * (0.6 + level * 3.0) / (d + 0.004);
    col += pal(fi * 0.18 + u_flow * 0.02) * (line * 0.9 + glow * 0.45);
  }

  float pulse = u_pulse * smoothstep(0.03, 0.0, abs(r - (0.55 + 0.25 * (1.0 - u_pulse))));
  col += pal(0.1) * pulse * 0.7;
  col *= 0.55 + 0.7 * u_energy;
  return col;
}
