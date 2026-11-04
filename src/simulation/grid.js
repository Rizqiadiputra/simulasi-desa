// Grid peta desa: tipe sel, kepemilikan bangunan, tinggi permukaan, biaya jalan.
// Modul murni (tanpa three.js) supaya bisa dipakai simulasi offline / backend.
import { GRID, CELL, cellToWorld } from '../data/config.js';
import { BUILDING_TYPES } from '../data/buildingTypes.js';

export const T = { GRASS: 0, ROAD: 1, WATER: 2, BRIDGE: 3, BLOCK: 4, FIELD: 5 };
const COST = [3, 1, Infinity, 1, Infinity, 2.5];

export const key = (i, j) => `${i},${j}`;

// rot: 0 depan +z, 1 depan +x, 2 depan -z, 3 depan -x
export function effFootprint(type, rot) {
  const [w, d] = BUILDING_TYPES[type].fp;
  return rot % 2 ? [d, w] : [w, d];
}

export function footprintCells(type, ci, cj, rot) {
  const [w, d] = effFootprint(type, rot);
  const out = [];
  const i0 = ci - Math.floor(w / 2), j0 = cj - Math.floor(d / 2);
  for (let i = i0; i < i0 + w; i++) for (let j = j0; j < j0 + d; j++) out.push([i, j]);
  return out;
}

const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
export const rotDir = (rot) => DIRS[rot & 3];

export function doorCell(type, ci, cj, rot) {
  const [w, d] = effFootprint(type, rot);
  const [dx, dz] = DIRS[rot & 3];
  const off = dx ? Math.floor(w / 2) + 1 : Math.floor(d / 2) + 1;
  return [ci + dx * off, cj + dz * off];
}

// Rotasi offset sel lokal (di, dj) sesuai rot (konsisten dengan rotasi Y = rot*90°)
export function rotCell(di, dj, rot) {
  let a = di, b = dj;
  for (let k = 0; k < (rot & 3); k++) [a, b] = [b, -a];
  return [a, b];
}

export function passableCells(type, ci, cj, rot) {
  return (BUILDING_TYPES[type].passable || []).map(([di, dj]) => {
    const [a, b] = rotCell(di, dj, rot);
    return [ci + a, cj + b];
  });
}

export function localToWorld(b, lx, lz) {
  const c = cellToWorld(b.ci, b.cj);
  const t = (b.rot & 3) * (Math.PI / 2);
  const cos = Math.cos(t), sin = Math.sin(t);
  return { x: c.x + lx * cos + lz * sin, z: c.z - lx * sin + lz * cos };
}

export class Grid {
  constructor(state) {
    this.n = GRID;
    const N = GRID * GRID;
    this.type = new Uint8Array(N);
    this.owner = new Array(N).fill(null);
    this.height = new Float32Array(N);
    this.rebuild(state);
  }
  idx(i, j) { return j * this.n + i; }
  inBounds(i, j) { return i >= 0 && j >= 0 && i < this.n && j < this.n; }
  get(i, j) { return this.inBounds(i, j) ? this.type[this.idx(i, j)] : T.WATER; }
  cost(i, j) { return COST[this.get(i, j)]; }
  walkable(i, j) { return Number.isFinite(this.cost(i, j)); }
  heightAt(i, j) { return this.inBounds(i, j) ? this.height[this.idx(i, j)] : 0; }
  ownerAt(i, j) { return this.inBounds(i, j) ? this.owner[this.idx(i, j)] : null; }

  rebuild(state) {
    this.type.fill(T.GRASS); this.owner.fill(null); this.height.fill(0);
    for (const [i, j] of state.water) if (this.inBounds(i, j)) this.type[this.idx(i, j)] = T.WATER;
    for (const [i, j] of state.roads) this.setRoad(i, j);
    for (const b of state.buildings) this.markBuilding(b);
  }
  setRoad(i, j) {
    if (!this.inBounds(i, j)) return;
    const k = this.idx(i, j);
    if (this.type[k] === T.WATER || this.type[k] === T.BRIDGE) this.type[k] = T.BRIDGE;
    else if (this.type[k] === T.GRASS) this.type[k] = T.ROAD;
  }
  markBuilding(b) {
    const def = BUILDING_TYPES[b.type];
    const pass = new Set(passableCells(b.type, b.ci, b.cj, b.rot).map(([i, j]) => key(i, j)));
    for (const [i, j] of footprintCells(b.type, b.ci, b.cj, b.rot)) {
      if (!this.inBounds(i, j)) continue;
      const k = this.idx(i, j);
      this.owner[k] = b.id;
      if (pass.has(key(i, j))) { if (this.type[k] !== T.BRIDGE) this.type[k] = T.ROAD; continue; }
      if (def.walkable) { this.type[k] = T.FIELD; this.height[k] = b.level || 0.3; }
      else this.type[k] = T.BLOCK;
    }
  }

  // Validasi penempatan bangunan baru
  canPlace(type, ci, cj, rot) {
    const def = BUILDING_TYPES[type];
    const pass = new Set(passableCells(type, ci, cj, rot).map(([i, j]) => key(i, j)));
    for (const [i, j] of footprintCells(type, ci, cj, rot)) {
      if (i < 1 || j < 1 || i > this.n - 2 || j > this.n - 2) return { ok: false, reason: 'Terlalu mepet batas desa' };
      const t = this.get(i, j);
      if (pass.has(key(i, j))) { if (t !== T.ROAD && t !== T.GRASS) return { ok: false, reason: 'Jalur gerbang terhalang' }; continue; }
      if (t === T.WATER || t === T.BRIDGE) return { ok: false, reason: 'Tidak bisa membangun di atas kanal' };
      if (t === T.ROAD) return { ok: false, reason: 'Jangan menutup jalan desa' };
      if (t !== T.GRASS) return { ok: false, reason: 'Sudah ada bangunan di situ' };
    }
    if (def.role === 'gate') return { ok: true };
    const [di, dj] = doorCell(type, ci, cj, rot);
    const t = this.get(di, dj);
    if (!this.inBounds(di, dj) || !(t === T.GRASS || t === T.ROAD || t === T.FIELD || t === T.BRIDGE))
      return { ok: false, reason: 'Pintu depan terhalang, coba putar' };
    if (!this.pathToRoad(di, dj, footprintCells(type, ci, cj, rot))) return { ok: false, reason: 'Tidak ada jalan menuju bangunan' };
    return { ok: true };
  }

  // BFS dari (i,j) ke sel jalan terdekat; return daftar sel (tanpa sel jalan tujuan) atau null.
  pathToRoad(si, sj, extraBlocked = []) {
    const blocked = new Set(extraBlocked.map(([i, j]) => key(i, j)));
    const st = this.get(si, sj);
    if (st === T.ROAD || st === T.BRIDGE) return [];
    const prev = new Map([[key(si, sj), null]]);
    const q = [[si, sj]];
    while (q.length) {
      const [i, j] = q.shift();
      for (const [dx, dz] of DIRS) {
        const ni = i + dx, nj = j + dz, k = key(ni, nj);
        if (!this.inBounds(ni, nj) || prev.has(k) || blocked.has(k)) continue;
        const t = this.get(ni, nj);
        if (t === T.ROAD || t === T.BRIDGE) {
          const path = []; let cur = key(i, j);
          while (cur) { path.push(cur.split(',').map(Number)); cur = prev.get(cur); }
          return path.reverse();
        }
        if (t === T.GRASS || t === T.FIELD) { prev.set(k, key(i, j)); q.push([ni, nj]); }
      }
      if (prev.size > 900) break;
    }
    return null;
  }
}

export const CELL_SIZE = CELL;
