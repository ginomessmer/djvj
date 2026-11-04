// Glitch: the camera mapped to the palette, with colour fringes that widen with the bass and
// slices that slip sideways on the kick. Displacement only: it never flashes.
vec3 render(vec2 uv, vec2 p) {
  float t = floor(u_time * 9.0);                              // glitches move in steps

  // Horizontal slices slip sideways; more and further on a kick.
  float row = floor(uv.y * 28.0);
  float slips = step(0.88 - 0.4 * u_kick, hash21(vec2(row, t)));
  vec2 shift = vec2(slips * (hash21(vec2(row, t + 3.1)) - 0.5) * (0.03 + 0.16 * u_kick), 0.0);
  // Now and then a whole block jumps.
  vec2 block = floor(uv * vec2(7.0, 11.0));
  if (hash21(block + t * 0.37) > 0.975 - 0.08 * u_pulse) {
    shift += (vec2(hash21(block + 5.0), hash21(block + 9.0)) - 0.5) * 0.07;
  }
  vec2 q = uv + shift;

  float split = 0.002 + 0.01 * u_bands[1] + 0.008 * u_pulse;
  float lr = cameraLuma(q + vec2(split, 0.0), 1.0);
  float lg = cameraLuma(q, 1.0);
  float lb = cameraLuma(q - vec2(split, 0.0), 1.0);

  float steps = mix(4.0, 9.0, u_cameraPresence);              // more presence, more detail
  float level = floor(lg * steps + 0.5) / steps;              // posterised
  vec3 col = pal(level * 0.75 + u_flow * 0.02) * (0.1 + 1.05 * lg);
  col += vec3(max(lr - lg, 0.0), 0.0, max(lb - lg, 0.0)) * 1.6;  // red/blue fringes

  col *= 0.86 + 0.14 * sin(uv.y * u_res.y * 1.5708);          // scanlines
  float band = smoothstep(0.0, 0.02, abs(fract(uv.y - u_time * 0.07) - 0.5) - 0.02);
  col *= 0.8 + 0.2 * band;                                    // a slow rolling band
  col += (hash21(uv * u_res + t) - 0.5) * 0.05;               // grain
  return col * (0.85 + 0.3 * u_energy);
}
