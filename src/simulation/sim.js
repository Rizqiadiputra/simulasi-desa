// Orkestrator simulasi: jam, cuaca, ekonomi, musim tanam, acara, pertumbuhan desa.
// Murni logika (tanpa three.js) — event dipancarkan lewat Emitter untuk scene & UI.
import { Emitter } from '../core/emitter.js';
import { pick, randInt } from '../core/rng.js';
import { clamp, fmt } from '../core/util.js';
import { DAY_REAL_SECONDS, YEAR_DAYS, GRID } from '../data/config.js';
import { BUILDING_TYPES, PROFESSIONS } from '../data/buildingTypes.js';
import { addCitizenRaw, findWorkplace, connectBuilding, nextBuildingName } from '../data/initialState.js';
import { makeName, ORIGINS, AKUWU_LINES } from '../data/names.js';
import { Grid, T, footprintCells, rotDir, effFootprint } from './grid.js';
import { Clock, dayInfo, SEASON_LABEL } from './clock.js';
import { getActivity } from './schedule.js';
import * as eco from './economy.js';
import { rollWeather, WEATHER_LABEL } from './weather.js';
import { eventsForDay, EVENT_INFO } from './events.js';

export const CROP_DAYS = 8;

export function cropStage(p) {
  if (p < 0.12) return { key: 'tandur', label: 'Baru ditanam (tandur)' };
  if (p < 0.72) return { key: 'tumbuh', label: 'Padi tumbuh menghijau' };
  if (p < 1) return { key: 'kuning', label: 'Padi mulai menguning' };
  return { key: 'siap', label: 'Siap panen!' };
}

export class Simulation extends Emitter {
  constructor(state) {
    super();
    this.state = state;
    state.news ||= [];
    this.grid = new Grid(state);
    this.clock = new Clock(state, { onHour: (h) => this.onHour(h), onNewDay: (d) => this.onNewDay(d) });
    this.today = eventsForDay(state, state.clock.day);
    this.silent = false;
  }

  get day() { return this.state.clock.day; }
  get hour() { return this.state.clock.minute / 60; }
  get info() { return dayInfo(this.day); }

  context(hour = this.hour) {
    return {
      events: this.today.filter((e) => e.type !== 'pasar'),
      pasaranRamai: this.today.some((e) => e.type === 'pasar'),
      weather: this.state.weather.type,
      hour,
    };
  }
  activeEvents(hour = this.hour) { return this.today.filter((e) => hour >= e.from && hour < e.to); }
  activityOf(c, hour = this.hour) { return getActivity(c, hour, this.context(hour)); }
  building(id) { return this.state.buildings.find((b) => b.id === id); }
  citizen(id) { return this.state.citizens.find((c) => c.id === id); }

  toast(msg, kind = 'info') { if (!this.silent) this.emit('toast', msg, kind); }
  pushNews(text) { this.state.news.push(text); if (this.state.news.length > 12) this.state.news.shift(); }

  // ------------------------------------------------------------------ jam
  onHour(hour) {
    const st = this.state;
    if (hour % 4 === 0) {
      const w = rollWeather(this.info.season);
      if (w !== st.weather.type) {
        st.weather = { type: w, since: this.day * 24 + hour };
        if (w === 'hujan') this.toast('🌧️ Hujan turun. Warga berteduh, sawah senang.');
        this.emit('weather', w);
      }
    }
    // Siapa yang sedang bekerja?
    const counts = {}, sellers = [], farmersAt = {};
    for (const c of st.citizens) {
      const a = getActivity(c, hour + 0.5, this.context(hour + 0.5));
      if (a.key !== 'kerja' || !c.workId) continue;
      counts[c.profession] = (counts[c.profession] || 0) + 1;
      if (c.profession === 'pedagang') sellers.push(c);
      if (c.profession === 'petani') farmersAt[c.workId] = (farmersAt[c.workId] || 0) + 1;
      if (c.profession === 'pengrajin' || c.profession === 'pandai_besi') c.kepeng += 0.4;
    }
    eco.produce(st, counts);
    eco.updatePrices(st);
    eco.marketSales(st, sellers, this.today.some((e) => e.type === 'pasar'));

    // Pertumbuhan padi & panen
    const growth = (1 / (CROP_DAYS * 24)) * (this.info.season === 'ketiga' ? 0.8 : 1) * (st.weather.type === 'hujan' ? 1.3 : 1);
    let harvested = 0;
    for (const b of st.buildings) {
      if (b.type !== 'sawah') continue;
      b.crop ||= { progress: 0 };
      b.crop.progress = Math.min(1, b.crop.progress + growth);
      const assigned = st.citizens.filter((c) => c.workId === b.id).length;
      if (b.crop.progress >= 1 && (farmersAt[b.id] || (!assigned && hour === 10))) {
        const y = eco.harvestYield(farmersAt[b.id] || 0.5);
        st.economy.stock.beras += y;
        st.economy.kas += y * 0.12 * st.economy.prices.beras;
        for (const c of st.citizens) if (c.workId === b.id) c.kepeng += 3;
        b.crop.progress = 0;
        b.crop.lastHarvest = this.day;
        harvested += y;
        this.emit('harvest', b, y);
      }
    }
    if (harvested) {
      this.toast(`🌾 Panen! +${fmt(harvested)} bakul beras masuk lumbung`, 'good');
      this.pushNews(`Panen di sawah menghasilkan ${fmt(harvested)} bakul beras.`);
      const d = this.day + 1;
      if (!st.events.scheduled.some((e) => e.type === 'pesta' && e.day >= this.day)) {
        st.events.scheduled.push({ type: 'pesta', day: d });
        this.pushNews(`Besok malam ada ${EVENT_INFO.pesta.label} di pendopo!`);
      }
    }
    if (hour === 6) this.makeAnnouncement();
    for (const e of this.today) if (hour === Math.floor(e.from) && e.type !== 'pasar') this.toast(`${e.icon} ${e.label} dimulai!`, 'event');
    this.emit('hour', hour);
  }

