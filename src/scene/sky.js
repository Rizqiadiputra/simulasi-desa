// Siklus siang-malam: langit gradasi, matahari/bulan bergerak, bintang, kabut pagi, hujan.
import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../core/util.js';
import { mulberry32 } from '../core/rng.js';
import { HALF } from '../data/config.js';

// Keyframe warna per jam
const K = [
  { h: 0, top: 0x0a0f24, bot: 0x1a2140, fog: 0x161c32, sun: 0.0, amb: 0.5, sc: 0x8fa6d8 },
  { h: 4.6, top: 0x0d1430, bot: 0x252a4a, fog: 0x1d2238, sun: 0.0, amb: 0.5, sc: 0x8fa6d8 },
  { h: 5.5, top: 0x2b3668, bot: 0xd98a6b, fog: 0x8e8088, sun: 0.25, amb: 0.5, sc: 0xffa070 },
  { h: 6.5, top: 0x6c9cd6, bot: 0xffc58c, fog: 0xe6cdb0, sun: 1.1, amb: 0.75, sc: 0xffc890 },
  { h: 9, top: 0x4f8fd6, bot: 0xbfe0f2, fog: 0xc6dce6, sun: 2.3, amb: 0.95, sc: 0xfff2dc },
  { h: 15, top: 0x4b8ad3, bot: 0xc4e0ee, fog: 0xc8dde6, sun: 2.2, amb: 0.95, sc: 0xfff0d8 },
  { h: 17, top: 0x5b86c8, bot: 0xffd2a0, fog: 0xeed0b2, sun: 1.6, amb: 0.8, sc: 0xffd29a },
  { h: 18, top: 0x3a4f8f, bot: 0xff8a50, fog: 0xd68c6c, sun: 0.6, amb: 0.6, sc: 0xff8040 },
  { h: 19, top: 0x161d42, bot: 0x5a3a5a, fog: 0x3a3048, sun: 0.0, amb: 0.52, sc: 0x8fa6d8 },
  { h: 24, top: 0x0a0f24, bot: 0x1a2140, fog: 0x161c32, sun: 0.0, amb: 0.5, sc: 0x8fa6d8 },
];
const _a = new THREE.Color(), _b = new THREE.Color();
function sample(hour) {
  let i = 0;
  while (i < K.length - 2 && hour >= K[i + 1].h) i++;
  const k0 = K[i], k1 = K[i + 1];
  const t = clamp((hour - k0.h) / (k1.h - k0.h), 0, 1);
  const mix = (a, b, out) => out.copy(_a.set(a)).lerp(_b.set(b), t);
  return {
    top: mix(k0.top, k1.top, new THREE.Color()), bot: mix(k0.bot, k1.bot, new THREE.Color()),
    fog: mix(k0.fog, k1.fog, new THREE.Color()), sc: mix(k0.sc, k1.sc, new THREE.Color()),
    sun: lerp(k0.sun, k1.sun, t), amb: lerp(k0.amb, k1.amb, t),
  };
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const GLOW_TEX = (() => { let t; return () => (t ||= glowTexture()); })();

export class SkySystem {
  constructor(scene, camera, opts = {}) {
    this.scene = scene; this.camera = camera;
    this.nightFactor = 0; this.morning = 0; this.rainAmt = 0; this.cloud = 0;

    // Kubah langit
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color() }, bot: { value: new THREE.Color() },
        sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, sunVis: { value: 1 },
        moonDir: { value: new THREE.Vector3(0, -1, 0) }, moonVis: { value: 0 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunVis; uniform vec3 moonDir; uniform float moonVis; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); float h = d.y;
          vec3 col = mix(bot, top, smoothstep(-0.08, 0.55, h));
          float s = max(dot(d, sunDir), 0.0);
          col += sunColor * (pow(s, 900.0) * 3.0 + pow(s, 12.0) * 0.35) * sunVis;
          float m = max(dot(d, moonDir), 0.0);
          col += vec3(0.85,0.9,1.0) * (smoothstep(0.9993, 0.9996, m) * 1.2 + pow(m, 40.0) * 0.12) * moonVis;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.skyMat.toneMapped = false;
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 12), this.skyMat);
    this.dome.renderOrder = -1;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    // Bintang
    const r = mulberry32(42);
    const sp = [];
    for (let k = 0; k < 700; k++) {
      const u = r() * Math.PI * 2, v = Math.acos(r() * 0.95);
      sp.push(Math.sin(v) * Math.cos(u) * 560, Math.cos(v) * 560, Math.sin(v) * Math.sin(u) * 560);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // Cahaya
    this.hemi = new THREE.HemisphereLight(0xcfe4ff, 0x5a4a30, 0.9);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    const sm = opts.shadowSize || 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera;
    sc.left = -HALF - 10; sc.right = HALF + 10; sc.top = HALF + 10; sc.bottom = -HALF - 10; sc.near = 1; sc.far = 320;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);

    scene.fog = new THREE.FogExp2(0xc6dce6, 0.004);

    // Kabut tipis pagi: bidang transparan melayang
    const mistMat = new THREE.MeshBasicMaterial({ map: GLOW_TEX(), transparent: true, opacity: 0, depthWrite: false, color: 0xffffff, fog: false });
    this.mistMat = mistMat;
    this.mist = [];
    for (let k = 0; k < 14; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mistMat);
      const s = 26 + r() * 30;
      m.scale.set(s, 1, s * 0.6);
      m.position.set((r() - 0.5) * 110, 0.6 + r() * 2.2, (r() - 0.5) * 110);
      m.userData.v = 0.4 + r() * 0.6;
      m.renderOrder = 5;
      scene.add(m); this.mist.push(m);
    }

    // Hujan
    const N = opts.rainDrops || 1400;
    this.rainN = N;
    const rp = new Float32Array(N * 6);
    for (let k = 0; k < N; k++) {
      const x = (r() - 0.5) * 90, y = r() * 40, z = (r() - 0.5) * 90;
      rp.set([x, y, z, x + 0.15, y - 1.1, z], k * 6);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: 0xaac4dd, transparent: true, opacity: 0, depthWrite: false });
    this.rain = new THREE.LineSegments(rg, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);
  }

  update(hour, weather, dt, target) {
    const s = sample(hour);
    const wantRain = weather === 'hujan' ? 1 : 0;
    const wantCloud = weather === 'hujan' ? 1 : weather === 'mendung' ? 0.55 : 0;
    this.rainAmt += (wantRain - this.rainAmt) * Math.min(1, dt * 0.6);
    this.cloud += (wantCloud - this.cloud) * Math.min(1, dt * 0.4);
    const grey = new THREE.Color(0x8a939c).multiplyScalar(lerp(1, 0.25, smoothstep(0.6, 0.0, s.sun / 2.3)));
    const cl = this.cloud * 0.75;
    s.top.lerp(grey, cl); s.bot.lerp(grey, cl * 0.8); s.fog.lerp(grey, cl * 0.7);

    // Arah matahari: terbit timur (+x) jam 6, terbenam barat jam 18
    const a = ((hour - 6) / 12) * Math.PI;
    const sunDir = new THREE.Vector3(Math.cos(a) * 0.85, Math.sin(a), 0.38).normalize();
    const ma = ((hour - 18 + 24) % 24) / 12 * Math.PI;
    const moonDir = new THREE.Vector3(Math.cos(ma) * 0.8, Math.sin(ma), -0.3).normalize();
    const day = sunDir.y > 0;
    this.nightFactor = 1 - smoothstep(-0.1, 0.18, sunDir.y);

    this.skyMat.uniforms.top.value.copy(s.top);
    this.skyMat.uniforms.bot.value.copy(s.bot);
    this.skyMat.uniforms.sunDir.value.copy(sunDir);
    this.skyMat.uniforms.sunColor.value.copy(s.sc);
    this.skyMat.uniforms.sunVis.value = (1 - this.cloud * 0.85) * smoothstep(-0.1, 0.05, sunDir.y);
    this.skyMat.uniforms.moonDir.value.copy(moonDir);
    this.skyMat.uniforms.moonVis.value = this.nightFactor * (1 - this.cloud * 0.8) * smoothstep(-0.05, 0.1, moonDir.y);
    this.dome.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    this.starMat.opacity = this.nightFactor * (1 - this.cloud) * 0.9;

    const lightDir = (day ? sunDir.clone() : moonDir.y > 0 ? moonDir.clone() : new THREE.Vector3(0.3, 1, 0.2));
    lightDir.y = Math.max(lightDir.y, 0.4); lightDir.normalize(); // hindari bayangan terlalu panjang
    this.sun.position.copy(target).addScaledVector(lightDir, 140);
    this.sun.target.position.copy(target);
    this.sun.shadow.camera.position.copy(this.sun.position);
    const sunI = s.sun * (1 - this.cloud * 0.6);
    this.sun.intensity = day ? sunI : 0.55 * smoothstep(-0.05, 0.2, moonDir.y) * (1 - this.cloud * 0.6);
    this.sun.color.copy(day ? s.sc : _a.set(0x9fb4e8));
    this.hemi.intensity = s.amb * (1 - this.cloud * 0.2) + 0.15;
    this.hemi.color.copy(s.top).lerp(_a.set(0xffffff), 0.45);
    this.hemi.groundColor.set(0x6b5a3c).multiplyScalar(0.4 + s.amb * 0.6);

    // Kabut: tebal di pagi hari & saat hujan
    this.morning = smoothstep(4.3, 6.0, hour) * (1 - smoothstep(6.8, 9.2, hour));
    this.scene.fog.color.copy(s.fog);
    this.scene.fog.density = 0.0026 + this.morning * 0.0045 + this.rainAmt * 0.004 + this.nightFactor * 0.0015;
    this.mistMat.opacity = this.morning * 0.2;
    this.mistMat.color.copy(s.fog).lerp(_a.set(0xffffff), 0.5);
    for (const m of this.mist) { m.visible = this.morning > 0.01; m.position.x += m.userData.v * dt; if (m.position.x > 70) m.position.x = -70; }

    // Hujan mengikuti kamera
    this.rain.visible = this.rainAmt > 0.02;
    if (this.rain.visible) {
      this.rainMat.opacity = this.rainAmt * 0.55;
      this.rain.position.set(target.x, 0, target.z);
      const p = this.rain.geometry.attributes.position.array;
      const fall = dt * 38;
      for (let k = 0; k < this.rainN; k++) {
        const o = k * 6;
        p[o + 1] -= fall; p[o + 4] -= fall;
        if (p[o + 4] < 0) { const y = 38 + Math.random() * 4; p[o + 1] = y; p[o + 4] = y - 1.1; }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
  }
}
