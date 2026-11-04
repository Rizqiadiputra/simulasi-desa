// "Otak" warga untuk ngobrol: konteks persona + jawaban lokal berbasis kata kunci (offline).
import { PROFESSIONS } from '../data/buildingTypes.js';
import { dayInfo, SEASON_LABEL } from '../simulation/clock.js';
import { WEATHER_LABEL } from '../simulation/weather.js';
import { nextEvents } from '../simulation/events.js';
import { storageCap } from '../simulation/economy.js';
import { cropStage } from '../simulation/sim.js';
import { fmtClock, fmt } from '../core/util.js';
import { AKUWU_LINES } from '../data/names.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const daypart = (h) => (h < 4 ? 'malam' : h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18.5 ? 'sore' : 'malam');

// Fakta yang dibutuhkan warga untuk menjawab
export function buildContext(app, c) {
  const sim = app.sim, st = sim.state, info = dayInfo(sim.day);
  const home = sim.building(c.homeId), work = sim.building(c.workId);
  const housemates = st.citizens.filter((x) => x.homeId === c.homeId && x.id !== c.id);
  const sawah = st.buildings.filter((b) => b.type === 'sawah');
  const avg = sawah.length ? sawah.reduce((s, b) => s + (b.crop?.progress || 0), 0) / sawah.length : 0;
  return {
    c, sim, st, info, home, work, housemates,
    prof: PROFESSIONS[c.profession],
    activity: (app.npcs.statusText(app.npcs.npcs.get(c.id)) || 'santai').split(' — ')[0],
    hour: sim.hour,
    time: fmtClock(st.clock.minute),
    weather: WEATHER_LABEL[st.weather.type].toLowerCase(),
    season: SEASON_LABEL[info.season],
    events: nextEvents(st, sim.day, 3),
    today: sim.today.filter((e) => e.type !== 'pasar'),
    pasaran: info.pasaran,
    crop: cropStage(avg).label.toLowerCase().replace(/^padi /, ''),
    akuwu: st.citizens.find((x) => x.profession === 'akuwu'),
    player: st.player,
    news: st.announcements[0]?.lines.slice(2, 7) || [],
    e: st.economy,
    cap: storageCap(st),
    pop: st.citizens.length,
    buildings: [...new Set(st.buildings.map((b) => b.name))].filter((n) => !n.startsWith('Rumah') && !n.startsWith('Sawah')).slice(0, 14),
  };
}

// System prompt untuk Claude
export function systemPrompt(x) {
  const c = x.c, kid = c.profession === 'anak';
  const you = x.player?.name || 'seorang pengembara';
  return [
    `Kamu memerankan ${c.name}, warga Desa Majapahit di dekat Trowulan, Jawa Timur. Tahun Saka ${x.info.year} (sekitar 1293 M), masa awal Kerajaan Majapahit di bawah Sri Kertarajasa Jayawardhana (Raden Wijaya). Gajah Mada dan Hayam Wuruk belum terkenal di masa ini.`,
    `Profilmu: ${x.prof.label}, ${c.age} tahun, ${c.gender === 'L' ? 'laki-laki' : 'perempuan'}, asal ${c.origin}. Tinggal di ${x.home?.name || '-'}${x.housemates.length ? ` bersama ${x.housemates.map((h) => h.name).join(', ')}` : ''}. Bekerja di ${x.work?.name || '-'}. Kegemaran: ${c.hobby}. Punya ${Math.round(c.kepeng)} kepeng.`,
    `Saat ini: hari ${x.info.weekday} ${x.pasaran}, hari ke-${x.sim.day}, jam ${x.time} (${daypart(x.hour)}), cuaca ${x.weather}, ${x.season}. Kamu sedang: ${x.activity}.`,
    `Keadaan desa: ${x.pop} warga, kepala desa ${x.akuwu?.name || 'Pak Akuwu'}. Padi di sawah ${x.crop}. Lumbung berisi ${fmt(x.e.stock.beras)} dari ${fmt(x.cap)} bakul. Harga pasar: beras ${x.e.prices.beras}, kelapa ${x.e.prices.kelapa}, gerabah ${x.e.prices.gerabah}, alat besi ${x.e.prices.alat_besi} kepeng. Tempat penting: ${x.buildings.join(', ')}.`,
    x.events.length ? `Acara mendatang: ${x.events.map((e) => `${e.label} hari ke-${e.day} jam ${Math.floor(e.from)}.00`).join('; ')}.` : '',
    x.news.length ? `Kabar terbaru dari Pak Akuwu: ${x.news.join(' ')}` : '',
    `Lawan bicaramu: ${you}, pendatang yang sedang berkunjung ke desa.`,
    `Gaya bicara: bahasa Indonesia santai sehari-hari, sesekali sisipkan kata Jawa (nggih, monggo, sampun, kisanak, lho). ${kid ? 'Kamu anak kecil: polos, ceria, kalimat sederhana.' : 'Ramah dan sesuai pekerjaanmu.'} Jawab singkat, 1–3 kalimat, tanpa markdown, tanpa daftar. Tetap dalam peran. Kamu tidak tahu apa pun setelah abad ke-14; kalau ditanya hal modern (HP, internet, mobil), bingunglah dengan lucu. Jangan mengarang angka yang bertentangan dengan keadaan desa di atas.`,
  ].filter(Boolean).join('\n');
}

