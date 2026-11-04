// Kuda-kuda istal (merumput & berkeliaran) dan kereta kencana yang keliling desa.
import * as THREE from 'three';
import { createHorse, animateHorse, createKereta, HORSE_COLORS } from './models.js';
import { findPath } from '../npc/pathfinding.js';
import { cellToWorld, worldToCell } from '../data/config.js';
import { doorCell } from '../simulation/grid.js';
import { T } from '../simulation/grid.js';
import { horseLineOk, horseBodyOk, horseTurn, horseTurnDir } from './rules.js';

const HORSE_NAMES = ['Si Sembrani', 'Si Bayu', 'Si Jagad', 'Si Turangga', 'Si Kilat', 'Si Mega', 'Si Gendhis', 'Si Wilis', 'Si Lintang'];
const ROUTE_TYPES = ['istal', 'rumah_akuwu', 'pendopo', 'pasar', 'terakota', 'pande', 'pos_jaga'];
const rnd = (a, b) => a + Math.random() * (b - a);
const angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
const _v = new THREE.Vector3();

export class VehicleManager {
  constructor(app) {
    this.app = app; this.sim = app.sim; this.grid = app.sim.grid; this.scene = app.stage.scene;
    this.horses = [];
    this.kereta = null;
    this.nameK = 0;
    for (const b of this.sim.state.buildings) if (b.type === 'istal') this.spawnHorses(b);
    this.sim.on('buildingAdded', (b) => {
      if (b.type === 'istal') this.spawnHorses(b);
      if (this.kereta) this.kereta.route = null; // rute dihitung ulang
    });
  }

  groundAt(x, z) {
    const { i, j } = worldToCell(x, z);
    const t = this.grid.get(i, j);
    return t === T.BRIDGE ? 0.24 : t === T.FIELD ? this.grid.heightAt(i, j) : 0;
  }
  doorWorld(b) { const [i, j] = doorCell(b.type, b.ci, b.cj, b.rot); return { ...cellToWorld(i, j), cell: [i, j] }; }

  spawnHorses(b) {
    const d = this.doorWorld(b);
    for (let k = 0; k < 3; k++) {
      const col = HORSE_COLORS[(this.horses.length + k) % HORSE_COLORS.length];
      const g = createHorse(col, { saddle: true });
      const h = {
        id: `kuda${this.horses.length + 1}`, name: HORSE_NAMES[this.nameK++ % HORSE_NAMES.length], color: col.name, g, home: b,
        yaw: rnd(0, 6.28), phase: rnd(0, 6), mode: 'idle', t: rnd(1, 4), graze: 0, path: [], rider: false, freeT: 0,
      };
      // muncul di depan istal (bukan di dalam bangunan)
      const spot = this.wanderTarget(h) || { x: d.x, z: d.z };
      h.x = spot.x; h.z = spot.z;
      if (!horseBodyOk(this.grid, h.x, h.z, h.yaw)) h.yaw = Math.atan2(h.x - this.doorWorld(b).x, h.z - this.doorWorld(b).z) || 0;
      this.scene.add(g);
      this.horses.push(h);
    }
    if (!this.kereta) this.spawnKereta(b);
  }

  spawnKereta(b) {
    const g = createKereta();
    const d = this.doorWorld(b);
    this.kereta = { g, name: 'Kereta Kencana Jatayu', x: d.x, z: d.z, yaw: 0, k: 0, route: null, parked: true, speed: 0, passenger: false, phase: 0 };
    this.scene.add(g);
  }

  // ---------------------------------------------------------------- kuda
  // titik tujuan berkeliaran di depan istal, jalurnya tidak menembus bangunan
  wanderTarget(h) {
    const d = this.doorWorld(h.home);
    for (let n = 0; n < 12; n++) {
      const x = d.x + rnd(-4.5, 4.5), z = d.z + rnd(-4.5, 4.5);
      const { i, j } = worldToCell(x, z);
      const t = this.grid.get(i, j);
      if (t !== T.GRASS && t !== T.ROAD) continue;
      if (h.x === undefined) { if (horseBodyOk(this.grid, x, z, h.yaw)) return { x, z }; continue; }
      if (!horseLineOk(this.grid, h.x, h.z, x, z)) continue;
      // badan harus bisa diputar di tempat menghadap tujuan (tidak mentok di kedua sisi)
      const dir = horseTurnDir(this.grid, h.x, h.z, h.yaw, Math.atan2(x - h.x, z - h.z));
      if (dir) return { x, z, dir };
    }
    return null;
  }

