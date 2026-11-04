// Karakter pemain: W/S atau ↑↓ untuk jalan, A/D atau ← → untuk memutar kamera (laptop), atau joystick (HP).
import * as THREE from 'three';
import { cellToWorld, worldToCell } from '../data/config.js';
import { passableCells } from '../simulation/grid.js';
import { seeThrough } from '../scene/seeThrough.js';
import { T } from '../simulation/grid.js';
import { animateHorse } from '../vehicles/models.js';
import { horseBodyOk, horseTurn, horseTurnDir } from '../vehicles/rules.js';
import { PlayerNeeds } from './needs.js';

const angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

// Fisika karakter
const R = 0.28, H = 1.55, STEP = 0.55, GRAV = 22, JUMP = 7.4; // tinggi loncat ≈ 1.25 unit
const _hits = [];


export class Player {
  constructor(app) {
    this.app = app;
    this.state = app.state;
    this.grid = app.sim.grid;
    this.active = false;
    this.keys = new Set();
    this.joy = { x: 0, y: 0 };
    this.moving = false;
    this.phase = 0;
    this.idx = null;
    this.nearby = null;
    this.grounded = true;
    this.vehicle = null; // null | { type: 'kuda', h } | { type: 'kereta' }
    this.camMode = 'orbit'; // orbit (atas) | chase (belakang) | pov (mata)
    this.viewYaw = 0; this.viewPitch = 0.25;
    this.camPos = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    // penanda di atas kepala
    this.marker = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0xffd25a }));
    this.marker.visible = false;
    app.stage.scene.add(this.marker);
    this.needs = new PlayerNeeds(this);
    // alat kerja di tangan (cangkul / tongkat pengusir burung), tampil saat bekerja
    this.tool = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: 0x7a5232 }), iron = new THREE.MeshLambertMaterial({ color: 0x5c5c5c });
    this.toolPivot = new THREE.Group(); this.toolPivot.position.set(0.22, 1.05, 0.1);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 6), wood); handle.position.y = 0.55;
    this.toolBlade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.2), iron); this.toolBlade.position.set(0, 1.08, 0.1);
    this.toolPivot.add(handle, this.toolBlade); this.tool.add(this.toolPivot);
    this.tool.visible = false; app.stage.scene.add(this.tool);
    this.tilt = new THREE.Quaternion(); this.axisX = new THREE.Vector3(1, 0, 0);
    if (this.state.player) this.spawnModel();
    this.bindKeys();
  }

  get data() { return this.state.player; }

  // Buat / ubah profil
  setProfile({ name, gender, skin, kainHex }) {
    const st = this.state;
    const isNew = !st.player;
    st.player ||= { id: 'pemain', profession: 'tamu', age: 25, origin: 'Negeri seberang', hobby: 'Jalan-jalan keliling desa', kepeng: 20, sinceDay: this.app.sim.day, homeId: null, workId: null };
    Object.assign(st.player, { name: name || 'Si Pengembara', gender, look: { skin, kainHex, h: 1 } });
    if (isNew) {
      const gate = st.buildings.find((b) => b.type === 'gapura_bentar');
      const cell = gate ? passableCells(gate.type, gate.ci, gate.cj, gate.rot)[0] : [2, 24];
      const w = cellToWorld(cell[0] + 1, cell[1]);
      Object.assign(st.player, { x: w.x, z: w.z, y: 0, yaw: Math.PI / 2 });
    }
    this.spawnModel();
  }

  spawnModel() {
    const npcModel = this.app.npcs.model;
    if (this.idx === null) this.idx = npcModel.alloc();
    npcModel.setup(this.idx, this.data);
  }

  bindKeys() {
    // A / D dan ← → memutar kamera (seperti Roblox)
    const map = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'camL', ArrowLeft: 'camL', KeyD: 'camR', ArrowRight: 'camR', ShiftLeft: 'run', ShiftRight: 'run' };
    addEventListener('keydown', (e) => {
      if (!this.active || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.code === 'KeyE') { e.preventDefault(); this.interact(); return; }
      if (e.code === 'Space') { e.preventDefault(); this.jump(); return; }
      if (e.code === 'KeyC' || e.code === 'KeyV') { this.cycleCam(); this.app.ui?.updateCamBtn(); return; }
      const k = map[e.code];
      if (k) { this.keys.add(k); e.preventDefault(); }
    });
    addEventListener('keyup', (e) => { const k = map[e.code]; if (k) this.keys.delete(k); });
    addEventListener('blur', () => this.keys.clear());
  }

  start() {
    if (!this.data) return false;
    this.active = true;
    const c = this.app.stage.controls;
    c.enablePan = false;
    c.touches.ONE = THREE.TOUCH.ROTATE;
    c.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    const saved = this.data.camMode;
    // putar kamera supaya lurus dengan jalan desa: ↑ = menyusuri jalan, ↑+← = serong
    if (saved && saved !== 'orbit') this.setCam(saved);
    else this.app.stage.flyTo(this.data.x, this.data.z, 30, this.app.stage.gridAzimuth());
    return true;
  }
  stop() {
    if (this.vehicle) this.dismount();
    const keep = this.camMode;
    this.setCam('orbit');
    if (this.data) this.data.camMode = keep;
    this.active = false;
    this.keys.clear();
    this.joy.x = this.joy.y = 0;
    const c = this.app.stage.controls;
    c.enablePan = true;
    c.touches.ONE = THREE.TOUCH.PAN;
    c.mouseButtons.LEFT = THREE.MOUSE.PAN;
  }

  // ---------------------------------------------------------- mode kamera
  cycleCam() {
    if (!this.active) return;
    const order = ['orbit', 'chase', 'pov'];
    this.setCam(order[(order.indexOf(this.camMode) + 1) % order.length]);
  }
  setCam(mode) {
    const { camera, controls } = this.app.stage;
    const prev = this.camMode;
    if (prev === mode) return;
    this.camMode = mode;
    if (this.data) this.data.camMode = mode;
    if (prev === 'orbit') {
      // mulai dari arah pandang kamera sekarang, dibulatkan lurus dengan jalan desa
      const f = camera.getWorldDirection(this.tmp);
      this.viewYaw = Math.round(Math.atan2(f.x, f.z) / (Math.PI / 2)) * (Math.PI / 2);
      this.viewPitch = mode === 'pov' ? 0 : 0.3;
    }
    if (mode === 'pov') this.viewPitch = Math.max(-0.3, Math.min(0.3, this.viewPitch));
    controls.enabled = mode === 'orbit';
    camera.fov = { orbit: 35, chase: 55, pov: 72 }[mode];
    camera.near = mode === 'pov' ? 0.08 : mode === 'chase' ? 0.3 : 1;
    camera.updateProjectionMatrix();
    camera.rotation.order = 'YXZ';
    if (mode === 'orbit' && this.data) {
      const p = this.data;
      controls.target.set(p.x, 0, p.z);
      camera.position.set(p.x - Math.sin(this.viewYaw) * 22, 22, p.z - Math.cos(this.viewYaw) * 22);
      camera.lookAt(controls.target);
      controls.update();
    }
    if (mode !== 'orbit' && this.data) this.camPos.copy(camera.position);
  }
  get firstPerson() { return this.active && this.camMode !== 'orbit'; }

  // seret layar untuk menoleh (mode belakang & mata)
  look(dx, dy) {
    this.povTurned = true;
    this.viewYaw -= dx * 0.006;
    const lo = this.camMode === 'pov' ? -1.2 : -0.25, hi = this.camMode === 'pov' ? 1.2 : 1.0;
    this.viewPitch = Math.max(lo, Math.min(hi, this.viewPitch + (this.camMode === 'pov' ? -dy : dy) * 0.005));
  }

  // Tahan ← / → : kamera berputar mengelilingi pemain
  turnCamera(dt) {
    const dir = (this.keys.has('camL') ? 1 : 0) - (this.keys.has('camR') ? 1 : 0);
    if (!dir) return;
    const a = dir * 2.2 * dt; // ~2,2 radian per detik
    if (this.camMode === 'orbit') {
      const { camera, controls } = this.app.stage;
      this.tmp.copy(camera.position).sub(controls.target).applyAxisAngle(THREE.Object3D.DEFAULT_UP, a);
      camera.position.copy(controls.target).add(this.tmp);
      camera.lookAt(controls.target);
    } else {
      this.povTurned = true;
      this.viewYaw += a;
    }
  }

  updateCamera(dt) {
    const p = this.data, { camera, controls } = this.app.stage;
    const fx = Math.sin(this.viewYaw), fz = Math.cos(this.viewYaw);
    if (this.camMode === 'pov') {
      const bob = this.moving ? Math.sin(this.phase * 2) * 0.04 : 0;
      this.eyeY = this.eyeY === undefined ? p.y : this.eyeY + (p.y - this.eyeY) * Math.min(1, dt * 14);
      const ride = this.vehicle?.type === 'kuda' ? 0.95 : this.vehicle?.type === 'kereta' ? 0.15 : 0;
      camera.position.set(p.x + fx * (ride ? 0.3 : 0.12), this.eyeY + 1.42 + ride + bob, p.z + fz * (ride ? 0.3 : 0.12));
      camera.rotation.set(this.viewPitch, this.viewYaw + Math.PI, 0, 'YXZ');
    } else {
      const dist = this.vehicle ? 8 : 5.5, h = (this.vehicle ? 2.2 : 1.4) + Math.sin(this.viewPitch) * dist;
      const back = Math.cos(this.viewPitch) * dist;
      this.tmp.set(p.x - fx * back, p.y + h, p.z - fz * back);
      this.camPos.lerp(this.tmp, Math.min(1, dt * 8));
      camera.position.copy(this.camPos);
      camera.lookAt(p.x + fx * 1.5, p.y + 1.3, p.z + fz * 1.5);
    }
    controls.target.set(p.x, 0, p.z); // dipakai bayangan & hujan
  }

  get world() { return this.app.buildings.collision; }

  jump() {
    const p = this.data;
    if (!this.active || !p || !this.grounded || this.vehicle?.type === 'kereta' || this.needs.busy) return;
    const n = this.needs.n;
    if (!this.vehicle) { if (n.stamina < 8) return this.app.ui?.toast('😮‍💨 Terlalu capek untuk loncat', 'bad'); n.stamina -= 8; }
    p.vy = JUMP;
    this.grounded = false;
  }

  // Tinggi tanah dasar (tanpa bangunan)
  terrainAt(x, z) {
    const { i, j } = worldToCell(x, z);
    return this.grid.get(i, j) === T.BRIDGE ? 0.24 : 0;
  }
  // Apakah badan (silinder) menabrak sesuatu di posisi ini?
  blockedAt(x, z, feet) {
    // menunggang kuda: seluruh badan kuda tidak boleh masuk bangunan / kanal (berhenti di depannya)
    if (this.vehicle?.type === 'kuda' && !horseBodyOk(this.grid, x, z, this.data.yaw || 0)) return true;
    const { i, j } = worldToCell(x, z);
    if (!this.grid.inBounds(i, j)) return true;
    const t = this.grid.get(i, j);
    if (t === T.WATER && feet < 0.5) return true; // kanal (boleh diloncati kalau tinggi)
    for (const b of this.world.query(x - R, z - R, x + R, z + R, _hits)) {
      if (b.y0 < feet + H && b.y1 > feet + STEP) return true;
    }
    return false;
  }
  // Permukaan tertinggi yang bisa dipijak di bawah kaki
  supportAt(x, z, feet) {
    let top = this.terrainAt(x, z);
    const r = R * 0.6;
    for (const b of this.world.query(x - r, z - r, x + r, z + r, _hits)) {
      if (b.y1 <= feet + STEP && b.y1 > top) top = b.y1;
    }
    return top;
  }
  ceilingAt(x, z, feet, newFeet) {
    let c = Infinity;
    for (const b of this.world.query(x - R, z - R, x + R, z + R, _hits)) {
      if (b.y0 >= feet + H - 0.05 && b.y0 < newFeet + H) c = Math.min(c, b.y0);
    }
    return c;
  }

  update(dt, t) {
    const p = this.data;
    if (!p || this.idx === null) return;
    const V = this.vehicle;
    let ix = 0, iy = 0;
    if (this.active) this.turnCamera(dt);
    if (V?.type === 'kereta') {
      // penumpang: ikut kereta
      const K = this.app.vehicles.kereta;
      const s = this.app.vehicles.seatWorld(this.tmp);
      p.x = s.x; p.z = s.z; p.y = s.y; p.vy = 0; p.yaw = K.yaw;
      if (this.camMode !== 'pov' || !this.povTurned) this.viewYaw = angLerp(this.viewYaw, K.yaw, Math.min(1, dt * 2));
      this.moving = false;
    } else if (this.active && !this.needs.busy) {
      // W/S atau ↑↓ maju-mundur (joystick HP tetap bisa serong)
      ix = (this.keys.has('r') ? 1 : 0) - (this.keys.has('l') ? 1 : 0) + this.joy.x;
      iy = (this.keys.has('u') ? 1 : 0) - (this.keys.has('d') ? 1 : 0) + this.joy.y;
    }
    const len = Math.hypot(ix, iy);
    this.moving = len > 0.08;
    if (this.moving) {
      // arah relatif kamera
      const cam = this.app.stage.camera;
      const fwd = this.camMode === 'orbit' ? cam.getWorldDirection(this.tmp) : this.tmp.set(Math.sin(this.viewYaw), 0, Math.cos(this.viewYaw));
      fwd.y = 0; fwd.normalize();
      const rx = -fwd.z, rz = fwd.x; // kanan kamera
      const k = Math.min(1, len) / len;
      let dx = (rx * ix + fwd.x * iy) * k, dz = (rz * ix + fwd.z * iy) * k;
      const riding = V?.type === 'kuda';
      // lari: tahan Shift, atau dorong joystick sampai mentok
      const run = (this.keys.has('run') || Math.hypot(this.joy.x, this.joy.y) > 0.95) && (riding ? !this.needs.sleeping : this.needs.canRun);
      this.running = run;
      const speed = (run ? (riding ? 12 : 6.5) : riding ? 7 : 4) * (riding ? 1 : this.needs.speedMul) * dt;
      dx *= speed; dz *= speed;
      const feet = p.y || 0;
      if (riding) this.rideStep(dx, dz, dt, feet);
      else {
        // geser per sumbu supaya bisa "meluncur" di sepanjang dinding
        const stuck = this.blockedAt(p.x, p.z, feet); // terjebak -> boleh keluar
        p.yaw = this.camMode === 'pov' ? this.viewYaw : Math.atan2(dx, dz);
        if (stuck || !this.blockedAt(p.x + dx, p.z, feet)) p.x += dx;
        if (stuck || !this.blockedAt(p.x, p.z + dz, feet)) p.z += dz;
      }
      this.phase += dt * (this.grounded ? 11 : 3);
    }
    if (!this.moving) this.running = false;
    if (this.active) this.needs.update(dt, { moving: this.moving, running: this.running, riding: V?.type === 'kuda' });
    if (this.active && V?.type !== 'kereta') this.physics(dt);
    if (V?.type === 'kuda') {
      // kuda mengikuti pemain
      const h = V.h;
      h.x = p.x; h.z = p.z; h.yaw = p.yaw || 0;
      h.phase += dt * (this.moving ? (this.running ? 13 : 8) : 0);
      h.g.position.set(p.x, p.y, p.z); h.g.rotation.y = h.yaw;
      animateHorse(h.g, h.phase, this.moving && this.grounded ? 1 : 0, 0);
    }

    const seatY = V?.type === 'kuda' ? 0.95 : 0; // duduk di pelana
    const bob = this.moving ? Math.abs(Math.sin(this.phase)) * (V ? 0.05 : 0.08) : 0;
    this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.yaw || 0);
    // animasi bekerja di sawah: membungkuk (tanam / siangi / panen), mengayun cangkul, atau melambai tongkat
    const work = this.needs.task;
    this.tool.visible = !!work && work.offer.task.motion !== 'bend';
    if (work) {
      const m = work.offer.task.motion, s = Math.sin(work.t * (m === 'wave' ? 7 : 5));
      const lean = m === 'bend' ? 0.75 + 0.12 * s : m === 'swing' ? 0.12 + 0.22 * Math.max(0, -s) : 0.05;
      this.q.multiply(this.tilt.setFromAxisAngle(this.axisX, lean));
      this.tool.position.set(p.x, p.y || 0, p.z); this.tool.rotation.set(0, p.yaw || 0, 0);
      this.toolBlade.visible = m === 'swing';
      if (m === 'swing') this.toolPivot.rotation.set(-0.3 + 1.6 * (0.5 - 0.5 * s), 0, 0); // angkat lalu hantam ke tanah
      else this.toolPivot.rotation.set(-0.4, 0, 0.6 * s); // tongkat dilambai kiri-kanan
    }
    this.m.compose(this.tmp.set(p.x, p.y + seatY + bob, p.z), this.q, new THREE.Vector3(1.05, V?.type === 'kuda' ? 0.8 : 1.05, 1.05));
    const pov = this.active && this.camMode === 'pov';
    this.app.npcs.model.set(this.idx, this.m, !pov);
    this.marker.visible = !(this.active && this.camMode !== 'orbit');
    this.marker.position.set(p.x, p.y + 1.85 + Math.sin(t * 3) * 0.1, p.z);
    this.marker.rotation.y = t * 2;

    seeThrough.uFade.value = this.active && !pov ? 1 : 0;
    seeThrough.uPlayer.value.set(p.x, p.y + 0.9 + seatY, p.z);
    seeThrough.uCam.value.copy(this.app.stage.camera.position);
    if (this.active) {
      if (this.camMode !== 'orbit') this.updateCamera(dt);
      else {
        // kamera ikut
        const c = this.app.stage.controls;
        const d = this.tmp.set(p.x - c.target.x, 0, p.z - c.target.z).multiplyScalar(Math.min(1, dt * 5));
        c.target.add(d); this.app.stage.camera.position.add(d);
      }
      this.findNearby();
    }
  }

  // Kuda: putar badan dulu ke arah tujuan, lalu selalu berjalan ke arah moncongnya
  // (badan & arah gerak selalu sama, tidak pernah jalan miring seperti kepiting)
  rideStep(dx, dz, dt, feet) {
    const p = this.data;
    const step = Math.hypot(dx, dz);
    const target = Math.atan2(dx, dz);
    const cur = p.yaw || 0;
    const stuck = this.blockedAt(p.x, p.z, feet);
    // ±9 rad/detik; kalau sisi terpendek mentok bangunan, putar lewat sisi satunya
    // arah putar dipertahankan selama arah tujuan tidak berubah banyak (anti bolak-balik di pojok)
    if (this.turnTarget === undefined || Math.abs(Math.atan2(Math.sin(target - this.turnTarget), Math.cos(target - this.turnTarget))) > 0.6) { this.turnDir = 0; this.forceTurn = false; }
    this.turnTarget = target;
    let diff = ((target - cur + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    const forced = () => cur + Math.sign(diff) * Math.min(Math.abs(diff), dt * 9);
    // jaring pengaman (celah sempit): putar paksa di tempat sampai lurus, tanpa maju dulu
    if (this.forceTurn) {
      p.yaw = forced();
      if (Math.abs(diff) <= dt * 9) this.forceTurn = false;
      return;
    }
    // pilih sisi putar yang tidak mentok sampai menghadap tujuan; tidak ada -> mundur dulu
    if (!this.turnDir) this.turnDir = horseTurnDir(this.grid, p.x, p.z, cur, target);
    const r = this.turnDir ? horseTurn(this.grid, p.x, p.z, cur, target, dt * 9, this.turnDir) : null;
    let ny = r ? r.yaw : null;
    this.turnDir = r ? r.dir : 0;
    // tidak bisa berputar > 0,8 detik padahal arah tujuan lapang -> putar paksa (tidak terkunci selamanya)
    this.noTurnT = ny === null ? (this.noTurnT || 0) + dt : 0;
    if (ny === null && !stuck && this.noTurnT > 0.8 && horseBodyOk(this.grid, p.x, p.z, target)) { this.forceTurn = true; this.noTurnT = 0; return; }
    if (ny === null && stuck) ny = forced();
    if (ny !== null) { p.yaw = ny; this.shuffle = 0; }
    else {
      // terlalu mepet untuk berputar: geser sedikit (boleh ke samping) ke titik terdekat yang cukup lega
      const room = this.roomToTurn(p.x, p.z, cur, target, feet);
      if (room) {
        const dx = room.x - p.x, dz = room.z - p.z, d = Math.hypot(dx, dz), m = Math.min(d, step * 0.6);
        const nx = p.x + (dx / d) * m, nz = p.z + (dz / d) * m;
        if (!this.blockedAt(nx, nz, feet)) { p.x = nx; p.z = nz; return; }
      }
      // tidak ada: mundur dulu (kalau belakang mentok, maju) sampai cukup ruang
      const s = this.shuffle || -1;
      for (const k of [s, -s]) {
        const bx = p.x + Math.sin(cur) * step * 0.5 * k, bz = p.z + Math.cos(cur) * step * 0.5 * k;
        if (!this.blockedAt(bx, bz, feet)) { p.x = bx; p.z = bz; this.shuffle = k; break; }
      }
      return;
    }
    // maju sesuai arah hadap; makin belum lurus ke tujuan, makin pelan
    const along = step * Math.max(0, Math.cos(target - p.yaw));
    if (along <= 0) return;
    const mx = Math.sin(p.yaw) * along, mz = Math.cos(p.yaw) * along;
    if (stuck || !this.blockedAt(p.x + mx, p.z + mz, feet)) { p.x += mx; p.z += mz; }
    else if (!this.blockedAt(p.x + mx, p.z, feet)) p.x += mx; // meluncur di sepanjang dinding
    else if (!this.blockedAt(p.x, p.z + mz, feet)) p.z += mz;
  }

  // Titik terdekat (≤1,25 unit) tempat kuda dengan arah sekarang muat & bisa berputar ke `target`
  roomToTurn(x, z, cur, target, feet) {
    for (let r = 0.25; r <= 1.26; r += 0.25) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, qx = x + Math.sin(a) * r, qz = z + Math.cos(a) * r;
        if (this.blockedAt(qx, qz, feet)) continue;
        if (horseTurnDir(this.grid, qx, qz, cur, target)) return { x: qx, z: qz };
      }
    }
    return null;
  }

  mount(v) {
    const p = this.data, ui = this.app.ui;
    if (v.type === 'kuda') {
      const h = v.h;
      h.rider = true; h.path = []; h.mode = 'idle'; h.graze = 0;
      p.x = h.x; p.z = h.z; p.yaw = h.yaw; p.vy = 0;
      ui.toast(`🐎 Kamu menunggang ${h.name}! Lebih cepat & tetap bisa loncat. Tekan E untuk turun.`, 'good');
    } else {
      const K = this.app.vehicles.kereta;
      K.passenger = true;
      this.povTurned = false;
      ui.toast(`👑 Duduk manis di ${K.name}. Kereta keliling desa ${K.parked ? '(sekarang parkir, jalan lagi jam 07.00–17.00)' : ''}. Tekan E untuk turun.`, 'good');
    }
    this.vehicle = v;
    this.eyeY = undefined;
  }

  dismount() {
    const p = this.data, V = this.vehicle;
    if (!V) return;
    if (V.type === 'kuda') {
      V.h.rider = false; V.h.freeT = 0; V.h.mode = 'idle'; V.h.t = 3;
      // turun ke samping kuda
      const sx = Math.cos(V.h.yaw) * 0.9, sz = -Math.sin(V.h.yaw) * 0.9;
      if (!this.blockedAt(p.x + sx, p.z + sz, p.y)) { p.x += sx; p.z += sz; }
    } else {
      const K = this.app.vehicles.kereta;
      K.passenger = false;
      for (const side of [1, -1]) {
        const x = K.x + Math.cos(K.yaw) * 1.4 * side, z = K.z - Math.sin(K.yaw) * 1.4 * side;
        if (!this.blockedAt(x, z, 0)) { p.x = x; p.z = z; break; }
      }
      p.y = this.supportAt(p.x, p.z, 0.3); p.vy = 0;
    }
    this.vehicle = null;
    this.eyeY = undefined;
  }

  physics(dt) {
    const p = this.data;
    p.y ||= 0; p.vy ||= 0;
    p.vy = Math.max(-30, p.vy - GRAV * dt);
    let ny = p.y + p.vy * dt;
    if (p.vy > 0) {
      const c = this.ceilingAt(p.x, p.z, p.y, ny);
      if (c < Infinity) { ny = c - H; p.vy = 0; }
    }
    const sup = this.supportAt(p.x, p.z, p.y);
    if (ny <= sup) {
      if (!this.grounded && p.vy < -9) this.app.ui?.toast('💥 Bruk! Mendarat keras', 'info');
      ny = sup; p.vy = 0; this.grounded = true;
    } else if (ny > sup + 0.02) this.grounded = false;
    p.y = ny;
  }

  findNearby() {
    const p = this.data;
    const V = this.vehicle, vm = this.app.vehicles;
    if (V) { this.nearby = { kind: 'turun', label: V.type === 'kuda' ? `⬇️ Turun dari ${V.h.name}` : '⬇️ Turun dari kereta' }; return; }
    const K = vm?.kereta;
    if (K && Math.hypot(K.x - p.x, K.z - p.z) < 3.2) { this.nearby = { kind: 'kereta', label: `👑 Naik ${K.name}` }; return; }
    for (const h of vm?.horses || []) {
      if (Math.hypot(h.x - p.x, h.z - p.z) < 2.2) { this.nearby = { kind: 'kuda', h, label: `🐎 Naik kuda ${h.name}` }; return; }
    }
    // bangunan di dekat kaki (pasar, petirtaan, pendopo, sawah -> aksi kebutuhan)
    const { i, j } = worldToCell(p.x, p.z);
    let near = null;
    for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const id = this.grid.ownerAt(i + a, j + b);
      if (id) { near = this.app.sim.building(id); break; }
    }
    const w = this.needs.task;
    if (w) { this.nearby = { kind: 'busy', label: `${w.offer.task.icon} Sedang ${w.offer.task.verb}... ${Math.ceil(w.dur - w.t)} detik` }; return; }
    const need = this.needs.actionAt(near);
    if (need?.b) { this.nearby = need; return; }
    let best = null, bd = 2.6;
    for (const n of this.app.npcs.list) {
      if (n.mode === 'hidden') continue;
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d < bd) { bd = d; best = { kind: 'citizen', npc: n, label: `💬 Ngobrol dengan ${n.c.name}` }; }
    }
    if (!best && need) best = need; // minum di kanal
    if (!best && near) best = { kind: 'building', b: near, label: `🔍 Lihat ${near.name}` };
    this.nearby = best;
  }

  interact() {
    const nb = this.nearby;
    if (!nb) return;
    const ui = this.app.ui;
    if (this.needs.busy || nb.kind === 'busy') return;
    if (nb.kind === 'need') return this.needs.act(nb);
    if (nb.kind === 'turun') return this.dismount();
    if (nb.kind === 'kuda') return this.mount({ type: 'kuda', h: nb.h });
    if (nb.kind === 'kereta') return this.mount({ type: 'kereta' });
    if (nb.kind === 'citizen') {
      const n = nb.npc;
      n.yaw = Math.atan2(this.data.x - n.x, this.data.z - n.z);
      if (n.mode === 'stay') n.idleT = 4;
      ui.openChat(n.c.id);
    } else ui.openBuilding(nb.b.id);
  }
}
