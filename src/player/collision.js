// Dunia tabrakan sederhana: kumpulan AABB (dari tiap balok bangunan) dalam spatial hash.
const CS = 4; // ukuran sel hash (unit dunia)

export class CollisionWorld {
  constructor() {
    this.cells = new Map();
    this.qid = 0;
  }
  key(i, j) { return i * 10007 + j; }

  // box: {x0,y0,z0,x1,y1,z1}
  add(box) {
    for (let i = Math.floor(box.x0 / CS); i <= Math.floor(box.x1 / CS); i++)
      for (let j = Math.floor(box.z0 / CS); j <= Math.floor(box.z1 / CS); j++) {
        const k = this.key(i, j);
        let list = this.cells.get(k);
        if (!list) this.cells.set(k, (list = []));
        list.push(box);
      }
  }

  query(x0, z0, x1, z1, out = []) {
    out.length = 0;
    const q = ++this.qid;
    for (let i = Math.floor(x0 / CS); i <= Math.floor(x1 / CS); i++)
      for (let j = Math.floor(z0 / CS); j <= Math.floor(z1 / CS); j++) {
        const list = this.cells.get(this.key(i, j));
        if (!list) continue;
        for (const b of list) {
          if (b.q === q) continue;
          b.q = q;
          if (b.x1 > x0 && b.x0 < x1 && b.z1 > z0 && b.z0 < z1) out.push(b);
        }
      }
    return out;
  }
}

// Ubah kotak lokal bangunan [minx,miny,minz,maxx,maxy,maxz] ke dunia (rotasi kelipatan 90°)
export function toWorldBox(lb, cx, cz, rot) {
  const t = (rot & 3) * (Math.PI / 2), c = Math.round(Math.cos(t)), s = Math.round(Math.sin(t));
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const lx of [lb[0], lb[3]]) for (const lz of [lb[2], lb[5]]) {
    const wx = cx + lx * c + lz * s, wz = cz - lx * s + lz * c;
    x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); z0 = Math.min(z0, wz); z1 = Math.max(z1, wz);
  }
  return { x0, y0: lb[1], z0, x1, y1: lb[4], z1 };
}
