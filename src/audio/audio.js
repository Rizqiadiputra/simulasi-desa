// Mesin audio desa: musik gamelan, suara suasana, dan efek suara.
// Browser hanya mengizinkan suara setelah pemain menyentuh/klik/menekan tombol,
// jadi AudioContext baru dibuat pada interaksi pertama.
import { Music } from './music.js';
import { Ambience } from './ambience.js';
import { slendro, metal, pot, gong, noiseHit, wood } from './voices.js';
import { cellToWorld } from '../data/config.js';

const PREF_KEY = 'desa-audio-v1';
const DEFAULTS = { music: 0.5, sfx: 0.7, muted: false };

function loadPrefs() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}

export class SoundEngine {
  constructor(app) {
    this.app = app;
    this.prefs = loadPrefs();
    this.ctx = null;
    const unlock = () => this.unlock();
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, unlock, { once: false, passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else if (!this.prefs.muted) this.ctx.resume();
    });
    this.ambT = 0;
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended' && !this.prefs.muted && !document.hidden) this.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = this.ctx = new Ctx();
    // master -> kompresor (supaya tidak pecah saat banyak suara bersamaan)
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.connect(comp);
    this.musicBus = ctx.createGain(); this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
    this.applyVolumes();
    this.music = new Music(ctx, this.musicBus);
    this.ambience = new Ambience(ctx, this.sfxBus);
    this.music.start();
    if (this.prefs.muted) ctx.suspend();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.prefs.music, t, 0.1);
    this.sfxBus.gain.setTargetAtTime(this.prefs.sfx, t, 0.1);
  }

  savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(this.prefs)); } catch { /* abaikan */ } }

  setVolume(kind, v) {
    this.prefs[kind] = Math.max(0, Math.min(1, v));
    this.applyVolumes();
    this.savePrefs();
  }

  toggleMute() {
    this.prefs.muted = !this.prefs.muted;
    this.savePrefs();
    if (this.ctx) this.prefs.muted ? this.ctx.suspend() : this.ctx.resume();
    return this.prefs.muted;
  }

  // dipanggil tiap frame dari main.js; suasana & mode musik cukup diperbarui 4x per detik
  update(dt) {
    if (!this.ready) return;
    this.ambT += dt;
    if (this.ambT < 0.25) return;
    this.ambT = 0;
    const { sim, state } = this.app, hour = sim.hour;
    const event = sim.activeEvents().length > 0;
    this.music.setMode(event && hour >= 6 && hour < 22 ? 'acara' : hour >= 20 || hour < 5 ? 'malam' : 'siang');
    const L = this.listener();
    this.ambience.update({
      hour,
      weather: state.weather.type,
      waterDist: this.nearest(L, this.waterPoints()),
      fireDist: this.nearest(L, this.app.torches.points),
      nightFactor: this.app.sky.nightFactor,
    });
  }

  // pendengar = pemain kalau sedang jalan-jalan, kalau tidak titik tengah kamera
  listener() {
    const p = this.app.player;
    if (p?.active && p.data) return { x: p.data.x, z: p.data.z };
    const t = this.app.stage.controls.target;
    return { x: t.x, z: t.z };
  }

  nearest(L, pts) {
    let best = Infinity;
    for (const q of pts || []) { const d = (q.x - L.x) ** 2 + (q.z - L.z) ** 2; if (d < best) best = d; }
    return Math.sqrt(best);
  }

  // titik tengah tiap sel kanal (dihitung ulang kalau jumlah sel berubah)
  waterPoints() {
    const w = this.app.state.water;
    if (this._waterN !== w.length) { this._waterN = w.length; this._water = w.map(([i, j]) => cellToWorld(i, j)); }
    return this._water;
  }

  // ------------------------------------------------------------------ efek suara
  get t() { return this.ctx.currentTime; }

  click() { if (this.ready) wood(this.ctx, this.sfxBus, this.t, 900, 0.08, 0.04); }

  step({ riding, running }) {
    if (!this.ready) return;
    if (riding) {
      // tapal kuda: dua ketukan kayu
      wood(this.ctx, this.sfxBus, this.t, 380 + Math.random() * 60, 0.14, 0.05);
      wood(this.ctx, this.sfxBus, this.t + 0.07, 330 + Math.random() * 60, 0.1, 0.05);
      return;
    }
    noiseHit(this.ctx, this.sfxBus, this.t, { freq: 500 + Math.random() * 400, q: 0.8, gain: running ? 0.16 : 0.1, decay: 0.07 });
  }

  jump() { if (this.ready) noiseHit(this.ctx, this.sfxBus, this.t, { freq: 900, q: 0.6, gain: 0.04, decay: 0.14, attack: 0.04 }); }

  land(hard) {
    if (!this.ready) return;
    noiseHit(this.ctx, this.sfxBus, this.t, { freq: 220, q: 0.7, gain: hard ? 0.35 : 0.16, decay: hard ? 0.2 : 0.1 });
  }

  // bangunan baru berdiri: ketukan palu lalu kenong
  build() {
    if (!this.ready) return;
    for (let i = 0; i < 3; i++) wood(this.ctx, this.sfxBus, this.t + i * 0.14, 520, 0.16, 0.07);
    pot(this.ctx, this.sfxBus, this.t + 0.5, slendro(5), { gain: 0.18, decay: 1.6 });
  }

  // pengumuman / acara desa: gong kecil
  event() { if (this.ready) { pot(this.ctx, this.sfxBus, this.t, slendro(2), { gain: 0.14, decay: 1.4 }); gong(this.ctx, this.sfxBus, this.t + 0.05, 98, { gain: 0.14, decay: 2.5 }); } }

  // panen: nada naik
  harvest() { if (this.ready) [2, 3, 4, 5, 7].forEach((d, i) => metal(this.ctx, this.sfxBus, this.t + i * 0.12, slendro(d), { gain: 0.14, decay: 1 })); }

  // balasan warga di chat
  reply() { if (this.ready) { metal(this.ctx, this.sfxBus, this.t, slendro(7), { gain: 0.06, decay: 0.5 }); metal(this.ctx, this.sfxBus, this.t + 0.09, slendro(9), { gain: 0.05, decay: 0.5 }); } }

  // tekan E: sapa warga, ambil kerja, dll.
  interact() { if (this.ready) { wood(this.ctx, this.sfxBus, this.t, 1100, 0.07, 0.03); metal(this.ctx, this.sfxBus, this.t + 0.04, slendro(8), { gain: 0.05, decay: 0.4 }); } }

  // naik kuda / kereta: dengus kuda + tapal; turun: satu ketukan
  mount(kind) {
    if (!this.ready) return;
    if (kind === 'kuda') noiseHit(this.ctx, this.sfxBus, this.t, { freq: 420, q: 1.5, gain: 0.2, decay: 0.35, attack: 0.05 });
    wood(this.ctx, this.sfxBus, this.t + 0.3, 360, 0.14, 0.05);
    wood(this.ctx, this.sfxBus, this.t + 0.4, 320, 0.12, 0.05);
  }
  dismount() { if (this.ready) noiseHit(this.ctx, this.sfxBus, this.t, { freq: 240, q: 0.7, gain: 0.18, decay: 0.12 }); }

  bad() { if (this.ready) { wood(this.ctx, this.sfxBus, this.t, 260, 0.14, 0.09); wood(this.ctx, this.sfxBus, this.t + 0.1, 200, 0.12, 0.1); } }
}
