// Fluid: domain-warped noise. The music pushes the warp; also the calm "idle" look.
vec3 render(vec2 uv, vec2 p) {
  vec2 q = p * (1.6 + u_bands[1] * 0.4);
  float t = u_flow * 0.35;

  vec2 w = vec2(fbm(q + vec2(0.0, t)), fbm(q + vec2(5.2, 1.3) - t));
  float warp = 1.2 + 2.2 * u_energy + 1.2 * u_kick;
  float f = fbm(q + warp * w + vec2(t * 0.5));

  vec3 col = mix(pal(f * 0.9 + t * 0.05), pal(f * 0.9 + 0.5), smoothstep(0.3, 0.8, w.x));
  col *= 0.25 + 1.1 * smoothstep(0.15, 0.85, f);
  col += pal(0.7) * pow(f, 4.0) * (0.3 + 0.9 * u_bands[2]);
  return col;
}
