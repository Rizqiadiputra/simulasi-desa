// Membuat objek (pohon, atap) tembus pandang di antara kamera dan karakter pemain.
import * as THREE from 'three';

export const seeThrough = {
  uPlayer: { value: new THREE.Vector3() },
  uCam: { value: new THREE.Vector3() },
  uFade: { value: 0 },
};

export function makeSeeThrough(material) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, seeThrough);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSTPos;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        #ifdef USE_INSTANCING
          vSTPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vSTPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSTPos; uniform vec3 uPlayer; uniform vec3 uCam; uniform float uFade;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (uFade > 0.5) {
          vec3 cp = uPlayer - uCam; float L = length(cp); vec3 d = cp / L;
          vec3 v = vSTPos - uCam; float t = dot(v, d);
          if (t > 0.0 && t < L - 0.6) {
            float r = length(v - d * t);
            if (r < 1.4 || (r < 2.4 && mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 1.0)) discard;
          }
        }`);
  };
  material.customProgramCacheKey = () => 'seeThrough';
  return material;
}
