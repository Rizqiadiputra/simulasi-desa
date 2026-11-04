// Model warga low-poly via InstancedMesh: kain, badan, kulit (kepala+lengan), tutup kepala, tombak.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const ni = (g) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); return g; };
const merge = (...gs) => { const m = mergeGeometries(gs.map(ni)); m.computeVertexNormals(); return m; };

const PARTS = {
  kain: () => new THREE.CylinderGeometry(0.19, 0.25, 0.56, 6).translate(0, 0.28, 0),
  torso: () => new THREE.CylinderGeometry(0.2, 0.17, 0.42, 6).translate(0, 0.76, 0),
  skin: () => merge(
    new THREE.IcosahedronGeometry(0.16, 0).translate(0, 1.13, 0.01),
    new THREE.CylinderGeometry(0.05, 0.045, 0.42, 4).translate(0.24, 0.72, 0),
    new THREE.CylinderGeometry(0.05, 0.045, 0.42, 4).translate(-0.24, 0.72, 0),
    new THREE.CylinderGeometry(0.06, 0.07, 0.06, 5).translate(0, 0.98, 0),
  ),
  caping: () => new THREE.ConeGeometry(0.42, 0.2, 8).translate(0, 1.33, 0),
  udeng: () => new THREE.CylinderGeometry(0.17, 0.17, 0.09, 6).translate(0, 1.21, 0),
  sanggul: () => merge(new THREE.IcosahedronGeometry(0.11, 0).translate(0, 1.17, -0.15), new THREE.IcosahedronGeometry(0.16, 0).scale(1, 0.55, 1).translate(0, 1.22, -0.02)),
  kuluk: () => new THREE.CylinderGeometry(0.11, 0.15, 0.22, 6).translate(0, 1.34, 0),
  tombak: () => merge(new THREE.CylinderGeometry(0.025, 0.025, 2.0, 4).translate(0.3, 1.0, 0.05), new THREE.ConeGeometry(0.06, 0.25, 4).translate(0.3, 2.12, 0.05)),
};

export const SKIN = [0x9c6a46, 0x8a5a3a, 0xa87650, 0x7d5034];
const KEMBEN = [0x8e2a22, 0x2f4b7a, 0x5f7a3a, 0xa5552e];
const KAIN = {
  petani: [0x6b4a32, 0x5a3e2a, 0x7a5a3a, 0x60472f], pedagang: [0x2f4b7a, 0x3a3f6e, 0x6a2f5a, 0x2f5a6a],
  pandai_besi: [0x3a3a3a, 0x2e2a28, 0x44403a, 0x383028], pengrajin: [0xa5552e, 0x9a4a2a, 0xb06a3a, 0x8a4a30],
  prajurit: [0x8e2a22, 0x8e2a22, 0x7a2420, 0x9a3026], pendeta: [0xe9e2cf, 0xefe6d0, 0xe0d6bc, 0xf0e8d6],
  anak: [0xc9a46a, 0xb98a5a, 0xd0b07a, 0xa87a4a], akuwu: [0x7a1f2b, 0x7a1f2b, 0x7a1f2b, 0x7a1f2b],
};

export class NPCModel {
  constructor(scene, cap = 512, shadows = true) {
    this.cap = cap;
    this.mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    this.meshes = {};
    const tmp = new THREE.Color(1, 1, 1);
    for (const [k, f] of Object.entries(PARTS)) {
      const m = new THREE.InstancedMesh(f(), this.mat, cap);
      m.count = 0;
      m.castShadow = shadows && (k === 'kain' || k === 'torso' || k === 'caping');
      m.frustumCulled = false;
      for (let i = 0; i < cap; i++) m.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
      m.setColorAt(0, tmp);
      scene.add(m);
      this.meshes[k] = m;
    }
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.used = 0;
    this.parts = []; // per indeks: set part aktif
  }

  // Tentukan warna & aksesoris dari data warga
  setup(idx, c) {
    const col = new THREE.Color();
    const skin = SKIN[c.look?.skin ?? 0];
    const L = c.gender === 'L';
    const kain = c.look?.kainHex ?? (KAIN[c.profession] || KAIN.petani)[c.look?.cloth ?? 0];
    let torso = L ? skin : c.look?.kainHex ?? KEMBEN[c.look?.cloth ?? 0];
    if (c.profession === 'prajurit') torso = 0x5a2a1e;
    if (c.profession === 'pendeta') torso = L ? 0xd9a441 : 0xe9e2cf;
    const parts = new Set(['kain', 'torso', 'skin']);
    let hat = null, hatCol = 0x3a2a20;
    if (c.profession === 'petani') { hat = 'caping'; hatCol = 0xd8c27a; }
    else if (c.profession === 'akuwu') { hat = 'kuluk'; hatCol = 0xd4a43a; }
    else if (c.profession === 'pendeta') { hat = L ? 'kuluk' : 'sanggul'; hatCol = L ? 0xefe6d0 : 0x1a1410; }
    else if (!L) { hat = 'sanggul'; hatCol = 0x1a1410; }
    else if (c.profession === 'prajurit') { hat = 'udeng'; hatCol = 0xa83a2c; }
    else if (c.profession !== 'anak') { hat = 'udeng'; hatCol = c.profession === 'pandai_besi' ? 0x222222 : 0x4a3424; }
    if (hat) parts.add(hat);
    if (c.profession === 'prajurit') parts.add('tombak');
    this.meshes.kain.setColorAt(idx, col.set(kain));
    this.meshes.torso.setColorAt(idx, col.set(torso));
    this.meshes.skin.setColorAt(idx, col.set(skin));
    if (hat) this.meshes[hat].setColorAt(idx, col.set(hatCol));
    if (parts.has('tombak')) this.meshes.tombak.setColorAt(idx, col.set(0x6a4a2a));
    this.parts[idx] = parts;
    for (const m of Object.values(this.meshes)) {
      m.count = Math.max(m.count, idx + 1);
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  alloc() { return this.used++; }

  set(idx, matrix, visible) {
    const parts = this.parts[idx];
    for (const [k, m] of Object.entries(this.meshes)) m.setMatrixAt(idx, visible && parts?.has(k) ? matrix : this.zero);
  }
  flush() { for (const m of Object.values(this.meshes)) m.instanceMatrix.needsUpdate = true; }
}
