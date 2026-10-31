// Ambient: the safe fallback. Depends on wall-clock time only, never on audio.
vec3 render(vec2 uv, vec2 p) {
  float t = u_time * 0.08;
  float d = length(p - 0.15 * vec2(sin(t * 3.0), cos(t * 2.0)));
  vec3 col = mix(pal(t), pal(t + 0.4), smoothstep(0.0, 0.9, d));
  col *= 0.5 + 0.15 * sin(u_time * 0.5);
  col *= smoothstep(1.1, 0.0, d);
  return col;
}
