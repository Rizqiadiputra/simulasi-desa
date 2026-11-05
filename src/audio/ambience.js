// Suara suasana: hujan & guntur, angin, aliran kanal (sungai), gemeretak obor,
// jangkrik & kodok di malam hari, kicau burung di pagi/siang.
// Sungai dan api bersifat posisional: makin dekat pendengar (pemain / kamera), makin keras.
import { noiseBuffer, chirp, noiseHit } from './voices.js';

// Lapisan derau yang terus berputar, volumenya diatur sesuai cuaca
function noiseLayer(ctx, out, { lo, hi }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = lo;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = hi;
  const g = ctx.createGain(); g.gain.value = 0;
  src.connect(hp).connect(lp).connect(g).connect(out);
  src.start();
  g.lp = lp;
  return g;
}

export class Ambience {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = out;
    this.rain = noiseLayer(ctx, out, { lo: 400, hi: 5000 });
    this.wind = noiseLayer(ctx, out, { lo: 80, hi: 500 });
    this.fire = noiseLayer(ctx, out, { lo: 200, hi: 900 });
    // sungai: derau "gemericik" yang filternya bergoyang pelan
    this.river = noiseLayer(ctx, out, { lo: 350, hi: 1400 });
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 0.35; depth.gain.value = 350;
    lfo.connect(depth).connect(this.river.lp.frequency); lfo.start();
    this.nextCritter = 0;
    this.nextBird = 0;
    this.nextThunder = 0;
    this.nextCrackle = 0;
    this.fireLevel = 0;
  }

  // dipanggil beberapa kali per detik dari loop game
  //   waterDist / fireDist: jarak pendengar ke kanal / obor terdekat (unit dunia)
  //   nightFactor: 0 (siang) .. 1 (malam), dipakai juga untuk menyalakan obor
  update({ hour, weather, waterDist = Infinity, fireDist = Infinity, nightFactor = 0 }) {
    const ctx = this.ctx, t = ctx.currentTime;
    if (ctx.state !== 'running') return;
    const night = hour >= 19 || hour < 5;
    const rainy = weather === 'hujan';
    const near = (d, r) => Math.max(0, 1 - d / r) ** 2;
    this.rain.gain.setTargetAtTime(rainy ? 0.12 : 0, t, 1.5);
    this.wind.gain.setTargetAtTime(weather === 'mendung' ? 0.025 : rainy ? 0.015 : 0.006, t, 2);
    this.river.gain.setTargetAtTime(near(waterDist, 16) * 0.07, t, 0.6); // hanya terdengar saat dekat kanal
    this.fireLevel = nightFactor > 0.05 ? near(fireDist, 9) * nightFactor : 0;
    this.fire.gain.setTargetAtTime(this.fireLevel * 0.09, t, 0.4);

    // gemeretak api: letupan kecil acak, makin sering kalau makin dekat
    if (this.fireLevel > 0.02 && t >= this.nextCrackle) {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) noiseHit(ctx, this.out, t + Math.random() * 0.15, { freq: 2500 + Math.random() * 2500, q: 2, gain: 0.05 + this.fireLevel * 0.12, decay: 0.015 });
      this.nextCrackle = t + 0.08 + Math.random() * (0.5 / (0.2 + this.fireLevel));
    }
    // guntur: sesekali saat hujan
    if (rainy && t >= this.nextThunder) {
      if (this.nextThunder) this.thunder(t);
      this.nextThunder = t + 18 + Math.random() * 40;
    } else if (!rainy) this.nextThunder = 0;

    // jangkrik & kodok
    if (night && t >= this.nextCritter) {
      if (Math.random() < 0.7) this.crickets(t);
      else this.frog(t);
      this.nextCritter = t + 0.5 + Math.random() * (rainy ? 0.8 : 1.6);
    }
    // burung: ramai di pagi hari, jarang di siang, diam saat hujan
    const birdChance = hour >= 5 && hour < 9 ? 1 : hour >= 9 && hour < 17 ? 0.3 : 0;
    if (!rainy && birdChance && t >= this.nextBird) {
      if (Math.random() < birdChance) this.bird(t);
      this.nextBird = t + 1 + Math.random() * 3;
    }
  }

  // gemuruh rendah yang bergulung, kadang diawali petir yang menggelegar
  thunder(t) {
    const ctx = this.ctx;
    const close = Math.random() < 0.35;
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = close ? 380 : 180;
    const g = ctx.createGain();
    const dur = 3 + Math.random() * 3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(close ? 0.9 : 0.45, t + 0.15);
    for (let k = 1; k < 4; k++) g.gain.exponentialRampToValueAtTime((close ? 0.7 : 0.35) * (1 - k / 5) + 0.05, t + k * dur / 5 + Math.random() * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(lp).connect(g).connect(this.out);
    src.start(t, Math.random()); src.stop(t + dur + 0.1);
    if (close) noiseHit(ctx, this.out, t, { freq: 1200, q: 0.4, gain: 0.35, decay: 0.35 });
  }

  crickets(t) {
    const pan = this.ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8; pan.connect(this.out);
    const f = 4000 + Math.random() * 900, pulses = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < pulses; i++) chirp(this.ctx, pan, t + i * 0.055, { from: f, to: f * 1.02, dur: 0.03, gain: 0.025 });
  }

  frog(t) {
    const pan = this.ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.4 - 0.7; pan.connect(this.out);
    for (let i = 0; i < 2; i++) noiseHit(this.ctx, pan, t + i * 0.13, { freq: 320 + Math.random() * 80, q: 9, gain: 0.12, decay: 0.08 });
  }

  bird(t) {
    const pan = this.ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.8 - 0.9; pan.connect(this.out);
    const base = 2200 + Math.random() * 1500, n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const up = Math.random() < 0.6;
      chirp(this.ctx, pan, t + i * (0.11 + Math.random() * 0.06), { from: up ? base : base * 1.5, to: up ? base * 1.5 : base, dur: 0.07 + Math.random() * 0.05, gain: 0.035 });
    }
  }
}
