// Ekonomi sederhana: mata uang kepeng, stok barang desa, harga dinamis.
import { BUILDING_TYPES } from '../data/buildingTypes.js';
import { clamp } from '../core/util.js';

export const GOODS = {
  beras: { label: 'Beras', unit: 'bakul', base: 2, icon: '🍚' },
  kelapa: { label: 'Kelapa', unit: 'butir', base: 1, icon: '🥥' },
  gerabah: { label: 'Gerabah', unit: 'buah', base: 5, icon: '🏺' },
  alat_besi: { label: 'Alat Besi', unit: 'buah', base: 12, icon: '⚒️' },
};

const SELL_RATE = { beras: 2, kelapa: 2, gerabah: 1, alat_besi: 0.35 }; // per pedagang per jam

export function population(state) {
  let adults = 0, kids = 0;
  for (const c of state.citizens) (c.profession === 'anak' ? kids++ : adults++);
  return { adults, kids, total: adults + kids };
}

export function storageCap(state) {
  const n = state.buildings.filter((b) => b.type === 'lumbung').length;
  return 150 + n * (BUILDING_TYPES.lumbung.storage || 120);
}

export function targetStock(state, good) {
  const p = population(state).total;
  return { beras: p * 4, kelapa: p * 1.5, gerabah: 30, alat_besi: 12 }[good];
}

export function updatePrices(state) {
  const e = state.economy;
  for (const g of Object.keys(GOODS)) {
    const ratio = targetStock(state, g) / Math.max(1, e.stock[g]);
    e.prices[g] = +(GOODS[g].base * clamp(ratio, 0.5, 3)).toFixed(1);
  }
}

// Produksi per jam oleh pekerja yang sedang 'kerja'
export function produce(state, workerCounts) {
  const s = state.economy.stock;
  s.gerabah += (workerCounts.pengrajin || 0) * 0.5;
  s.alat_besi += (workerCounts.pandai_besi || 0) * 0.22;
  s.kelapa += (workerCounts.petani || 0) * 0.25;
}

// Pedagang menjual ke saudagar luar desa -> kepeng masuk
export function marketSales(state, sellers, ramai) {
  const e = state.economy;
  let revenue = 0;
  if (!sellers.length) return 0;
  for (const g of Object.keys(GOODS)) {
    const reserve = g === 'beras' ? population(state).total * 3 : targetStock(state, g) * 0.3;
    const avail = Math.max(0, e.stock[g] - reserve);
    const qty = Math.min(avail, SELL_RATE[g] * sellers.length * (ramai ? 2 : 1));
    if (qty <= 0) continue;
    e.stock[g] -= qty;
    revenue += qty * e.prices[g];
  }
  if (revenue > 0) {
    const tax = revenue * 0.15;
    e.kas += tax;
    const share = (revenue - tax) / sellers.length;
    for (const c of sellers) c.kepeng += share;
  }
  return revenue;
}

export function dailyConsumption(state) {
  const { adults, kids } = population(state);
  const need = adults * 1 + kids * 0.5;
  const s = state.economy.stock;
  const short = Math.max(0, need - s.beras);
  s.beras = Math.max(0, s.beras - need);
  // pajak bumi (drawya haji) harian
  state.economy.kas += adults * 1.5;
  // kelebihan beras di atas kapasitas lumbung dijual ke kotaraja
  const cap = storageCap(state);
  let overflow = 0;
  if (s.beras > cap) { overflow = s.beras - cap; s.beras = cap; state.economy.kas += overflow * state.economy.prices.beras * 0.5; }
  return { need, short, overflow };
}

export function harvestYield(farmers) {
  return Math.round(30 + farmers * 12);
}
