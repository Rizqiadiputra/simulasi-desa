// Perilaku warga: membaca jadwal, mencari jalan (A*), berjalan, beraktivitas, tidur.
import * as THREE from 'three';
import { NPCModel } from './model.js';
import { findPath } from './pathfinding.js';
import { BUILDING_TYPES } from '../data/buildingTypes.js';
import { cellToWorld, worldToCell } from '../data/config.js';
import { doorCell, passableCells, localToWorld } from '../simulation/grid.js';
import { clamp } from '../core/util.js';

const UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3();
const rnd = (a, b) => a + Math.random() * (b - a);

const PATROL_TYPES = ['gapura_bentar', 'pos_jaga', 'pendopo', 'pasar', 'gapura_paduraksa', 'petirtaan', 'pura'];
const KELILING_TYPES = ['pendopo', 'pasar', 'sawah', 'terakota', 'pande', 'lumbung'];
const WANDER_TYPES = ['pendopo', 'petirtaan', 'pasar', 'lumbung', 'pura', 'gapura_bentar'];

export class NPCManager {
  constructor(scene, sim, opts = {}) {
    this.sim = sim; this.state = sim.state; this.grid = sim.grid;
    this.model = new NPCModel(scene, 600, opts.shadows !== false);
    this.npcs = new Map();
    this.list = [];
    this.checkT = 0;
    for (const c of this.state.citizens) this.add(c, { teleport: true });
  }

  add(c, { teleport = false, arrive = false } = {}) {
    const idx = this.model.alloc();
    this.model.setup(idx, c);
    const npc = {
      c, idx, x: 0, z: 0, y: 0, yaw: Math.random() * 6.28, path: [], mode: 'stay', act: null, actKey: '',
      speed: rnd(1.7, 2.3) * (c.profession === 'anak' ? 1.15 : 1), ox: rnd(-0.45, 0.45), oz: rnd(-0.45, 0.45),
      phase: Math.random() * 10, idleT: rnd(1, 4), wait: 0, spot: null, radius: 0.7, bId: null, scale: (c.profession === 'anak' ? 0.62 + Math.min(c.age, 12) * 0.015 : 1) * (c.look?.h || 1),
      dest: '',
    };
    this.npcs.set(c.id, npc);
    this.list.push(npc);
    if (arrive) {
      const gate = this.state.buildings.find((b) => b.type === 'gapura_bentar');
      const cell = gate ? passableCells(gate.type, gate.ci, gate.cj, gate.rot)[0] : [1, 24];
      const w = cellToWorld(cell[0] - 1, cell[1]);
      Object.assign(npc, { x: w.x, z: w.z });
      this.plan(npc, this.sim.activityOf(c), false);
      npc.arriving = true;
    } else this.plan(npc, this.sim.activityOf(c), teleport);
    return npc;
  }

  refreshLook(c) { const n = this.npcs.get(c.id); if (n) { this.model.setup(n.idx, c); n.actKey = ''; } }

