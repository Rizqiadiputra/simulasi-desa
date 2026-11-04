// Desa Majapahit — titik masuk: merangkai simulasi, scene 3D, NPC, dan UI.
import { createStage, IS_MOBILE } from './scene/stage.js';
import { Terrain } from './scene/terrain.js';
import { Vegetation } from './scene/vegetation.js';
import { SkySystem } from './scene/sky.js';
import { TorchSystem } from './scene/torches.js';
import { BuildingManager } from './buildings/manager.js';
import { NPCManager } from './npc/manager.js';
import { Simulation } from './simulation/sim.js';
import { loadState, saveState, clearSaves, replaceState, loadSlot } from './data/store.js';
import { createInitialState } from './data/initialState.js';
import { UI } from './ui/ui.js';
import { Player } from './player/player.js';
import { ChatService } from './chat/chat.js';
import { VehicleManager } from './vehicles/manager.js';
import { cellToWorld } from './data/config.js';
import * as THREE from 'three';

let state = await loadState();
const fresh = !state;
if (!state) state = createInitialState();

const sim = new Simulation(state);
{
  const away = Date.now() - (state.clock.savedAt || Date.now());
  const mins = sim.catchUp(away);
  if (!fresh && mins > 30) sim.offlineMinutes = mins;
}
// Desa lama belum punya istal? Pak Akuwu membangunkannya (kuda & kereta kencana)
if (!state.buildings.some((b) => b.type === 'istal')) {
  const spot = sim.findSpot('istal');
  if (spot) sim.addBuilding({ type: 'istal', ...spot, by: 'akuwu', free: true });
}
if (fresh) sim.makeAnnouncement();

const stage = createStage(document.getElementById('app'));
const { scene, camera, controls, renderer } = stage;

const terrain = new Terrain(scene, state, sim.grid);
const vegetation = new Vegetation(scene, state, { decor: IS_MOBILE ? 260 : 420 });
const sky = new SkySystem(scene, camera, { shadowSize: IS_MOBILE ? 1024 : 2048, rainDrops: IS_MOBILE ? 800 : 1400 });
const buildings = new BuildingManager(scene, state);
const torches = new TorchSystem(scene, { lights: IS_MOBILE ? 3 : 4 });
const refreshTorches = () => { const { pts, lights } = buildings.torchPoints(); torches.setPoints(pts, lights); };
refreshTorches();

sim.on('buildingAdded', (b, info) => {
  buildings.add(b, true);
  if (info.roads?.length) terrain.refreshRoads();
  if (info.treesChanged) vegetation.refresh();
  setTimeout(refreshTorches, 1600);
});
sim.on('hour', () => buildings.updateRice());
const npcs = new NPCManager(scene, sim, { shadows: !IS_MOBILE });
sim.on('citizenAdded', (c, o) => npcs.add(c, { arrive: o?.arrive, teleport: !o?.arrive }));
sim.on('citizenChanged', (c) => npcs.refreshLook(c));
sim.on('harvest', () => buildings.updateRice());

// ---------------------------------------------------------------- loop
const app = { state, sim, stage, terrain, vegetation, sky, buildings, torches, npcs, refreshTorches };
app.onResync = () => npcs.resync();

// Cincin seleksi warga
const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95, depthTest: false }));
ring.renderOrder = 10; ring.visible = false; scene.add(ring);
let selectedNpc = null;
app.selectNpc = (id) => { selectedNpc = id ? npcs.npcs.get(id) : null; };
app.focusBuilding = (b) => { const w = cellToWorld(b.ci, b.cj); stage.flyTo(w.x, w.z, 48); };
app.reset = async () => { app.resetting = true; await clearSaves(); location.reload(); };
// Muat slot simpanan manual: jadikan simpanan otomatis terbaru, lalu muat ulang halaman
app.loadSlot = async (n) => {
  const s = await loadSlot(n);
  if (!s) return false;
  app.resetting = true; // jangan sampai state lama tersimpan lagi saat halaman ditutup
  await replaceState(s);
  location.reload();
  return true;
};
// API sederhana untuk integrasi backend / media sosial (mis. komentar -> warga baru)
app.api = {
  addCitizen: (data = {}) => sim.addCitizen({ ...data, by: 'api' }),
  addBuilding: (data) => sim.addBuilding({ ...data, by: 'api', free: true }),
  exportState: () => JSON.parse(JSON.stringify(state)),
};
app.player = new Player(app);
app.chat = new ChatService(app);
app.vehicles = new VehicleManager(app);
const ui = new UI(app);
app.ui = ui;
if (sim.offlineMinutes) setTimeout(() => ui.toast(`🌙 Selama kamu pergi, ${Math.round(sim.offlineMinutes / 60)} jam desa telah berlalu`, 'event'), 900);
const followTmp = new THREE.Vector3();
window.desa = app; // akses debug dari console

let last = performance.now(), t = 0, saveT = 0;
// Kualitas adaptif: kalau FPS rendah (HP lemah), turunkan resolusi & matikan bayangan
const perf = { frames: 0, time: 0, level: 0 };
function adaptQuality(dt) {
  if (perf.level >= 2 || t < 3) return;
  perf.frames++; perf.time += dt;
  if (perf.time < 4) return;
  const fps = perf.frames / perf.time;
  perf.frames = 0; perf.time = 0;
  if (fps > 45) return;
  perf.level++;
  if (perf.level === 1) renderer.setPixelRatio(1);
  else { renderer.shadowMap.enabled = false; sky.sun.castShadow = false; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
  console.info(`[desa] FPS ${fps.toFixed(0)}, kualitas diturunkan ke level ${perf.level}`);
}
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now; t += dt;
  if (sim.clock.realtime) { if (sim.syncRealtime() > 3) app.onResync?.(); } else sim.clock.tick(dt);
  const hour = sim.hour;
  sky.update(hour, state.weather.type, dt, controls.target);
  torches.update(sky.nightFactor, t);
  buildings.update(dt, sky.nightFactor, t);
  terrain.update(t);
  app.vehicles.update(dt, t, hour);
  app.player.update(dt, t);
  npcs.update(dt, t, sim.clock.speed);
  if (selectedNpc && selectedNpc.mode !== 'hidden') { ring.visible = true; ring.position.set(selectedNpc.x, selectedNpc.y + 0.06, selectedNpc.z); ring.scale.setScalar(1 + Math.sin(t * 5) * 0.08); } else ring.visible = false;
  if (ui.follow) {
    const n = npcs.npcs.get(ui.follow);
    if (n) { followTmp.set(n.x, 0, n.z).sub(controls.target).multiplyScalar(Math.min(1, dt * 3)); controls.target.add(followTmp); camera.position.add(followTmp); }
  }
  ui.update(dt);
  stage.updateFly(dt);
  if (!app.player.firstPerson) controls.update();
  renderer.render(scene, camera);
  adaptQuality(dt);
  saveT += dt;
  if (saveT > 10) { saveT = 0; if (!app.resetting) saveState(state); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (!app.resetting) saveState(state); }
  else {
    const away = Date.now() - state.clock.savedAt;
    if (away > 3000) { const m = sim.catchUp(away); if (m > 3) app.onResync?.(); }
    last = performance.now();
  }
});
addEventListener('pagehide', () => { if (!app.resetting) saveState(state); });

setTimeout(() => document.getElementById('loading').classList.add('hide'), 300);
export default app;
