// Glyphs: columns of symbols raining down. The camera shows through: where it is bright, the
// symbols are lit and take the second palette colour, so the DJ appears inside the rain.

// One made-up symbol on a 3x5 grid of bits, inside a cell (f in 0..1).
float glyph(vec2 f, float seed) {
  vec2 q = (f - vec2(0.16, 0.1)) / vec2(0.68, 0.8);
  if (q.x < 0.0 || q.y < 0.0 || q.x >= 1.0 || q.y >= 1.0) return 0.0;
  vec2 bit = floor(q * vec2(3.0, 5.0));
  vec2 inBit = fract(q * vec2(3.0, 5.0));
  float on = step(0.48, hash21(bit + seed * 7.13));
  vec2 gap = step(vec2(0.12), inBit) * step(inBit, vec2(0.88));
  return on * gap.x * gap.y;
}

vec3 render(vec2 uv, vec2 p) {
  const float ASPECT = 0.62;                                  // cell width / height
  float rows = mix(32.0, 24.0, smoothstep(0.3, 0.9, u_energy));
  vec2 g = vec2(p.x / ASPECT, p.y) * rows;
  vec2 cell = floor(g);
  vec2 f = fract(g);

  // Each column falls at its own speed; the head is bright, the trail fades behind it.
  float column = hash21(vec2(cell.x, 3.7));
  float speed = 0.55 + 1.2 * column;
  float fromTop = rows * 0.5 - cell.y;
  float behindHead = fract(u_flow * 0.085 * speed + column * 5.0 - fromTop / (rows * 1.4));
  float trail = exp(-behindHead * 6.5);
  float head = smoothstep(0.035, 0.0, behindHead);

  // Symbols change now and then, faster in the trail than elsewhere.
  float rate = 0.4 + 2.5 * trail * hash21(cell + 1.3);
  float shape = glyph(f, floor(hash21(cell) * 50.0 + u_time * rate));

  vec2 centre = vec2((cell.x + 0.5) * ASPECT, cell.y + 0.5) / rows;
  vec2 centreUv = vec2(centre.x * u_res.y / u_res.x, centre.y) + 0.5;
  // Auto gain puts the frame's mean near 0.42: what is brighter than that (a lit DJ in a dark
  // booth) becomes the figure, the rest stays rain.
  float cam = smoothstep(0.35, 0.75, cameraLuma(centreUv, 2.5));

  float light = 0.12 + 0.7 * trail + 1.1 * cam * (0.6 + 0.4 * trail) + 0.25 * cam * u_pulse;
  vec3 rain = pal(0.15 + 0.1 * column + u_flow * 0.01);
  vec3 figure = pal(0.6 + u_flow * 0.01);
  vec3 col = mix(rain, figure, cam) * light * shape;
  col += vec3(0.9) * head * shape * (0.5 + 0.5 * u_bands[3]);
  return col * (0.8 + 0.3 * u_energy);
}