  // ---------------------------------------------------------------- tujuan
  nearest(types, from) {
    let best = null, bd = Infinity;
    for (const b of this.state.buildings) {
      if (!types.includes(b.type)) continue;
      const w = cellToWorld(b.ci, b.cj);
      const d = from ? Math.hypot(w.x - from.x, w.z - from.z) : 0;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  first(type) { return this.state.buildings.find((b) => b.type === type); }

  doorOf(b) {
    if (BUILDING_TYPES[b.type].role === 'gate') return passableCells(b.type, b.ci, b.cj, b.rot)[0];
    return doorCell(b.type, b.ci, b.cj, b.rot);
  }

  spotIn(b, list, extraY = 0) {
    const s = list[Math.floor(Math.random() * list.length)];
    const w = localToWorld(b, s[0] + rnd(-0.25, 0.25), s[1] + rnd(-0.25, 0.25));
    return { x: w.x, z: w.z, y: (s[2] || 0) + extraY };
  }

  resolve(npc, act) {
    const c = npc.c, st = this.state;
    const home = this.sim.building(c.homeId);
    let b = null, spots = null, radius = 0.6;
    switch (act.place) {
      case 'home': b = home; break;
      case 'work': b = this.sim.building(c.workId) || home; break;
      case 'pasar': b = this.nearest(['pasar'], home && cellToWorld(home.ci, home.cj)); spots = b && BUILDING_TYPES.pasar.gather; break;
      case 'candi': b = this.first('candi') || this.first('pura') || this.first('pendopo'); spots = b && BUILDING_TYPES[b.type].gather; radius = 0.3; break;
      case 'pendopo': b = this.first('pendopo'); spots = b && BUILDING_TYPES.pendopo.gather; radius = 0.4; break;
      case 'petirtaan': b = this.nearest(['petirtaan'], home && cellToWorld(home.ci, home.cj)) || home; break;
      case 'patrol': case 'wander': {
        const types = act.place === 'wander' ? WANDER_TYPES : c.profession === 'akuwu' ? KELILING_TYPES : PATROL_TYPES;
        const opts = st.buildings.filter((x) => types.includes(x.type) && x.id !== npc.lastWander);
        b = opts[Math.floor(Math.random() * opts.length)] || home;
        npc.lastWander = b?.id;
        return { b, door: this.doorOf(b), spot: null, roam: true };
      }
      default: b = home;
    }
    if (!b) b = home;
    if (!b) return null;
    const def = BUILDING_TYPES[b.type];
    const door = this.doorOf(b);
    let spot;
    if (!act.visible) { const w = cellToWorld(door[0], door[1]); spot = { x: w.x, z: w.z, y: 0 }; }
    else if (def.walkable) { spot = this.spotIn(b, [[rnd(-3, 3), rnd(-3, 3), 0]], b.level || 0.3); radius = 3.2; }
    else spot = this.spotIn(b, spots || def.spots || [[0, 0, 0]]);
    return { b, door, spot, radius };
  }

  plan(npc, act, teleport) {
    npc.act = act;
    npc.actKey = act.key;
    const tgt = this.resolve(npc, act);
    if (!tgt) return;
    npc.target = tgt;
    npc.bId = tgt.b.id;
    npc.radius = tgt.radius || 0.6;
    npc.dest = tgt.b.name;
    const doorW = cellToWorld(tgt.door[0], tgt.door[1]);
    const final = tgt.spot || { x: doorW.x + npc.ox * 2, z: doorW.z + npc.oz * 2, y: 0 };
    npc.spot = final;
    if (teleport) {
      Object.assign(npc, { x: final.x, z: final.z, y: final.y, path: [] });
      this.arrive(npc);
      return;
    }
    const pts = [];
    let { i, j } = worldToCell(npc.x, npc.z);
    if (!this.grid.walkable(i, j) || (this.grid.ownerAt(i, j) && this.grid.ownerAt(i, j) !== tgt.b.id && !BUILDING_TYPES[this.sim.building(this.grid.ownerAt(i, j))?.type]?.walkable)) {
      const ob = this.sim.building(this.grid.ownerAt(i, j));
      if (ob) { const d = this.doorOf(ob); const w = cellToWorld(d[0], d[1]); pts.push({ x: w.x, z: w.z, y: 0 }); [i, j] = d; }
    }
    const path = findPath(this.grid, i, j, tgt.door[0], tgt.door[1]);
    if (!path) { Object.assign(npc, { x: final.x, z: final.z, y: final.y, path: [] }); this.arrive(npc); return; }
    for (let k = 1; k < path.length; k++) {
      const [pi, pj] = path[k];
      const w = cellToWorld(pi, pj);
      pts.push({ x: w.x + npc.ox, z: w.z + npc.oz, y: this.grid.heightAt(pi, pj) });
    }
    pts.push(final);
    npc.path = pts;
    npc.mode = 'walk';
  }

  arrive(npc) {
    npc.path = [];
    if (npc.arriving) npc.arriving = false;
    if (!npc.act.visible) { npc.mode = 'hidden'; return; }
    npc.mode = 'stay';
    npc.idleT = rnd(1.5, 5);
    if (npc.target?.roam) npc.wait = rnd(3, 7);
    npc.home = { ...npc.spot };
  }

  resync() { for (const n of this.list) this.plan(n, this.sim.activityOf(n.c), true); }

  // ---------------------------------------------------------------- update
  update(dt, t, speedMul) {
    const hour = this.sim.hour;
    this.checkT -= dt;
    const check = this.checkT <= 0;
    if (check) this.checkT = 0.3;
    const sp = clamp(speedMul, 1, 14);
    const pl = this.sim.state.player;
    for (const n of this.list) {
      if (n.chatting && n.mode !== 'hidden') {
        // diajak ngobrol: berhenti (jalur disimpan) & menghadap lawan bicara bila dekat
        const near = pl && Math.hypot(pl.x - n.x, pl.z - n.z) < 6;
        if (near) n.yaw = Math.atan2(pl.x - n.x, pl.z - n.z);
        if (n.mode === 'walk' && n.slow) { n.mode = 'stay'; n.path = []; }
        if (n.mode === 'stay' || near) { n.idleT = 3; _q.setFromAxisAngle(UP, n.yaw); _m.compose(_p.set(n.x, n.y, n.z), _q, _s.setScalar(n.scale)); this.model.set(n.idx, _m, true); continue; }
      }
      if (check) {
        const act = this.sim.activityOf(n.c, hour);
        if (act.key !== n.actKey) this.plan(n, act, false);
        else n.act = act;
      }
      if (n.mode === 'stay' && n.target?.roam) {
        n.wait -= dt * sp;
        if (n.wait <= 0) this.plan(n, n.act, false);
      }
      let moving = false;
      if (n.mode === 'walk' && n.path.length) {
        const p = n.path[0];
        const dx = p.x - n.x, dz = p.z - n.z, d = Math.hypot(dx, dz);
        const step = n.speed * sp * dt * (n.slow ? 0.4 : 1);
        if (d <= step) { n.x = p.x; n.z = p.z; n.y = p.y; n.path.shift(); if (!n.path.length) { if (n.slow) { n.slow = false; n.mode = 'stay'; n.idleT = rnd(2, 6); } else this.arrive(n); } }
        else { n.x += (dx / d) * step; n.z += (dz / d) * step; n.y += (p.y - n.y) * Math.min(1, step / d); n.yaw = Math.atan2(dx, dz); }
        moving = true;
      } else if (n.mode === 'stay') {
        n.idleT -= dt;
        if (n.idleT <= 0 && n.home) {
          const a = Math.random() * 6.28, r = Math.random() * n.radius;
          n.path = [{ x: n.home.x + Math.cos(a) * r, z: n.home.z + Math.sin(a) * r, y: n.home.y }];
          n.slow = true; n.mode = 'walk';
        }
      }
      // matriks
      if (n.mode === 'hidden') { this.model.set(n.idx, null, false); continue; }
      n.phase += dt * (moving ? 9 * Math.min(sp, 3) : 2);
      const bob = moving ? Math.abs(Math.sin(n.phase)) * 0.07 : 0;
      _q.setFromAxisAngle(UP, n.yaw);
      if (moving) _q.multiply(new THREE.Quaternion().setFromAxisAngle(_v.set(0, 0, 1), Math.sin(n.phase) * 0.06));
      _m.compose(_p.set(n.x, n.y + bob, n.z), _q, _s.setScalar(n.scale));
      this.model.set(n.idx, _m, true);
    }
    this.model.flush();
  }

  statusText(n) {
    if (!n) return '';
    if (n.mode === 'walk' && !n.slow) return `${n.act.label} — sedang jalan ke ${n.dest}`;
    return n.act.label;
  }

  // Cari warga terdekat dari titik layar (lebih ramah jari di HP daripada raycast)
  pick(sx, sy, camera, w, h, maxPx = 30) {
    let best = null, bd = maxPx;
    for (const n of this.list) {
      if (n.mode === 'hidden') continue;
      _v.set(n.x, n.y + 0.7 * n.scale, n.z).project(camera);
      if (_v.z > 1) continue;
      const px = (_v.x * 0.5 + 0.5) * w, py = (-_v.y * 0.5 + 0.5) * h;
      const d = Math.hypot(px - sx, py - sy);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
}
