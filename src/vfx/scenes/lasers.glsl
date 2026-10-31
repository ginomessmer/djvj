// Lasers: two fans of beams, from the bottom and the top edge. The fan opens with the energy and
// swings slowly; each beam breathes with its own frequency band. Pulses are soft and smooth on
// purpose: no strobing.
vec3 fan(vec2 origin, float direction, vec2 p, float phase) {
  vec2 d = p - origin;
  float theta = atan(d.x, d.y * direction);                // 0 = straight along the fan
  float spread = 0.12 + 0.06 * u_energy;
  float sweep = 0.4 * sin(u_flow * 0.3 + phase);

  vec3 col = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float level = u_bands[i % 5];
    float off = theta - ((fi - 3.0) * spread + sweep);
    float core = exp(-off * off / (0.00012 + 0.00018 * level));      // thin, hot core
    float haze = exp(-off * off / 0.004) * 0.12;                      // soft scatter around it
    col += pal(fi / 7.0 + u_flow * 0.015 + phase) * (core * (0.7 + 1.5 * level) + haze);
  }
  return col * exp(-length(d) * 0.6);
}

vec3 render(vec2 uv, vec2 p) {
  vec3 col = fan(vec2(0.0, -0.62), 1.0, p, 0.0) + fan(vec2(0.0, 0.62), -1.0, p, 2.1);
  col *= 0.6 + 0.4 * vnoise(p * 3.0 + vec2(0.0, u_flow * 0.25));    // drifting smoke
  col *= (0.9 + 0.5 * u_energy) * (0.88 + 0.12 * u_pulse);
  col += pal(0.78) * 0.04;
  return col;
}