  // ------------------------------------------------------------------ hari
  onNewDay(day) {
    const st = this.state;
    const res = eco.dailyConsumption(st);
    if (res.short > 0) this.pushNews(`Beras di lumbung kurang ${fmt(res.short)} bakul. Hati-hati paceklik!`);
    if (res.overflow > 0) this.pushNews(`Lumbung penuh, ${fmt(res.overflow)} bakul beras dijual ke kotaraja.`);
    st.events.scheduled = st.events.scheduled.filter((e) => e.day >= day);
    this.today = eventsForDay(st, day);

    // Tahun baru Saka: semua bertambah umur
    if (day > 1 && (day - 1) % YEAR_DAYS === 0) {
      for (const c of st.citizens) {
        c.age += 1;
        if (c.profession === 'anak' && c.age >= 14) {
          const prof = this.pickProfession();
          const gender = c.gender;
          const old = c.name;
          c.profession = prof;
          c.name = makeName({ gender, profession: prof, age: c.age });
          c.workId = findWorkplace(st, prof, c)?.id || null;
          this.pushNews(`${old} sudah dewasa! Kini dikenal sebagai ${c.name}, seorang ${PROFESSIONS[prof].label.toLowerCase()}.`);
          this.emit('citizenChanged', c);
        }
      }
    }
    this.growVillage();
    this.emit('newDay', day);
  }

  pickProfession() {
    const st = this.state;
    const vac = [];
    for (const b of st.buildings) {
      const jobs = BUILDING_TYPES[b.type].jobs;
      if (!jobs) continue;
      for (const [p, n] of Object.entries(jobs)) {
        if (p === 'akuwu') continue;
        const used = st.citizens.filter((c) => c.workId === b.id && c.profession === p).length;
        for (let k = used; k < n; k++) vac.push(p);
      }
    }
    return vac.length ? pick(vac) : pick(['petani', 'petani', 'pedagang', 'pengrajin']);
  }

  freeHome() {
    const st = this.state;
    let best = null, bestFree = 0;
    for (const b of st.buildings) {
      const cap = BUILDING_TYPES[b.type].capacity;
      if (!cap) continue;
      const free = cap - st.citizens.filter((c) => c.homeId === b.id).length;
      if (free > bestFree) { best = b; bestFree = free; }
    }
    return best;
  }
  housingFree() {
    const st = this.state;
    let cap = 0;
    for (const b of st.buildings) cap += BUILDING_TYPES[b.type].capacity || 0;
    return cap - st.citizens.length;
  }

