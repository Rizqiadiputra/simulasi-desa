// Obor & pelita: api instanced + glow sprite additive + beberapa PointLight di titik penting.
import * as THREE from 'three';
import { GLOW_TEX } from './sky.js';

export class TorchSystem {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.max = 400;
    this.flameMat = new THREE.MeshBasicMaterial({ color: 0xffb347, fog: false });
    this.flames = new THREE.InstancedMesh(new THREE.ConeGeometry(0.09, 0.32, 5).translate(0, 0.16, 0), this.flameMat, this.max);
    this.flames.count = 0;
    this.flames.frustumCulled = false;
    scene.add(this.flames);

    this.glowGeo = new THREE.BufferGeometry();
    this.glowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.max * 3), 3));
    this.glowMat = new THREE.PointsMaterial({ map: GLOW_TEX(), color: 0xffa04a, size: 3.2, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.glow = new THREE.Points(this.glowGeo, this.glowMat);
    this.glow.frustumCulled = false;
    scene.add(this.glow);

    this.lights = [];
    for (let k = 0; k < (opts.lights ?? 4); k++) {
      const l = new THREE.PointLight(0xff9a4a, 0, 16, 1.6);
      scene.add(l); this.lights.push(l);
    }
    this.points = [];
    this.mtx = new THREE.Matrix4();
  }

  setPoints(points, lightPoints) {
    this.points = points.slice(0, this.max);
    const arr = this.glowGeo.attributes.position.array;
    this.points.forEach((p, k) => arr.set([p.x, p.y + 0.15, p.z], k * 3));
    this.glowGeo.setDrawRange(0, this.points.length);
    this.glowGeo.attributes.position.needsUpdate = true;
    this.flames.count = this.points.length;
    this.lights.forEach((l, k) => {
      const p = lightPoints[k];
      if (p) { l.position.set(p.x, p.y, p.z); l.userData.on = true; } else l.userData.on = false;
    });
  }

  update(night, t) {
    const on = night > 0.05;
    this.flames.visible = on;
    this.glow.visible = on;
    this.glowMat.opacity = night * 0.85;
    this.glowMat.size = 3.0 + Math.sin(t * 9) * 0.15;
    if (on) {
      for (let k = 0; k < this.points.length; k++) {
        const p = this.points[k];
        const f = 0.8 + Math.sin(t * 13 + k * 1.7) * 0.15 + Math.sin(t * 7.3 + k) * 0.1;
        this.mtx.makeScale(night * 0.9, night * f * 1.2, night * 0.9).setPosition(p.x, p.y, p.z);
        this.flames.setMatrixAt(k, this.mtx);
      }
      this.flames.instanceMatrix.needsUpdate = true;
    }
    this.lights.forEach((l, k) => { l.intensity = l.userData.on ? night * (14 + Math.sin(t * 11 + k * 2) * 2.5) : 0; });
  }
}
