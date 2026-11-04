// Pohon beringin, kelapa, pisang & semak — semua InstancedMesh (1 draw call per jenis).
import * as THREE from 'three';
import { PartBuilder, geo } from '../buildings/builder.js';
import { C, HALF } from '../data/config.js';
import { mulberry32 } from '../core/rng.js';
import { outerHeight } from './terrain.js';
import { makeSeeThrough } from './seeThrough.js';

function treeGeo(type) {
  const b = new PartBuilder(type.length * 31);
  if (type === 'beringin') {
    b.cyl(0.5, 0.85, 3.4, 7, 0, 0, 0, 0x6b5440);
    for (let k = 0; k < 7; k++) { const a = k * 0.9; b.cyl(0.04, 0.05, 2.6, 3, Math.cos(a) * 1.9, 0.4, Math.sin(a) * 1.9, 0x5a4a38); }
    b.add(geo.ico(2.8), C.daunD, { y: 4.7, sy: 0.62 });
    b.add(geo.ico(2.1), C.daun, { x: 1.7, y: 4.1, z: 0.6, sy: 0.7 });
    b.add(geo.ico(2.0), C.daun, { x: -1.5, y: 4.3, z: -0.8, sy: 0.7 });
    b.add(geo.ico(1.7), 0x5a8c3e, { x: 0.2, y: 5.8, z: -0.4, sy: 0.75 });
  } else if (type === 'kelapa') {
    let x = 0, y = 0;
    for (let k = 0; k < 4; k++) { b.add(geo.cyl(0.15, 0.2, 1.4, 5), 0x8a6a4a, { x, y, rz: -0.07 * k }); x += 0.1 * k; y += 1.38; }
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const f = geo.box(2.7, 0.05, 0.5).translate(1.35, 0, 0).rotateZ(-0.5 - (k % 2) * 0.2);
      b.add(f, k % 2 ? C.daunL : C.daun, { x, y: y + 0.1, ry: a });
    }
    for (let k = 0; k < 3; k++) b.add(geo.ico(0.16), 0x6a4a2a, { x: x + Math.cos(k * 2) * 0.25, y: y - 0.15, z: Math.sin(k * 2) * 0.25 });
  } else if (type === 'pisang') {
    b.cyl(0.12, 0.16, 1.5, 5, 0, 0, 0, 0x7a8a4a);
    for (let k = 0; k < 5; k++) {
      const f = geo.box(1.6, 0.04, 0.55).translate(0.8, 0, 0).rotateZ(0.5);
      b.add(f, 0x7fb04a, { y: 1.4, ry: (k / 5) * Math.PI * 2 + 0.3 });
    }
  } else {
    b.add(geo.ico(0.8), 0x5d8a3c, { y: 0.5, sy: 0.7 });
    b.add(geo.ico(0.6), 0x6c9a44, { x: 0.6, y: 0.4, z: 0.2, sy: 0.7 });
  }
  return b.build().solid;
}

const TYPES = ['beringin', 'kelapa', 'pisang', 'semak'];

export class Vegetation {
  constructor(scene, state, opts = {}) {
    this.scene = scene; this.state = state;
    this.mat = makeSeeThrough(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    // dekorasi hutan di luar desa (deterministik, tidak disimpan di state)
    const r = mulberry32(99);
    this.decor = [];
    const n = opts.decor ?? 420;
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, d = HALF + 4 + Math.pow(r(), 0.8) * 150;
      const x = Math.cos(a) * d * 1.1, z = Math.sin(a) * d;
      if (Math.max(Math.abs(x), Math.abs(z)) < HALF + 2) continue;
      const t = r() < 0.42 ? 'kelapa' : r() < 0.25 ? 'beringin' : r() < 0.5 ? 'pisang' : 'semak';
      this.decor.push({ t, x, z, y: outerHeight(x, z), s: 0.8 + r() * 0.6, ry: r() * 6.28 });
    }
    this.meshes = {};
    for (const t of TYPES) {
      const m = new THREE.InstancedMesh(treeGeo(t), this.mat, 1200);
      m.castShadow = t !== 'semak';
      m.receiveShadow = true;
      m.count = 0;
      this.meshes[t] = m;
      scene.add(m);
    }
    this.refresh();
  }

  refresh() {
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const counts = Object.fromEntries(TYPES.map((t) => [t, 0]));
    const put = (tr) => {
      const m = this.meshes[tr.t];
      if (!m || counts[tr.t] >= 1200) return;
      q.setFromAxisAngle(up, tr.ry || 0);
      mtx.compose(p.set(tr.x, tr.y || 0, tr.z), q, s.setScalar(tr.s || 1));
      m.setMatrixAt(counts[tr.t]++, mtx);
    };
    this.state.trees.forEach(put);
    this.decor.forEach(put);
    for (const t of TYPES) { this.meshes[t].count = counts[t]; this.meshes[t].instanceMatrix.needsUpdate = true; this.meshes[t].computeBoundingSphere(); }
  }
}
