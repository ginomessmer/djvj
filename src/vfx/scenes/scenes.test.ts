import { describe, expect, it } from 'vitest';
import { SCENE_IDS } from '@/domain/show/scenes';
import { SCENE_SHADERS } from './index';

describe('scene shaders', () => {
  it.each(SCENE_IDS)('%s defines render(uv, p) and nothing the stage already provides', (id) => {
    const source = SCENE_SHADERS[id];
    expect(source).toMatch(/vec3\s+render\s*\(\s*vec2\s+uv\s*,\s*vec2\s+p\s*\)\s*\{/);
    expect(source).not.toMatch(/\bvoid\s+main\s*\(/); // the shared footer provides main()
    expect(source).not.toMatch(/#version/);
    expect(source).not.toMatch(/\buniform\b/); // uniforms come from the shared header
  });
});
