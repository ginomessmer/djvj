// Glyphs: columns of symbols raining down, each symbol lit and coloured like the camera image at
// its place (an ASCII-art camera), with a soft copy of the image behind: the DJ appears in the
// rain by shades, not as a cut-out, so it also works in front of a bright wall.

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

  // Each symbol is lit like the camera image at its cell (an ASCII-art camera), with local detail
  // boosted: a face reads by its shades, whether it is brighter than the room or not. No global
  // threshold, so a lit wall behind the DJ cannot swallow them.
  float tone = cameraLumaLocal(centreUv, 1.0);
  // Both how many bits a symbol has and how bright it is follow the tone: a cell covered only in
  // part cannot show shades by brightness alone.
  float level = smoothstep(0.18, 0.88, tone);
  float shape = glyph(f, floor(hash21(cell) * 50.0 + u_time * rate), mix(0.15, 0.95, level));

  // Presence decides how much the image leads and how much the rain does.
  float imageLed = mix(0.5, 1.0, u_cameraPresence);
  float fromImage = 0.02 + 2.0 * level + 0.25 * level * u_pulse;
  float fromRain = 0.08 + 0.8 * trail;
  // The rain keeps running on top, mostly where the image is dark, so it never flattens a face.
  float light = mix(fromRain, fromImage, imageLed) + 0.45 * trail * (1.0 - level);
  // Colour by column, never by tone (a palette's colours differ in brightness: tone-mapped hues
  // made a lit face look dark); the brightest cells run towards white instead.
  vec3 tint = mix(pal(0.15 + 0.12 * column + u_flow * 0.01), vec3(1.0), 0.45 * level * level);
  vec3 col = tint * light * shape;
  col += vec3(0.9) * head * shape * (0.5 + 0.5 * u_bands[3]) * (1.0 - 0.6 * level);

  // A soft, tinted copy of the image behind the symbols fills in the face between them.
  float image = cameraLumaLocal(uv, 1.5);
  col += pal(0.35 + 0.4 * image + u_flow * 0.01) * smoothstep(0.1, 0.85, image) *
    (0.02 + 0.14 * u_cameraPresence);
  return col * (0.8 + 0.3 * u_energy);
}
