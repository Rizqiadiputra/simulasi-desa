// Definisi tipe bangunan. Footprint dalam sel (selalu ganjil supaya punya sel tengah).
// Sisi depan = +z lokal. `spots` = titik aktivitas lokal [x, z, y] (unit dunia, relatif pusat).
// `gather` = titik kumpul saat acara (boleh di luar footprint, di depan pintu).

const ring = (r, n, y = 0, z0 = 0) =>
  Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r + z0, y];
  });
const frontArea = (zFrom, zTo, w = 4, n = 10) => {
  const rows = Math.ceil(n / 5);
  return Array.from({ length: n }, (_, k) => [
    ((k % 5) / 4 - 0.5) * w,
    zFrom + (Math.floor(k / 5) / Math.max(1, rows - 1)) * (zTo - zFrom),
    0,
  ]);
};

export const BUILDING_TYPES = {
  rumah: {
    label: 'Rumah Panggung', icon: '🛖', fp: [3, 3], cost: 120, capacity: 4, role: 'home', buildable: true,
    desc: 'Rumah kayu berkolong tempat keluarga warga tinggal. Kolongnya buat ayam & kayu bakar.',
    spots: [[0, 3.2, 0], [1.2, 3.0, 0], [-1.2, 3.1, 0]],
  },
  rumah_akuwu: {
    label: 'Kediaman Akuwu', icon: '🏡', fp: [5, 3], cost: 0, capacity: 4, role: 'home', buildable: false,
    desc: 'Rumah Pak Akuwu, kepala desa. Di sinilah titah dan pengumuman desa diputuskan.',
    spots: [[0, 3.6, 0], [1.5, 3.4, 0], [-1.5, 3.4, 0]],
  },
  pendopo: {
    label: 'Pendopo', icon: '🏛️', fp: [5, 5], cost: 300, role: 'civic', buildable: true, light: true,
    desc: 'Balai terbuka untuk musyawarah, belajar kakawin, dan pesta desa.',
    jobs: { akuwu: 1 },
    spots: [[0, 0, 0.6], [1.5, 1, 0.6], [-1.5, -1, 0.6], [1.6, -1.4, 0.6], [-1.2, 1.6, 0.6]],
    gather: [...ring(2.4, 10, 0.6), ...ring(3.4, 12, 0.6)],
  },
  lumbung: {
    label: 'Lumbung Padi', icon: '🌾', fp: [1, 1], cost: 80, role: 'storage', buildable: true,
    desc: 'Lumbung berkaki tinggi untuk menyimpan padi. Tiap lumbung menambah kapasitas simpan beras.',
    storage: 120, spots: [[0, 1.6, 0]],
  },
  pasar: {
    label: 'Pasar', icon: '🧺', fp: [5, 5], cost: 250, role: 'market', buildable: true, light: true,
    desc: 'Tempat jual-beli pakai kepeng. Ramai sekali tiap hari pasaran Umanis.',
    jobs: { pedagang: 4 },
    spots: [[-3.2, -1.7, 0], [0, -1.7, 0], [3.2, -1.7, 0], [-3.2, 1.5, 0], [3.2, 1.5, 0]],
    gather: [[-1.5, 0, 0], [0, 0.3, 0], [1.5, 0, 0], [-0.8, -0.6, 0], [0.8, 0.6, 0], [-2, 0.5, 0], [2, -0.4, 0], [0, -0.8, 0], [0.4, 3.5, 0], [-0.4, 4.2, 0]],
  },
  pande: {
    label: 'Bengkel Pande Besi', icon: '⚒️', fp: [3, 3], cost: 200, role: 'work', buildable: true,
    desc: 'Bengkel pandai besi: menempa cangkul, arit, tombak, sampai keris.',
    jobs: { pandai_besi: 2 },
    spots: [[0.6, 0.6, 0], [-0.6, -0.1, 0]],
  },
  terakota: {
    label: 'Bengkel Terakota', icon: '🏺', fp: [3, 3], cost: 180, role: 'work', buildable: true,
    desc: 'Tempat membuat gerabah, celengan, dan arca terakota khas Trowulan.',
    jobs: { pengrajin: 3 },
    spots: [[-1.2, -0.6, 0], [0, -0.8, 0], [0.4, 1.2, 0]],
  },
  sawah: {
    label: 'Petak Sawah', icon: '🌱', fp: [5, 5], cost: 60, role: 'farm', buildable: true, walkable: true,
    desc: 'Sawah berundak yang diairi kanal. Panen padi kira-kira tiap 8 hari.',
    jobs: { petani: 3 },
    spots: [[0, 0, 0]], wander: 3.6,
  },
  candi: {
    label: 'Candi', icon: '🛕', fp: [5, 5], cost: 600, role: 'sacred', buildable: true, light: true,
    desc: 'Candi bata merah tempat pemujaan. Upacara Purnama digelar di halamannya.',
    jobs: { pendeta: 2 },
    spots: [[-0.8, 3.2, 1.9], [0.8, 3.2, 1.9]],
    gather: frontArea(6.2, 8.4, 5, 15),
  },
  pura: {
    label: 'Pura Kecil', icon: '🪔', fp: [3, 3], cost: 250, role: 'sacred', buildable: true,
    desc: 'Pura keluarga dengan meru beratap ijuk bersusun.',
    jobs: { pendeta: 1 },
    spots: [[0.6, 0.6, 0], [-0.6, 1.2, 0]],
  },
  petirtaan: {
    label: 'Petirtaan', icon: '⛲', fp: [5, 5], cost: 400, role: 'civic', buildable: true,
    desc: 'Kolam pemandian suci berundak, airnya dari kanal. Tempat mandi & bersuci.',
    spots: [[-3.6, 3.6, 0.8], [3.6, 3.6, 0.8], [-3.6, -3.6, 0.8], [3.6, -3.6, 0.8], [0, -3.6, 0.8], [-3.6, 0, 0.8], [3.6, 0, 0.8], [-2, 3.6, 0.8], [2, 3.6, 0.8]],
  },
  gapura_bentar: {
    label: 'Gapura Bentar', icon: '🚪', fp: [5, 1], cost: 200, role: 'gate', buildable: true, light: true,
    desc: 'Gerbang terbelah dua, menandai pintu masuk desa.',
    passable: [[0, 0]], spots: [[0, 1.6, 0]],
  },
  gapura_paduraksa: {
    label: 'Gapura Paduraksa', icon: '🧱', fp: [3, 1], cost: 350, role: 'gate', buildable: true,
    desc: 'Gerbang beratap tinggi ala Bajang Ratu, pembatas kawasan suci.',
    passable: [[0, 0]], spots: [[0, 1.6, 0]],
  },
  istal: {
    label: 'Istal Kuda', icon: '🐎', fp: [3, 3], cost: 220, role: 'work', buildable: true,
    desc: 'Kandang kuda tunggangan desa. Tiap istal memelihara 3 ekor kuda. Kereta kencana desa juga parkir di sini.',
    spots: [[0, 3.2, 0]],
  },
  pos_jaga: {
    label: 'Pos Bhayangkara', icon: '🛡️', fp: [3, 3], cost: 150, role: 'work', buildable: true,
    desc: 'Menara jaga para prajurit Bhayangkara, lengkap dengan kentongan.',
    jobs: { prajurit: 3 },
    spots: [[0.8, 2.2, 0], [-0.8, 2.0, 0], [0, 0.4, 0]],
  },
};

export const PROFESSIONS = {
  petani: { label: 'Petani', work: ['sawah'], icon: '🌾' },
  pedagang: { label: 'Pedagang Pasar', work: ['pasar'], icon: '🧺' },
  pandai_besi: { label: 'Pandai Besi', work: ['pande'], icon: '⚒️' },
  pengrajin: { label: 'Pengrajin Terakota', work: ['terakota'], icon: '🏺' },
  prajurit: { label: 'Prajurit Bhayangkara', work: ['pos_jaga'], icon: '🛡️' },
  pendeta: { label: 'Pendeta', work: ['candi', 'pura'], icon: '🪷' },
  anak: { label: 'Anak-anak', work: [], icon: '🧒' },
  tamu: { label: 'Pengembara (kamu)', work: [], icon: '🧭' },
  akuwu: { label: 'Akuwu (Kepala Desa)', work: ['pendopo'], icon: '👑' },
};

export const buildableTypes = () => Object.entries(BUILDING_TYPES).filter(([, t]) => t.buildable);
