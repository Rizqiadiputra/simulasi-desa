// State awal desa: satu objek JSON yang bisa di-serialize (siap dikirim ke backend).
import { GRID, STATE_VERSION, cellToWorld } from './config.js';
import { mulberry32, pick, randInt } from '../core/rng.js';
import { makeName, ORIGINS, HOBBIES } from './names.js';
import { BUILDING_TYPES } from './buildingTypes.js';
import { Grid, T, footprintCells, doorCell } from '../simulation/grid.js';

const NAMES = {
  candi: 'Candi Arcapada', gapura_paduraksa: 'Gapura Bajang Alit', gapura_bentar: 'Gapura Lawang Kulon',
  pura: 'Pura Kahyangan Alit', petirtaan: 'Petirtaan Tirta Amerta', pendopo: 'Pendopo Agung',
  rumah_akuwu: 'Kediaman Ki Akuwu', pasar: 'Pasar Wurare', pande: 'Pande Wesi Mpu Gandring',
  terakota: 'Bengkel Terakota Lemah Abang', pos_jaga: 'Pos Bhayangkara Kulon', istal: 'Istal Turangga', lumbung: 'Lumbung Dewi Sri',
  sawah: 'Sawah', rumah: 'Rumah',
};
const SAWAH_NAMES = ['Sawah Wetan', 'Sawah Lor', 'Sawah Kidul', 'Sawah Ngare', 'Sawah Tegal', 'Sawah Gedhe', 'Sawah Cilik', 'Sawah Sumber', 'Sawah Mbelik', 'Sawah Pucang', 'Sawah Randu', 'Sawah Ploso'];

export function nextBuildingName(state, type) {
  const n = state.buildings.filter((b) => b.type === type).length;
  if (type === 'sawah') return SAWAH_NAMES[n % SAWAH_NAMES.length] + (n >= SAWAH_NAMES.length ? ` ${Math.floor(n / SAWAH_NAMES.length) + 1}` : '');
  if (type === 'lumbung') return n === 0 ? NAMES.lumbung : `Lumbung ${['Sri Sedana', 'Kaliwon', 'Tumpuk', 'Arum', 'Gemah'][n % 5]}`;
  const base = NAMES[type] || BUILDING_TYPES[type].label;
  return n === 0 ? base : `${BUILDING_TYPES[type].label} ${n + 1}`;
}

