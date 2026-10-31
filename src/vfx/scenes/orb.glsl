// Orb: a raymarched sphere whose surface is pushed around by the bass, slowly orbited by the
// camera. The heaviest scene: rays that miss the bounding sphere are not marched at all.
float orbDistance(vec3 q) {
  float t = u_flow * 0.6;
  float push = 0.05 + 0.12 * u_bands[1] + 0.05 * u_pulse;
  float wobble = sin(q.x * 5.0 + t) * sin(q.y * 5.0 - t * 1.3) * sin(q.z * 5.0 + t * 0.7);
  return length(q) - (0.32 + 0.05 * u_energy) - push * wobble;
}

vec3 orbNormal(vec3 q) {
  vec2 e = vec2(0.003, 0.0);
  return normalize(vec3(
    orbDistance(q + e.xyy) - orbDistance(q - e.xyy),
    orbDistance(q + e.yxy) - orbDistance(q - e.yxy),
    orbDistance(q + e.yyx) - orbDistance(q - e.yyx)
  ));
}

vec3 render(vec2 uv, vec2 p) {
  const float BOUND = 0.7;                       // radius that always contains the orb

  float spin = u_flow * 0.12;
  mat2 turn = mat2(cos(spin), -sin(spin), sin(spin), cos(spin));
  vec3 ro = vec3(0.0, 0.0, -1.6);
  vec3 rd = normalize(vec3(p, 1.4));
  ro.xz = turn * ro.xz;
  rd.xz = turn * rd.xz;

  vec3 col = pal(0.78) * 0.08 * (1.0 - uv.y);

  float b = dot(ro, rd);
  float miss = sqrt(max(dot(ro, ro) - b * b, 0.0));          // distance of the ray from the centre
  col += pal(0.1) * exp(-miss * 5.0) * (0.2 + 0.5 * u_energy + 0.3 * u_pulse);   // halo

  if (miss < BOUND) {
    float t = -b - sqrt(BOUND * BOUND - miss * miss);        // where the ray enters the bound
    bool hit = false;
    for (int i = 0; i < 40; i++) {
      float d = orbDistance(ro + rd * t);
      if (d < 0.002) {
        hit = true;
        break;
      }
      t += d * 0.7;                                          // displaced: step carefully
      if (t > 3.0) break;
    }
    if (hit) {
      vec3 q = ro + rd * t;
      vec3 n = orbNormal(q);
      vec3 lightDir = normalize(vec3(-0.5, 0.7, -0.6));
      float facing = max(dot(n, -rd), 0.0);
      float diffuse = 0.4 + 0.6 * max(dot(n, lightDir), 0.0);
      float specular = pow(max(dot(reflect(rd, n), lightDir), 0.0), 28.0);
      float hue = 0.9 * (1.0 - facing) + n.y * 0.25 + u_flow * 0.02;       // shifts with the viewing angle
      vec3 base = pal(0.25 + 0.25 * sin(hue * 6.2831853));                  // only the bright palette colours
      col = base * diffuse * (0.7 + 0.6 * u_energy)
          + pal(0.5) * pow(1.0 - facing, 2.5) * 0.9
          + vec3(1.0) * specular * 0.8;
    }
  }
  return col;
}
