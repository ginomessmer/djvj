// Neon edges: the outline of whatever the camera sees, glowing in palette colours over a dim
// version of the image and a slow haze. Beats thicken the lines.
float edgeAt(vec2 uv, vec2 px) {
  float tl = cameraLuma(uv + px * vec2(-1.0, 1.0), 1.5);
  float tc = cameraLuma(uv + px * vec2(0.0, 1.0), 1.5);
  float tr = cameraLuma(uv + px * vec2(1.0, 1.0), 1.5);
  float ml = cameraLuma(uv + px * vec2(-1.0, 0.0), 1.5);
  float mr = cameraLuma(uv + px * vec2(1.0, 0.0), 1.5);
  float bl = cameraLuma(uv + px * vec2(-1.0, -1.0), 1.5);
  float bc = cameraLuma(uv + px * vec2(0.0, -1.0), 1.5);
  float br = cameraLuma(uv + px * vec2(1.0, -1.0), 1.5);
  float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);       // Sobel
  float gy = (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br);
  return length(vec2(gx, gy));
}

vec3 render(vec2 uv, vec2 p) {
  vec2 px = (1.6 + 1.6 * u_pulse) / u_res;
  // The noise floor of a dark camera sits around 0.1: only real contours get through.
  float edge = smoothstep(0.12, 0.42, edgeAt(uv, px));

  vec3 glow = pal(uv.y * 0.5 - uv.x * 0.2 + u_flow * 0.04) * edge;
  glow *= 0.9 + 0.5 * u_bands[3] + 0.3 * u_energy;
  vec3 image = cameraColor(uv, 3.0) * (0.04 + 0.12 * u_cameraPresence) * (0.6 + 0.4 * u_bands[1]);
  vec3 haze = pal(fbm(p * 1.4 + u_flow * 0.05) + 0.3) * 0.05;
  return haze + image + glow * 1.3;
}