  updateHorse(h, dt) {
    if (h.rider) return; // dikendalikan pemain
    let moving = false;
    const homeD = this.doorWorld(h.home);
    // ditinggal jauh dari istal -> pulang lewat jalan
    if (!h.path.length && h.mode !== 'return' && Math.hypot(h.x - homeD.x, h.z - homeD.z) > 9) {
      h.freeT += dt;
      if (h.freeT > 25) {
        const s = worldToCell(h.x, h.z);
        const p = findPath(this.grid, s.i, s.j, homeD.cell[0], homeD.cell[1]);
        if (p) { h.path = p.slice(1).map(([i, j]) => cellToWorld(i, j)); h.mode = 'return'; }
        h.freeT = 0;
      }
    }
    if (h.path.length) {
      const p = h.path[0], dx = p.x - h.x, dz = p.z - h.z, d = Math.hypot(dx, dz);
      const step = (h.mode === 'return' ? 2.6 : 1.1) * dt;
      if (d <= step) { h.x = p.x; h.z = p.z; h.path.shift(); h.stuck = 0; if (!h.path.length) { h.mode = 'idle'; h.t = rnd(2, 5); } }
      else if (h.mode === 'return') {
        h.x += (dx / d) * step; h.z += (dz / d) * step;
        h.yaw = angLerp(h.yaw, Math.atan2(dx, dz), Math.min(1, dt * 5));
      } else {
        // putar badan dulu di tempat (lewat sisi yang tidak mentok), baru melangkah lurus
        const target = Math.atan2(dx, dz);
        const r = horseTurn(this.grid, h.x, h.z, h.yaw, target, dt * 2.5, h.turnDir || 0);
        let off = 9;
        if (r) { h.yaw = r.yaw; h.turnDir = r.dir; off = Math.abs(angLerp(r.yaw, target, 1) - r.yaw); }
        if (off < 0.12) {
          const nx = h.x + Math.sin(h.yaw) * step, nz = h.z + Math.cos(h.yaw) * step;
          if (horseBodyOk(this.grid, nx, nz, h.yaw)) { h.x = nx; h.z = nz; off = 0; }
          else off = 9;
        }
        if (off === 9) { h.path = []; h.mode = 'idle'; h.t = rnd(1, 3); h.stuck = (h.stuck || 0) + 1; } // mentok: berhenti
      }
      moving = h.path.length > 0;
      h.phase += dt * (h.mode === 'return' ? 9 : 5);
    } else {
      h.t -= dt;
      if (h.t <= 0) {
        if (Math.random() < 0.45) { h.mode = 'graze'; h.t = rnd(4, 9); }
        else {
          const w = h.stuck >= 4 ? null : this.wanderTarget(h);
          if (w) { h.path = [{ x: w.x, z: w.z }]; h.mode = 'walk'; h.turnDir = w.dir; }
          else if ((h.stuck = (h.stuck || 0) + 1) >= 4) this.unstick(h, homeD);
          else h.t = 2;
        }
      }
    }
    h.graze += ((h.mode === 'graze' ? 1 : 0) - h.graze) * Math.min(1, dt * 2);
    this.placeHorse(h, moving ? (h.mode === 'return' ? 1 : 0.6) : 0);
  }

  // terjebak berkali-kali: pulang ke pintu istal lewat jalan (mode return menembus pojok sempit)
  unstick(h, homeD) {
    h.stuck = 0;
    const s = worldToCell(h.x, h.z);
    const p = findPath(this.grid, s.i, s.j, homeD.cell[0], homeD.cell[1]);
    if (p && p.length > 1) { h.path = p.slice(1).map(([i, j]) => cellToWorld(i, j)); h.mode = 'return'; }
    else { h.path = [{ x: homeD.x, z: homeD.z }]; h.mode = 'return'; }
  }