  growVillage() {
    const st = this.state, e = st.economy;
    const pop = eco.population(st).total;
    const r = Math.random();
    if (this.housingFree() > 0 && e.stock.beras >= pop * 0.9) {
      if (r < 0.45) {
        const prof = this.pickProfession();
        const c = this.addCitizen({ profession: prof, by: 'pendatang' });
        if (c) this.pushNews(`Selamat datang ${c.name}, pendatang dari ${c.origin} yang jadi ${PROFESSIONS[c.profession].label.toLowerCase()}.`);
      } else if (r < 0.62) {
        const parentHome = st.buildings.find((b) => BUILDING_TYPES[b.type].capacity && st.citizens.filter((c) => c.homeId === b.id).length < BUILDING_TYPES[b.type].capacity && st.citizens.some((c) => c.homeId === b.id && c.profession !== 'anak'));
        if (parentHome) {
          const c = this.addCitizen({ profession: 'anak', age: 0, homeId: parentHome.id, origin: 'Lahir di desa', by: 'lahir' });
          if (c) this.pushNews(`Ada bayi lahir di ${parentHome.name}! Namanya ${c.name}.`);
        }
      }
    }
    // Pembangunan otomatis atas titah Pak Akuwu
    let built = null;
    if (this.housingFree() <= 1 && e.kas >= BUILDING_TYPES.rumah.cost + 150) built = this.autoBuild('rumah');
    else if (st.citizens.filter((c) => c.profession === 'petani').length > st.buildings.filter((b) => b.type === 'sawah').length * 3 && e.kas >= 200) built = this.autoBuild('sawah');
    else if (e.stock.beras > eco.storageCap(st) * 0.9 && e.kas >= 200) built = this.autoBuild('lumbung');
    if (built) this.pushNews(`Atas titah Pak Akuwu, ${built.name} selesai dibangun.`);
  }

