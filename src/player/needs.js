// Kebutuhan pemain: makan, minum, energi (tidur), kesehatan, stamina. Nilai 0–100, disimpan di state.player.needs.
// Berkurang menurut waktu nyata selama mode Jalan-jalan (jam desa mengikuti jam asli, terlalu lambat untuk ini).
import { worldToCell, cellToWorld } from '../data/config.js';
import { T } from '../simulation/grid.js';
import { farmOffer, farmReward, sapa } from './farmwork.js';

export const NEEDS = [
  ['makan', '🍚', 'Makan'],
  ['minum', '💧', 'Minum'],
  ['energi', '😴', 'Energi'],
  ['kesehatan', '❤️', 'Kesehatan'],
  ['stamina', '⚡', 'Stamina'],
];

// berkurang per detik nyata (makan habis ±20 menit, minum ±14 menit, energi ±30 menit)
const DECAY = { makan: 100 / 1200, minum: 100 / 840, energi: 100 / 1800 };
const LOW = 25;
const WARN = {
  makan: '😋 Perutmu keroncongan. Cari makan di pasar.',
  minum: '🥵 Tenggorokan kering. Minum di petirtaan, kanal, atau pasar.',
  energi: '🥱 Kamu mengantuk. Numpang tidur di pendopo.',
  kesehatan: '🤒 Badanmu lemas! Penuhi makan, minum & tidur dulu.',
};
const SLEEP_SECONDS = 6;
const WORK_SECONDS = 5;
const clamp = (v) => Math.max(0, Math.min(100, v));

export class PlayerNeeds {
  constructor(player) {
    this.player = player;
    this.app = player.app;
    this.warned = {};
    this.exhausted = false; // stamina habis: tidak bisa lari sampai pulih 30
    this.sleepT = 0;
  }

  get n() {
    const p = this.player.data;
    if (!p) return null;
    p.needs ||= { makan: 80, minum: 80, energi: 90, kesehatan: 100, stamina: 100 };
    return p.needs;
  }
  get sleeping() { return this.sleepT > 0; }
  // sedang tidur / bekerja: pemain tidak bisa bergerak
  get busy() { return this.sleeping || !!this.task; }
  // boleh lari?
  get canRun() { const n = this.n; return !!n && !this.exhausted && !this.busy && n.energi > 5; }
  // pengali kecepatan: lemas kalau sakit / sangat lelah
  get speedMul() { const n = this.n; if (!n) return 1; return n.kesehatan < 25 || n.energi < 10 ? 0.7 : 1; }

  update(dt, { moving, running, riding }) {
    const n = this.n;
    if (!n) return;
    if (this.sleeping) {
      this.sleepT -= dt;
      n.energi = clamp(n.energi + (100 / SLEEP_SECONDS) * dt);
      n.kesehatan = clamp(n.kesehatan + (15 / SLEEP_SECONDS) * dt);
      n.stamina = 100;
      if (!this.sleeping) this.wake();
      return;
    }
    if (this.task) this.updateTask(dt, n);
    const work = this.task ? 1.6 : running ? (riding ? 1.3 : 2) : moving ? 1.15 : 1;
    n.makan = clamp(n.makan - DECAY.makan * work * dt);
    n.minum = clamp(n.minum - DECAY.minum * work * dt);
    n.energi = clamp(n.energi - DECAY.energi * (running && !riding ? 2 : 1) * dt);

    // stamina: lari menguras, istirahat memulihkan (lebih pelan kalau lapar / haus / lelah)
    if (running && !riding) n.stamina = clamp(n.stamina - 14 * dt);
    else {
      const weak = n.makan < 20 || n.minum < 20 || n.energi < 20 ? 0.4 : 1;
      n.stamina = clamp(n.stamina + (moving ? 6 : 12) * weak * dt);
    }
    if (n.stamina <= 0 && !this.exhausted) { this.exhausted = true; this.toast('😮‍💨 Napasmu habis! Jalan pelan dulu.', 'bad'); }
    if (this.exhausted && n.stamina >= 30) this.exhausted = false;

    // kesehatan: turun kalau ada kebutuhan yang kosong, pulih pelan kalau semua cukup
    let hurt = 0;
    if (n.makan <= 0) hurt += 0.6;
    if (n.minum <= 0) hurt += 0.8;
    if (n.energi <= 0) hurt += 0.3;
    if (hurt) n.kesehatan = clamp(n.kesehatan - hurt * dt);
    else if (n.makan > 40 && n.minum > 40 && n.energi > 40) n.kesehatan = clamp(n.kesehatan + 0.25 * dt);

    for (const k of Object.keys(WARN)) {
      if (n[k] < LOW && !this.warned[k]) { this.warned[k] = true; this.toast(WARN[k], 'bad'); }
      else if (n[k] > LOW + 15) this.warned[k] = false;
    }
    if (n.kesehatan <= 0) this.faint();
  }

