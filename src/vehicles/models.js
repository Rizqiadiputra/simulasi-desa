// Model low-poly kuda (kaki beranimasi) & kereta kencana (roda berputar). Depan = +z.
import * as THREE from 'three';
import { PartBuilder, geo } from '../buildings/builder.js';
import { C } from '../data/config.js';

const MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const mesh = (g) => { const m = new THREE.Mesh(g, MAT); m.castShadow = true; m.receiveShadow = true; return m; };

export const HORSE_COLORS = [
  { body: 0x7a4a2a, mane: 0x2a1c14, name: 'cokelat' },
  { body: 0x4a2e1c, mane: 0x1a1210, name: 'hitam kecokelatan' },
  { body: 0x9a5a30, mane: 0x5a2e14, name: 'merah sawo' },
  { body: 0xe8e0d0, mane: 0xcfc6b4, name: 'putih' },
  { body: 0x2a2420, mane: 0x141010, name: 'hitam legam' },
];

const legGeoCache = new Map();
function legGeo(color) {
  if (legGeoCache.has(color)) return legGeoCache.get(color);
  const b = new PartBuilder(5);
  b.add(geo.box(0.13, 0.85, 0.13).translate(0, -0.85, 0), color, {});
  b.add(geo.box(0.15, 0.12, 0.18).translate(0, -0.97, 0.01), 0x2a2420, {});
  const g = b.build().solid;
  legGeoCache.set(color, g);
  return g;
}

// Kuda: Group dengan bagian {legs[4], neck, body}
export function createHorse({ body, mane }, { saddle = false, harness = false } = {}) {
  const g = new THREE.Group();
  const b = new PartBuilder(9);
  b.box(0.5, 0.52, 1.3, 0, 0.92, 0, body);
  b.add(geo.ico(0.33), body, { y: 1.18, z: 0.55, sx: 0.82, sz: 1.05 });
  b.add(geo.ico(0.32), body, { y: 1.2, z: -0.55, sx: 0.88 });
  b.add(geo.box(0.11, 0.75, 0.13).translate(0, -0.75, 0), mane, { y: 1.38, z: -0.78, rx: 0.35 }); // ekor
  if (saddle) {
    b.box(0.62, 0.06, 0.6, 0, 1.43, 0.0, C.merah).box(0.64, 0.03, 0.64, 0, 1.42, 0, C.emas);
    b.box(0.5, 0.16, 0.12, 0, 1.47, -0.25, C.kayuD); // sandaran pelana
    for (const s of [-1, 1]) b.box(0.03, 0.45, 0.06, s * 0.3, 1.0, 0.05, C.kayuD); // sanggurdi
  }
  if (harness) {
    b.box(0.56, 0.08, 0.12, 0, 1.25, 0.62, C.merah).box(0.56, 0.06, 0.5, 0, 1.44, 0.1, C.emas);
    b.add(geo.cone(0.08, 0.35, 5), C.merah, { y: 1.45, z: 0.1 }); // jambul hias
  }
  const bodyMesh = mesh(b.build().solid);
  g.add(bodyMesh);

  // leher + kepala (pivot di pangkal leher, bisa menunduk merumput)
  const neck = new THREE.Group();
  neck.position.set(0, 1.22, 0.62);
  const hb = new PartBuilder(11);
  hb.add(geo.box(0.26, 0.72, 0.3), body, { rx: 0.6 });
  hb.add(geo.box(0.07, 0.68, 0.1), mane, { z: -0.12, rx: 0.6 });
  hb.add(geo.box(0.22, 0.24, 0.55).translate(0, 0, 0.2), body, { y: 0.56, z: 0.38, rx: 0.45 });
  hb.add(geo.box(0.06, 0.12, 0.05), body, { x: 0.07, y: 0.72, z: 0.32 }).add(geo.box(0.06, 0.12, 0.05), body, { x: -0.07, y: 0.72, z: 0.32 });
  hb.add(geo.box(0.24, 0.05, 0.05), 0x141010, { y: 0.6, z: 0.5 }); // mata
  if (harness || saddle) hb.add(geo.box(0.24, 0.04, 0.3), C.merah, { y: 0.5, z: 0.6, rx: 0.45 }); // tali kekang
  neck.add(mesh(hb.build().solid));
  g.add(neck);

  const legs = [];
  for (const [x, z] of [[0.16, 0.5], [-0.16, 0.5], [0.16, -0.5], [-0.16, -0.5]]) {
    const l = mesh(legGeo(body));
    l.position.set(x, 0.98, z);
    g.add(l); legs.push(l);
  }
  g.userData = { legs, neck, body: bodyMesh };
  return g;
}

// fase: diagonal berpasangan; amp 0 = diam
export function animateHorse(h, phase, amp, graze = 0) {
  const { legs, neck, body } = h.userData;
  const off = [0, Math.PI, Math.PI, 0];
  legs.forEach((l, k) => { l.rotation.x = Math.sin(phase + off[k]) * 0.55 * amp; });
  body.position.y = Math.abs(Math.sin(phase)) * 0.05 * amp;
  neck.rotation.x = graze * 1.0 + Math.sin(phase * 2) * 0.05 * amp;
}