// ------------------------------------------------------------------ otak lokal
const INTENTS = [
  ['salam', /\b(halo|hai|hi|hey|sugeng|selamat (pagi|siang|sore|malam)|pagi|assalam|om swastyastu|permisi|punten|kulonuwun)\b/],
  ['pamit', /\b(dah|dadah|sampai jumpa|pamit|pergi dulu|duluan|bye|selamat tinggal)\b/],
  ['terima', /\b(makasih|terima ?kasih|matur nuwun|thanks)\b/],
  ['kabar', /(apa kabar|gimana kabar|bagaimana kabar|kabarmu|sehat)/],
  ['nama', /(siapa nama|namamu|nama kamu|kamu siapa|siapa kamu|nama anda)/],
  ['kegiatan', /(lagi apa|lagi ngapain|sedang apa|ngapain|sibuk apa|mau ke mana|mau kemana)/],
  ['kerja', /(kerja|pekerjaan|profesi|pakaryan|mata pencaharian)/],
  ['umur', /(umur|usia|berapa tahun)/],
  ['asal', /(asal|dari mana|darimana|kampung halaman)/],
  ['rumah', /(tinggal|rumahmu|rumah kamu|serumah|keluarga|anak|istri|suami|ibu|bapak)/],
  ['hobi', /(hobi|kegemaran|suka apa|senang apa|waktu luang)/],
  ['cuaca', /(cuaca|hujan|panas|mendung|cerah|langit)/],
  ['waktu', /(jam berapa|hari apa|tanggal|sekarang hari)/],
  ['sawah', /(panen|padi|sawah|tanam|beras|lumbung|musim)/],
  ['pasar', /(pasar|harga|jual|beli|kepeng|uang|dagang|murah|mahal)/],
  ['acara', /(acara|upacara|festival|pesta|purnama|ramai|perayaan)/],
  ['akuwu', /(akuwu|kepala desa|pemimpin desa)/],
  ['raja', /(raja|majapahit|wijaya|kertarajasa|hayam wuruk|gajah mada|kerajaan|keraton|istana)/],
  ['tempat', /(candi|pura|petirtaan|pendopo|gapura|tempat|bangunan|desa ini)/],
  ['modern', /(hp|handphone|internet|wifi|mobil|motor|komputer|listrik|instagram|tiktok|youtube|kopi)/],
  ['makan', /(makan|lapar|masak|nasi|minum)/],
  ['saya', /(aku siapa|kenal aku|tahu aku|namaku)/],
];

const K = (x) => x.c.profession === 'anak';

