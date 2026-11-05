// Suara-suara dasar yang dibuat langsung dengan Web Audio (tanpa file audio).
// Semua fungsi menerima (ctx, out, t, ...) dan menjadwalkan suara pada waktu t.

// Tangga nada slendro (lima nada, jarak tidak rata seperti gamelan sungguhan), dalam cents
const SLENDRO = [0, 231, 474, 717, 955];
const BASE = 262; // kira-kira nada "nem" saron

// derajat 0,1,2,... -> frekuensi (5 derajat = 1 oktaf)
export function slendro(deg, octave = 0) {
  const o = Math.floor(deg / 5), i = ((deg % 5) + 5) % 5;
  return BASE * 2 ** (o + octave) * 2 ** (SLENDRO[i] / 1200);
}

let noiseBuf = null;
export function noiseBuffer(ctx) {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

// Amplop: naik cepat lalu meluruh eksponensial
function env(ctx, out, t, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(out);
  return g;
}

function tone(ctx, g, t, freq, dur, type = 'sine', gain = 1) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (gain === 1) o.connect(g);
  else { const k = ctx.createGain(); k.gain.value = gain; o.connect(k).connect(g); }
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

// Bilah logam (saron / gender): nada dasar + parsial tak harmonis khas metalofon
export function metal(ctx, out, t, freq, { gain = 0.25, decay = 1.2 } = {}) {
  const g = env(ctx, out, t, gain, 0.003, decay);
  tone(ctx, g, t, freq, decay);
  tone(ctx, g, t, freq * 2.76, decay * 0.4, 'sine', 0.18);
  tone(ctx, g, t, freq * 5.4, decay * 0.15, 'sine', 0.06);
}

// Pencon (bonang / kenong): ada sedikit "dengung" karena dua nada hampir sama
export function pot(ctx, out, t, freq, { gain = 0.16, decay = 0.9 } = {}) {
  const g = env(ctx, out, t, gain, 0.004, decay);
  tone(ctx, g, t, freq, decay);
  tone(ctx, g, t, freq * 1.004, decay, 'sine', 0.6);
  tone(ctx, g, t, freq * 3.01, decay * 0.25, 'sine', 0.08);
}

// Gong: rendah, panjang, bergelombang (beating)
export function gong(ctx, out, t, freq = 58, { gain = 0.45, decay = 6 } = {}) {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 600;
  lp.connect(out);
  const g = env(ctx, lp, t, gain, 0.03, decay);
  tone(ctx, g, t, freq, decay);
  tone(ctx, g, t, freq * 1.012, decay, 'sine', 0.8);
  tone(ctx, g, t, freq * 2.02, decay * 0.5, 'sine', 0.25);
  tone(ctx, g, t, freq * 2.94, decay * 0.3, 'sine', 0.08);
}

// Kendang: "dhung" (nada turun) atau "tak" (ketukan kering)
export function drum(ctx, out, t, kind = 'dhung', gain = 0.3) {
  if (kind === 'dhung') {
    const g = env(ctx, out, t, gain, 0.004, 0.22);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.18);
    o.connect(g); o.start(t); o.stop(t + 0.3);
  } else {
    noiseHit(ctx, out, t, { freq: 1800, q: 1.2, gain: gain * 0.7, decay: 0.05 });
  }
}

// Semburan derau pendek lewat filter bandpass (langkah kaki, ketukan, dll.)
export function noiseHit(ctx, out, t, { freq = 800, q = 1, gain = 0.2, decay = 0.08, attack = 0.002 } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
  const g = env(ctx, out, t, gain, attack, decay);
  src.connect(bp).connect(g);
  src.start(t, Math.random() * 1.5);
  src.stop(t + attack + decay + 0.05);
}

// Ketukan kayu (klik UI, tapal kuda)
export function wood(ctx, out, t, freq = 700, gain = 0.18, decay = 0.06) {
  const g = env(ctx, out, t, gain, 0.002, decay);
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + decay);
  o.connect(g); o.start(t); o.stop(t + decay + 0.05);
}

// Kicau burung: sapuan nada cepat
export function chirp(ctx, out, t, { from = 2600, to = 3800, dur = 0.09, gain = 0.05 } = {}) {
  const g = env(ctx, out, t, gain, 0.01, dur);
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  o.connect(g); o.start(t); o.stop(t + dur + 0.05);
}

// ------------------------------------------------------------------ kuda
// Tapal kuda: dentum rendah + klik keras di tanah
export function hoof(ctx, out, t, gain = 0.15) {
  wood(ctx, out, t, 260 + Math.random() * 80, gain, 0.05);
  noiseHit(ctx, out, t, { freq: 2200 + Math.random() * 800, q: 1.5, gain: gain * 0.5, decay: 0.02 });
}

// Dengusan: hembusan napas lewat bibir yang bergetar ("brrr")
export function snort(ctx, out, t, gain = 0.2) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.9;
  const g = ctx.createGain(); g.gain.value = 0;
  const flutter = ctx.createOscillator(), depth = ctx.createGain();
  flutter.frequency.value = 28; depth.gain.value = gain * 0.5;
  flutter.connect(depth).connect(g.gain);
  const dur = 0.35 + Math.random() * 0.25;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain * 0.6, t + 0.04);
  g.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(bp).connect(g).connect(out);
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
  flutter.start(t); flutter.stop(t + dur + 0.05);
}

// Ringkikan: nada tinggi bergetar cepat yang naik lalu turun bergelombang
export function whinny(ctx, out, t, gain = 0.12) {
  const dur = 1 + Math.random() * 0.4, f0 = 700 + Math.random() * 200;
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0 * 0.8, t);
  o.frequency.linearRampToValueAtTime(f0 * 1.45, t + 0.18);
  o.frequency.linearRampToValueAtTime(f0 * 1.1, t + dur * 0.6);
  o.frequency.linearRampToValueAtTime(f0 * 0.6, t + dur);
  // vibrato cepat khas ringkikan
  const vib = ctx.createOscillator(), vd = ctx.createGain();
  vib.frequency.setValueAtTime(9, t); vib.frequency.linearRampToValueAtTime(14, t + dur);
  vd.gain.value = f0 * 0.09;
  vib.connect(vd).connect(o.frequency);
  // filter "mulut"
  const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 1300; f1.Q.value = 1.4;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.08);
  g.gain.setValueAtTime(gain, t + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f1).connect(lp).connect(g).connect(out);
  o.start(t); o.stop(t + dur + 0.05);
  vib.start(t); vib.stop(t + dur + 0.05);
  snort(ctx, out, t + dur - 0.05, gain * 0.9); // diakhiri hembusan
}
