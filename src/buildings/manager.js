// Menempatkan mesh bangunan di scene, padi instanced untuk sawah, ghost untuk mode Bangun.
import * as THREE from 'three';
import { buildModel } from './models.js';
import { BUILDING_TYPES } from '../data/buildingTypes.js';
import { cellToWorld, CELL } from '../data/config.js';
import { localToWorld, effFootprint } from '../simulation/grid.js';
import { createWaterMaterial } from '../scene/terrain.js';
import { makeSeeThrough } from '../scene/seeThrough.js';
import { CollisionWorld, toWorldBox } from '../player/collision.js';

const RICE_PER_ROW = 7;
const _c = new THREE.Color();
const GREEN0 = new THREE.Color(0x9bdc5a), GREEN1 = new THREE.Color(0x4f9a32), YELLOW = new THREE.Color(0xd9c04a);

function riceGeo() {
  const parts = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const g = new THREE.ConeGeometry(0.06, 0.7, 3).translate(0, 0.35, 0).rotateZ(Math.cos(a) * 0.25).rotateX(Math.sin(a) * 0.25).translate(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08);
    parts.push(g.toNonIndexed());
  }
  const pos = []; for (const g of parts) pos.push(...g.attributes.position.array);
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}

export class BuildingManager {
  constructor(scene, state) {
    this.scene = scene; this.state = state;
    this.solidMat = makeSeeThrough(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    this.glowNightMat = new THREE.MeshBasicMaterial({ color: 0x2a1c10 });
    this.glowAlwaysMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.waterMat = createWaterMaterial();
    this.group = new THREE.Group();
    scene.add(this.group);
    this.objects = new Map(); // id -> Group
    this.collision = new CollisionWorld();
    this.pickables = [];

    this.riceMax = 64 * RICE_PER_ROW * RICE_PER_ROW;
    this.rice = new THREE.InstancedMesh(riceGeo(), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), this.riceMax);
    this.rice.count = 0;
    this.rice.receiveShadow = true;
    this.rice.setColorAt(0, _c.set(0xffffff));
    scene.add(this.rice);
    this.riceSlots = new Map(); // sawahId -> [start, count]

    for (const b of state.buildings) this.add(b, false);
    this.rebuildRice();

    // highlight seleksi
    this.selBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, depthTest: false }));
    this.selBox.visible = false;
    this.selBox.renderOrder = 10;
    scene.add(this.selBox);
  }

  add(b, animate = true) {
    const model = buildModel(b.type, b);
    const g = new THREE.Group();
    const { x, z } = cellToWorld(b.ci, b.cj);
    g.position.set(x, 0, z);
    g.rotation.y = (b.rot & 3) * (Math.PI / 2);
    const mk = (geom, mat, shadow) => {
      if (!geom) return;
      const m = new THREE.Mesh(geom, mat);
      m.userData.buildingId = b.id;
      if (shadow) { m.castShadow = true; m.receiveShadow = true; }
      g.add(m);
      this.pickables.push(m);
    };
    mk(model.solid, this.solidMat, true);
    mk(model.glowNight, this.glowNightMat, false);
    mk(model.glowAlways, this.glowAlwaysMat, false);
    mk(model.water, this.waterMat, false);
    g.userData = { id: b.id, torches: model.torches, lights: model.lights, rise: animate ? 0 : 1 };
    for (const lb of model.boxes) this.collision.add(toWorldBox(lb, x, z, b.rot));
    if (animate) g.scale.set(1, 0.01, 1);
    this.group.add(g);
    this.objects.set(b.id, g);
    if (b.type === 'sawah' && animate) this.rebuildRice();
    return g;
  }

  torchPoints() {
    const pts = [], lights = [];
    const v = new THREE.Vector3();
    for (const b of this.state.buildings) {
      const g = this.objects.get(b.id);
      if (!g) continue;
      g.updateMatrixWorld(true);
      const sy = g.scale.y; g.scale.y = 1; g.updateMatrixWorld(true);
      for (const [x, y, z] of g.userData.torches) { v.set(x, y, z).applyMatrix4(g.matrixWorld); pts.push(v.clone()); }
      if (BUILDING_TYPES[b.type].light && g.userData.lights[0]) { const [x, y, z] = g.userData.lights[0]; lights.push(new THREE.Vector3(x, y, z).applyMatrix4(g.matrixWorld)); }
      g.scale.y = sy; g.updateMatrixWorld(true);
    }
    // prioritaskan cahaya: pendopo, pasar, candi, gapura dulu
    return { pts, lights };
  }

  rebuildRice() {
    this.riceSlots.clear();
    let n = 0;
    for (const b of this.state.buildings) {
      if (b.type !== 'sawah') continue;
      const start = n;
      for (let a = 0; a < RICE_PER_ROW; a++) for (let c = 0; c < RICE_PER_ROW; c++) {
        const lx = -3.6 + a * 1.2, lz = -3.6 + c * 1.2;
        if (lx < -2.8 && lz > 2.8) continue; // pondok
        if (Math.abs(lx) < 0.3) continue; // pematang tengah
        if (n >= this.riceMax) break;
        n++;
      }
      this.riceSlots.set(b.id, [start, n - start]);
    }
    this.rice.count = n;
    this.updateRice();
  }

  updateRice() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const b of this.state.buildings) {
      const slot = this.riceSlots.get(b.id);
      if (!slot) continue;
      const pr = b.crop?.progress ?? 0;
      const sc = 0.22 + Math.min(1, pr / 0.72) * 0.85;
      if (pr < 0.5) _c.copy(GREEN0).lerp(GREEN1, pr / 0.5);
      else _c.copy(GREEN1).lerp(YELLOW, Math.min(1, (pr - 0.5) / 0.45));
      let k = slot[0];
      const h = b.level ?? 0.3;
      for (let a = 0; a < RICE_PER_ROW; a++) for (let c = 0; c < RICE_PER_ROW; c++) {
        const lx = -3.6 + a * 1.2, lz = -3.6 + c * 1.2;
        if (lx < -2.8 && lz > 2.8) continue;
        if (Math.abs(lx) < 0.3) continue;
        if (k >= slot[0] + slot[1]) break;
        const w = localToWorld(b, lx, lz);
        q.setFromAxisAngle(up, (a * 7 + c * 3) % 6);
        m.compose(p.set(w.x, h + 0.02, w.z), q, s.set(1.4, sc * (0.9 + ((a + c) % 3) * 0.08), 1.4));
        this.rice.setMatrixAt(k, m);
        this.rice.setColorAt(k, _c);
        k++;
      }
    }
    this.rice.instanceMatrix.needsUpdate = true;
    if (this.rice.instanceColor) this.rice.instanceColor.needsUpdate = true;
    this.rice.computeBoundingSphere();
  }

  select(b) {
    if (!b) { this.selBox.visible = false; return; }
    const [w, d] = effFootprint(b.type, b.rot);
    const { x, z } = cellToWorld(b.ci, b.cj);
    this.selBox.scale.set(w * CELL + 0.3, 0.02, d * CELL + 0.3);
    this.selBox.position.set(x, 0.12 + (b.level || 0), z);
    this.selBox.visible = true;
  }

  // Ghost pratinjau untuk mode bangun
  showGhost(type, ci, cj, rot, ok, data) {
    if (!this.ghost || this.ghost.userData.type !== type) {
      this.hideGhost();
      const model = buildModel(type, data || { level: 0.3 });
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.45, depthWrite: false });
      g.add(new THREE.Mesh(model.solid, mat));
      const [w, d] = BUILDING_TYPES[type].fp;
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(w * CELL, d * CELL).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.3, depthWrite: false }));
      pad.position.y = 0.08;
      g.add(pad);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.0, 3).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85, depthWrite: false }));
      arrow.position.set(0, 0.3, (d * CELL) / 2 + 1.0);
      g.add(arrow);
      g.userData = { type, mats: [mat, pad.material] };
      g.renderOrder = 8;
      this.ghost = g;
      this.scene.add(g);
    }
    const { x, z } = cellToWorld(ci, cj);
    this.ghost.position.set(x, 0, z);
    this.ghost.rotation.y = (rot & 3) * (Math.PI / 2);
    for (const m of this.ghost.userData.mats) m.color.set(ok ? 0x66ff88 : 0xff5a4a);
    this.ghost.visible = true;
  }
  hideGhost() {
    if (this.ghost) { this.scene.remove(this.ghost); this.ghost = null; }
  }

  update(dt, night, t) {
    this.glowNightMat.color.setRGB(0.16 + night * 1.0, 0.11 + night * 0.62, 0.06 + night * 0.2);
    this.glowAlwaysMat.color.setScalar(0.85 + Math.sin(t * 6) * 0.15);
    // animasi bangunan baru "tumbuh" dari tanah
    for (const g of this.objects.values()) {
      if (g.userData.rise >= 1) continue;
      g.userData.rise = Math.min(1, g.userData.rise + dt * 0.7);
      const k = g.userData.rise;
      g.scale.y = Math.max(0.01, 1 - Math.pow(1 - k, 3) + Math.sin(k * Math.PI) * 0.06);
      if (k >= 1) g.scale.y = 1;
    }
  }
}
