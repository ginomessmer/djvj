import type { SceneId } from '@/domain/show/scenes';
import ambient from './ambient.glsl?raw';
import aurora from './aurora.glsl?raw';
import deco from './deco.glsl?raw';
import fluid from './fluid.glsl?raw';
import glitch from './glitch.glsl?raw';
import glyphs from './glyphs.glsl?raw';
import grid from './grid.glsl?raw';
import halftone from './halftone.glsl?raw';
import kaleidoscope from './kaleidoscope.glsl?raw';
import lasers from './lasers.glsl?raw';
import lava from './lava.glsl?raw';
import neon from './neon.glsl?raw';
import orb from './orb.glsl?raw';
import rig from './rig.glsl?raw';
import rings from './rings.glsl?raw';
import starfield from './starfield.glsl?raw';
import tunnel from './tunnel.glsl?raw';
import voxels from './voxels.glsl?raw';

/** GLSL body of every scene. Typed by `SceneId`, so a scene without a shader does not compile. */
export const SCENE_SHADERS: Record<SceneId, string> = {
  aurora,
  lava,
  fluid,
  rings,
  grid,
  orb,
  kaleidoscope,
  tunnel,
  starfield,
  lasers,
  deco,
  voxels,
  rig,
  halftone,
  glyphs,
  neon,
  glitch,
  ambient,
};