  findSpot(type) {
    const g = this.grid;
    const roads = [];
    for (let j = 1; j < GRID - 1; j++) for (let i = 1; i < GRID - 1; i++) {
      const t = g.get(i, j);
      if (t === T.ROAD) roads.push([i, j]);
    }
    const cx = type === 'sawah' ? 44 : 22, cz = 24;
    roads.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(b[0] - cx, b[1] - cz) + (Math.random() - 0.5) * 6);
    for (const [ri, rj] of roads) {
      for (let rot = 0; rot < 4; rot++) {
        const [w, d] = effFootprint(type, rot);
        const [dx, dz] = rotDir(rot);
        const off = dx ? Math.floor(w / 2) + 1 : Math.floor(d / 2) + 1;
        const ci = ri - dx * off, cj = rj - dz * off;
        if (g.canPlace(type, ci, cj, rot).ok) return { ci, cj, rot };
      }
    }
    return null;
  }

  autoBuild(type) {
    const spot = this.findSpot(type);
    if (!spot) return null;
    const res = this.addBuilding({ type, ...spot, by: 'akuwu' });
    return res.ok ? res.building : null;
  }

  // ------------------------------------------------------------------ aksi
  addBuilding({ type, ci, cj, rot, by = 'kamu', free = false }) {
    const st = this.state, def = BUILDING_TYPES[type];
    const check = this.grid.canPlace(type, ci, cj, rot);
    if (!check.ok) return check;
    if (!free && st.economy.kas < def.cost) return { ok: false, reason: `Kas desa kurang (butuh ${def.cost} kepeng)` };
    if (!free) st.economy.kas -= def.cost;
    const b = { id: `b${++st.counters.building}`, type, ci, cj, rot, name: nextBuildingName(st, type), builtDay: this.day, builtMinute: Math.floor(st.clock.minute), by };
    if (type === 'sawah') { b.level = +clamp(0.2 + (ci - 36) * 0.045, 0.15, 0.75).toFixed(2); b.crop = { progress: 0 }; }
    if (type === 'rumah') b.name = `Rumah Baru ${st.buildings.filter((x) => x.type === 'rumah').length + 1}`;
    st.buildings.push(b);
    this.grid.markBuilding(b);
    const roads = connectBuilding(st, this.grid, b);
    // pohon di lahan bangunan ditebang
    const cells = footprintCells(type, ci, cj, rot);
    const before = st.trees.length;
    st.trees = st.trees.filter((t) => !cells.some(([i, j]) => Math.abs(t.x - ((i - GRID / 2 + 0.5) * 2)) < 1.6 && Math.abs(t.z - ((j - GRID / 2 + 0.5) * 2)) < 1.6));
    // warga tanpa pekerjaan langsung direkrut
    for (const c of st.citizens) if (!c.workId && def.jobs?.[c.profession]) c.workId = findWorkplace(st, c.profession, c)?.id || null;
    const who = by === 'kamu' ? 'oleh kamu' : by === 'akuwu' ? 'atas titah Pak Akuwu' : by === 'api' ? 'oleh warga dunia maya' : '';
    st.history.push({ id: ++st.counters.history, day: this.day, minute: Math.floor(st.clock.minute), text: `${b.name} dibangun ${who}`.trim(), buildingId: b.id, type, by });
    this.emit('buildingAdded', b, { roads, treesChanged: before !== st.trees.length });
    if (by === 'kamu') this.pushNews(`Warga bergotong-royong membangun ${b.name}.`);
    return { ok: true, building: b };
  }

  addCitizen({ profession, gender, name, origin, age, homeId, by = 'kamu' } = {}) {
    const st = this.state;
    const home = homeId ? this.building(homeId) : this.freeHome();
    if (!home) return null;
    profession ||= this.pickProfession();
    gender ||= profession === 'prajurit' || profession === 'pandai_besi' ? 'L' : Math.random() < 0.5 ? 'L' : 'P';
    age ??= profession === 'anak' ? randInt(4, 12) : randInt(18, 45);
    const c = addCitizenRaw(st, { profession, gender, homeId: home.id, age, origin: origin || pick(ORIGINS), name });
    c.workId = findWorkplace(st, profession, c)?.id || null;
    this.emit('citizenAdded', c, { arrive: by !== 'lahir' });
    if (by === 'kamu' || by === 'api') this.toast(`👋 ${c.name} pindah ke desa!`, 'good');
    return c;
  }

  // ------------------------------------------------------------------ pengumuman
  makeAnnouncement() {
    const st = this.state, info = this.info, e = st.economy;
    const lines = [];
    lines.push(`Sugeng enjang, warga! Hari ini ${info.weekday} ${info.pasaran}, hari ke-${this.day} tahun Saka ${info.year}.`);
    lines.push(`Kita sedang di ${SEASON_LABEL[info.season]}. Cuaca pagi ini ${WEATHER_LABEL[st.weather.type].toLowerCase()}.`);
    for (const ev of this.today) {
      if (ev.type === 'pasar') lines.push('Hari pasaran Umanis! Pasar Wurare pasti ramai, saudagar dari Canggu datang membeli.');
      else lines.push(`${ev.icon} Nanti jam ${ev.from}.00 ada ${ev.label} di ${ev.place}. Semua warga diharap hadir!`);
    }
    const sawah = st.buildings.filter((b) => b.type === 'sawah');
    const ripe = sawah.filter((b) => (b.crop?.progress || 0) >= 0.72).length;
    if (sawah.length) lines.push(ripe ? `${ripe} dari ${sawah.length} petak sawah padinya sudah menguning.` : 'Padi di sawah masih hijau, sabar ya para petani.');
    lines.push(`Harga di pasar: beras ${e.prices.beras} kepeng, gerabah ${e.prices.gerabah} kepeng, alat besi ${e.prices.alat_besi} kepeng.`);
    lines.push(...st.news.splice(0));
    lines.push(`Pesan saya: "${pick(AKUWU_LINES)}"`);
    st.announcements.unshift({ day: this.day, minute: 360, title: `${info.weekday} ${info.pasaran} · Hari ke-${this.day}`, lines });
    if (st.announcements.length > 40) st.announcements.length = 40;
    this.toast('📜 Pak Akuwu punya pengumuman baru', 'event');
    this.emit('announcement');
  }

  // Mode realtime: kejar jam asli. Return menit yang dikejar (untuk info "selama kamu pergi").
  syncRealtime() {
    const c = this.clock;
    if (!c.realtime) return 0;
    if (!this.state.clock.epoch && this.state.clock.day === 1 && !this.state.clock.synced) { c.snapToReal(); this.state.clock.synced = true; this.today = eventsForDay(this.state, this.day); return 0; }
    this.state.clock.synced = true;
    const d = c.realDiff();
    if (d < -1) { c.snapToReal(); return 0; }
    if (d <= 2) { if (d > 0) c.advance(d); return 0; }
    this.silent = true;
    c.advance(Math.min(d, 1440 * 30));
    this.silent = false;
    if (c.realDiff() > 2) c.snapToReal(); // lebih dari 30 hari: lompat saja
    this.today = eventsForDay(this.state, this.day);
    return d;
  }

  // Waktu berjalan saat aplikasi ditutup (mode cepat)
  catchUp(realMs) {
    if (this.clock.realtime) return this.syncRealtime();
    const minutes = Math.min((realMs / 1000 / DAY_REAL_SECONDS) * 1440, 1440 * 30);
    if (minutes < 1) return 0;
    this.silent = true;
    this.clock.advance(minutes);
    this.silent = false;
    return minutes;
  }
}
