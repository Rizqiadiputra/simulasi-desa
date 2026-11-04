// Renderer, scene, kamera orbit isometrik dengan batas peta.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HALF } from '../data/config.js';

export const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 900);

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: !IS_MOBILE || devicePixelRatio < 2, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, IS_MOBILE ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 1, 1400);
  camera.position.set(62, 68, 72);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(2, 0, 4);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.screenSpacePanning = false;
  controls.minDistance = 14;
  controls.maxDistance = 170;
  controls.minPolarAngle = 0.32;
  controls.maxPolarAngle = 1.22;
  controls.zoomSpeed = 1.1;
  controls.panSpeed = 1.0;
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };

  // Batas area peta: geser target & kamera bersamaan
  const lim = HALF - 2;
  const tmp = new THREE.Vector3();
  controls.addEventListener('change', () => {
    const t = controls.target;
    const cx = THREE.MathUtils.clamp(t.x, -lim, lim), cz = THREE.MathUtils.clamp(t.z, -lim, lim);
    if (cx !== t.x || cz !== t.z || t.y !== 0) {
      tmp.set(cx - t.x, -t.y, cz - t.z);
      t.add(tmp); camera.position.add(tmp);
    }
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // Fokus kamera ke titik tertentu (animasi halus)
  let fly = null;
  // azimuth (radian) opsional: arah horizontal kamera dari target
  function flyTo(x, z, dist, azimuth) {
    const off = camera.position.clone().sub(controls.target);
    if (azimuth !== undefined) {
      const hz = Math.hypot(off.x, off.z);
      off.x = Math.sin(azimuth) * hz; off.z = Math.cos(azimuth) * hz;
    }
    if (dist) off.setLength(dist);
    fly = { from: controls.target.clone(), to: new THREE.Vector3(x, 0, z), off0: camera.position.clone().sub(controls.target), off, t: 0 };
  }
  function updateFly(dt) {
    if (!fly) return;
    fly.t = Math.min(1, fly.t + dt * 1.6);
    const k = 1 - Math.pow(1 - fly.t, 3);
    controls.target.lerpVectors(fly.from, fly.to, k);
    const off = fly.off0.clone().lerp(fly.off, k);
    camera.position.copy(controls.target).add(off);
    if (fly.t >= 1) fly = null;
  }
  controls.addEventListener('start', () => { fly = null; });

  // sudut kamera terdekat yang lurus dengan jalan desa (kelipatan 90°)
  function gridAzimuth() {
    const off = camera.position.clone().sub(controls.target);
    const az = Math.atan2(off.x, off.z);
    return Math.round(az / (Math.PI / 2)) * (Math.PI / 2);
  }

  return { renderer, scene, camera, controls, flyTo, updateFly, gridAzimuth };
}
