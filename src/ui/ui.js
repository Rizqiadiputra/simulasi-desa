// Antarmuka: header, tab bawah, bottom sheet, toast, tap di peta, mode Bangun.
import * as THREE from 'three';
import { esc, fmt, fmtClock } from '../core/util.js';
import { BUILDING_TYPES, PROFESSIONS, buildableTypes } from '../data/buildingTypes.js';
import { worldToCell, GRID } from '../data/config.js';
import { dayInfo } from '../simulation/clock.js';
import { WEATHER_ICON, WEATHER_LABEL } from '../simulation/weather.js';
import { saveState, resetState, exportState, listSlots, saveSlot, deleteSlot, MAX_SLOTS } from '../data/store.js';
import * as P from './panels.js';
import { SUGGESTIONS as SUGG } from '../chat/brain.js';
import { Minimap } from './minimap.js';
import { NEEDS } from '../player/needs.js';

const TABS = [['peta', '🗺️', 'Peta'], ['pengumuman', '📜', 'Pengumuman'], ['riwayat', '🏗️', 'Riwayat'], ['warga', '👥', 'Warga']];
const SPEEDS = [1, 5, 20, 0];

export class UI {
  constructor(app) {
    this.app = app;
    this.sim = app.sim;
    this.root = document.getElementById('ui');
    this.tab = 'peta';
    this.view = null; // {kind, id}
    this.filter = 'semua';
    this.query = '';
    this.follow = null;
    this.build = null;
    this.unread = 0;
    this.render();
    this.bindCanvas();
    this.minimap = new Minimap(app, this.root);
    this.sim.on('toast', (m, k) => this.toast(m, k));
    this.sim.on('announcement', () => { if (!(this.view?.kind === 'tab' && this.tab === 'pengumuman')) { this.unread++; this.updateBadge(); } });
    this.sim.on('buildingAdded', () => this.refreshIfTab('riwayat'));
    this.sim.on('citizenAdded', () => this.refreshIfTab('warga'));
    this.sim.on('hour', () => { if (this.view?.kind === 'building' || this.tab === 'pengumuman') this.refreshView(); });
    this.liveT = 0;
  }

  $(sel) { return this.root.querySelector(sel); }

