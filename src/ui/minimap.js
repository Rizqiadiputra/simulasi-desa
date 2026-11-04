// Peta kecil (berputar mengikuti arah kamera: atas peta = tombol ↑) + peta besar dengan penanda tujuan.
import { GRID, HALF } from '../data/config.js';
import { T, footprintCells } from '../simulation/grid.js';
import { BUILDING_TYPES } from '../data/buildingTypes.js';

const PX = 3; // piksel per unit dunia pada layer statis
const SIZE = GRID * 2 * PX; // 288
const ROLE_COLOR = {
  home: '#6b4630', sacred: '#c0583c', civic: '#d0a24a', market: '#e0b040', farm: '#86b84a',
  work: '#8a6a45', gate: '#8f3d2b', storage: '#a8794d',
};
const SMALL_RADIUS = 30; // unit dunia yang terlihat dari tengah peta kecil
const toMap = (v) => (v + HALF) * PX;

export class Minimap {
  constructor(app, root) {
    this.app = app;
    this.dest = null;
    this.big = false;
    this.static = document.createElement('canvas');
    this.static.width = this.static.height = SIZE;

    this.el = document.createElement('div');
    this.el.className = 'minimap';
    this.el.innerHTML = `<canvas width="240" height="240" aria-label="Peta kecil, ketuk untuk memperbesar"></canvas><div class="mm-dist" hidden></div>`;
    root.appendChild(this.el);
    this.canvas = this.el.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');

    this.overlay = document.createElement('div');
    this.overlay.className = 'mm-overlay';
    this.overlay.hidden = true;
    this.overlay.innerHTML = `<div class="mm-panel">
        <div class="mm-head"><b>🗺️ Peta Desa</b><span class="mm-tip">Ketuk tempat untuk memasang 🚩 tujuan</span><button class="mm-x" aria-label="Tutup">✕</button></div>
        <canvas width="600" height="600"></canvas>
        <div class="mm-foot"><button class="btn sm" data-mm-clear>Hapus tujuan</button><span class="mm-legend"><i style="background:#c8a46a"></i>Jalan <i style="background:#3d8ea6"></i>Kanal <i style="background:#f5d36b;border-radius:50%"></i>Kamu <i style="background:#fff;border-radius:50%"></i>Warga</span></div>
      </div>`;
    root.appendChild(this.overlay);
    this.bigCanvas = this.overlay.querySelector('canvas');
    this.bctx = this.bigCanvas.getContext('2d');

    this.canvas.addEventListener('click', () => this.open());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay || e.target.closest('.mm-x')) return this.close();
      if (e.target.closest('[data-mm-clear]')) { this.dest = null; this.app.ui.toast('🚩 Tujuan dihapus'); return this.close(); }
    });
    this.bigCanvas.addEventListener('click', (e) => this.onBigTap(e));

    this.rebuild();
    app.sim.on('buildingAdded', () => setTimeout(() => this.rebuild(), 0));
    this.t = 0;
  }

  // Layer statis: tanah, jalan, kanal, bangunan
  rebuild() {
    const g = this.app.sim.grid, st = this.app.state;
    const c = this.static.getContext('2d');
    c.fillStyle = '#8ba75a';
    c.fillRect(0, 0, SIZE, SIZE);
    const cs = 2 * PX;
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
      const t = g.get(i, j);
      const col = t === T.ROAD ? '#c8a46a' : t === T.WATER ? '#3d8ea6' : t === T.BRIDGE ? '#8a5a34' : null;
      if (col) { c.fillStyle = col; c.fillRect(i * cs, j * cs, cs, cs); }
    }
    for (const b of st.buildings) {
      const def = BUILDING_TYPES[b.type];
      const cells = footprintCells(b.type, b.ci, b.cj, b.rot);
      let i0 = Infinity, j0 = Infinity, i1 = -Infinity, j1 = -Infinity;
      for (const [i, j] of cells) { i0 = Math.min(i0, i); j0 = Math.min(j0, j); i1 = Math.max(i1, i); j1 = Math.max(j1, j); }
      const x = i0 * cs + 1, y = j0 * cs + 1, w = (i1 - i0 + 1) * cs - 2, h = (j1 - j0 + 1) * cs - 2;
      c.fillStyle = ROLE_COLOR[def.role] || '#7a5a3a';
      if (def.role === 'gate') { c.fillRect(x, y, w, h); continue; }
      c.fillRect(x, y, w, h);
      c.strokeStyle = 'rgba(40,20,10,.55)'; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
    // tepi desa
    c.strokeStyle = 'rgba(40,30,20,.5)'; c.lineWidth = 2; c.strokeRect(1, 1, SIZE - 2, SIZE - 2);
  }

  open() { this.big = true; this.overlay.hidden = false; this.drawBig(); }
  close() { this.big = false; this.overlay.hidden = true; }

  onBigTap(e) {
    const r = this.bigCanvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * SIZE / PX - HALF;
    const z = ((e.clientY - r.top) / r.height) * SIZE / PX - HALF;
    this.dest = { x, z };
    const ui = this.app.ui, pl = this.app.player;
    if (!pl.active) this.app.stage.flyTo(x, z);
    ui.toast(pl.active ? '🚩 Tujuan dipasang. Ikuti panah di peta kecil!' : '🚩 Tujuan dipasang. Mulai 🚶 Jalan-jalan untuk ke sana.', 'good');
    this.close();
  }

  // posisi yang jadi pusat peta kecil: pemain (saat jalan-jalan) atau titik kamera
  center() {
    const p = this.app.state.player;
    if (this.app.player?.active && p) return { x: p.x, z: p.z };
    const t = this.app.stage.controls.target;
    return { x: t.x, z: t.z };
  }

  drawDots(c, s) {
    // warga
    c.fillStyle = '#fff';
    c.strokeStyle = 'rgba(30,20,10,.7)';
    c.lineWidth = 1 / s;
    for (const n of this.app.npcs.list) {
      if (n.mode === 'hidden') continue;
      c.beginPath(); c.arc(toMap(n.x), toMap(n.z), 2.2 / s, 0, 6.283); c.fill(); c.stroke();
    }
    const V = this.app.vehicles;
    if (V) {
      c.fillStyle = '#5a3a20';
      for (const h of V.horses) if (!h.rider) { c.beginPath(); c.arc(toMap(h.x), toMap(h.z), 2.6 / s, 0, 6.283); c.fill(); }
      if (V.kereta) { const k = V.kereta; c.fillStyle = '#ffd24a'; c.strokeStyle = '#7a1f2b'; c.lineWidth = 1.5 / s; c.fillRect(toMap(k.x) - 3.5 / s, toMap(k.z) - 3.5 / s, 7 / s, 7 / s); c.strokeRect(toMap(k.x) - 3.5 / s, toMap(k.z) - 3.5 / s, 7 / s, 7 / s); }
    }
  }

  drawPlayer(c, s) {
    const p = this.app.state.player;
    if (!p) return;
    c.save();
    c.translate(toMap(p.x), toMap(p.z));
    c.rotate(Math.PI - (p.yaw || 0)); // panah menunjuk arah hadap
    c.scale(1 / s, 1 / s);
    c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 6); c.lineTo(0, 3); c.lineTo(-6, 6); c.closePath();
    c.fillStyle = '#f5d36b'; c.strokeStyle = '#3a2418'; c.lineWidth = 2; c.fill(); c.stroke();
    c.restore();
  }

  drawFlag(c, s, size = 1, upright = 0) {
    if (!this.dest) return;
    c.save();
    c.translate(toMap(this.dest.x), toMap(this.dest.z));
    c.rotate(upright); // bendera tetap tegak walau peta berputar
    c.scale(size / s, size / s);
    c.fillStyle = '#d63a2a'; c.strokeStyle = '#3a2418'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -14); c.stroke();
    c.beginPath(); c.moveTo(0, -14); c.lineTo(10, -10); c.lineTo(0, -6); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }

  update(dt) {
    this.t += dt;
    if (this.t < 1 / 20) return; // 20 fps cukup
    this.t = 0;
    this.checkArrival();
    this.drawSmall();
    if (this.big) this.drawBig();
  }

  checkArrival() {
    const p = this.app.state.player;
    if (!this.dest || !p || !this.app.player?.active) return;
    if (Math.hypot(p.x - this.dest.x, p.z - this.dest.z) < 3) { this.dest = null; this.app.ui.toast('🚩 Sampai di tujuan!', 'good'); }
  }

  drawSmall() {
    const c = this.ctx, W = this.canvas.width, R = W / 2;
    const cam = this.app.stage.camera;
    const f = cam.getWorldDirection(this._f ||= cam.position.clone());
    const theta = Math.atan2(f.x, -f.z); // arah kamera di peta -> diputar ke atas
    const cen = this.center();
    const s = R / (SMALL_RADIUS * PX); // skala layer statis -> peta kecil
    c.clearRect(0, 0, W, W);
    c.save();
    c.beginPath(); c.arc(R, R, R - 3, 0, 6.283); c.clip();
    c.fillStyle = '#5f7f45'; c.fillRect(0, 0, W, W);
    c.translate(R, R);
    c.rotate(-theta);
    c.scale(s, s);
    c.translate(-toMap(cen.x), -toMap(cen.z));
    c.drawImage(this.static, 0, 0);
    this.drawDots(c, s);
    if (this.app.player?.active) this.drawPlayer(c, s);
    else {
      // tanda pusat kamera
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2 / s;
      c.beginPath(); c.arc(toMap(cen.x), toMap(cen.z), 6 / s, 0, 6.283); c.stroke();
    }
    c.restore();

    // panah ke tujuan bila di luar jangkauan + jarak
    const dist = this.el.querySelector('.mm-dist');
    if (this.dest) {
      const dx = this.dest.x - cen.x, dz = this.dest.z - cen.z, d = Math.hypot(dx, dz);
      if (d > SMALL_RADIUS * 0.85) {
        const a = Math.atan2(dx, -dz) - theta; // sudut dari atas, searah jarum jam
        c.save(); c.translate(R + Math.sin(a) * (R - 16), R - Math.cos(a) * (R - 16)); c.rotate(a);
        c.beginPath(); c.moveTo(0, -11); c.lineTo(9, 7); c.lineTo(-9, 7); c.closePath();
        c.fillStyle = '#d63a2a'; c.strokeStyle = '#fff'; c.lineWidth = 2; c.fill(); c.stroke(); c.restore();
      }
      dist.hidden = false;
      dist.textContent = `🚩 ${Math.round(d)} m`;
    } else dist.hidden = true;

    // bingkai + penanda utara
    c.beginPath(); c.arc(R, R, R - 3, 0, 6.283);
    c.strokeStyle = '#3a2418'; c.lineWidth = 5; c.stroke();
    c.strokeStyle = '#d4a43a'; c.lineWidth = 2; c.stroke();
    const na = -theta;
    const nx = R + Math.sin(na) * (R - 14), ny = R - Math.cos(na) * (R - 14);
    c.beginPath(); c.arc(nx, ny, 12, 0, 6.283); c.fillStyle = '#7a1f2b'; c.fill();
    c.fillStyle = '#ffe8c0'; c.font = 'bold 15px Nunito, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('U', nx, ny + 1);

    // bendera tujuan digambar paling akhir (di atas bingkai & penanda U)
    if (this.dest) {
      const dx = (this.dest.x - cen.x) * PX * s, dz = (this.dest.z - cen.z) * PX * s;
      const cs = Math.cos(-theta), sn = Math.sin(-theta);
      const fx = R + dx * cs - dz * sn, fy = R + dx * sn + dz * cs;
      if (Math.hypot(fx - R, fy - R) < R - 6) {
        c.save(); c.translate(fx, fy); c.scale(1.9, 1.9);
        c.fillStyle = '#d63a2a'; c.strokeStyle = '#3a2418'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -14); c.stroke();
        c.beginPath(); c.moveTo(0, -14); c.lineTo(10, -10); c.lineTo(0, -6); c.closePath(); c.fill(); c.stroke();
        c.restore();
      }
    }
  }

  drawBig() {
    const c = this.bctx, W = this.bigCanvas.width, s = W / SIZE;
    c.clearRect(0, 0, W, W);
    c.save();
    c.scale(s, s);
    c.drawImage(this.static, 0, 0);
    this.drawDots(c, s);
    // label bangunan penting
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const b of this.app.state.buildings) {
      const def = BUILDING_TYPES[b.type];
      if (def.role === 'home' && b.type !== 'rumah_akuwu') continue;
      if (b.type === 'sawah' || b.type === 'lumbung') continue;
      const x = toMap((b.ci - GRID / 2 + 0.5) * 2), z = toMap((b.cj - GRID / 2 + 0.5) * 2);
      c.font = `${14 / s}px sans-serif`;
      c.fillText(def.icon, x, z);
    }
    this.drawFlag(c, s);
    this.drawPlayer(c, s);
    c.restore();
    // kompas
    c.fillStyle = '#7a1f2b'; c.beginPath(); c.arc(W - 26, 26, 18, 0, 6.283); c.fill();
    c.fillStyle = '#ffe8c0'; c.font = 'bold 20px Nunito, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('U', W - 26, 27);
  }
}