  placeHorse(h, amp) {
    h.g.position.set(h.x, this.groundAt(h.x, h.z), h.z);
    h.g.rotation.y = h.yaw;
    animateHorse(h.g, h.phase, amp, h.graze);
  }

  // ---------------------------------------------------------------- kereta
  buildRoute() {
    const st = this.sim.state;
    const stops = [];
    for (const type of ROUTE_TYPES) { const b = st.buildings.find((x) => x.type === type); if (b) stops.push(this.doorWorld(b).cell); }
    if (stops.length < 2) return [];
    const pts = [];
    for (let k = 0; k < stops.length; k++) {
      const a = stops[k], b = stops[(k + 1) % stops.length];
      const p = findPath(this.grid, a[0], a[1], b[0], b[1]);
      if (!p) continue;
      for (const [i, j] of (pts.length ? p.slice(1) : p)) pts.push({ ...cellToWorld(i, j), stop: i === b[0] && j === b[1], park: k === stops.length - 1 && i === b[0] && j === b[1] });
    }
    return pts;
  }

  updateKereta(dt, hour) {
    const K = this.kereta;
    if (!K) return;
    if (!K.route) { K.route = this.buildRoute(); K.k = 0; }
    const day = hour >= 7 && hour < 17;
    let want = 0;
    if (K.route.length) {
      if (K.wait > 0) K.wait -= dt;
      else if (K.parked && day) K.parked = false;
      else if (!K.parked) {
        want = 3.2;
        const p = K.route[K.k];
        const dx = p.x - K.x, dz = p.z - K.z, d = Math.hypot(dx, dz);
        if (d < 0.9) {
          K.k = (K.k + 1) % K.route.length;
          if (p.park && !day) { K.parked = true; } // malam: parkir di istal
          else if (p.stop) K.wait = 4; // berhenti sebentar di tiap tempat singgah
        } else K.yaw = angLerp(K.yaw, Math.atan2(dx, dz), Math.min(1, dt * 3));
      }
    }
    // bergerak ke arah hadap (belokan mulus)
    K.speed += (want * (K.wait > 0 ? 0 : 1) - K.speed) * Math.min(1, dt * 2);
    const step = K.speed * dt;
    K.x += Math.sin(K.yaw) * step; K.z += Math.cos(K.yaw) * step;
    K.phase += step * 2.6;
    const g = K.g;
    g.position.set(K.x, this.groundAt(K.x, K.z), K.z);
    g.rotation.y = K.yaw;
    for (const w of g.userData.wheels) w.rotation.x += step / w.userData.r;
    const amp = Math.min(1, K.speed / 2.5);
    for (const h of g.userData.horses) animateHorse(h, K.phase, amp, 0);
  }

  seatWorld(out = new THREE.Vector3()) {
    const K = this.kereta;
    K.g.updateMatrixWorld();
    return out.copy(K.g.userData.seat).applyMatrix4(K.g.matrixWorld);
  }

  update(dt, t, hour) {
    for (const h of this.horses) this.updateHorse(h, dt);
    this.updateKereta(dt, hour);
  }

  // ketuk di layar -> kuda / kereta terdekat
  pick(sx, sy, camera, w, hgt) {
    let best = null, bd = 34;
    const test = (obj, x, y, z) => {
      _v.set(x, y, z).project(camera);
      if (_v.z > 1) return;
      const d = Math.hypot((_v.x * 0.5 + 0.5) * w - sx, (-_v.y * 0.5 + 0.5) * hgt - sy);
      if (d < bd) { bd = d; best = obj; }
    };
    for (const h of this.horses) if (!h.rider) test({ kind: 'kuda', h }, h.x, 1.2, h.z);
    if (this.kereta) test({ kind: 'kereta' }, this.kereta.x, 1.4, this.kereta.z);
    return best;
  }
}
