// Konstanta dunia. 1 sel grid = CELL unit dunia.
export const GRID = 48;
export const CELL = 2;
export const HALF = (GRID * CELL) / 2; // 48
// Waktu desa = jam asli perangkat (1 hari desa = 1 hari nyata).
// Ganti ke 'fast' untuk mode cepat (1 hari desa = DAY_REAL_SECONDS detik).
export const TIME_MODE = 'realtime';
export const DAY_REAL_SECONDS = 600;
export const SAVE_KEY = 'desa-majapahit-v1';
export const STATE_VERSION = 1;
export const YEAR_DAYS = 24; // 12 hari Rendheng (hujan) + 12 hari Ketiga (kemarau)

export function cellToWorld(i, j) {
  return { x: (i - GRID / 2 + 0.5) * CELL, z: (j - GRID / 2 + 0.5) * CELL };
}
export function worldToCell(x, z) {
  return { i: Math.floor(x / CELL + GRID / 2), j: Math.floor(z / CELL + GRID / 2) };
}

// Palet warna low-poly hangat
export const C = {
  bata: 0xb4553a, bataD: 0x8f3d2b, bataL: 0xcc6d4d, batu: 0x7b746b, batuL: 0x9b9384,
  kayu: 0x7b4c2c, kayuD: 0x553420, kayuL: 0xa8794d, bambu: 0xc8a46a,
  ijuk: 0x3a2e28, sirap: 0x6b4630, alang: 0xb39a5e,
  tanah: 0xa98559, tanahD: 0x8a6a45, rumput: 0x8ba75a, daun: 0x4d7e38, daunD: 0x3a6630, daunL: 0x6f9e3c,
  air: 0x3d8ea6, sawah: 0x77b043, kuning: 0xd2b64c, putih: 0xe8e0cc,
  emas: 0xd4a43a, merah: 0xa83a2c, besi: 0x4a4a4e, jerami: 0xd8c27a, perunggu: 0xb08a3a,
};
