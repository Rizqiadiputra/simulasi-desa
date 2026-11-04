// Kuda tidak boleh masuk bangunan (sel BLOCK) atau kanal; jalan, rumput, jembatan & sawah boleh.
import { worldToCell } from '../data/config.js';
import { T } from '../simulation/grid.js';

export function horseCellOk(grid, x, z) {
  const { i, j } = worldToCell(x, z);
  if (!grid.inBounds(i, j)) return false;
  const t = grid.get(i, j);
  return t !== T.BLOCK && t !== T.WATER;
}

// Cek seluruh badan kuda (moncong sampai ekor + sisi kiri-kanan) pada posisi & arah tertentu
export function horseBodyOk(grid, x, z, yaw) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = fz, rz = -fx;
  for (const [f, s] of [[0, 0], [1.25, 0], [-0.95, 0], [0.6, 0.32], [0.6, -0.32], [-0.5, 0.32], [-0.5, -0.32]]) {
    if (!horseCellOk(grid, x + fx * f + rx * s, z + fz * f + rz * s)) return false;
  }
  return true;
}

// Putar badan kuda dari `cur` ke `target` maks `maxStep` rad.
// `dir` = arah putar yang sudah dipilih sebelumnya (+1/-1, 0 = belum): dipertahankan supaya
// kuda tidak bolak-balik di pojok. Tanpa arah, coba sisi terpendek dulu; mentok -> sisi satunya.
// Hasil: { yaw, dir } atau null kalau tidak bisa berputar sama sekali.
export function horseTurn(grid, x, z, cur, target, maxStep, dir = 0) {
  let diff = ((target - cur + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) < 1e-4) return { yaw: target, dir: 0 };
  const first = dir || Math.sign(diff);
  for (const s of dir ? [dir] : [first, -first]) {
    const dist = s === Math.sign(diff) ? Math.abs(diff) : Math.PI * 2 - Math.abs(diff);
    const yaw = cur + s * Math.min(dist, maxStep);
    if (horseBodyOk(grid, x, z, yaw)) return { yaw, dir: dist <= maxStep ? 0 : s };
  }
  return null;
}

// Bisakah kuda berputar di tempat dari `cur` ke `target`? Hasil: arah putar (+1/-1) atau 0 kalau tidak bisa.
export function horseTurnDir(grid, x, z, cur, target) {
  let diff = ((target - cur + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  const s0 = Math.sign(diff) || 1;
  for (const s of [s0, -s0]) {
    const dist = s === s0 ? Math.abs(diff) : Math.PI * 2 - Math.abs(diff);
    let ok = true;
    for (let a = 0.12; a < dist && ok; a += 0.12) ok = horseBodyOk(grid, x, z, cur + s * a);
    if (ok) return s;
  }
  return 0;
}

// Garis lurus aman untuk kuda (dicek tiap 0,5 unit)
export function horseLineOk(grid, x0, z0, x1, z1) {
  const yaw = Math.atan2(x1 - x0, z1 - z0), d = Math.hypot(x1 - x0, z1 - z0);
  for (let s = 0; s <= d; s += 0.5) {
    const k = d ? s / d : 0;
    if (!horseBodyOk(grid, x0 + (x1 - x0) * k, z0 + (z1 - z0) * k, yaw)) return false;
  }
  return horseBodyOk(grid, x1, z1, yaw);
}
