// Starfield: stars streaming out of the centre. Speed follows the energy; kicks and energy
// lengthen the streaks (a change of size, not a flash).
vec3 render(vec2 uv, vec2 p) {
  float r = length(p) + 1e-4;
  float angle = atan(p.y, p.x) / 6.2831853 + 0.5;
  float z = 0.25 / r;                                        // "depth": large near the centre
  float trail = min(0.25 + 0.9 * u_energy + 0.8 * u_kick, 0.85);

  vec3 col = pal(0.78) * 0.03;
  for (int layer = 0; layer < 3; layer++) {
    float fl = float(layer);
    float sectors = 70.0 + fl * 45.0;
    float sector = angle * sectors;
    float id = floor(sector);
    float across = fract(sector) - 0.5;

    float s = z + u_flow * (0.7 + fl * 0.45) + fl * 3.17;   // lattice moving outwards over time
    float cell = floor(s);
    float along = fract(s);

    float rnd = hash21(vec2(id + fl * 31.0, cell));
    float head = 0.1 * hash21(vec2(id + 7.0, cell + fl * 13.0));
    float exists = step(0.9, rnd);
    float streak = step(head, along) * smoothstep(head + trail, head, along);
    float width = smoothstep(0.22, 0.0, abs(across));

    col += pal(fract(rnd * 10.0)) * exists * streak * width * (0.5 + 2.0 * r) * smoothstep(0.0, 0.12, r) * 1.6;
  }
  return col;
}