  // pingsan: dibawa warga ke pendopo, dirawat tabib desa
  faint() {
    const n = this.n, pl = this.player, p = pl.data;
    if (pl.vehicle) pl.dismount();
    const b = this.app.sim.state.buildings.find((x) => x.type === 'pendopo') || this.app.sim.state.buildings.find((x) => x.type === 'gapura_bentar');
    if (b) { const d = this.app.vehicles.doorWorld(b); p.x = d.x; p.z = d.z; p.y = 0; p.vy = 0; }
    Object.assign(n, { kesehatan: 40, makan: Math.max(n.makan, 30), minum: Math.max(n.minum, 30), energi: Math.max(n.energi, 40), stamina: 50 });
    const fee = Math.min(p.kepeng || 0, 3);
    p.kepeng = (p.kepeng || 0) - fee;
    this.warned = {};
    this.toast(`😵 Kamu pingsan! Warga membawamu ke ${b?.name || 'desa'} dan tabib merawatmu${fee ? ` (${fee} kepeng)` : ''}.`, 'event');
  }

  updateTask(dt, n) {
    const w = this.task;
    w.t += dt;
    n.energi = clamp(n.energi - (12 / w.dur) * dt);
    n.makan = clamp(n.makan - (5 / w.dur) * dt);
    n.minum = clamp(n.minum - (7 / w.dur) * dt);
    n.stamina = clamp(n.stamina - (20 / w.dur) * dt);
    if (w.t < w.dur) return;
    this.task = null;
    const r = farmReward(this.app.sim, w.b, w.offer, this.player.data);
    if (typeof r === 'string') this.toast(r, 'good');
    else { n.makan = clamp(n.makan + r.food); this.toast(r.msg, 'good'); }
  }

  // petani menoleh ke pemain
  faceFarmer(id) {
    const npc = this.app.npcs.npcs.get(id), p = this.player.data;
    if (!npc) return;
    npc.yaw = Math.atan2(p.x - npc.x, p.z - npc.z);
    if (npc.mode === 'stay') npc.idleT = 4;
  }

  wake() {
    this.sleepT = 0;
    this.toast('🌅 Kamu bangun dengan segar. Energi penuh!', 'good');
  }

  toast(m, k) { this.app.ui?.toast(m, k); }

  // ------------------------------------------------------------ aksi di sekitar pemain
  // Hasil: { kind: 'need', act, label } atau null
  actionAt(b) {
    const n = this.n;
    if (!n) return null;
    const kp = Math.floor(this.player.data.kepeng || 0);
    if (b) {
      if (b.type === 'pasar') {
        return n.makan <= n.minum
          ? { kind: 'need', act: 'makan_pasar', b, label: `🍚 Makan nasi pecel (3 kepeng · punya ${kp})` }
          : { kind: 'need', act: 'minum_pasar', b, label: `🥥 Minum air kelapa (2 kepeng · punya ${kp})` };
      }
      if (b.type === 'petirtaan') return { kind: 'need', act: 'petirtaan', b, label: `💧 Minum & mandi di ${b.name}` };
      if (b.type === 'pendopo') return { kind: 'need', act: 'tidur', b, label: `😴 Numpang tidur di ${b.name}` };
      if (b.type === 'sawah') { const o = farmOffer(this.app.sim, b); return { kind: 'need', act: 'kerja_sawah', b, offer: o, label: o.label }; }
    }
    // dekat kanal?
    const p = this.player.data, { i, j } = worldToCell(p.x, p.z), g = this.player.grid;
    for (const [a, c] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (g.inBounds(i + a, j + c) && g.get(i + a, j + c) === T.WATER) return { kind: 'need', act: 'minum_kanal', label: '💧 Minum air kanal' };
    }
    return null;
  }