const R = {
  salam: (x) => K(x) ? [`Halo ${x.player?.name || 'Kak'}! Hihi.`, 'Hai! Kakak mau main sama aku?'] :
    [`Sugeng ${daypart(x.hour)}, ${x.player?.name || 'kisanak'}! Monggo, ada yang bisa saya bantu?`, `Wah, ${x.player?.name || 'kisanak'}! Selamat datang di desa kami.`],
  pamit: (x) => K(x) ? ['Dadah Kakak! Besok main lagi ya!'] : ['Monggo, hati-hati di jalan nggih.', 'Sampai jumpa lagi, mampir kapan-kapan!'],
  terima: () => ['Sami-sami. Sama-sama, nggih.', 'Ah, tidak usah sungkan.'],
  kabar: (x) => [`Puji dewata, sehat. ${x.weather === 'hujan' ? 'Cuma agak basah kena hujan.' : 'Badan segar, hati senang.'}`, `Baik-baik saja. Lagi ${x.activity.toLowerCase().split(' — ')[0]}.`],
  nama: (x) => K(x) ? [`Aku ${x.c.name}! Umurku ${x.c.age} tahun.`] : [`Saya ${x.c.name}, ${x.prof.label.toLowerCase()} di desa ini.`],
  kegiatan: (x) => [`Ini lagi ${x.activity.charAt(0).toLowerCase() + x.activity.slice(1)}.`, `Sekarang jam ${x.time}, ya biasa: ${x.activity.toLowerCase()}.`],
  kerja: (x) => ({
    petani: [`Saya petani, garap ${x.work?.name || 'sawah'}. Padinya sekarang ${x.crop}.`],
    pedagang: [`Saya jualan di ${x.work?.name || 'pasar'}. Beras lagi ${x.e.prices.beras} kepeng sebakul.`],
    pandai_besi: [`Saya pandai besi di ${x.work?.name || 'pande'}. Cangkul, arit, tombak, sampai keris saya tempa.`],
    pengrajin: [`Saya bikin gerabah terakota di ${x.work?.name || 'bengkel'}. Celengan babi buatan saya laris, lho!`],
    prajurit: [`Saya Bhayangkara, jaga keamanan desa${x.c.shift === 'malam' ? ', kebagian jaga malam' : ''}.`],
    pendeta: [`Saya melayani puja di ${x.work?.name || 'candi'}, juga mengajar kakawin ke anak-anak.`],
    akuwu: ['Saya akuwu, kepala desa ini. Urusan kas, pajak, sampai sengketa sawah saya yang pegang.'],
    anak: ['Aku belum kerja, masih belajar aksara di pendopo. Sama main!'],
  }[x.c.profession] || ['Saya bantu-bantu di desa.']),
  umur: (x) => [`Umur saya ${x.c.age} tahun.${x.c.age > 50 ? ' Sudah banyak makan asam garam.' : ''}`],
  asal: (x) => [x.c.origin === 'Asli desa' || x.c.origin === 'Lahir di desa' ? 'Saya asli sini, lahir dan besar di desa ini.' : `Saya dari ${x.c.origin}, pindah ke sini hari ke-${x.c.sinceDay}.`],
  rumah: (x) => [`Saya tinggal di ${x.home?.name || 'rumah panggung'}${x.housemates.length ? ` bareng ${x.housemates.slice(0, 3).map((h) => h.name).join(', ')}` : ', sendirian saja'}.`],
  hobi: (x) => [`Kalau senggang saya suka ${x.c.hobby.toLowerCase()}.`, `${x.c.hobby}! Itu kesenangan saya.`],
  cuaca: (x) => [`Hari ini ${x.weather}. ${x.season}, jadi ${x.info.season === 'rendheng' ? 'sering hujan, bagus buat sawah' : 'agak kering, kanal jadi penting'}.`],
  waktu: (x) => [`Sekarang ${x.info.weekday} ${x.pasaran}, jam ${x.time}. Hari ke-${x.sim.day} tahun Saka ${x.info.year}.`],
  sawah: (x) => [`Padi di sawah ${x.crop}. Lumbung isinya ${fmt(x.e.stock.beras)} bakul dari ${fmt(x.cap)}.`, `${x.season}. Semoga panen kali ini melimpah.`],
  pasar: (x) => [`Di pasar beras ${x.e.prices.beras} kepeng, gerabah ${x.e.prices.gerabah}, alat besi ${x.e.prices.alat_besi}. ${x.pasaran === 'Umanis' ? 'Hari ini Umanis, pasar ramai!' : 'Ramainya pas hari Umanis.'}`],
  acara: (x) => x.today.length ? [`Hari ini ada ${x.today.map((e) => e.label).join(' dan ')}! Datang ya.`] : x.events.length ? [`Acara berikutnya ${x.events[0].label} hari ke-${x.events[0].day}. Jangan lewatkan!`] : ['Belum ada acara dekat-dekat ini.'],
  akuwu: (x) => x.c.profession === 'akuwu' ? [pick(AKUWU_LINES)] : [`${x.akuwu?.name || 'Pak Akuwu'} itu orangnya baik, tiap pagi bikin pengumuman. Biasanya di pendopo.`],
  raja: (x, t) => /gajah mada/.test(t) ? ['Gajah Mada? Belum pernah dengar. Mungkin nanti jadi orang besar?']
    : /hayam wuruk/.test(t) ? ['Hayam Wuruk? Hmm, tidak ada pangeran bernama itu. Raja kita Sri Kertarajasa.']
    : /nama|kenapa|arti/.test(t) && /majapahit/.test(t) && !/raja/.test(t) ? ['Majapahit itu dari buah maja yang pahit, lho. Waktu hutan Tarik dibuka, buahnya pahit semua.']
    : ['Raja kita Sri Kertarajasa Jayawardhana, dulu dikenal Raden Wijaya. Beliau baru saja mendirikan Majapahit setelah mengusir pasukan Tartar. Keratonnya di Trowulan, dekat sini!'],
  tempat: (x) => [`Coba mampir ke ${pick(x.buildings)}. Bagus tempatnya.`, 'Candi bata merah kita itu kebanggaan desa. Kalau purnama ramai sekali.'],
  modern: (x) => K(x) ? ['Hah? Itu mainan apa, Kak?'] : ['Apa itu? Saya tidak paham, kisanak. Itu dari negeri seberang?', 'Wah, kata-kata kisanak aneh. Belum pernah dengar di pasar mana pun.'],
  makan: () => ['Mampir saja, ada nasi, sayur lodeh, dan ikan kanal bakar.', 'Lapar? Di pasar ada jajan pasar enak, murah lagi.'],
  saya: (x) => [x.player ? `Tentu, kamu ${x.player.name}, pengembara yang lagi keliling desa kami!` : 'Kisanak pendatang, kan? Wajahnya baru.'],
};