function wheelGeo(r) {
  const b = new PartBuilder(13);
  b.add(new THREE.CylinderGeometry(r, r, 0.1, 14).rotateZ(Math.PI / 2), C.kayuD, {});
  b.add(new THREE.CylinderGeometry(r * 0.88, r * 0.88, 0.12, 14).rotateZ(Math.PI / 2), C.emas, {});
  b.add(new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.14, 14).rotateZ(Math.PI / 2), C.kayu, {});
  for (let k = 0; k < 4; k++) b.add(geo.box(0.16, r * 1.7, 0.06).translate(0, -r * 0.85, 0), C.emas, { rx: (k * Math.PI) / 4 });
  b.add(new THREE.CylinderGeometry(0.11, 0.11, 0.2, 8).rotateZ(Math.PI / 2), C.emas, {});
  return b.build().solid;
}

// Kereta kencana: badan emas berkanopi, 4 roda, kusir, 2 kuda putih
export function createKereta() {
  const g = new THREE.Group();
  const b = new PartBuilder(17);
  b.box(1.5, 0.14, 2.7, 0, 0.74, -0.15, C.kayuD);
  b.box(1.46, 0.42, 1.7, 0, 0.88, -0.45, C.merah); // dinding rendah kabin
  b.box(1.54, 0.08, 1.78, 0, 1.3, -0.45, C.emas).box(1.54, 0.1, 1.78, 0, 0.84, -0.45, C.emas);
  for (const sx of [-0.7, 0.7]) for (const sz of [-1.25, 0.35]) b.cyl(0.05, 0.06, 1.15, 6, sx, 1.3, sz, C.emas);
  b.box(1.2, 0.3, 0.45, 0, 0.88, -0.55, C.merah); // bangku penumpang
  b.frustum(1.8, 0.22, 2.1, 0.9, 0, 2.43, -0.45, C.emas);
  b.pyr(1.65, 0.75, 1.95, 0, 2.62, -0.45, C.merah);
  b.cyl(0.06, 0.16, 0.35, 6, 0, 3.3, -0.45, C.emas);
  b.add(geo.ico(0.14), C.emas, { y: 3.72, z: -0.45 });
  // hiasan garuda di depan kabin
  b.box(1.0, 0.5, 0.06, 0, 1.38, 0.38, C.emas).add(geo.cone(0.18, 0.35, 4), C.emas, { y: 1.88, z: 0.38 });
  b.box(0.05, 0.3, 0.6, 0.5, 1.55, 0.38, C.emas).box(0.05, 0.3, 0.6, -0.5, 1.55, 0.38, C.emas);
  // tempat duduk kusir & kusir
  b.box(0.9, 0.35, 0.45, 0, 0.88, 0.85, C.kayu);
  b.cyl(0.18, 0.22, 0.45, 6, 0, 1.23, 0.85, 0x2f4b7a).cyl(0.17, 0.15, 0.36, 6, 0, 1.6, 0.85, 0x9c6a46);
  b.add(geo.ico(0.15), 0x9c6a46, { y: 2.08, z: 0.86 }).cyl(0.16, 0.16, 0.08, 6, 0, 2.15, 0.86, C.merah);
  // tiang penarik & kuk kuda
  for (const s of [-1, 1]) b.add(geo.box(0.07, 0.07, 1.9), C.emas, { x: s * 0.42, y: 0.92, z: 1.95 });
  b.box(1.3, 0.08, 0.08, 0, 1.25, 2.7, C.emas);
  // umbul-umbul merah-putih
  for (const s of [-1, 1]) {
    b.cyl(0.025, 0.025, 1.6, 4, s * 0.7, 1.3, -1.32, C.kayuD);
    b.box(0.02, 0.18, 0.45, s * 0.7, 2.66, -1.55, C.merah).box(0.02, 0.18, 0.45, s * 0.7, 2.48, -1.55, C.putih);
  }
  b.light(0, 1.5, 0.9);
  const body = mesh(b.build().solid);
  g.add(body);

  const wheels = [];
  for (const [x, z, r] of [[0.82, -1.0, 0.72], [-0.82, -1.0, 0.72], [0.82, 0.55, 0.52], [-0.82, 0.55, 0.52]]) {
    const w = mesh(wheelGeo(r));
    w.position.set(x, r, z);
    w.userData.r = r;
    g.add(w); wheels.push(w);
  }
  const horses = [];
  for (const x of [-0.42, 0.42]) {
    const h = createHorse(HORSE_COLORS[3], { harness: true });
    h.position.set(x, 0, 3.1);
    g.add(h); horses.push(h);
  }
  g.userData = { wheels, horses, seat: new THREE.Vector3(0, 0.5, -0.5) };
  return g;
}
