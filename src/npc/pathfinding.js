// A* 8-arah di atas Grid desa (jalan lebih murah, rumput lebih mahal, air & bangunan terlarang).
let buf = null;
function buffers(N) {
  if (!buf || buf.N !== N) buf = { N, g: new Float32Array(N), came: new Int32Array(N), closed: new Uint8Array(N), stamp: new Uint32Array(N), gen: 0 };
  return buf;
}

class Heap {
  constructor() { this.a = []; }
  push(f, v) {
    const a = this.a; a.push([f, v]);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

export function findPath(grid, si, sj, ti, tj) {
  const n = grid.n, N = n * n;
  if (!grid.inBounds(si, sj) || !grid.inBounds(ti, tj)) return null;
  if (si === ti && sj === tj) return [[si, sj]];
  const B = buffers(N);
  B.gen++;
  const gen = B.gen;
  const visit = (k) => { if (B.stamp[k] !== gen) { B.stamp[k] = gen; B.g[k] = Infinity; B.came[k] = -1; B.closed[k] = 0; } };
  const h = (i, j) => { const dx = Math.abs(i - ti), dz = Math.abs(j - tj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  const s = grid.idx(si, sj), t = grid.idx(ti, tj);
  visit(s); B.g[s] = 0;
  const open = new Heap();
  open.push(h(si, sj), s);
  let iter = 0;
  while (open.size && iter++ < 6000) {
    const [, cur] = open.pop();
    visit(cur);
    if (B.closed[cur]) continue;
    B.closed[cur] = 1;
    if (cur === t) break;
    const ci = cur % n, cj = (cur / n) | 0;
    for (const [dx, dz, w] of NB) {
      const ni = ci + dx, nj = cj + dz;
      if (!grid.inBounds(ni, nj)) continue;
      const nk = grid.idx(ni, nj);
      const c = nk === t ? Math.min(grid.cost(ni, nj), 3) : grid.cost(ni, nj);
      if (!Number.isFinite(c)) continue;
      if (dx && dz && (!grid.walkable(ci + dx, cj) || !grid.walkable(ci, cj + dz))) continue;
      visit(nk);
      const ng = B.g[cur] + c * w;
      if (ng < B.g[nk]) { B.g[nk] = ng; B.came[nk] = cur; open.push(ng + h(ni, nj), nk); }
    }
  }
  visit(t);
  if (B.came[t] === -1) return null;
  const path = [];
  for (let k = t; k !== -1; k = B.came[k]) path.push([k % n, (k / n) | 0]);
  return path.reverse();
}