const FALLBACK = (x) => K(x) ? ['Hmm, aku nggak ngerti, Kak. Ayo main saja!', 'Hah? Tanya yang lain dong!'] :
  [`Hmm, saya kurang paham, kisanak. Tanya soal ${pick(['pasar', 'sawah', 'acara desa', 'Majapahit', 'pekerjaan saya'])} saja?`, 'Wah, itu di luar pengetahuan saya. Saya cuma orang desa biasa.'];

export function localReply(x, text) {
  const t = ` ${text.toLowerCase()} `;
  let hits = INTENTS.filter(([, re]) => re.test(t)).map(([k]) => k);
  if (!hits.length) return pick(FALLBACK(x));
  // prioritas: maksud yang lebih spesifik menyingkirkan yang umum
  const drop = (k, ifAny) => { if (ifAny.some((h) => hits.includes(h))) hits = hits.filter((h) => h !== k); };
  drop('sawah', ['pasar']);
  drop('tempat', ['raja', 'acara']);
  drop('kerja', ['kegiatan']);
  drop('rumah', ['nama', 'saya']);
  if (hits.length > 1) hits = hits.filter((h) => h !== 'salam'); // "halo, lagi ngapain?" -> jawab intinya
  // gabungkan maksimal 2 maksud
  return hits.slice(0, 2).map((k) => pick(R[k](x, t))).join(' ');
}

export function openingLine(x) {
  const greet = R.salam(x);
  return pick(greet);
}

export const SUGGESTIONS = ['Lagi ngapain?', 'Ceritain tentang dirimu', 'Harga di pasar berapa?', 'Ada acara apa?', 'Siapa raja Majapahit?', 'Gimana padinya?'];
