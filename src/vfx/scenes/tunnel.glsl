// Tunnel: polar coordinates, travel speed follows the music, kicks punch the vanishing point.
vec3 render(vec2 uv, vec2 p) {
  float r = length(p) + 1e-4;
  float a = atan(p.y, p.x) / 6.2831853;
  float z = 0.35 / (r + 0.03);                 // depth into the tunnel
  float t = u_flow;

  float twist = a + 0.12 * sin(z * 0.6 + u_time * 0.15) + t * 0.03;
  float rings = sin((z - t * 1.6) * 5.0 + u_bands[1] * 2.0);
  float spokes = sin(twist * 6.2831853 * 8.0);
  float cell = rings * spokes;
  float grid = smoothstep(-0.04, 0.10, cell);                       // crisp checker cells
  float edge = smoothstep(0.93, 1.0, abs(rings)) * 0.7;              // bright ring lines

  vec3 col = pal(z * 0.06 + t * 0.02) * (0.04 + 0.9 * grid)          // dark gaps, lit cells
           + pal(z * 0.06 + 0.5) * edge;
  col *= 0.55 + 0.9 * u_energy;

  col *= smoothstep(0.0, 0.22, r);                                  // fog at the vanishing point
  col += pal(t * 0.04 + 0.3) * u_pulse * 0.5 * exp(-r * 3.0);        // beat glow
  col += pal(0.9) * u_bands[4] * 0.12
       * hash21(floor(gl_FragCoord.xy / 3.0) + floor(u_time * 24.0)); // hi-hat shimmer
  return col;
}
