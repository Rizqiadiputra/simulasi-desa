// Kuda-kuda istal (merumput & berkeliaran) dan kereta kencana yang keliling desa.
import * as THREE from 'three';
import { createHorse, animateHorse, createKereta, HORSE_COLORS } from './models.js';
import { findPath } from '../npc/pathfinding.js';
import { cellToWorld, worldToCell } from '../data/config.js';
import { doorCell } from '../simulation/grid.js';
import { T } from '../simulation/grid.js';
import { horseLineOk, horseBodyOk, horseTurn, horseTurnDir } from './rules.js';

const HORSE_NAMES = ['Si Sembrani', 'Si Bayu', 'Si Jagad', 'Si Turangga', 'Si Kilat', 'Si Mega', 'Si Gendhis', 'Si Wilis', 'Si Lintang'];
const HITCH = 3.1; // jarak titik tengah kereta ke kuk kuda (posisi kuda di model)
const PIVOT = 1.35; // poros putar balik: tengah rangkaian (buritan -1,6 .. moncong kuda +4,3)
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
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
    const free = (i, j) => this.grid.inBounds(i, j) && this.grid.get(i, j) !== T.BLOCK && this.grid.get(i, j) !== T.WATER;
    const pts = [];
    for (let k = 0; k < stops.length; k++) {
      const a = stops[k], b = stops[(k + 1) % stops.length];
      const p = findPath(this.grid, a[0], a[1], b[0], b[1]);
      if (!p) continue;
      // langkah diagonal dipecah jadi dua langkah lurus lewat sel kosong (utamakan jalan),
      // supaya kereta yang lebar tidak menyerempet pojok bangunan
      const cells = [p[0]];
      for (let n = 1; n < p.length; n++) {
        const [i0, j0] = cells[cells.length - 1], [i1, j1] = p[n];
        if (i0 !== i1 && j0 !== j1) {
          const opts = [[i1, j0], [i0, j1]].filter(([i, j]) => free(i, j));
          opts.sort((u, v) => (this.grid.get(v[0], v[1]) === T.ROAD) - (this.grid.get(u[0], u[1]) === T.ROAD));
          if (opts.length) cells.push(opts[0]);
        }
        cells.push(p[n]);
      }
      for (const [i, j] of (pts.length ? cells.slice(1) : cells)) pts.push({ ...cellToWorld(i, j), i, j, stop: i === b[0] && j === b[1], park: k === stops.length - 1 && i === b[0] && j === b[1] });
    }
    return this.trimDeadEnds(pts);
  }

  // Pintu tempat singgah sering ada di ujung jalan buntu (masuk lalu balik lewat sel yang sama).
  // Kereta cukup berhenti di sel sebelum pintu, supaya moncong kuda tidak menembus bangunan.
  trimDeadEnds(pts) {
    const same = (a, b) => a && b && a.i === b.i && a.j === b.j;
    if (pts.length > 2 && same(pts[0], pts[pts.length - 1])) pts.shift(); // rute melingkar: titik awal = titik parkir
    for (let guard = 0; guard < 32; guard++) {
      let changed = false;
      for (let n = 0; n < pts.length && pts.length > 3; n++) {
        const N = pts.length, prev = pts[(n - 1 + N) % N], cur = pts[n], next = pts[(n + 1) % N];
        if ((cur.stop || cur.park) && !cur.trimmed && same(prev, next)) {
          prev.stop ||= cur.stop; prev.park ||= cur.park; prev.trimmed = true; // cukup mundur satu sel
          const kill = [n, (n + 1) % N].sort((x, y) => y - x); // buang pintu & sel kembar sesudahnya
          for (const k of kill) pts.splice(k, 1);
          changed = true;
          break;
        }
      }
      if (!changed) break;
    }
    return pts;
  }

  // Kereta bergerak seperti gerbong: titik kuk kuda ("lead") mengikuti rute persis di atas jalan,
  // badan kereta ditarik mengikuti jejak lead sejauh HITCH di belakangnya. Dengan begitu kuda dan
  // roda selalu berada di sel jalan yang sama, tidak memotong tikungan menembus rumah.
  updateKereta(dt, hour) {
    const K = this.kereta;
    if (!K) return;
    if (!K.route) this.resetKeretaRoute(K);
    const day = hour >= 7 && hour < 17;
    let want = 0;
    if (K.route.length) {
      if (K.wait > 0) K.wait -= dt;
      else if (K.parked && day) K.parked = false;
      else if (!K.parked) want = 3.2;
    }
    K.speed += (want * (K.wait > 0 || K.turning ? 0 : 1) - K.speed) * Math.min(1, dt * 2);
    if (K.turning && !(K.wait > 0)) return this.turnKereta(K, dt);
    let step = K.speed * dt;
    // majukan lead di sepanjang rute
    while (step > 1e-4 && K.route.length && !K.parked && !(K.wait > 0) && !K.turning) {
      const p = K.route[K.k];
      const dx = p.x - K.lead.x, dz = p.z - K.lead.z, d = Math.hypot(dx, dz);
      if (d <= step) {
        K.lead.x = p.x; K.lead.z = p.z; step -= d;
        K.k = (K.k + 1) % K.route.length;
        if (p.park && !day) K.parked = true; // malam: parkir di istal
        else if (p.stop) K.wait = 4; // berhenti sebentar di tiap tempat singgah
        // ujung jalan buntu: titik berikutnya berbalik arah -> putar balik dulu
        const q = K.route[K.k];
        const back = Math.atan2(q.x - K.lead.x, q.z - K.lead.z);
        if (Math.hypot(q.x - K.lead.x, q.z - K.lead.z) > 0.1 && Math.abs(angDiff(back, K.yaw)) > 2.4) {
          const fx = Math.sin(K.yaw), fz = Math.cos(K.yaw);
          K.turning = { t: 0, from: K.yaw, cx: K.x + fx * PIVOT, cz: K.z + fz * PIVOT, dir: Math.random() < 0.5 ? 1 : -1 };
          break;
        }
      } else { K.lead.x += (dx / d) * step; K.lead.z += (dz / d) * step; step = 0; }
      const last = K.trail[K.trail.length - 1] || K.body;
      if (Math.hypot(K.lead.x - last.x, K.lead.z - last.z) > 0.2) K.trail.push({ x: K.lead.x, z: K.lead.z });
    }
    // badan kereta: titik di jejak sejauh HITCH di belakang lead
    const px = K.x, pz = K.z;
    const body = this.advanceBody(K);
    K.x = body.x; K.z = body.z;
    const fx = K.lead.x - K.x, fz = K.lead.z - K.z;
    if (Math.hypot(fx, fz) > 0.3) K.yaw = Math.atan2(fx, fz);
    const moved = Math.hypot(K.x - px, K.z - pz);
    K.phase += moved * 2.6;
    const g = K.g;
    g.position.set(K.x, this.groundAt(K.x, K.z), K.z);
    g.rotation.y = K.yaw;
    for (const w of g.userData.wheels) w.rotation.x += moved / w.userData.r;
    const amp = Math.min(1, K.speed / 2.5);
    for (const h of g.userData.horses) animateHorse(h, K.phase, amp, 0);
  }

  // Putar balik di ujung jalan buntu: seluruh rangkaian berputar 180° pelan-pelan, berporos di
  // tengah rangkaian. Setelah selesai, kuda menghadap jalan pulang dan rute dilanjutkan dari sana.
  turnKereta(K, dt) {
    const T_ = K.turning;
    T_.t = Math.min(1, T_.t + dt / 2.5);
    const e = T_.t * T_.t * (3 - 2 * T_.t); // mulai & berhenti halus
    K.yaw = T_.from + T_.dir * Math.PI * e;
    const fx = Math.sin(K.yaw), fz = Math.cos(K.yaw);
    const px = K.x, pz = K.z;
    K.x = T_.cx - fx * PIVOT; K.z = T_.cz - fz * PIVOT;
    K.lead.x = K.x + fx * HITCH; K.lead.z = K.z + fz * HITCH;
    K.phase += dt * 4; // kuda tetap melangkah saat berbelok
    const g = K.g;
    g.position.set(K.x, this.groundAt(K.x, K.z), K.z);
    g.rotation.y = K.yaw;
    const moved = Math.hypot(K.x - px, K.z - pz);
    for (const w of g.userData.wheels) w.rotation.x += moved / w.userData.r;
    for (const h of g.userData.horses) animateHorse(h, K.phase, 0.5, 0);
    if (T_.t < 1) return;
    // selesai: jejak baru lurus dari badan ke kuda, lanjut ke titik rute di depan kuda
    K.turning = null;
    K.body = { x: K.x, z: K.z };
    K.trail = [];
    const R = K.route;
    for (let n = 0; n < 6; n++) {
      const q = R[K.k];
      const ahead = (q.x - K.lead.x) * fx + (q.z - K.lead.z) * fz;
      if (ahead > 0.3) break;
      K.k = (K.k + 1) % R.length;
    }
  }

  // Badan kereta ditarik maju di sepanjang jejak kuda (K.trail = titik-titik yang dilewati lead
  // sesudah badan), sampai jarak lurusnya ke lead = HITCH. Badan tidak pernah melompati jejak,
  // jadi di jalan berbentuk U kereta tetap menyusuri jalannya sendiri.
  advanceBody(K) {
    const L = K.lead, tr = K.trail;
    let b = K.body;
    for (let guard = 0; guard < 200; guard++) {
      if (Math.hypot(b.x - L.x, b.z - L.z) <= HITCH) break;
      const q = tr[0] || L;
      if (tr.length && Math.hypot(q.x - L.x, q.z - L.z) > HITCH) { b = { x: q.x, z: q.z }; tr.shift(); continue; }
      // titik di segmen b -> q yang jarak lurusnya ke lead tepat HITCH (bisection)
      let lo = 0, hi = 1;
      for (let it = 0; it < 16; it++) {
        const m = (lo + hi) / 2, x = b.x + (q.x - b.x) * m, z = b.z + (q.z - b.z) * m;
        if (Math.hypot(x - L.x, z - L.z) > HITCH) lo = m; else hi = m;
      }
      b = { x: b.x + (q.x - b.x) * hi, z: b.z + (q.z - b.z) * hi };
      break;
    }
    K.body = b;
    return b;
  }

  // Rute (dihitung ulang kalau bangunan berubah). Lanjut dari titik rute terdekat, dan kalau baru
  // muncul, jejak diisi dari ujung rute (jalan menuju istal) supaya kereta langsung berdiri di jalan.
  resetKeretaRoute(K) {
    K.route = this.buildRoute();
    const R = K.route;
    if (!R.length) { K.lead ||= { x: K.x, z: K.z }; K.body ||= { x: K.x, z: K.z }; K.trail ||= []; return; }
    if (!K.lead) {
      const park = Math.max(0, R.findIndex((p) => p.park)); // titik parkir di istal
      const at = (n) => { const q = R[(park - n + R.length) % R.length]; return { x: q.x, z: q.z }; };
      K.lead = at(0);
      K.body = at(4);
      K.trail = [at(3), at(2), at(1)];
      K.k = (park + 1) % R.length;
      return;
    }
    let best = 0, bd = Infinity;
    R.forEach((p, n) => { const d = Math.hypot(p.x - K.lead.x, p.z - K.lead.z); if (d < bd) { bd = d; best = n; } });
    K.k = best;
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
