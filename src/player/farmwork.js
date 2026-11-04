// Bantu di sawah: sesuai pemilik sawah (petani penggarap), kebutuhan sawah (tahap padi), dan jam kerja petani.
import { baseSchedule } from '../simulation/schedule.js';
import { cropStage } from '../simulation/sim.js';

// sapaan pendek: "Ki Wira Sena" -> "Ki Wira", "Nyi Sekar Ayu" -> "Nyi Sekar"
export const sapa = (c) => c.name.split(' ').slice(0, 2).join(' ');
const jam = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}.00`;

// Pekerjaan menurut tahap padi
function taskFor(b) {
  const p = b.crop?.progress || 0, st = cropStage(p).key;
  if (st === 'tandur') return { key: st, verb: 'menanam bibit padi', icon: '🌱', motion: 'bend', grow: 0.03, pay: 3, busy: true };
  if (st === 'tumbuh') return p < 0.4
    ? { key: st, verb: 'menyiangi rumput liar', icon: '🌿', motion: 'bend', grow: 0.02, pay: 3 }
    : { key: st, verb: 'mencangkul pematang & mengalirkan air', icon: '⛏️', motion: 'swing', grow: 0.02, pay: 3 };
  if (st === 'kuning') return { key: st, verb: 'mengusir burung pipit', icon: '🐦', motion: 'wave', grow: 0.01, pay: 2 };
  return { key: st, verb: 'memanen padi', icon: '🌾', motion: 'bend', grow: 0, pay: 5, busy: true };
}

// jam mulai kerja berikutnya dari jadwal petani
function nextWork(c, hour) {
  const starts = baseSchedule(c).filter(([, k]) => k === 'kerja').map(([h]) => h);
  return starts.find((h) => h > hour) ?? starts[0] + 24;
}

// Tawaran bantuan di sawah `b`. Hasil: { ok, label, reason?, farmer?, task? }
export function farmOffer(sim, b) {
  const hour = sim.hour, day = sim.day;
  const task = taskFor(b);
  const farmers = sim.state.citizens.filter((c) => c.workId === b.id && c.profession === 'petani');
  if (hour < 5.5 || hour >= 18) {
    return { ok: false, label: '🌙 Sawah sepi, petani datang jam 06.00', reason: `🌙 Sudah ${hour >= 18 ? 'malam' : 'dini hari'}, sawah sepi. Petani menggarap sawah pagi sampai sore (06.00–16.00).` };
  }
  // petani yang sedang menggarap sawah ini sekarang
  const here = farmers.filter((c) => sim.activityOf(c).key === 'kerja');
  const farmer = here[0];
  if (!farmer && farmers.length) {
    const f = farmers[0], a = sim.activityOf(f);
    return { ok: false, label: `🌾 ${sapa(f)} lagi tidak di sawah`, reason: `${sapa(f)} (pemilik ${b.name}) lagi ${a.label.toLowerCase()}. Kembali ke sawah sekitar jam ${jam(nextWork(f, hour))}.` };
  }
  if (!farmer && (hour < 6 || hour >= 16)) {
    return { ok: false, label: '🌾 Sawah sedang tidak digarap', reason: 'Sawah tanpa penggarap ini hanya bisa dibantu jam 06.00–16.00 (upah dari kas desa).' };
  }
  // sudah cukup dibantu hari ini? (sawah kekurangan petani / musim tanam & panen butuh lebih banyak tangan)
  b.help ||= { day, n: 0 };
  if (b.help.day !== day) b.help = { day, n: 0 };
  const cap = (farmers.length < 3 ? 4 : 2) + (task.busy ? 2 : 0);
  if (b.help.n >= cap) {
    const who = farmer ? sapa(farmer) : 'Pak Akuwu';
    return { ok: false, label: `🌾 ${who}: sudah cukup hari ini`, reason: `${who}: "Matur nuwun, sawahnya sudah cukup dibantu hari ini. Besok bantu lagi ya."` };
  }
  const who = farmer ? sapa(farmer) : 'desa';
  const pay = farmer ? task.pay : 2;
  return { ok: true, farmer, task, pay, label: `${task.icon} Bantu ${farmer ? who : 'sawah desa'} ${task.verb} (+${pay} kepeng)` };
}

// Selesai bekerja: sawah terbantu, petani membayar
export function farmReward(sim, b, offer, player) {
  const { farmer, task } = offer;
  b.help.n++;
  if (task.grow) b.crop.progress = Math.min(1, (b.crop.progress || 0) + task.grow);
  if (!farmer) {
    sim.state.economy.kas -= 2; player.kepeng += 2;
    return `${task.icon} Selesai ${task.verb}. Pak Akuwu memberi upah 2 kepeng dari kas desa.`;
  }
  if ((farmer.kepeng || 0) >= offer.pay) {
    farmer.kepeng -= offer.pay; player.kepeng += offer.pay;
    return `${task.icon} Selesai ${task.verb}. ${sapa(farmer)}: "Matur nuwun!" (+${offer.pay} kepeng)`;
  }
  return { msg: `${task.icon} Selesai ${task.verb}. ${sapa(farmer)} tidak punya kepeng, kamu diberi nasi bungkus (makan +25).`, food: 25 };
}
