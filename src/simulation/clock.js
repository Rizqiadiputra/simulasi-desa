// Jam & kalender desa. 1 hari desa = DAY_REAL_SECONDS detik nyata (default 10 menit).
import { DAY_REAL_SECONDS, YEAR_DAYS, TIME_MODE } from '../data/config.js';

export const SAPTAWARA = ['Radite', 'Soma', 'Anggara', 'Buda', 'Wrhaspati', 'Sukra', 'Saniscara'];
export const PANCAWARA = ['Umanis', 'Pahing', 'Pon', 'Wagai', 'Kaliwuan'];

export function dayInfo(day) {
  const yearDay = ((day - 1) % YEAR_DAYS) + 1;
  return {
    day,
    weekday: SAPTAWARA[(day - 1) % 7],
    pasaran: PANCAWARA[(day - 1) % 5],
    yearDay,
    year: 1215 + Math.floor((day - 1) / YEAR_DAYS), // tahun Saka (~1293 M)
    season: yearDay <= YEAR_DAYS / 2 ? 'rendheng' : 'ketiga',
  };
}
export const SEASON_LABEL = { rendheng: 'Mangsa Rendheng (hujan)', ketiga: 'Mangsa Ketiga (kemarau)' };

export class Clock {
  constructor(state, hooks) {
    this.state = state;
    this.hooks = hooks; // { onHour(hour), onNewDay(day) }
  }
  get day() { return this.state.clock.day; }
  get minute() { return this.state.clock.minute; }
  get hour() { return this.state.clock.minute / 60; }
  get realtime() { return TIME_MODE === 'realtime'; }
  get speed() { return this.realtime ? 1 : this.state.clock.speed ?? 1; }
  set speed(v) { this.state.clock.speed = v; }

  // ---- mode realtime: hari ke-N & jam mengikuti jam perangkat
  static midnight(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
  realTarget(now = Date.now()) {
    const c = this.state.clock;
    if (!c.epoch) c.epoch = Clock.midnight(now) - (c.day - 1) * 86400000; // hari desa sekarang = hari ini
    const d = new Date(now);
    const day = Math.round((Clock.midnight(now) - c.epoch) / 86400000) + 1;
    const minute = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 + d.getMilliseconds() / 60000;
    return { day, minute };
  }
  // selisih menit desa terhadap jam asli (positif = desa tertinggal)
  realDiff() {
    const c = this.state.clock, t = this.realTarget();
    return (t.day - c.day) * 1440 + (t.minute - c.minute);
  }
  snapToReal() { const t = this.realTarget(); Object.assign(this.state.clock, t); }

  tick(dtReal) {
    if (this.realtime) { const d = this.realDiff(); if (d > 0) this.advance(d); else if (d < -1) this.snapToReal(); return; }
    if (!this.speed) return;
    this.advance((dtReal * 1440 * this.speed) / DAY_REAL_SECONDS);
  }

  // Majukan waktu sekian menit desa, memicu hook tiap pergantian jam/hari.
  advance(minutes) {
    const c = this.state.clock;
    let remaining = minutes;
    while (remaining > 1e-9) {
      const next = (Math.floor(c.minute / 60) + 1) * 60;
      const step = Math.min(remaining, next - c.minute);
      c.minute += step;
      remaining -= step;
      if (c.minute >= next - 1e-9) {
        c.minute = next;
        if (c.minute >= 1440) {
          c.minute = 0;
          c.day += 1;
          this.hooks.onNewDay?.(c.day);
        }
        this.hooks.onHour?.(Math.round(c.minute / 60));
      }
    }
  }
}
