// Musik latar: gamelan generatif bertangga nada slendro.
// Tiap "gongan" = 16 ketukan balungan (melodi pokok) yang diakhiri pukulan gong.
// Satu pola diulang beberapa kali, lalu diganti pola baru, supaya terasa berulang tapi tidak membosankan.
//   siang  : saron + bonang + kenong + kempul + kendang, tempo sedang
//   malam  : gender lembut saja, pelan dan jarang
//   acara  : (upacara, pasar, festival) lebih cepat dan ramai
import { slendro, metal, pot, gong, drum } from './voices.js';

const BEATS = 16;
const LOOKAHEAD = 0.25; // detik; jadwalkan suara sedikit di depan

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Melodi pokok: jalan acak di sekitar nada tengah, berakhir di nada "gong"
function makeBalungan() {
  const notes = [];
  let d = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < BEATS; i++) {
    if (i === BEATS - 1) { notes.push(5); break; } // selalu mendarat di nada gong
    if (i % 4 !== 3 && Math.random() < 0.12) { notes.push(null); continue; } // pin (jeda)
    d += pick([-2, -1, -1, 1, 1, 2, 0]);
    d = Math.max(2, Math.min(9, d));
    notes.push(d);
  }
  return notes;
}

export class Music {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = out;
    this.mode = 'siang';
    this.beat = 0;
    this.next = 0;
    this.pattern = makeBalungan();
    this.repeats = 0;
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this.next = this.ctx.currentTime + 0.3;
    this.timer = setInterval(() => this.tick(), 100);
  }
  stop() { clearInterval(this.timer); this.timer = null; }

  setMode(mode) { this.mode = mode; }

  get beatLen() { return { siang: 60 / 72, malam: 60 / 46, acara: 60 / 96 }[this.mode]; }

  tick() {
    const ctx = this.ctx;
    if (ctx.state !== 'running') return;
    if (this.next < ctx.currentTime - 1) this.next = ctx.currentTime + 0.05; // habis jeda (tab disembunyikan)
    while (this.next < ctx.currentTime + LOOKAHEAD) {
      this.playBeat(this.next, this.beat);
      this.next += this.beatLen;
      if (++this.beat >= BEATS) {
        this.beat = 0;
        if (++this.repeats >= 2 + Math.floor(Math.random() * 3)) { this.pattern = makeBalungan(); this.repeats = 0; }
      }
    }
  }

  playBeat(t, i) {
    const { ctx, out, mode } = this;
    const n = this.pattern[i];
    const nxt = this.pattern[(i + 1) % BEATS];
    const len = this.beatLen;

    if (mode === 'malam') {
      // gender: hanya nada pokok, lembut, dengan sedikit hiasan oktaf
      if (n !== null && Math.random() < 0.75) metal(ctx, out, t, slendro(n, -1), { gain: 0.1, decay: 2.6 });
      if (n !== null && Math.random() < 0.25) metal(ctx, out, t + len / 2, slendro(n + 5, -1), { gain: 0.05, decay: 2 });
      if (i === BEATS - 1) gong(ctx, out, t, 55, { gain: 0.28, decay: 7 });
      return;
    }

    const loud = mode === 'acara' ? 1.25 : 1;
    // saron: balungan
    if (n !== null) metal(ctx, out, t, slendro(n), { gain: 0.16 * loud, decay: 1.1 });
    // bonang: dua pukulan per ketukan, antara nada sekarang dan nada berikutnya (gaya "mipil")
    const a = n ?? nxt ?? 5, b = nxt ?? a;
    pot(ctx, out, t, slendro(a, 1), { gain: 0.07 * loud, decay: 0.6 });
    pot(ctx, out, t + len / 2, slendro(b, 1), { gain: 0.06 * loud, decay: 0.6 });
    if (mode === 'acara') pot(ctx, out, t + len / 4, slendro(a + 2, 1), { gain: 0.035, decay: 0.4 });
    // kenong tiap 4 ketukan, kempul di sela-selanya, gong di akhir gongan
    if (i % 4 === 3 && i !== BEATS - 1) pot(ctx, out, t, slendro(n ?? 5, -1), { gain: 0.12, decay: 2.2 });
    if (i === 5 || i === 9 || i === 13) gong(ctx, out, t, 98, { gain: 0.16, decay: 2.5 });
    if (i === BEATS - 1) gong(ctx, out, t, 58, { gain: 0.42, decay: 6.5 });
    // kendang
    if (i === 0 || (i % 4 === 2 && Math.random() < 0.7)) drum(ctx, out, t, 'dhung', 0.22 * loud);
    if (mode === 'acara' || Math.random() < 0.35) drum(ctx, out, t + len * 0.75, 'tak', 0.16);
  }
}
