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

// Garis lurus aman untuk kuda (dicek tiap 0,5 unit)
export function horseLineOk(grid, x0, z0, x1, z1) {
  const yaw = Math.atan2(x1 - x0, z1 - z0), d = Math.hypot(x1 - x0, z1 - z0);
  for (let s = 0; s <= d; s += 0.5) {
    const k = d ? s / d : 0;
    if (!horseBodyOk(grid, x0 + (x1 - x0) * k, z0 + (z1 - z0) * k, yaw)) return false;
  }
  return horseBodyOk(grid, x1, z1, yaw);
}
