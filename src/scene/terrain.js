// Tanah desa, kanal air, jalan tanah, jembatan, perbukitan & gunung di kejauhan.
import * as THREE from 'three';
import { GRID, CELL, HALF, C, cellToWorld } from '../data/config.js';
import { T } from '../simulation/grid.js';
import { PartBuilder, geo } from '../buildings/builder.js';
import { mulberry32 } from '../core/rng.js';
import { smoothstep } from '../core/util.js';

export const WATER_Y = -0.32;

export function outerHeight(x, z) {
  const d = Math.max(Math.abs(x), Math.abs(z)) - HALF;
  if (d <= 0) return 0;
  const n = Math.sin(x * 0.045) * Math.cos(z * 0.05) + Math.sin((x + z) * 0.09) * 0.5 + Math.cos(x * 0.13 - z * 0.07) * 0.3;
  return (n * 2.2 + 2.4) * smoothstep(0, 26, d) + Math.max(0, d - 30) * 0.12;
}

export function createWaterMaterial() {
  return new THREE.MeshPhongMaterial({ color: C.air, specular: 0x9fd4e6, shininess: 70, flatShading: true, transparent: true, opacity: 0.92 });
}

export class Terrain {
  constructor(scene, state, grid) {
    this.scene = scene; this.state = state; this.grid = grid;
    this.waterMat = createWaterMaterial();
    this.vcMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildGround();
    this.buildOuter();
    this.buildMountains();
    this.buildWater();
    this.roadMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, 0.06, CELL).translate(0, 0.0, 0), new THREE.MeshLambertMaterial(), GRID * GRID);
    this.roadMesh.receiveShadow = true;
    this.roadMesh.name = 'roads';
    this.group.add(this.roadMesh);
    this.refreshRoads();
  }

  buildGround() {
    const r = mulberry32(7);
    const pos = [], col = [];
    const c = new THREE.Color();
    const base = new THREE.Color(C.rumput), dark = new THREE.Color(0x6a9446), dry = new THREE.Color(0x9aa457);
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
      if (this.grid.get(i, j) === T.WATER || this.grid.get(i, j) === T.BRIDGE) continue;
      const x0 = (i - GRID / 2) * CELL, z0 = (j - GRID / 2) * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
      pos.push(x0, 0, z0, x0, 0, z1, x1, 0, z0, x1, 0, z0, x0, 0, z1, x1, 0, z1);
      c.copy(base).lerp(r() < 0.5 ? dark : dry, r() * 0.45);
      for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, this.vcMat);
    m.receiveShadow = true; m.name = 'ground';
    this.ground = m;
    this.group.add(m);
  }

  buildOuter() {
    const size = 520, seg = 130; // 4 unit per segmen, tepi desa jatuh tepat di ±48
    const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    const cols = new Float32Array(p.count * 3);
    const c = new THREE.Color(), lo = new THREE.Color(0x76a24c), hi = new THREE.Color(0x4f7a3a), far = new THREE.Color(0x5f7f55);
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), z = p.getZ(k);
      const h = outerHeight(x, z);
      p.setY(k, h - (Math.max(Math.abs(x), Math.abs(z)) < HALF - 0.01 ? 0.5 : 0));
      c.copy(lo).lerp(hi, Math.min(1, h / 8)).lerp(far, smoothstep(90, 240, Math.hypot(x, z)));
      cols[k * 3] = c.r; cols[k * 3 + 1] = c.g; cols[k * 3 + 2] = c.b;
    }
    // buang segitiga di dalam area desa
    const idx = g.index.array, keep = [];
    for (let t = 0; t < idx.length; t += 3) {
      let cx = 0, cz = 0;
      for (let q = 0; q < 3; q++) { cx += p.getX(idx[t + q]); cz += p.getZ(idx[t + q]); }
      if (Math.abs(cx / 3) < HALF && Math.abs(cz / 3) < HALF) continue;
      keep.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    g.setIndex(keep);
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, this.vcMat);
    m.receiveShadow = true;
    this.group.add(m);
  }

  buildMountains() {
    const b = new PartBuilder(3);
    const peaks = [
      [70, -250, 75, 82, 0x5c7a5e], // mirip Penanggungan
      [-80, -280, 110, 96, 0x557058], // Welirang–Arjuno
      [-150, -250, 70, 70, 0x5e7660],
      [200, -230, 80, 58, 0x627b62],
      [-260, -60, 70, 48, 0x66805f],
      [260, 60, 80, 44, 0x6a8460],
    ];
    for (const [x, z, r, h, col] of peaks) {
      b.add(geo.cone(r, h, 9), col, { x, y: -2, z, ry: x * 0.1 });
      b.add(geo.cone(r * 0.3, h * 0.28, 7), 0x7d8a7a, { x: x + r * 0.08, y: h * 0.7 - 2, z: z + r * 0.05 });
    }
    const out = b.build();
    const m = new THREE.Mesh(out.solid, this.vcMat);
    this.group.add(m);
  }

  buildWater() {
    const b = new PartBuilder(11);
    const waterQuads = [];
    const isW = (i, j) => { const t = this.grid.get(i, j); return t === T.WATER || t === T.BRIDGE; };
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
      if (!isW(i, j)) continue;
      const { x, z } = cellToWorld(i, j);
      waterQuads.push([x, z]);
      b.box(CELL, 0.1, CELL, x, -0.85, z, 0x3c4a3c);
      // tanggul bata di sisi yang bukan air
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + dx, nj = j + dz;
        const edge = ni < 0 || nj < 0 || ni >= GRID || nj >= GRID;
        if (!edge && isW(ni, nj)) continue;
        const ex = x + dx * CELL / 2, ez = z + dz * CELL / 2;
        if (dx) { b.box(0.2, 0.9, CELL, ex - dx * 0.1, -0.85, ez, C.bataD); if (!edge) b.box(0.4, 0.14, CELL + 0.02, ex, -0.02, ez, C.bataL); }
        else { b.box(CELL, 0.9, 0.2, ex, -0.85, ez - dz * 0.1, C.bataD); if (!edge) b.box(CELL + 0.02, 0.14, 0.4, ex, -0.02, ez, C.bataL); }
      }
    }
    const out = b.build();
    if (out.solid) { const m = new THREE.Mesh(out.solid, this.vcMat); m.receiveShadow = true; this.group.add(m); }
    const wg = new THREE.PlaneGeometry(CELL, CELL).rotateX(-Math.PI / 2);
    const water = new THREE.InstancedMesh(wg, this.waterMat, waterQuads.length);
    const mtx = new THREE.Matrix4();
    waterQuads.forEach(([x, z], k) => { mtx.makeTranslation(x, WATER_Y, z); water.setMatrixAt(k, mtx); });
    water.receiveShadow = true;
    this.group.add(water);
    this.water = water;
  }

  refreshRoads() {
    const r = mulberry32(5);
    const mtx = new THREE.Matrix4(), c = new THREE.Color();
    const base = new THREE.Color(C.tanah), alt = new THREE.Color(0xb7976a);
    let n = 0;
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
      const t = this.grid.get(i, j);
      if (t !== T.ROAD) continue;
      const { x, z } = cellToWorld(i, j);
      mtx.makeTranslation(x, 0.0, z);
      this.roadMesh.setMatrixAt(n, mtx);
      this.roadMesh.setColorAt(n, c.copy(base).lerp(alt, r()));
      n++;
    }
    this.roadMesh.count = n;
    this.roadMesh.instanceMatrix.needsUpdate = true;
    if (this.roadMesh.instanceColor) this.roadMesh.instanceColor.needsUpdate = true;
    this.buildBridges();
  }

  buildBridges() {
    if (this.bridges) { this.group.remove(this.bridges); this.bridges.geometry.dispose(); }
    const b = new PartBuilder(21);
    let any = false;
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
      if (this.grid.get(i, j) !== T.BRIDGE) continue;
      any = true;
      const { x, z } = cellToWorld(i, j);
      const alongX = this.grid.get(i - 1, j) !== T.WATER && this.grid.get(i + 1, j) !== T.WATER;
      const ry = alongX ? 0 : Math.PI / 2;
      b.add(geo.box(CELL + 0.6, 0.22, CELL - 0.2), C.kayu, { x, y: 0.02, z, ry });
      for (const s of [-1, 1]) {
        const ox = alongX ? 0 : s * (CELL / 2 - 0.15), oz = alongX ? s * (CELL / 2 - 0.15) : 0;
        b.add(geo.box(CELL + 0.6, 0.08, 0.1), C.kayuD, { x: x + ox, y: 0.62, z: z + oz, ry });
        for (const t of [-1, 0, 1]) b.cyl(0.05, 0.05, 0.62, 4, x + ox + (alongX ? t * 1.1 : 0), 0.02, z + oz + (alongX ? 0 : t * 1.1), C.kayuD);
      }
      b.add(geo.box(alongX ? 0.3 : CELL, 0.9, alongX ? CELL : 0.3), C.bataD, { x, y: -0.85, z });
    }
    if (!any) return;
    const out = b.build();
    this.bridges = new THREE.Mesh(out.solid, this.vcMat);
    this.bridges.castShadow = true; this.bridges.receiveShadow = true;
    this.group.add(this.bridges);
  }

  update(t) {
    // kilau air pelan
    this.waterMat.color.setHSL(0.53, 0.45, 0.43 + Math.sin(t * 0.7) * 0.015);
  }
}
