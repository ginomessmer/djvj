// Halftone: the camera as a rotated grid of dots in palette colours. Bright = big dot; beats
// swell the dots a little, energy makes the grid coarser. A soft copy of the image sits under the
// dots, so a face keeps its features even where the dots are too coarse for them.
vec3 render(vec2 uv, vec2 p) {
  float cells = mix(92.0, 70.0, smoothstep(0.2, 0.9, u_energy));   // dots per screen height
  float angle = 0.42 + 0.06 * sin(u_flow * 0.08);
  float c = cos(angle);
  float s = sin(angle);
  mat2 rot = mat2(c, s, -s, c);

  vec2 g = rot * p * cells;
  vec2 cell = floor(g) + 0.5;
  vec2 f = g - cell;
  vec2 centre = transpose(rot) * (cell / cells);                       // the cell centre, in p
  vec2 centreUv = vec2(centre.x * u_res.y / u_res.x, centre.y) + 0.5;

  // Dark parts lose their dots, lit parts get full ones, and local detail (eyes, edges) shows as
  // a change in dot size.
  float level = clamp(cameraContrast(cameraLumaDetail(centreUv, 1.0)), 0.0, 1.0);
  float radius = 0.56 * pow(level, 0.85) * (1.0 + 0.2 * u_pulse);
  float aa = 1.5 * cells / u_res.y;                                    // ~1.5 px, in cell units
  float dotMask = smoothstep(radius + aa, radius - aa, length(f));

  vec3 ink = pal(centre.y * 0.35 + centre.x * 0.1 + level * 0.45 + u_flow * 0.025);
  ink *= 0.55 + 0.75 * level + 0.3 * u_bands[2] + 0.2 * u_energy;
  float image = smoothstep(0.25, 0.95, cameraContrast(cameraLumaDetail(uv, 1.5)));
  vec3 under = pal(0.5 + image * 0.3 + u_flow * 0.01) * image * (0.06 + 0.3 * u_cameraPresence);
  vec3 paper = pal(0.55 + u_flow * 0.01) * (0.02 + 0.03 * fbm(p * 2.0 + u_flow * 0.04));
  return paper + under + ink * dotMask;
}
