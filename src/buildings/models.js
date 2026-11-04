// Model procedural low-poly tiap bangunan. Sisi depan = +z lokal, tanah y=0.
// Ukuran footprint: 1 sel = 2 unit (3x3 sel = 6x6 unit).
import { C } from '../data/config.js';
import { PartBuilder, geo } from './builder.js';

const PI = Math.PI;

function candiTiers(b, w, d, y, n, step, h, colA = C.bata, colB = C.bataL, pinnacle = true) {
  for (let k = 0; k < n; k++) {
    const ww = w - k * step, dd = d - k * step * (d / w);
    b.frustum(ww, h, dd, 0.9, 0, y + k * h, 0, k % 2 ? colB : colA);
    if (pinnacle && ww > 1.4) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1])
        b.box(0.22, 0.32, 0.22, sx * (ww / 2 - 0.15), y + (k + 1) * h - 0.05, sz * (dd / 2 - 0.15), C.bataL);
    }
  }
  return y + n * h;
}

const M = {
  rumah(b) {
    for (const x of [-1.8, 0, 1.8]) for (const z of [-1.6, 0, 1.6]) b.cyl(0.11, 0.14, 1.0, 5, x, 0, z, C.kayuD);
    b.box(4.4, 0.18, 4.2, 0, 1.0, 0.1, C.kayu);
    b.box(3.8, 1.5, 3.2, 0, 1.18, -0.3, C.bambu);
    b.box(0.8, 1.15, 0.06, 0, 1.18, 1.31, C.kayuD);
    b.glowN(0.55, 0.45, 0.05, -1.2, 1.75, 1.31);
    b.glowN(0.55, 0.45, 0.05, 1.2, 1.75, 1.31);
    b.glowN(0.05, 0.45, 0.6, 1.91, 1.75, -0.4);
    // tangga
    b.box(0.9, 0.12, 0.45, 0, 0.32, 2.45, C.kayu).box(0.9, 0.12, 0.45, 0, 0.66, 2.2, C.kayu);
    // tiang emperan + atap ijuk
    for (const x of [-2.0, 2.0]) b.cyl(0.07, 0.07, 1.7, 5, x, 1.18, 1.95, C.kayuD);
    b.prism(5.4, 2.4, 5.6, 0, 2.6, -0.1, C.ijuk, PI / 2);
    b.box(5.8, 0.14, 0.22, 0, 4.95, -0.1, C.kayuD);
    // kandang ayam & tumpukan kayu di kolong
    b.box(1.0, 0.5, 0.8, -1.0, 0, -0.8, C.kayuL).box(1.2, 0.35, 0.5, 1.0, 0, -1.0, C.kayu);
    b.torch(1.95, 2.25, 2.05);
    b.cyl(0.08, 0.06, 0.1, 5, 1.95, 2.05, 2.05, 0x3a2a20);
  },

  rumah_akuwu(b) {
    b.box(9.4, 0.7, 5.4, 0, 0, -0.1, C.bataD);
    b.box(9.6, 0.12, 5.6, 0, 0.7, -0.1, C.bataL);
    b.box(2.2, 0.35, 0.7, 0, 0, 2.95, C.bata);
    b.box(7.6, 1.9, 3.6, 0, 0.82, -0.6, C.kayuL);
    b.box(1.0, 1.4, 0.06, 0, 0.82, 1.21, C.kayuD);
    for (const x of [-2.6, -1.4, 1.4, 2.6]) b.glowN(0.6, 0.5, 0.05, x, 1.6, 1.21);
    for (const x of [-4.2, -2.1, 2.1, 4.2]) b.cyl(0.12, 0.14, 2.0, 6, x, 0.82, 2.2, C.kayu);
    b.pyr(10.4, 1.5, 6.6, 0, 2.7, -0.2, C.sirap);
    b.pyr(5.6, 2.6, 3.4, 0, 3.4, -0.4, C.ijuk);
    b.cyl(0.08, 0.14, 0.5, 6, 0, 5.85, -0.4, C.emas);
    // umbul-umbul merah-putih
    b.cyl(0.05, 0.06, 6.0, 5, 4.6, 0, 3.0, C.bambu);
    b.box(0.03, 0.4, 1.2, 4.6, 5.3, 3.62, C.merah).box(0.03, 0.4, 1.2, 4.6, 4.9, 3.62, C.putih);
    b.obor(-4.7, 2.9, 1.4).obor(3.4, 2.9, 1.4);
    b.light(0, 2.2, 3.0);
  },

  pendopo(b) {
    b.box(9.2, 0.6, 9.2, 0, 0, 0, C.bataD);
    b.box(9.0, 0.05, 9.0, 0, 0.6, 0, 0xc9a77a);
    for (const [x, z] of [[0, 4.9], [0, -4.9], [4.9, 0], [-4.9, 0]]) b.box(x ? 0.7 : 2.4, 0.3, x ? 2.4 : 0.7, x, 0, z, C.bata);
    for (const sx of [-1.4, 1.4]) for (const sz of [-1.4, 1.4]) b.cyl(0.2, 0.22, 3.6, 6, sx, 0.6, sz, C.kayu);
    const outer = [-4, -1.33, 1.33, 4];
    for (const x of outer) for (const z of outer) if (Math.abs(x) === 4 || Math.abs(z) === 4) b.cyl(0.13, 0.15, 2.45, 6, x, 0.6, z, C.kayuD);
    b.pyr(10.6, 1.7, 10.6, 0, 3.0, 0, C.sirap);
    b.pyr(4.6, 2.8, 4.6, 0, 4.15, 0, C.ijuk);
    b.cyl(0.1, 0.18, 0.6, 6, 0, 6.85, 0, C.emas);
    // gamelan
    for (let k = 0; k < 5; k++) b.cyl(0.22, 0.22, 0.12, 8, -1.6 + k * 0.8, 0.85, -2.6, C.perunggu);
    b.box(4.2, 0.25, 0.7, 0, 0.6, -2.6, C.kayuD);
    b.cyl(0.45, 0.45, 0.05, 10, 2.6, 1.6, -3.0, C.perunggu);
    b.box(0.1, 1.6, 0.1, 2.0, 0.6, -3.0, C.kayuD).box(0.1, 1.6, 0.1, 3.2, 0.6, -3.0, C.kayuD).box(1.3, 0.1, 0.1, 2.6, 2.1, -3.0, C.kayuD);
    for (const [x, z] of [[4, 4], [-4, 4], [4, -4], [-4, -4]]) b.torch(x * 1.06, 2.75, z * 1.06);
    b.light(0, 2.6, 0);
  },

  lumbung(b) {
    for (const sx of [-0.55, 0.55]) for (const sz of [-0.55, 0.55]) {
      b.cyl(0.07, 0.08, 0.95, 5, sx, 0, sz, C.kayuD);
      b.cyl(0.22, 0.22, 0.05, 7, sx, 0.7, sz, C.kayuL);
    }
    b.box(1.5, 0.1, 1.5, 0, 0.95, 0, C.kayu);
    b.box(1.1, 0.9, 1.1, 0, 1.05, 0, C.bambu);
    b.prism(2.0, 1.9, 2.1, 0, 1.75, 0, C.alang);
    b.box(0.12, 0.12, 2.3, 0, 3.6, 0, C.kayuD);
    b.box(0.3, 1.0, 0.06, 0.2, 0.0, 0.85, C.kayuD, 0); // tangga kecil
  },

  pasar(b) {
    b.box(9.6, 0.06, 9.6, 0, 0, 0, 0xb89a6c);
    const stalls = [[-3.2, -2.8, 0], [0, -2.8, 0], [3.2, -2.8, 0], [-3.2, 2.6, PI], [3.2, 2.6, PI]];
    const goods = [
      (x, z) => { for (let k = 0; k < 3; k++) b.add(geo.cone(0.28, 0.32, 6), k % 2 ? C.putih : C.jerami, { x: x - 0.55 + k * 0.55, y: 0.78, z }); },
      (x, z) => { for (let k = 0; k < 3; k++) b.pot(x - 0.55 + k * 0.55, 0.78, z, 1.2); },
      (x, z) => { b.box(0.5, 0.2, 0.5, x - 0.4, 0.78, z, 0x5f9a3a).box(0.5, 0.25, 0.5, x + 0.4, 0.78, z, 0x8bbd4a); },
      (x, z) => { for (let k = 0; k < 4; k++) b.add(geo.ico(0.14), k % 2 ? 0xe39a2c : 0x7a8a2a, { x: x - 0.5 + k * 0.33, y: 0.92, z }); },
      (x, z) => { b.box(0.7, 0.12, 0.6, x - 0.3, 0.78, z, 0x2f4b7a).box(0.7, 0.12, 0.6, x + 0.3, 0.9, z, C.merah); },
    ];
    stalls.forEach(([x, z, ry], k) => {
      for (const sx of [-0.9, 0.9]) for (const sz of [-0.6, 0.6]) b.cyl(0.06, 0.06, 1.85, 5, x + sx, 0, z + sz, C.kayuD);
      b.box(1.9, 0.08, 1.2, x, 0.7, z, C.kayu);
      b.add(geo.pyr(2.5, 0.85, 1.9), k % 2 ? C.ijuk : C.alang, { x, y: 1.8, z, ry });
      goods[k % goods.length](x, z);
    });
    // gentong air & keranjang
    b.cyl(0.35, 0.3, 0.6, 8, -4.2, 0, 0.2, 0x9a4a30).cyl(0.3, 0.22, 0.35, 7, 4.2, 0, -0.4, C.bambu);
    for (const [x, z] of [[-4.5, 4.5], [4.5, 4.5], [-4.5, -4.5], [4.5, -4.5]]) b.obor(x, z, 1.5);
    b.light(0, 2.2, 0);
  },

  pande(b) {
    b.box(5.6, 0.1, 5.6, 0, 0, 0, C.tanahD);
    for (const sx of [-2.3, 2.3]) for (const sz of [-2.3, 2.3]) b.cyl(0.12, 0.14, 2.4, 6, sx, 0, sz, C.kayuD);
    b.prism(5.6, 1.7, 6.0, 0, 2.4, 0, C.sirap, PI / 2);
    // prapen (tungku)
    b.box(1.5, 0.9, 1.3, -1.4, 0.1, -1.4, C.bataD);
    b.glowA(0.9, 0.06, 0.7, -1.4, 1.0, -1.4);
    b.cyl(0.25, 0.32, 1.6, 6, -1.4, 1.0, -1.9, C.bata);
    // ububan (puput bambu vertikal)
    b.cyl(0.14, 0.14, 1.3, 6, -2.3, 0.1, -0.7, C.bambu).cyl(0.14, 0.14, 1.3, 6, -2.0, 0.1, -0.7, C.bambu);
    // landasan
    b.cyl(0.28, 0.32, 0.5, 7, 0.6, 0.1, -0.1, C.kayu);
    b.box(0.6, 0.25, 0.3, 0.6, 0.6, -0.1, C.besi);
    // rak alat
    b.box(1.8, 1.4, 0.15, 1.3, 0.1, -2.5, C.kayuD);
    for (let k = 0; k < 5; k++) b.box(0.08, 0.7, 0.04, 0.6 + k * 0.33, 0.6, -2.4, C.besi);
    b.torch(-1.4, 1.2, -1.4);
    b.obor(2.6, 2.6, 1.3);
  },

  terakota(b) {
    b.box(5.6, 0.08, 5.6, 0, 0, 0, C.tanah);
    for (const sx of [-2.3, 2.3]) for (const sz of [-2.4, 0.0]) b.cyl(0.1, 0.12, 2.1, 6, sx, 0, sz, C.kayuD);
    b.prism(3.6, 1.3, 5.8, 0, 2.05, -1.2, C.alang, PI / 2);
    // tungku pembakaran (dome bata)
    b.add(geo.dome(1.1), C.bataD, { x: 1.6, y: 0.08, z: 1.6 });
    b.glowA(0.5, 0.4, 0.1, 1.6, 0.15, 2.66);
    // meja putar & bangku
    b.box(3.4, 0.6, 0.8, -0.6, 0.08, -1.6, C.kayu);
    for (let k = 0; k < 5; k++) b.pot(-1.9 + k * 0.65, 0.68, -1.6, 0.9 + (k % 2) * 0.3, k % 3 ? 0xb5603e : 0xc77a52);
    b.cyl(0.35, 0.35, 0.12, 9, 0.4, 0.4, 0.3, C.kayuL);
    b.cyl(0.08, 0.08, 0.4, 5, 0.4, 0.0, 0.3, C.kayuD);
    // deretan gerabah dijemur
    for (let k = 0; k < 6; k++) b.pot(-2.2 + (k % 3) * 0.6, 0.08, 1.4 + Math.floor(k / 3) * 0.7, 1.3, 0xc06a45);
    // celengan babi terakota
    b.add(geo.ico(0.22), 0xc77a52, { x: -0.6, y: 0.9, z: -1.6, sx: 1.4 });
    b.obor(2.6, -2.6, 1.3);
  },

  sawah(b, data) {
    const h = data?.level ?? 0.3;
    b.box(9.95, h, 9.95, 0, 0, 0, 0x8a6e45, 0);
    b.add(geo.box(9.3, 0.02, 9.3), 0x6d8a52, { y: h }); // lumpur sawah berair
    for (const [w, d, x, z] of [[9.95, 0.4, 0, 4.78], [9.95, 0.4, 0, -4.78], [0.4, 9.95, 4.78, 0], [0.4, 9.95, -4.78, 0], [0.3, 9.4, 0, 0]]) b.box(w, 0.14, d, x, h, z, 0x7d9a4a);
    // gubuk pondok di pojok
    const px = -3.9, pz = 3.9;
    for (const sx of [-0.45, 0.45]) for (const sz of [-0.45, 0.45]) b.cyl(0.05, 0.05, 1.3, 4, px + sx, h, pz + sz, C.kayuD);
    b.box(1.1, 0.08, 1.1, px, h + 0.5, pz, C.bambu);
    b.prism(1.5, 0.7, 1.5, px, h + 1.3, pz, C.alang);
    // orang-orangan sawah
    b.cyl(0.04, 0.04, 1.3, 4, 2.4, h, -2.4, C.kayuD).box(0.9, 0.06, 0.06, 2.4, h + 0.95, -2.4, C.kayuD).add(geo.cone(0.25, 0.15, 6), C.jerami, { x: 2.4, y: h + 1.3, z: -2.4 });
  },

  candi(b) {
    b.box(8.8, 1.0, 8.8, 0, 0, 0, C.bataD);
    b.box(9.0, 0.14, 9.0, 0, 1.0, 0, C.bataL);
    b.box(7.4, 0.8, 7.4, 0, 1.1, 0, C.bata);
    b.box(7.6, 0.12, 7.6, 0, 1.9, 0, C.bataL);
    // tangga depan
    // tangga menjorok ke depan: 7 anak tangga @0,3 (bisa didaki karakter)
    for (let k = 0; k < 7; k++) b.box(1.8, 0.3 * (k + 1), 0.32, 0, 0, 5.55 - k * 0.3, C.bataL);
    b.box(0.35, 2.4, 2.3, -1.08, 0, 4.55, C.bataD).box(0.35, 2.4, 2.3, 1.08, 0, 4.55, C.bataD);
    // tubuh candi
    b.box(5.2, 3.4, 5.2, 0, 2.0, 0, C.bata);
    b.box(1.6, 2.4, 0.25, 0, 2.0, 2.62, C.bataL);
    b.box(1.0, 1.9, 0.1, 0, 2.0, 2.76, 0x2a1a12);
    b.box(1.2, 0.6, 0.18, 0, 4.45, 2.66, C.bataL); // kala
    for (const [x, z, ry] of [[2.62, 0, PI / 2], [-2.62, 0, PI / 2], [0, -2.62, 0]]) b.box(1.0, 1.6, 0.1, x, 2.4, z, 0x3a2418, ry);
    b.box(5.9, 0.4, 5.9, 0, 5.4, 0, C.bataL);
    const top = candiTiers(b, 5.0, 5.0, 5.8, 5, 0.85, 0.75);
    b.cyl(0.35, 0.55, 0.8, 8, 0, top, 0, C.bataL);
    b.add(geo.ico(0.35), C.bata, { x: 0, y: top + 1.0, z: 0 });
    b.glowN(0.6, 0.6, 0.05, 0, 2.2, 2.82);
    for (const x of [-1.7, 1.7]) { b.box(0.35, 0.8, 0.35, x, 0, 5.4, C.bataD); b.torch(x, 1.15, 5.4); }
    b.light(0, 2.2, 6.0);
  },

  pura(b) {
    b.box(5.4, 0.04, 5.4, 0, 0, 0, 0xc4a078);
    b.box(5.6, 1.2, 0.4, 0, 0, -2.6, C.bata).box(0.4, 1.2, 5.6, -2.6, 0, 0, C.bata).box(0.4, 1.2, 5.6, 2.6, 0, 0, C.bata);
    b.box(1.6, 1.2, 0.4, -1.9, 0, 2.6, C.bata).box(1.6, 1.2, 0.4, 1.9, 0, 2.6, C.bata);
    for (const x of [-0.85, 0.85]) {
      b.box(0.7, 1.8, 0.7, x, 0, 2.6, C.bataD);
      b.frustum(0.7, 0.4, 0.7, 0.7, x, 1.8, 2.6, C.bataL).frustum(0.5, 0.35, 0.5, 0.6, x, 2.2, 2.6, C.bata);
    }
    // meru tumpang tiga
    const mx = -0.8, mz = -0.9;
    b.box(1.5, 0.6, 1.5, mx, 0, mz, C.bata);
    b.box(1.0, 1.0, 1.0, mx, 0.6, mz, C.kayu);
    b.pyr(2.2, 0.6, 2.2, mx, 1.6, mz, C.ijuk);
    b.cyl(0.14, 0.14, 0.4, 5, mx, 2.0, mz, C.kayuD);
    b.pyr(1.7, 0.55, 1.7, mx, 2.35, mz, C.ijuk);
    b.cyl(0.12, 0.12, 0.4, 5, mx, 2.7, mz, C.kayuD);
    b.pyr(1.25, 0.6, 1.25, mx, 3.05, mz, C.ijuk);
    b.cyl(0.05, 0.1, 0.35, 5, mx, 3.6, mz, C.emas);
    // padmasana batu
    b.box(0.9, 0.5, 0.9, 1.3, 0, -1.4, C.batu).box(0.7, 0.4, 0.7, 1.3, 0.5, -1.4, C.batuL).box(0.5, 0.5, 0.15, 1.3, 0.9, -1.7, C.batu);
    // tedung kuning
    b.cyl(0.03, 0.03, 1.6, 4, 1.9, 0, 0.8, C.kayuD).add(geo.cone(0.45, 0.25, 8), 0xe1b43c, { x: 1.9, y: 1.55, z: 0.8 });
    b.torch(-0.85, 2.75, 2.6).torch(0.85, 2.75, 2.6);
  },

  petirtaan(b) {
    const H = 1.2;
    b.box(9.6, H, 0.8, 0, 0, -4.4, C.bata);
    b.box(0.8, H, 8.0, -4.4, 0, 0, C.bata).box(0.8, H, 8.0, 4.4, 0, 0, C.bata);
    b.box(4.0, H, 0.8, -2.8, 0, 4.4, C.bata).box(4.0, H, 0.8, 2.8, 0, 4.4, C.bata);
    b.box(9.8, 0.12, 0.9, 0, H, -4.4, C.bataL).box(0.9, 0.12, 9.8, -4.4, H, 0, C.bataL).box(0.9, 0.12, 9.8, 4.4, H, 0, C.bataL);
    // undakan teras ke dalam
    const ring = (half, th, h, col, gap = 0) => {
      const L = half * 2;
      b.box(L, h, th, 0, 0, -half + th / 2, col).box(th, h, L - th * 2, -half + th / 2, 0, 0, col).box(th, h, L - th * 2, half - th / 2, 0, 0, col);
      if (gap) { const seg = (L - gap) / 2; b.box(seg, h, th, -(gap / 2 + seg / 2), 0, half - th / 2, col).box(seg, h, th, gap / 2 + seg / 2, 0, half - th / 2, col); }
      else b.box(L, h, th, 0, 0, half - th / 2, col);
    };
    ring(4.0, 0.8, 0.8, C.bataL, 1.6);
    ring(3.2, 0.8, 0.45, C.bata, 1.6);
    b.box(6.4, 0.02, 6.4, 0, 0, 0, 0x2f4a3a);
    b.water(4.8, 0.2, 4.8, 0, 0, 0);
    b.water(1.6, 0.2, 2.4, 0, 0, 3.4);
    // candi mini di tengah kolam
    b.box(1.6, 0.8, 1.6, 0, 0, 0, C.bataD);
    b.box(1.0, 1.0, 1.0, 0, 0.8, 0, C.bata);
    candiTiers(b, 1.2, 1.2, 1.8, 3, 0.3, 0.35, C.bata, C.bataL, false);
    b.add(geo.ico(0.18), C.bataL, { y: 3.0 });
    // pancuran
    for (const x of [-2, 0, 2]) b.box(0.25, 0.25, 0.4, x, 0.7, -3.85, C.batu);
    // tangga masuk
    for (let k = 0; k < 3; k++) b.box(1.6, 0.25 * (3 - k), 0.5, 0, 0, 4.55 - k * 0.5, C.bataL);
    b.obor(-1.0, 5.0, 1.2, 0).obor(1.0, 5.0, 1.2, 0);
  },

  gapura_bentar(b) {
    for (const s of [-1, 1]) {
      const xc = s * 2.45;
      b.box(3.4, 1.0, 2.2, xc, 0, 0, C.bataD);
      b.box(3.6, 0.12, 2.3, xc, 1.0, 0, C.bataL);
      b.box(2.8, 2.6, 1.8, xc, 1.1, 0, C.bata);
      b.box(0.8, 1.0, 0.1, xc, 1.8, 0.92, C.bataL);
      b.box(3.0, 0.3, 2.0, xc, 3.7, 0, C.bataL);
      let y = 4.0;
      for (let k = 0; k < 5; k++) {
        const w = 2.7 - k * 0.42, d = 1.7 - k * 0.22;
        b.frustum(w, 0.6, d, 0.85, xc, y, 0, k % 2 ? C.bataL : C.bata);
        b.box(0.18, 0.28, 0.18, xc - s * (w / 2 - 0.1), y + 0.55, d / 2 - 0.1, C.bataL);
        y += 0.6;
      }
      b.cyl(0.12, 0.25, 0.5, 6, xc, y, 0, C.bataL);
      b.box(0.9, 1.1, 0.6, s * 4.6, 0, 0, C.bata);
      b.torch(s * 1.0, 1.25, 1.3);
      b.box(0.25, 1.05, 0.25, s * 1.0, 0, 1.3, C.bataD);
    }
    b.light(0, 2.0, 2.0);
  },

  gapura_paduraksa(b) {
    for (const s of [-1, 1]) {
      b.box(2.0, 1.0, 2.4, s * 1.6, 0, 0, C.bataD);
      b.box(1.6, 3.2, 2.0, s * 1.4, 1.0, 0, C.bata);
      b.box(0.9, 1.0, 0.6, s * 2.6, 0, 0, C.bata);
    }
    b.box(4.4, 1.0, 2.0, 0, 4.2, 0, C.bataL);
    b.box(1.0, 0.75, 0.12, 0, 4.3, 1.04, C.bataD); // kepala kala
    b.box(4.6, 0.25, 2.2, 0, 5.2, 0, C.bataL);
    let y = 5.45;
    for (let k = 0; k < 7; k++) {
      const w = 4.1 - k * 0.5, d = 2.0 - k * 0.2;
      b.frustum(w, 0.8, d, 0.86, 0, y, 0, k % 2 ? C.bataL : C.bata);
      if (w > 1.3) for (const s of [-1, 1]) b.box(0.22, 0.35, 0.22, s * (w / 2 - 0.12), y + 0.75, d / 2 - 0.12, C.bataL);
      y += 0.8;
    }
    b.cyl(0.1, 0.3, 0.6, 6, 0, y, 0, C.bataL);
    b.add(geo.ico(0.22), C.bataL, { y: y + 0.7 });
    b.torch(-1.0, 1.25, 1.35).torch(1.0, 1.25, 1.35);
  },

  istal(b) {
    b.box(5.6, 0.06, 5.6, 0, 0, 0, C.tanahD);
    for (const x of [-2.5, 0, 2.5]) for (const z of [-2.5, 0.4]) b.cyl(0.11, 0.13, 2.3, 6, x, 0, z, C.kayuD);
    b.prism(3.8, 1.4, 6.0, 0, 2.3, -1.05, C.sirap, Math.PI / 2);
    b.box(5.4, 1.3, 0.12, 0, 0, -2.6, C.kayu); // dinding belakang
    for (const x of [-1.25, 1.25]) b.box(0.08, 1.1, 2.6, x, 0, -1.2, C.kayuL); // sekat kandang
    for (const x of [-2.0, 0, 2.0]) b.add(geo.cone(0.55, 0.6, 7), C.jerami, { x: x * 0.9, y: 0.06, z: -2.0 }); // tumpukan jerami
    b.box(1.6, 0.4, 0.4, 1.2, 0.06, 1.3, C.kayu).water(1.4, 0.05, 0.25, 1.2, 0.4, 1.3); // palungan air
    for (const s of [-1, 1]) b.box(1.4, 0.08, 0.08, s * 1.95, 1.0, 2.6, C.kayuL).box(1.4, 0.08, 0.08, s * 1.95, 0.55, 2.6, C.kayuL); // pagar depan (tengah terbuka)
    for (const x of [-2.6, -1.3, 1.3, 2.6]) b.cyl(0.06, 0.07, 1.15, 5, x, 0, 2.6, C.kayuD);
    b.add(geo.box(0.9, 0.06, 0.06), C.kayuD, { x: -1.6, y: 0.9, z: 0.9 }); // tali tambat
    b.obor(2.7, 2.7, 1.3).obor(-2.7, 2.7, 1.3);
  },

  pos_jaga(b) {
    for (const sx of [-1.1, 1.1]) for (const sz of [-1.1, 1.1]) b.cyl(0.11, 0.13, 3.3, 5, sx, 0, sz, C.kayuD);
    b.box(2.9, 0.15, 2.9, 0, 2.4, 0, C.kayu);
    for (const [w, d, x, z] of [[2.9, 0.08, 0, 1.4], [2.9, 0.08, 0, -1.4], [0.08, 2.9, 1.4, 0], [0.08, 2.9, -1.4, 0]]) b.box(w, 0.5, d, x, 2.55, z, C.kayuL);
    b.pyr(3.6, 1.5, 3.6, 0, 3.3, 0, C.ijuk);
    b.add(geo.box(0.5, 2.9, 0.08), C.kayu, { x: 0.3, y: 0, z: 2.0, rx: -0.42 });
    // kentongan
    b.add(geo.cyl(0.13, 0.13, 0.7, 6), C.kayuL, { x: -0.6, y: 1.55, z: 1.15 });
    b.cyl(0.02, 0.02, 0.4, 3, -0.6, 2.25, 1.15, C.kayuD);
    // rak tombak
    b.box(1.6, 0.1, 0.12, -1.8, 1.2, 2.0, C.kayuD);
    for (let k = 0; k < 4; k++) { b.cyl(0.025, 0.025, 2.1, 4, -2.4 + k * 0.4, 0, 2.0, C.kayu); b.add(geo.cone(0.05, 0.25, 4), C.besi, { x: -2.4 + k * 0.4, y: 2.1, z: 2.0 }); }
    b.box(1.6, 0.4, 0.6, 1.4, 0, 1.9, C.kayu); // bale-bale
    b.torch(1.1, 2.9, 1.1).torch(-1.1, 2.9, -1.1);
    b.obor(-2.5, 2.6, 1.4);
  },
};

const cache = new Map();
// Geometry di-cache per tipe (sawah per level) supaya bangunan sejenis berbagi buffer
export function buildModel(type, data) {
  const k = type === 'sawah' ? `sawah:${data?.level ?? 0.3}` : type;
  if (cache.has(k)) return cache.get(k);
  const b = new PartBuilder(type.length * 97 + 13);
  M[type](b, data);
  const out = b.build();
  cache.set(k, out);
  return out;
}