  render() {
    this.root.innerHTML = `
      <header class="hud">
        <div class="hud-l">
          <div class="hud-title">Desa Majapahit <span>— Hari ke-<b data-h="day">1</b></span></div>
          <div class="hud-sub"><b data-h="clock">06:00</b> · <span data-h="cal"></span> · <span data-h="wx"></span></div>
        </div>
        <div class="hud-r">
          <span class="pill" title="Jumlah warga">👥 <b data-h="pop">0</b></span>
          <span class="pill coin-pill" title="Kas desa (kepeng)"><i class="kepeng"></i><b data-h="kas">0</b></span>
          ${this.sim.clock.realtime ? '' : '<button class="pill btn-speed" data-speed="1" title="Kecepatan waktu">▶ 1×</button>'}
          <button class="pill" data-mute="1" title="Suara nyala / mati">🔊</button>
          <button class="pill" data-settings="1" title="Pengaturan">⚙</button>
        </div>
      </header>
      <div class="event-banner" data-h="event" hidden></div>
      <div class="toasts"></div>
      <div class="follow-chip" hidden><span></span><button data-unfollow="1">✕</button></div>
      <div class="hint">Geser untuk keliling · cubit/scroll untuk zoom · ketuk bangunan atau warga</div>
      <button class="fab" data-buildmenu="1">🔨 <span>Bangun</span></button>
      <button class="fab fab-walk" data-walk="1">🚶 <span>Jalan-jalan</span></button>
      <div class="walkhud" hidden>
        <div class="needs">${NEEDS.map(([k, i, l]) => `<div class="need" data-need="${k}" title="${l}"><span>${i}</span><i><b></b></i></div>`).join('')}<div class="need-kp" title="Kepeng milikmu"><i class="kepeng"></i> <b data-h="mykp">0</b></div></div>
        <div class="sleep-veil" hidden>😴 zzz…</div>
        <div class="joy"><div class="joy-knob"></div></div>
        <button class="act-btn" data-act="1" hidden></button>
        <button class="cam-btn" data-cam="1">🎥 Atas</button>
        <button class="jump-btn" data-jump="1" aria-label="Loncat">⤒<small>Loncat</small></button>
        <div class="walk-keys">W/S ↑↓: jalan · A/D ← →: putar kamera · Shift: lari · Space: loncat · E: sapa · C: kamera · seret: menoleh</div>
      </div>
      <div class="buildbar" hidden>
        <div class="bb-title"></div>
        <div class="bb-status"></div>
        <div class="bb-btns"><button class="btn" data-rotate="1">↻ Putar</button><button class="btn primary" data-confirm="1">✓ Bangun</button><button class="btn" data-cancel="1">✕</button></div>
      </div>
      <section class="sheet" aria-hidden="true">
        <div class="sheet-grip"></div>
        <div class="sheet-head"><button class="sheet-back" data-back="1" hidden>‹</button><h3 class="sheet-title"></h3><button class="sheet-x" data-close="1">✕</button></div>
        <div class="sheet-body"></div>
      </section>
      <nav class="tabs">${TABS.map(([k, i, l]) => `<button data-tab="${k}" class="${k === 'peta' ? 'on' : ''}"><span>${i}</span><small>${l}</small>${k === 'pengumuman' ? '<i class="badge" hidden></i>' : ''}</button>`).join('')}</nav>`;
    this.h = {};
    this.root.querySelectorAll('[data-h]').forEach((el) => (this.h[el.dataset.h] = el));
    this.sheet = this.$('.sheet');
    this.body = this.$('.sheet-body');
    this.root.addEventListener('click', (e) => { if (e.target.closest('button')) this.app.audio?.click(); this.onClick(e); });
    this.root.addEventListener('keydown', (e) => {
      if (e.target.dataset?.chatinput && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); this.sendChat(); }
    });
    this.root.addEventListener('input', (e) => {
      if (e.target.dataset.vol) { this.app.audio.setVolume(e.target.dataset.vol, e.target.value / 100); return; }
      if (e.target.dataset.search) { this.query = e.target.value; const pos = e.target.selectionStart; this.refreshView(); const inp = this.$('[data-search]'); inp?.focus(); inp?.setSelectionRange(pos, pos); }
    });
    this.updateSpeedBtn();
    this.updateMuteBtn();
    this.bindJoystick();
    setTimeout(() => this.$('.hint')?.classList.add('fade'), 6000);
  }

  // ------------------------------------------------------------ klik
  onClick(e) {
    const t = e.target.closest('button, [data-building], [data-citizen], li[data-fly]');
    if (!t) return;
    const d = t.dataset;
    if (d.tab) return this.selectTab(d.tab);
    if (d.close) return this.closeSheet();
    if (d.back) return this.back();
    if (d.citizen) return this.openCitizen(d.citizen, true);
    if (d.building) return this.openBuilding(d.building, true);
    if (d.follow) { this.startFollow(d.follow); return this.closeSheet(); }
    if (d.unfollow) return this.stopFollow();
    if (d.talk) { const ak = this.sim.state.citizens.find((c) => c.profession === 'akuwu'); return ak && this.openChat(ak.id, true); }
    if (d.chat) return this.openChat(d.chat, true);
    if (d.send) return this.sendChat();
    if (d.sugg) return this.sendChat(d.sugg);    if (d.filter) { this.filter = d.filter; return this.refreshView(); }
    if (d.speed) return this.cycleSpeed();
    if (d.settings) return this.open({ kind: 'settings' });
    if (d.mute) { const m = this.app.audio.toggleMute(); this.updateMuteBtn(); return this.toast(m ? '🔇 Suara dimatikan' : '🔊 Suara dinyalakan'); }
    if (d.buildmenu) return this.open({ kind: 'buildmenu' });
    if (d.pick) return this.startBuild(d.pick);
    if (d.invite) return this.open({ kind: 'invite' });
    if (d.doinvite) return this.doInvite();
    if (d.rotate) return this.rotateBuild();
    if (d.confirm) return this.confirmBuild();
    if (d.cancel) return this.cancelBuild();
    if (d.reset) { if (t.dataset.armed) { this.app.reset(); } else { t.dataset.armed = '1'; t.textContent = 'Yakin? Ketuk sekali lagi'; } return; }
    if (d.export) return this.exportJSON();
    if (d.slots) return this.openSlots(d.slots);
    if (d.slotsave) return this.armed(t, '⚠️ Timpa simpanan ini? Ketuk lagi', () => this.doSaveSlot(+d.slotsave));
    if (d.slotload) return this.armed(t, '⚠️ Progres sekarang diganti. Ketuk lagi', () => this.doLoadSlot(+d.slotload));
    if (d.slotdel) return this.armed(t, 'Yakin hapus?', () => this.doDeleteSlot(+d.slotdel));
    if (d.walk) return this.toggleWalk();
    if (d.act) return this.app.player.interact();
    if (d.jump) return this.app.player.jump();
    if (d.cam) { this.app.player.cycleCam(); this.updateCamBtn(); this.toast({ orbit: '🎥 Kamera atas', chase: '🎥 Kamera belakang · seret layar untuk menoleh', pov: '👁️ Sudut pandang mata (PoV) · seret layar untuk menoleh' }[this.app.player.camMode]); return; }
    if (d.profile) return this.open({ kind: 'profile' }, !!this.view);
    if (d.me) return this.open({ kind: 'player' });
    if (d.saveprofile) return this.saveProfile();
    if (d.swatch) { t.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === t)); return; }
  }

  // ------------------------------------------------------------ sheet
  selectTab(tab) {
    this.tab = tab;
    this.root.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    if (tab === 'peta') return this.closeSheet(true);
    if (tab === 'pengumuman') { this.unread = 0; this.updateBadge(); }
    this.stack = [];
    this.open({ kind: 'tab', tab });
  }
  open(view, push = false) {
    if (push && this.view) (this.stack ||= []).push(this.view);
    else if (!push) this.stack = this.view?.kind === 'tab' && view.kind !== 'tab' ? [this.view] : [];
    this.view = view;
    this.sheet.classList.add('open');
    this.sheet.setAttribute('aria-hidden', 'false');
    this.root.classList.add('sheet-open');
    this.refreshView();
    this.body.scrollTop = 0;
  }
  back() {
    const prev = this.stack?.pop();
    if (prev) { this.view = prev; this.refreshView(); } else this.closeSheet();
  }
  closeSheet(keepTab) {
    this.sheet.classList.remove('open');
    this.sheet.setAttribute('aria-hidden', 'true');
    this.root.classList.remove('sheet-open');
    this.view = null;
    this.stack = [];
    this.app.buildings.select(null);
    this.app.selectNpc?.(null);
    if (!keepTab) { this.tab = 'peta'; this.root.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === 'peta')); }
  }
  refreshIfTab(tab) { if (this.view?.kind === 'tab' && this.view.tab === tab) this.refreshView(); }

  npcStatus = (c) => this.app.npcs.statusText(this.app.npcs.npcs.get(c.id));

  refreshView() {
    const v = this.view;
    this.syncChatting();
    if (!v) return;
    let title = '', html = '';
    const sim = this.sim;
    if (v.kind === 'tab') {
      title = { pengumuman: '📜 Pengumuman Desa', riwayat: '🏗️ Riwayat Pembangunan', warga: '👥 Warga Desa' }[v.tab];
      if (v.tab === 'pengumuman') html = P.announcementsView(sim);
      if (v.tab === 'riwayat') html = P.historyView(sim);
      if (v.tab === 'warga') html = P.citizensView(sim, this.filter, this.query, this.npcStatus);
    } else if (v.kind === 'building') {
      const b = sim.building(v.id);
      if (!b) return this.closeSheet();
      title = 'Info Bangunan';
      html = P.buildingInfo(sim, b, this.npcStatus);
    } else if (v.kind === 'citizen') {
      const c = sim.citizen(v.id);
      if (!c) return this.closeSheet();
      title = 'Prasasti Warga';
      html = P.prasasti(sim, c, this.npcStatus(c));
    } else if (v.kind === 'chat') {
      const c = sim.citizen(v.id);
      if (!c) return this.closeSheet();
      title = '💬 Ngobrol';
      const chat = this.app.chat;
      const log = chat.log(c.id);
      const last = [...log].reverse().find((m) => m.from === 'npc' && m.src);
      const mode = chat.llm ? 'claude' : chat.llm === false ? 'lokal' : last?.src || 'lokal';
      html = P.chatView(c, log, this.npcStatus(c), mode, chat.busy, SUGG);
    } else if (v.kind === 'buildmenu') {
      title = '🔨 Bangun Desa';
      html = this.buildMenuHTML();
    } else if (v.kind === 'invite') {
      title = '➕ Undang Warga Baru';
      html = this.inviteHTML();
    } else if (v.kind === 'profile') {
      title = this.app.state.player ? '✏️ Ubah Profilku' : '🧭 Buat Karaktermu';
      html = P.profileForm(this.app.state.player);
    } else if (v.kind === 'player') {
      title = 'Prasasti Warga';
      html = P.prasasti(sim, this.app.state.player, this.app.player.moving ? 'Jalan-jalan keliling desa' : 'Sedang melihat-lihat suasana desa', { player: true });
    } else if (v.kind === 'vehicle') {
      const K = this.app.vehicles.kereta, h = v.veh.h;
      title = v.veh.kind === 'kuda' ? '🐎 Kuda Tunggangan' : '👑 Kereta Kencana';
      html = v.veh.kind === 'kuda'
        ? `<div class="b-head"><div class="b-ic">🐎</div><div><div class="b-type">Kuda ${esc(h.color)}</div><h2>${esc(h.name)}</h2><small>Penghuni ${esc(h.home.name)}</small></div></div>
           <p class="desc">Kuda tunggangan milik desa. Lagi ${h.rider ? 'ditunggangi' : h.mode === 'graze' ? 'merumput dengan tenang' : h.mode === 'return' ? 'pulang ke istal' : 'jalan-jalan di sekitar istal'}.</p>
           <p class="muted">Mode 🚶 Jalan-jalan → dekati kuda → tekan <b>E</b> (atau tombol 🐎) untuk naik. Saat menunggang kamu lebih cepat dan tetap bisa loncat.</p>`
        : `<div class="b-head"><div class="b-ic">👑</div><div><div class="b-type">Kereta kencana desa</div><h2>${esc(K.name)}</h2><small>Ditarik dua kuda putih</small></div></div>
           <p class="desc">Kereta berlapis emas yang dipakai Pak Akuwu untuk menyambut tamu. Tiap hari jam 07.00–17.00 keliling desa (istal → kediaman Akuwu → pendopo → pasar → bengkel → pos jaga), malamnya parkir di istal.</p>
           <div class="chips"><span class="chip">${K.parked ? '🅿️ Sedang parkir' : K.wait > 0 ? '⏸ Singgah sebentar' : '🛞 Sedang keliling'}</span>${K.passenger ? '<span class="chip">🧭 Kamu penumpangnya</span>' : ''}</div>
           <p class="muted">Mode 🚶 Jalan-jalan → dekati kereta → tekan <b>E</b> untuk naik sebagai penumpang.</p>`;
    } else if (v.kind === 'settings') {
      title = '⚙ Pengaturan';
      html = `<p>Desa tersimpan otomatis tiap beberapa detik. Waktu desa mengikuti jam asli perangkatmu (1 hari desa = 1 hari nyata) dan terus berjalan walau aplikasi ditutup.</p>
        <div class="btns col">
          <button class="btn primary" data-slots="save">💾 Simpan Game</button>
          <button class="btn" data-slots="load">📂 Muat Game</button>
          <button class="btn" data-profile="1">🧭 ${this.app.state.player ? 'Ubah profil karakterku' : 'Buat karakterku'}</button>
          <button class="btn" data-export="1">⬇️ Ekspor data desa (JSON)</button>
          <button class="btn danger" data-reset="1">🗑️ Mulai dari Awal</button>
        </div>
        <p class="muted small">Mulai dari Awal menghapus desa yang sedang berjalan. Slot di Simpan Game tetap aman dan bisa dimuat lagi.</p>
        <h3 class="set-h">🔊 Suara</h3>
        <label class="vol">🎶 Musik gamelan<input type="range" min="0" max="100" data-vol="music" value="${Math.round(this.app.audio.prefs.music * 100)}"></label>
        <label class="vol">🐦 Efek & suasana<input type="range" min="0" max="100" data-vol="sfx" value="${Math.round(this.app.audio.prefs.sfx * 100)}"></label>
        <p class="muted small">Musik dan suara dibuat langsung oleh kode (tangga nada slendro), tanpa file audio. Tombol 🔊 di atas untuk mematikan cepat.</p>`;
    } else if (v.kind === 'slots') {
      title = v.mode === 'save' ? '💾 Simpan Game' : '📂 Muat Game';
      html = this.slotsView(v);
    }
    this.$('.sheet-title').textContent = title;
    this.$('.sheet-back').hidden = !this.stack?.length;
    this.body.innerHTML = html;
  }

  // Warga yang sedang diajak ngobrol berhenti & menghadap kita
  syncChatting() {
    const id = this.view?.kind === 'chat' ? this.view.id : null;
    for (const n of this.app.npcs.list) n.chatting = n.c.id === id;
  }

  openChat(id, push = false) {
    const c = this.sim.citizen(id);
    if (!c) return;
    this.app.chat.greet(c);
    this.app.buildings.select(null);
    this.app.selectNpc?.(id);
    this.open({ kind: 'chat', id }, push && !!this.view);
    this.scrollChat();
    if (matchMedia('(pointer: fine)').matches) this.$('[data-chatinput]')?.focus();
  }

  scrollChat() { const l = this.$('.chat-log'); if (l) l.scrollTop = l.scrollHeight; }
  renderChatLog() {
    if (this.view?.kind !== 'chat') return;
    const c = this.sim.citizen(this.view.id), l = this.$('.chat-log');
    if (!c || !l) return;
    l.innerHTML = P.chatLogHTML(c, this.app.chat.log(c.id), this.app.chat.busy);
    const m = this.$('.chat-mode');
    if (m && this.app.chat.llm !== null) m.textContent = this.app.chat.llm ? '🤖 Dijawab Claude' : '🧠 Otak lokal (tanpa internet)';
    this.scrollChat();
  }
  async sendChat(text) {
    if (this.view?.kind !== 'chat') return;
    const c = this.sim.citizen(this.view.id);
    const inp = this.$('[data-chatinput]');
    const msg = text ?? inp?.value ?? '';
    if (!msg.trim() || this.app.chat.busy) return;
    if (inp && text === undefined) inp.value = '';
    const p = this.app.chat.send(c, msg);
    this.renderChatLog();
    if (await p) this.app.audio?.reply();
    this.renderChatLog();
    saveState(this.sim.state);
  }

  openBuilding(id, push = false) {
    const b = this.sim.building(id);
    if (!b) return;
    this.app.buildings.select(b);
    this.app.selectNpc?.(null);
    this.open({ kind: 'building', id }, push && !!this.view);
    if (this.view && push) this.app.focusBuilding?.(b);
  }
  openCitizen(id, push = false) {
    const c = this.sim.citizen(id);
    if (!c) return;
    this.app.buildings.select(null);
    this.app.selectNpc?.(id);
    this.open({ kind: 'citizen', id }, push && !!this.view);
  }

  startFollow(id) {
    const c = this.sim.citizen(id);
    this.follow = id;
    this.app.selectNpc?.(id);
    const chip = this.$('.follow-chip');
    chip.hidden = false;
    chip.querySelector('span').textContent = `📍 Mengikuti ${c?.name || ''}`;
  }
  stopFollow() { this.follow = null; this.$('.follow-chip').hidden = true; this.app.selectNpc?.(null); }

  // ------------------------------------------------------------ waktu
  cycleSpeed() {
    const cur = this.sim.clock.speed;
    const next = SPEEDS[(SPEEDS.indexOf(cur) + 1) % SPEEDS.length];
    this.sim.clock.speed = next;
    this.updateSpeedBtn();
    this.toast(next ? `⏩ Waktu desa ${next}× lebih cepat` : '⏸ Waktu desa dijeda');
  }
  updateSpeedBtn() {
    const s = this.sim.clock.speed;
    if (!this.$('.btn-speed')) return;
    this.$('.btn-speed').textContent = s ? `${s > 1 ? '⏩' : '▶'} ${s}×` : '⏸';
  }

  // ------------------------------------------------------------ toast
  updateMuteBtn() { const b = this.$('[data-mute]'); if (b) b.textContent = this.app.audio?.prefs.muted ? '🔇' : '🔊'; }

  toast(msg, kind = 'info') {
    if (kind === 'event') this.app.audio?.event();
    else if (kind === 'bad') this.app.audio?.bad();
    const box = this.$('.toasts');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 3600);
    setTimeout(() => el.remove(), 4200);
  }
  updateBadge() {
    const b = this.$('.tabs .badge');
    b.hidden = !this.unread;
    b.textContent = this.unread;
  }

  // ------------------------------------------------------------ per frame
  update(dt) {
    this.minimap?.update(dt);
    this.liveT -= dt;
    if (this.liveT > 0) return;
    this.liveT = 0.25;
    const st = this.sim.state, info = dayInfo(this.sim.day);
    this.h.day.textContent = this.sim.day;
    this.h.clock.textContent = fmtClock(st.clock.minute);
    this.h.cal.textContent = `${info.weekday} ${info.pasaran}`;
    this.h.wx.textContent = `${WEATHER_ICON[st.weather.type]} ${WEATHER_LABEL[st.weather.type]}`;
    this.h.pop.textContent = st.citizens.length;
    this.h.kas.textContent = fmt(st.economy.kas);
    const ev = this.sim.activeEvents().filter((e) => e.type !== 'pasar' || this.sim.hour < 12);
    const banner = this.h.event;
    if (ev.length) { banner.hidden = false; banner.textContent = ev.map((e) => `${e.icon} ${e.label}`).join(' · '); } else banner.hidden = true;
    if (this.app.player?.active) {
      const pl = this.app.player, n = pl.needs.n;
      if (n) {
        for (const [k, , l] of NEEDS) {
          const el = this.h['need_' + k] ||= this.$(`[data-need="${k}"]`);
          const v = Math.round(n[k]);
          el.querySelector('b').style.width = v + '%';
          el.classList.toggle('low', v < 25);
          el.title = `${l} ${v}/100`;
        }
        this.h.mykp.textContent = Math.floor(pl.data.kepeng || 0);
      }
      this.$('.sleep-veil').hidden = !pl.needs.sleeping;
      const nb = this.app.player.nearby, btn = this.$('.act-btn');
      btn.hidden = !nb || pl.needs.sleeping;
      if (nb && btn.textContent !== nb.label) btn.textContent = nb.label;
    }
    // teks kegiatan live
    this.root.querySelectorAll('[data-live-act]').forEach((el) => {
      const c = this.sim.citizen(el.dataset.liveAct);
      if (c) el.textContent = this.npcStatus(c);
    });
  }

  // ------------------------------------------------------------ tap peta
  bindCanvas() {
    const cv = this.app.stage.renderer.domElement;
    let down = null;
    let lookId = null, lx = 0, ly = 0;
    cv.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      if (this.app.player.firstPerson && lookId === null) { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; }
    });
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId) return;
      this.app.player.look(e.clientX - lx, e.clientY - ly);
      lx = e.clientX; ly = e.clientY;
    });
    const endLook = (e) => { if (e.pointerId === lookId) lookId = null; };
    cv.addEventListener('pointerup', endLook);
    cv.addEventListener('pointercancel', endLook);
    cv.addEventListener('pointerup', (e) => {
      if (!down || e.pointerId !== down.id) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const dur = performance.now() - down.t;
      down = null;
      if (moved > 8 || dur > 500) return;
      this.onTap(e.clientX, e.clientY);
    });
    this.app.stage.controls.addEventListener('start', () => { if (this.follow) this.stopFollow(); });
  }

  onTap(x, y) {
    const { camera } = this.app.stage;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (this.build) {
      const p = new THREE.Vector3();
      if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) {
        const { i, j } = worldToCell(p.x, p.z);
        this.build.ci = Math.max(1, Math.min(GRID - 2, i));
        this.build.cj = Math.max(1, Math.min(GRID - 2, j));
        this.updateGhost();
      }
      return;
    }
    const pl = this.app.state.player;
    if (pl) {
      const v = new THREE.Vector3(pl.x, (pl.y || 0) + 0.8, pl.z).project(camera);
      if (v.z < 1 && Math.hypot((v.x * 0.5 + 0.5) * innerWidth - x, (-v.y * 0.5 + 0.5) * innerHeight - y) < 26) { this.open({ kind: 'player' }); return; }
    }
    const veh = this.app.vehicles?.pick(x, y, camera, innerWidth, innerHeight);
    const npc = this.app.npcs.pick(x, y, camera, innerWidth, innerHeight, 26);
    if (veh && !npc) { this.open({ kind: 'vehicle', veh }); return; }
    if (npc) { this.openCitizen(npc.c.id); return; }
    const hits = ray.intersectObjects(this.app.buildings.pickables, false);
    if (hits.length) { this.openBuilding(hits[0].object.userData.buildingId); return; }
    if (this.view && this.view.kind !== 'tab') this.closeSheet();
  }

  // ------------------------------------------------------------ bangun
  buildMenuHTML() {
    const kas = this.sim.state.economy.kas;
    const cards = buildableTypes().map(([k, t]) => `<button class="bcard ${kas < t.cost ? 'off' : ''}" data-pick="${k}">
      <span class="bc-ic">${t.icon}</span><b>${esc(t.label)}</b><span class="coin">${fmt(t.cost)}</span><small>${esc(t.desc)}</small></button>`).join('');
    const free = this.sim.housingFree();
    return `<p class="muted">Kas desa: <span class="coin">${fmt(kas)}</span>. Pilih bangunan, lalu ketuk lokasi di peta. Pintu depan (panah kuning) sebaiknya menghadap jalan.</p>
      <button class="bcard wide" data-invite="1"><span class="bc-ic">👋</span><b>Undang Warga Baru</b><span class="chip">${free > 0 ? `${free} tempat kosong` : 'Rumah penuh'}</span><small>Ajak pendatang tinggal di desa. Butuh rumah dengan tempat kosong.</small></button>
      <div class="bgrid">${cards}</div>`;
  }

  inviteHTML() {
    const free = this.sim.housingFree();
    const opts = Object.entries(PROFESSIONS).filter(([k]) => k !== 'akuwu' && k !== 'tamu').map(([k, p]) => `<option value="${k}">${p.icon} ${esc(p.label)}</option>`).join('');
    return `${free > 0 ? '' : '<p class="warn">Semua rumah penuh. Bangun Rumah Panggung dulu ya!</p>'}
      <label class="field"><span>Nama (opsional)</span><input data-f="name" maxlength="32" placeholder="Kosongkan biar dikasih nama Jawa Kuno" /></label>
      <label class="field"><span>Pakaryan</span><select data-f="prof"><option value="">🎲 Acak (sesuai lowongan)</option>${opts}</select></label>
      <label class="field"><span>Jenis kelamin</span><select data-f="gender"><option value="">🎲 Acak</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></label>
      <div class="btns"><button class="btn primary" data-doinvite="1" ${free > 0 ? '' : 'disabled'}>👋 Undang ke desa</button></div>
      <p class="muted small">Warga baru datang lewat Gapura Lawang Kulon lalu berjalan ke rumahnya.</p>`;
  }

  doInvite() {
    const v = (k) => this.$(`[data-f="${k}"]`)?.value.trim();
    const name = v('name');
    const prof = v('prof') || undefined;
    const c = this.sim.addCitizen({ profession: prof, gender: v('gender') || undefined, name: name ? name.slice(0, 32) : undefined, by: 'kamu' });
    if (!c) return this.toast('Rumah penuh! Bangun Rumah Panggung dulu.', 'bad');
    this.sim.pushNews(`Pendatang baru ${c.name} dari ${c.origin} diundang ke desa.`);
    saveState(this.sim.state);
    this.openCitizen(c.id);
    this.startFollow(c.id);
  }

  startBuild(type) {
    const def = BUILDING_TYPES[type];
    if (this.sim.state.economy.kas < def.cost) return this.toast(`Kas desa kurang. ${def.label} butuh ${def.cost} kepeng.`, 'bad');
    const t = this.app.stage.controls.target;
    const { i, j } = worldToCell(t.x, t.z);
    this.build = { type, ci: i, cj: j, rot: 0 };
    this.closeSheet(true);
    this.root.classList.add('building');
    this.$('.buildbar').hidden = false;
    this.$('.bb-title').innerHTML = `${def.icon} ${esc(def.label)} · <span class="coin">${fmt(def.cost)}</span>`;
    this.updateGhost();
  }
  updateGhost() {
    const b = this.build;
    const res = this.sim.grid.canPlace(b.type, b.ci, b.cj, b.rot);
    b.ok = res.ok;
    this.app.buildings.showGhost(b.type, b.ci, b.cj, b.rot, res.ok);
    this.$('.bb-status').textContent = res.ok ? '✅ Lokasi bagus! Ketuk “Bangun”.' : `⚠️ ${res.reason}. Ketuk tempat lain di peta.`;
    this.$('.bb-status').className = `bb-status ${res.ok ? 'ok' : 'bad'}`;
    this.$('[data-confirm]').disabled = !res.ok;
  }
  rotateBuild() { if (!this.build) return; this.build.rot = (this.build.rot + 1) % 4; this.updateGhost(); }
  cancelBuild() {
    this.build = null;
    this.app.buildings.hideGhost();
    this.$('.buildbar').hidden = true;
    this.root.classList.remove('building');
  }
  confirmBuild() {
    const b = this.build;
    if (!b) return;
    const res = this.sim.addBuilding({ type: b.type, ci: b.ci, cj: b.cj, rot: b.rot, by: 'kamu' });
    if (!res.ok) return this.toast(res.reason, 'bad');
    this.toast(`🎉 ${res.building.name} berdiri! Tercatat di Riwayat Pembangunan.`, 'good');
    this.app.audio?.build();
    saveState(this.sim.state);
    this.cancelBuild();
  }

  // ------------------------------------------------------------ karakter pemain
  toggleWalk() {
    const pl = this.app.player;
    if (pl.active) {
      pl.stop();
      this.root.classList.remove('walking');
      this.$('.walkhud').hidden = true;
      this.$('.fab-walk').innerHTML = '🚶 <span>Jalan-jalan</span>';
      this.updateCamBtn();
      return;
    }
    if (!this.app.state.player) return this.open({ kind: 'profile' });
    this.stopFollow();
    this.closeSheet(true);
    this.cancelBuild();
    pl.start();
    this.root.classList.add('walking');
    this.$('.walkhud').hidden = false;
    this.$('.fab-walk').innerHTML = '✋ <span>Berhenti</span>';
    this.updateCamBtn();
    this.toast(matchMedia('(pointer: fine)').matches ? '🚶 W/S atau ↑↓ untuk jalan, A/D atau ← → putar kamera, Space untuk loncat, E untuk menyapa' : '🚶 Joystick kiri untuk jalan, tombol ⤒ untuk loncat', 'good');
  }

  updateCamBtn() {
    const m = this.app.player.camMode;
    this.$('.cam-btn').textContent = { orbit: '🎥 Atas', chase: '🎥 Belakang', pov: '👁️ Mata' }[m];
  }

  saveProfile() {
    const name = this.$('[data-f="pname"]').value.trim().slice(0, 32);
    const gender = this.$('[data-f="pgender"] .on')?.dataset.val || 'L';
    const skin = +(this.$('[data-f="pskin"] .on')?.dataset.val || 0);
    const kainHex = +(this.$('[data-f="pkain"] .on')?.dataset.val || 0x2f4b7a);
    const wasNew = !this.app.state.player;
    this.app.player.setProfile({ name, gender, skin, kainHex });
    saveState(this.sim.state);
    if (wasNew) { this.toast(`🎉 Selamat datang di desa, ${this.app.state.player.name}!`, 'good'); this.toggleWalk(); }
    else { this.toast('Profil disimpan', 'good'); this.open({ kind: 'player' }); }
  }

  bindJoystick() {
    const base = this.$('.joy'), knob = this.$('.joy-knob');
    let id = null, cx = 0, cy = 0;
    const R = 46;
    const move = (e) => {
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.app.player.joy.x = dx / R; this.app.player.joy.y = -dy / R;
    };
    const end = (e) => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; this.app.player.joy.x = this.app.player.joy.y = 0; };
    base.addEventListener('pointerdown', (e) => {
      id = e.pointerId; base.setPointerCapture(id);
      const r = base.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      move(e); e.preventDefault();
    });
    base.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
  }

  // ------------------------------------------------------------------ slot simpanan
  // Tombol dua ketukan: ketukan pertama minta konfirmasi, ketukan kedua menjalankan
  armed(t, label, fn) {
    if (!t.dataset.armed) { t.dataset.armed = '1'; t.textContent = label; return; }
    fn();
  }

  async openSlots(mode) {
    const v = { kind: 'slots', mode, list: null, busy: false };
    this.open(v, true);
    try { v.list = await listSlots(); } catch { v.list = { slots: [], where: 'lokal' }; }
    if (this.view === v) this.refreshView();
  }

  slotsView(v) {
    if (!v.list) return '<p class="muted">Memuat daftar simpanan…</p>';
    const by = Object.fromEntries(v.list.slots.map((x) => [x.slot, x]));
    const save = v.mode === 'save';
    const rows = [];
    for (let n = 1; n <= MAX_SLOTS; n++) {
      const x = by[n], m = x?.summary || {};
      const info = x
        ? `<b>${esc(x.name)}</b><small>Hari ke-${m.day ?? '?'} · ${m.minute != null ? fmtClock(m.minute) : '--:--'} · ${m.pop ?? '?'} warga · ${fmt(m.kas ?? 0)} kepeng${m.player ? ` · ${esc(m.player)}` : ''}</small><small class="muted">Disimpan ${new Date(x.savedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</small>`
        : '<b class="muted">Slot kosong</b>';
      const btns = save
        ? `<button class="btn sm primary" ${x ? `data-slotsave="${n}"` : `data-slotsave="${n}" data-armed="1"`} ${v.busy ? 'disabled' : ''}>${x ? 'Timpa' : 'Simpan di sini'}</button>`
        : x
          ? `<button class="btn sm primary" data-slotload="${n}" ${v.busy ? 'disabled' : ''}>Muat</button><button class="btn sm danger" data-slotdel="${n}" ${v.busy ? 'disabled' : ''}>Hapus</button>`
          : '';
      rows.push(`<li class="slot"><span class="slot-n">${n}</span><div class="slot-info">${info}</div><div class="slot-btns">${btns}</div></li>`);
    }
    const day = this.sim.day;
    return `${save ? `<label class="slot-name">Nama simpanan<input data-slotname maxlength="40" value="${esc(v.name ?? `Hari ke-${day}`)}"></label>` : '<p class="muted small">Memuat slot mengganti desa yang sedang berjalan. Simpan dulu kalau progres sekarang ingin disimpan.</p>'}
      <ul class="slots">${rows.join('')}</ul>
      <p class="muted small">${v.list.where === 'server' ? '☁️ Tersimpan di server, ikut ID pemainmu di browser ini.' : '📱 Server tidak terjangkau: slot disimpan di perangkat ini saja.'}</p>`;
  }

  async doSaveSlot(n) {
    const v = this.view;
    if (v?.kind !== 'slots' || v.busy) return;
    v.name = (this.$('[data-slotname]')?.value || '').trim() || `Hari ke-${this.sim.day}`;
    v.busy = true; this.refreshView();
    try {
      saveState(this.sim.state); // sekalian perbarui simpanan otomatis
      const where = await saveSlot(n, v.name, JSON.parse(JSON.stringify(this.sim.state)));
      this.toast(`💾 Tersimpan di slot ${n}${where === 'lokal' ? ' (perangkat ini)' : ''}`, 'good');
      v.list = await listSlots();
    } catch {
      this.toast('Gagal menyimpan. Coba lagi.', 'bad');
    }
    v.busy = false;
    if (this.view === v) this.refreshView();
  }

  async doLoadSlot(n) {
    const v = this.view;
    if (v?.kind !== 'slots' || v.busy) return;
    v.busy = true; this.refreshView();
    this.toast(`📂 Memuat slot ${n}…`);
    const ok = await this.app.loadSlot(n).catch(() => false);
    if (!ok) { this.toast('Simpanan tidak ditemukan.', 'bad'); v.busy = false; if (this.view === v) this.refreshView(); }
  }

  async doDeleteSlot(n) {
    const v = this.view;
    if (v?.kind !== 'slots' || v.busy) return;
    v.busy = true; this.refreshView();
    try { await deleteSlot(n); v.list = await listSlots(); this.toast(`🗑️ Slot ${n} dihapus`); } catch { this.toast('Gagal menghapus.', 'bad'); }
    v.busy = false;
    if (this.view === v) this.refreshView();
  }

  exportJSON() {
    const blob = new Blob([exportState(this.sim.state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `desa-majapahit-hari-${this.sim.day}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}

export { resetState };
