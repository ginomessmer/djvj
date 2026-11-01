// Halftone: the camera as a rotated grid of dots in palette colours. Bright = big dot; beats
// swell the dots a little, energy makes the grid finer.
vec3 render(vec2 uv, vec2 p) {
  float cells = mix(64.0, 44.0, smoothstep(0.2, 0.9, u_energy));   // dots per screen height
  float angle = 0.42 + 0.06 * sin(u_flow * 0.08);
  float c = cos(angle);
  float s = sin(angle);
  mat2 rot = mat2(c, s, -s, c);

  vec2 g = rot * p * cells;
  vec2 cell = floor(g) + 0.5;
  vec2 f = g - cell;
  vec2 centre = transpose(rot) * (cell / cells);                       // the cell centre, in p
  vec2 centreUv = vec2(centre.x * u_res.y / u_res.x, centre.y) + 0.5;

  float level = smoothstep(0.08, 0.92, cameraLuma(centreUv, 2.0));    // blurred: one value per dot
  float radius = 0.52 * sqrt(level) * (1.0 + 0.22 * u_pulse);
  float aa = 1.5 * cells / u_res.y;                                    // ~1.5 px, in cell units
  float dotMask = smoothstep(radius + aa, radius - aa, length(f));

  vec3 ink = pal(centre.y * 0.45 + centre.x * 0.15 + level * 0.35 + u_flow * 0.025);
  vec3 paper = pal(0.55 + u_flow * 0.01) * (0.03 + 0.05 * fbm(p * 2.0 + u_flow * 0.04));
  return paper + ink * dotMask * (0.75 + 0.5 * u_bands[2] + 0.3 * u_energy);
}
