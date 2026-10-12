import { MeshLambertMaterial, type Texture, type WebGLProgramParametersWithUniforms } from 'three';
import { ATLAS_TILES } from './textures';

/**
 * One material for the whole city: Lambert + vertex colours + an atlas texture whose tile is
 * chosen per vertex. The patch wraps the UV inside the tile with fract() and samples with
 * explicit gradients so mip-mapping does not bleed across tile seams.
 */
export function makeCityMaterial(atlas: Texture): MeshLambertMaterial {
  const mat = new MeshLambertMaterial({ vertexColors: true, map: atlas });
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float tile;\nvarying float vTile;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvTile = tile;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vTile;')
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
  float tileN = ${ATLAS_TILES.toFixed(1)};
  vec2 tileOrigin = vec2(mod(vTile, tileN), floor(vTile / tileN)) / tileN;
  vec2 tuv = tileOrigin + fract(vMapUv) / tileN;
  vec4 sampledDiffuseColor = textureGrad(map, tuv, dFdx(vMapUv) / tileN, dFdy(vMapUv) / tileN);
  diffuseColor *= sampledDiffuseColor;
#endif`,
      );
  };
  return mat;
}
