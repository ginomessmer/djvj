// Glyphs: columns of symbols raining down. The camera shows through: where it is bright, the
// symbols get denser, brighter and take the second palette colour, and a soft glow of the image
// fills in behind them, so the DJ appears inside the rain.

// One made-up symbol on a 3x5 grid of bits, inside a cell (f in 0..1). `fill`: share of bits on.
float glyph(vec2 f, float seed, float fill) {
  vec2 q = (f - vec2(0.16, 0.1)) / vec2(0.68, 0.8);
  if (q.x < 0.0 || q.y < 0.0 || q.x >= 1.0 || q.y >= 1.0) return 0.0;
  vec2 bit = floor(q * vec2(3.0, 5.0));
  vec2 inBit = fract(q * vec2(3.0, 5.0));
  float on = step(1.0 - fill, hash21(bit + seed * 7.13));
  vec2 gap = step(vec2(0.12), inBit) * step(inBit, vec2(0.88));
  return on * gap.x * gap.y;
}

vec3 render(vec2 uv, vec2 p) {
  const float ASPECT = 0.62;                                  // cell width / height
  float rows = mix(46.0, 36.0, smoothstep(0.3, 0.9, u_energy));
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
  vec2 centre = vec2((cell.x + 0.5) * ASPECT, cell.y + 0.5) / rows;
  vec2 centreUv = vec2(centre.x * u_res.y / u_res.x, centre.y) + 0.5;
  // What is brighter than the frame's mean (a lit DJ in a dark booth) becomes the figure, the
  // rest stays rain.
  float cam = smoothstep(0.35, 0.85, cameraContrast(cameraLumaDetail(centreUv, 1.5)));

  float shape = glyph(f, floor(hash21(cell) * 50.0 + u_time * rate), mix(0.5, 0.85, cam));

  // The rain steps back inside the figure, the figure's symbols light up.
  float light = 0.1 + 0.65 * trail * (1.0 - 0.5 * cam) + 1.5 * cam + 0.25 * cam * u_pulse;
  vec3 rain = pal(0.15 + 0.1 * column + u_flow * 0.01);
  vec3 figure = pal(0.6 + u_flow * 0.01);
  vec3 col = mix(rain, figure, cam) * light * shape;
  col += vec3(0.9) * head * shape * (0.5 + 0.5 * u_bands[3]) * (1.0 - 0.6 * cam);

  // A soft glow of the image behind the symbols fills in the face between them.
  float image = smoothstep(0.35, 0.95, cameraContrast(cameraLumaDetail(uv, 1.5)));
  col += figure * image * (0.04 + 0.26 * u_cameraPresence);
  return col * (0.8 + 0.3 * u_energy);
}