  act(a) {
    const n = this.n, p = this.player.data;
    const pay = (cost) => {
      if ((p.kepeng || 0) < cost) { this.toast(`Kepengmu kurang (butuh ${cost}). Bantu di sawah untuk dapat kepeng.`, 'bad'); return false; }
      p.kepeng -= cost;
      this.app.sim.state.economy.kas += cost * 0.2; // sebagian jadi pajak pasar
      return true;
    };
    switch (a.act) {
      case 'makan_pasar':
        if (n.makan > 95) return this.toast('Kamu masih kenyang.', 'info');
        if (!pay(3)) return;
        n.makan = clamp(n.makan + 45); n.minum = clamp(n.minum + 5);
        return this.toast('🍚 Nyam! Nasi pecel hangat. Makan +45', 'good');
      case 'minum_pasar':
        if (n.minum > 95) return this.toast('Kamu tidak haus.', 'info');
        if (!pay(2)) return;
        n.minum = clamp(n.minum + 50); n.stamina = clamp(n.stamina + 20);
        return this.toast('🥥 Segar! Air kelapa muda. Minum +50', 'good');
      case 'petirtaan':
        n.minum = clamp(n.minum + 60); n.kesehatan = clamp(n.kesehatan + 5); n.stamina = 100;
        return this.toast('💧 Air pancuran petirtaan sejuk sekali. Minum +60', 'good');
      case 'minum_kanal':
        if (n.minum > 95) return this.toast('Kamu tidak haus.', 'info');
        n.minum = clamp(n.minum + 20);
        return this.toast('💧 Kamu minum air kanal. Minum +20 (lebih segar di petirtaan)', 'good');
      case 'tidur':
        if (n.energi > 85) return this.toast('Kamu belum mengantuk.', 'info');
        if (this.player.vehicle) this.player.dismount();
        this.sleepT = SLEEP_SECONDS;
        return this.toast(`😴 Kamu berbaring di ${a.b.name}... zzz`, 'info');
      case 'kerja_sawah': {
        const o = farmOffer(this.app.sim, a.b); // cek ulang (jam bisa sudah berganti)
        if (!o.ok) return this.toast(o.reason, 'info');
        if (n.energi < 15 || n.kesehatan < 25) return this.toast('Kamu terlalu lelah untuk bekerja. Istirahat dulu.', 'bad');
        if (n.makan < 10 || n.minum < 10) return this.toast('Perut kosong, tidak kuat bekerja. Makan & minum dulu.', 'bad');
        if (this.player.vehicle) this.player.dismount();
        this.task = { b: a.b, offer: o, t: 0, dur: WORK_SECONDS };
        if (o.farmer) this.faceFarmer(o.farmer.id);
        // hadap ke petak sawah terdekat
        const { i, j } = worldToCell(p.x, p.z), g = this.player.grid;
        let best = null, bd = Infinity;
        for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
          if (g.ownerAt(i + di, j + dj) !== a.b.id) continue;
          const c = cellToWorld(i + di, j + dj), d = Math.hypot(c.x - p.x, c.z - p.z);
          if (d < bd) { bd = d; best = c; }
        }
        if (best && bd > 0.05) p.yaw = Math.atan2(best.x - p.x, best.z - p.z);
        return this.toast(`${o.task.icon} Kamu mulai ${o.task.verb}${o.farmer ? ` bersama ${sapa(o.farmer)}` : ''}...`, 'info');
      }
    }
  }
}