export function createInitialState() {
  const r = mulberry32(1293); // tahun 1293: berdirinya Majapahit
  const state = {
    version: STATE_VERSION,
    meta: { name: 'Desa Majapahit', createdAt: Date.now(), seed: 1293 },
    clock: { day: 1, minute: 6 * 60, savedAt: Date.now(), speed: 1 },
    economy: {
      kas: 900,
      stock: { beras: 140, kelapa: 40, gerabah: 18, alat_besi: 8 },
      prices: { beras: 2, kelapa: 1, gerabah: 5, alat_besi: 12 },
    },
    weather: { type: 'cerah', since: 0 },
    events: { scheduled: [] },
    roads: [], water: [], trees: [],
    buildings: [], citizens: [],
    history: [], announcements: [],
    counters: { building: 0, citizen: 0, history: 0 },
  };

  // --- Kanal ---
  for (let j = 0; j < GRID; j++) state.water.push([35, j]);
  for (let i = 0; i < 35; i++) state.water.push([i, 44]);

  // --- Jalan tanah ---
  const seg = (i0, j0, i1, j1) => {
    for (let i = Math.min(i0, i1); i <= Math.max(i0, i1); i++)
      for (let j = Math.min(j0, j1); j <= Math.max(j0, j1); j++) state.roads.push([i, j]);
  };
  seg(1, 24, 46, 24); // jalan utama barat-timur
  seg(24, 9, 24, 46); // jalan utama utara-selatan
  seg(10, 16, 33, 16);
  seg(8, 32, 33, 32);
  seg(8, 40, 33, 40);
  seg(8, 16, 8, 40);
  seg(32, 16, 32, 40);
  seg(36, 2, 36, 44); // pematang di tepi sawah

  // --- Bangunan awal ---
  const add = (type, ci, cj, rot, extra = {}) => {
    const b = { id: `b${++state.counters.building}`, type, ci, cj, rot, name: extra.name || nextBuildingName(state, type), builtDay: 0, by: 'leluhur', ...extra };
    if (type === 'sawah') b.crop = { progress: r() * 0.9 };
    state.buildings.push(b);
    return b;
  };
  add('candi', 24, 6, 0);
  add('gapura_paduraksa', 24, 11, 0);
  add('gapura_bentar', 4, 24, 1);
  add('pura', 16, 10, 0);
  add('petirtaan', 14, 20, 0);
  add('rumah_akuwu', 20, 20, 0);
  add('pendopo', 28, 20, 0);
  add('pasar', 28, 28, 2);
  add('pande', 20, 28, 2);
  add('terakota', 16, 28, 2);
  add('pos_jaga', 6, 20, 0);
  add('lumbung', 33, 28, 3);
  add('lumbung', 33, 30, 3);
  const houses = [[10, 34, 2], [14, 34, 2], [18, 34, 2], [27, 34, 2], [30, 34, 2], [20, 13, 0], [28, 13, 0], [12, 13, 0]];
  for (const [i, j, rot] of houses) add('rumah', i, j, rot);
  const sawahPlots = [[39, 4, 0.25], [39, 9, 0.25], [39, 14, 0.3], [39, 19, 0.3], [44, 9, 0.6], [44, 14, 0.65]];
  for (const [i, j, lv] of sawahPlots) add('sawah', i, j, 3, { level: lv });

  // Nama rumah
  let hn = 0;
  for (const b of state.buildings) if (b.type === 'rumah') b.name = `Rumah ${['Ki Kebo', 'Nyi Sekar', 'Ki Lembu', 'Ki Gagak', 'Nyi Wulan', 'Ki Jaran', 'Ki Banyak', 'Nyi Pudak'][hn++ % 8]}`;

  // Hubungkan pintu ke jalan
  const grid = new Grid(state);
  for (const b of state.buildings) connectBuilding(state, grid, b);

  // --- Pohon ---
  const treeOk = (i, j) => grid.get(i, j) === T.GRASS && !state.roads.some(([a, c]) => Math.abs(a - i) + Math.abs(c - j) < 1);
  const placeTree = (t, i, j, jitter = 0.6) => {
    const w = cellToWorld(i, j);
    state.trees.push({ t, x: +(w.x + (r() - 0.5) * jitter).toFixed(2), z: +(w.z + (r() - 0.5) * jitter).toFixed(2), s: +(0.8 + r() * 0.45).toFixed(2), ry: +(r() * 6.28).toFixed(2) });
  };
  [[22, 23], [31, 23], [10, 22], [26, 36]].forEach(([i, j]) => { if (treeOk(i, j)) placeTree('beringin', i, j, 0.2); });
  for (let k = 0; k < 150; k++) {
    const i = randInt(1, GRID - 2, r), j = randInt(1, GRID - 2, r);
    if (!treeOk(i, j)) continue;
    const nearWater = state.water.some(([a, c]) => Math.abs(a - i) <= 2 && Math.abs(c - j) <= 2);
    placeTree((nearWater && r() < 0.6) || r() < 0.3 ? 'kelapa' : r() < 0.6 ? 'pisang' : 'semak', i, j);
  }

  // --- Warga ---
  const homes = state.buildings.filter((b) => b.type === 'rumah');
  const akuwuHome = state.buildings.find((b) => b.type === 'rumah_akuwu');
  const addC = (profession, gender, home, age) => addCitizenRaw(state, { profession, gender, homeId: home.id, age, origin: 'Asli desa' }, r);
  addC('akuwu', 'L', akuwuHome, 52).name = 'Pak Akuwu Dharmasena';
  addC('pedagang', 'P', akuwuHome, 47);
  addC('anak', 'P', akuwuHome, 9);
  const plan = [
    ['petani', 'L', 38], ['petani', 'P', 35], ['anak', 'L', 8],
    ['pandai_besi', 'L', 41], ['pedagang', 'P', 39], ['anak', 'P', 11],
    ['petani', 'L', 30], ['pengrajin', 'P', 28], ['anak', 'L', 6],
    ['prajurit', 'L', 26], ['prajurit', 'L', 31], ['pedagang', 'P', 33],
    ['pendeta', 'L', 58], ['pendeta', 'P', 44],
    ['petani', 'L', 45], ['petani', 'P', 43], ['anak', 'P', 12],
    ['pengrajin', 'L', 36], ['pedagang', 'L', 40], ['anak', 'L', 10],
    ['pandai_besi', 'L', 29], ['prajurit', 'L', 24], ['petani', 'L', 50],
    ['petani', 'P', 22], ['anak', 'L', 7],
  ];
  plan.forEach(([p, g, a], k) => addC(p, g, homes[Math.floor(k / 3.2) % homes.length], a));
  for (const c of state.citizens) c.workId = findWorkplace(state, c.profession, c)?.id || null;

  // --- Riwayat & pengumuman pembuka ---
  state.history.push({ id: ++state.counters.history, day: 1, minute: 360, text: 'Desa Majapahit didirikan di tepi Kanal Trowulan', type: 'desa', by: 'leluhur' });
  for (const b of state.buildings) {
    if (b.type === 'sawah' || b.type === 'rumah') continue;
    state.history.push({ id: ++state.counters.history, day: 1, minute: 360, text: `${b.name} berdiri sejak zaman leluhur`, buildingId: b.id, type: b.type, by: 'leluhur' });
  }
  state.history.push({ id: ++state.counters.history, day: 1, minute: 360, text: `${homes.length} rumah panggung & ${sawahPlots.length} petak sawah sudah ada`, type: 'rumah', by: 'leluhur' });
  return state;
}

