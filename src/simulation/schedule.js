// Jadwal harian warga (fungsi murni). Mengembalikan aktivitas untuk jam tertentu.
// place: home | work | pasar | candi | pendopo | petirtaan | patrol | wander

export const ACTIVITIES = {
  tidur: { place: 'home', visible: false, label: 'Tidur nyenyak di rumah' },
  bangun: { place: 'home', visible: true, label: 'Baru bangun, cuci muka di pancuran' },
  kerja: { place: 'work', visible: true, label: 'Bekerja' },
  istirahat: { place: 'home', visible: true, label: 'Makan siang & leyeh-leyeh di emperan' },
  pasar: { place: 'pasar', visible: true, label: 'Belanja di pasar' },
  santai: { place: 'home', visible: true, label: 'Ngobrol santai di depan rumah' },
  mandi: { place: 'petirtaan', visible: true, label: 'Mandi & bersuci di petirtaan' },
  patroli: { place: 'patrol', visible: true, label: 'Patroli keliling desa' },
  keliling: { place: 'patrol', visible: true, label: 'Blusukan menyapa warga' },
  belajar: { place: 'pendopo', visible: true, label: 'Belajar aksara & kakawin di pendopo' },
  mengajar: { place: 'pendopo', visible: true, label: 'Mengajar kakawin di pendopo' },
  bermain: { place: 'wander', visible: true, label: 'Main kejar-kejaran keliling desa' },
  upacara: { place: 'candi', visible: true, label: 'Ikut Upacara Purnama di candi' },
  pesta: { place: 'pendopo', visible: true, label: 'Ikut Pesta Panen di pendopo' },
  festival: { place: 'pendopo', visible: true, label: 'Merayakan Festival Caitra' },
  berteduh: { place: 'home', visible: false, label: 'Berteduh dari hujan di rumah' },
  menganggur: { place: 'wander', visible: true, label: 'Lagi cari kerjaan, jalan-jalan dulu' },
};

const WORK_LABEL = {
  petani: 'Menggarap sawah', pedagang: 'Berjualan di pasar', pandai_besi: 'Menempa cangkul & keris',
  pengrajin: 'Membentuk gerabah terakota', prajurit: 'Berjaga di pos Bhayangkara',
  pendeta: 'Memimpin puja di tempat suci', akuwu: 'Mengurus desa di pendopo',
};

const S = {
  petani: [[0, 'tidur'], [5, 'bangun'], [6, 'kerja'], [11, 'istirahat'], [13, 'kerja'], [16, 'mandi'], [17, 'pasar'], [18, 'santai'], [21, 'tidur']],
  pedagang: [[0, 'tidur'], [4, 'bangun'], [5, 'kerja'], [16, 'mandi'], [17, 'santai'], [21, 'tidur']],
  pandai_besi: [[0, 'tidur'], [5, 'bangun'], [6, 'kerja'], [12, 'istirahat'], [13, 'kerja'], [17, 'pasar'], [18, 'santai'], [22, 'tidur']],
  pengrajin: [[0, 'tidur'], [5, 'bangun'], [6, 'kerja'], [11, 'istirahat'], [12, 'kerja'], [16, 'pasar'], [17, 'mandi'], [18, 'santai'], [21, 'tidur']],
  prajurit_siang: [[0, 'tidur'], [5, 'bangun'], [6, 'kerja'], [9, 'patroli'], [12, 'istirahat'], [13, 'patroli'], [16, 'kerja'], [18, 'santai'], [21, 'tidur']],
  prajurit_malam: [[0, 'patroli'], [3, 'kerja'], [6, 'tidur'], [14, 'bangun'], [15, 'pasar'], [16, 'santai'], [18, 'kerja'], [21, 'patroli']],
  pendeta: [[0, 'tidur'], [4, 'kerja'], [8, 'mandi'], [9, 'mengajar'], [11, 'istirahat'], [13, 'kerja'], [17, 'santai'], [20, 'tidur']],
  anak: [[0, 'tidur'], [6, 'bangun'], [7, 'belajar'], [10, 'bermain'], [12, 'istirahat'], [14, 'bermain'], [16, 'mandi'], [17, 'santai'], [19, 'tidur']],
  akuwu: [[0, 'tidur'], [5, 'bangun'], [6, 'kerja'], [10, 'keliling'], [12, 'istirahat'], [13, 'kerja'], [16, 'keliling'], [17, 'pasar'], [18, 'santai'], [21, 'tidur']],
};

export function baseSchedule(c) {
  if (c.profession === 'prajurit') return c.shift === 'malam' ? S.prajurit_malam : S.prajurit_siang;
  return S[c.profession] || S.petani;
}

// ctx: { events: [{type, from, to}], weather: 'cerah'|'mendung'|'hujan', pasaranRamai: bool }
export function getActivity(c, hour, ctx = {}) {
  const h = (((hour - (c.jitter || 0) / 60) % 24) + 24) % 24;
  const sched = baseSchedule(c);
  let key = sched[0][1];
  for (const [start, k] of sched) if (h >= start) key = k;
  if (key === 'kerja' && !c.workId) key = c.profession === 'anak' ? 'bermain' : 'menganggur';

  // Acara khusus mengalahkan jadwal biasa (kecuali prajurit yang sedang bertugas)
  for (const ev of ctx.events || []) {
    if (hour < ev.from || hour >= ev.to) continue;
    const onDuty = c.profession === 'prajurit' && (key === 'kerja' || key === 'patroli');
    if (onDuty) continue;
    if (key === 'tidur' && ev.type !== 'upacara') continue;
    if (ev.type === 'upacara') key = 'upacara';
    else if (ev.type === 'pesta') key = 'pesta';
    else if (ev.type === 'festival') key = 'festival';
  }
  if (ctx.pasaranRamai && (key === 'istirahat' || key === 'bermain' || key === 'menganggur') && h >= 7 && h < 15) key = 'pasar';
  if (ctx.weather === 'hujan' && ['bermain', 'santai', 'mandi', 'menganggur'].includes(key)) key = 'berteduh';

  const a = ACTIVITIES[key];
  let label = a.label;
  if (key === 'kerja') label = WORK_LABEL[c.profession] || 'Bekerja';
  if (key === 'kerja' && c.profession === 'prajurit' && (h >= 18 || h < 6)) label = 'Jaga malam sambil memukul kentongan';
  return { key, place: a.place, visible: a.visible, label };
}

export const WORK_HOURS_PRODUCE = { pengrajin: 'gerabah', pandai_besi: 'alat_besi', petani: 'kelapa' };
