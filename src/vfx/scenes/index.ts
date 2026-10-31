import type { SceneId } from '@/domain/show/scenes';
import ambient from './ambient.glsl?raw';
import fluid from './fluid.glsl?raw';
import rings from './rings.glsl?raw';
import tunnel from './tunnel.glsl?raw';

/** GLSL body of every scene. Typed by `SceneId`, so a scene without a shader does not compile. */
export const SCENE_SHADERS: Record<SceneId, string> = { tunnel, rings, fluid, ambient };