export function addCitizenRaw(state, { profession, gender, homeId, age, origin, name }, r = Math.random) {
  const c = {
    id: `w${++state.counters.citizen}`,
    name: name || makeName({ gender, profession, age }, r),
    gender, profession, age, homeId, workId: null,
    origin: origin || pick(ORIGINS, r),
    hobby: pick(HOBBIES, r),
    kepeng: randInt(5, 40, r),
    sinceDay: state.clock.day,
    jitter: randInt(0, 40, r),
    shift: profession === 'prajurit' ? (state.citizens.filter((x) => x.profession === 'prajurit').length % 3 === 2 ? 'malam' : 'siang') : undefined,
    look: { skin: randInt(0, 3, r), cloth: randInt(0, 3, r), h: +(0.94 + r() * 0.12).toFixed(2) },
  };
  state.citizens.push(c);
  return c;
}

export function findWorkplace(state, profession, citizen) {
  const types = { petani: ['sawah'], pedagang: ['pasar'], pandai_besi: ['pande'], pengrajin: ['terakota'], prajurit: ['pos_jaga'], pendeta: ['candi', 'pura'], akuwu: ['pendopo'] }[profession];
  if (!types) return null;
  let best = null, bestFree = -Infinity;
  for (const b of state.buildings) {
    if (!types.includes(b.type)) continue;
    const jobs = BUILDING_TYPES[b.type].jobs?.[profession] ?? 1;
    const used = state.citizens.filter((c) => c !== citizen && c.workId === b.id).length;
    const free = jobs - used;
    if (free > bestFree) { best = b; bestFree = free; }
  }
  return best;
}

// Buat jalan setapak dari pintu ke jaringan jalan terdekat
export function connectBuilding(state, grid, b) {
  if (BUILDING_TYPES[b.type].role === 'gate') return [];
  const [di, dj] = doorCell(b.type, b.ci, b.cj, b.rot);
  const path = grid.pathToRoad(di, dj, footprintCells(b.type, b.ci, b.cj, b.rot));
  const added = [];
  if (!path) return added;
  for (const [i, j] of path) {
    if (grid.get(i, j) === T.GRASS) { state.roads.push([i, j]); grid.setRoad(i, j); added.push([i, j]); }
  }
  return added;
}
