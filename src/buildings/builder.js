// PartBuilder: merakit banyak primitif low-poly jadi SATU geometry ber-vertex-color
// (1 draw call per bangunan). Konvensi: parameter y = alas (bottom) part.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/rng.js';

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

function prep(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

// Primitif base-aligned (alas di y=0)
export const geo = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0),
  cyl: (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, h / 2, 0),
  pyr: (w, h, d) => new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0).scale(w, h, d),
  frustum: (w, h, d, top = 0.8) => new THREE.CylinderGeometry(Math.SQRT1_2 * top, Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0).scale(w, h, d),
  prism: (w, h, d) => new THREE.CylinderGeometry(1, 1, 1, 3).rotateX(-Math.PI / 2).translate(0, 0.5, 0).scale(w / 1.732, h / 1.5, d),
  cone: (r, h, seg = 6) => new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0),
  ico: (r) => new THREE.IcosahedronGeometry(r, 0),
  dome: (r, seg = 7) => new THREE.SphereGeometry(r, seg, 4, 0, Math.PI * 2, 0, Math.PI / 2),
};

export class PartBuilder {
  constructor(seed = 1) {
    this.lists = { solid: [], glowNight: [], glowAlways: [], water: [] };
    this.torches = [];
    this.lights = [];
    this.rand = mulberry32(seed);
  }

  // t: {x,y,z, rx,ry,rz, sx,sy,sz}
  add(g, color, t = {}, list = 'solid', jitter = 0.05) {
    g = prep(g);
    _e.set(t.rx || 0, t.ry || 0, t.rz || 0, 'YXZ');
    _q.setFromEuler(_e);
    _m.compose(_v.set(t.x || 0, t.y || 0, t.z || 0), _q, _s.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1));
    g.applyMatrix4(_m);
    _c.set(color);
    if (jitter) _c.multiplyScalar(1 + (this.rand() - 0.5) * 2 * jitter);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.lists[list].push(g);
    return this;
  }

  box(w, h, d, x, y, z, color, ry = 0, list) { return this.add(geo.box(w, h, d), color, { x, y, z, ry }, list); }
  cyl(rt, rb, h, seg, x, y, z, color, list) { return this.add(geo.cyl(rt, rb, h, seg), color, { x, y, z }, list); }
  pyr(w, h, d, x, y, z, color, ry = 0) { return this.add(geo.pyr(w, h, d), color, { x, y, z, ry }); }
  frustum(w, h, d, top, x, y, z, color) { return this.add(geo.frustum(w, h, d, top), color, { x, y, z }); }
  prism(w, h, d, x, y, z, color, ry = 0) { return this.add(geo.prism(w, h, d), color, { x, y, z, ry }); }
  glowN(w, h, d, x, y, z, ry = 0) { return this.add(geo.box(w, h, d), 0xffffff, { x, y, z, ry }, 'glowNight', 0); }
  glowA(w, h, d, x, y, z, color = 0xff7a2a) { return this.add(geo.box(w, h, d), color, { x, y, z }, 'glowAlways', 0); }
  water(w, h, d, x, y, z) { return this.add(geo.box(w, h, d), 0xffffff, { x, y, z }, 'water', 0); }
  torch(x, y, z) { this.torches.push([x, y, z]); return this; }
  light(x, y, z) { this.lights.push([x, y, z]); return this; }

  // Obor berdiri: tiang + mangkuk, api ditambahkan oleh TorchSystem
  obor(x, z, h = 1.5, base = 0) {
    this.cyl(0.05, 0.07, h, 5, x, base, z, 0x4a2e1c);
    this.cyl(0.12, 0.06, 0.16, 6, x, base + h, z, 0x3a2a20);
    return this.torch(x, base + h + 0.2, z);
  }
  pot(x, y, z, s = 1, color = 0xb5603e) {
    this.cyl(0.18 * s, 0.13 * s, 0.26 * s, 7, x, y, z, color);
    this.cyl(0.11 * s, 0.18 * s, 0.1 * s, 7, x, y + 0.26 * s, z, color);
    return this;
  }

  build() {
    const out = { torches: this.torches, lights: this.lights, boxes: [] };
    // kotak tabrakan per balok (untuk fisika karakter pemain)
    for (const g of this.lists.solid) {
      g.computeBoundingBox();
      const { min, max } = g.boundingBox;
      if (max.x - min.x < 0.09 && max.z - min.z < 0.09) continue;
      out.boxes.push([min.x, min.y, min.z, max.x, max.y, max.z]);
    }
    for (const [k, list] of Object.entries(this.lists)) out[k] = list.length ? mergeGeometries(list, false) : null;
    for (const list of Object.values(this.lists)) for (const g of list) g.dispose();
    return out;
  }
}
