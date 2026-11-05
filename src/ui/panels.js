// Isi panel (HTML string). Semua teks data di-escape.
import { esc, fmt, fmtClock } from '../core/util.js';
import { BUILDING_TYPES, PROFESSIONS } from '../data/buildingTypes.js';
import { GOODS, storageCap, population } from '../simulation/economy.js';
import { cropStage, CROP_DAYS } from '../simulation/sim.js';
import { nextEvents } from '../simulation/events.js';
import { dayInfo, SEASON_LABEL } from '../simulation/clock.js';

const coin = (n) => `<span class="coin">${fmt(n)}</span>`;
const genderLabel = (g) => (g === 'L' ? 'Laki-laki' : 'Perempuan');

export function citizenRow(c, status) {
  const p = PROFESSIONS[c.profession];
  return `<button class="row" data-citizen="${esc(c.id)}">
    <span class="row-ic">${p.icon}</span>
    <span class="row-main"><b>${esc(c.name)}</b><small>${esc(p.label)} · ${c.age} th</small>${status ? `<em data-live-act="${esc(c.id)}">${esc(status)}</em>` : ''}</span>
    <span class="row-go">›</span></button>`;
}

export function buildingInfo(sim, b, npcStatus) {
  const st = sim.state, def = BUILDING_TYPES[b.type];
  const residents = st.citizens.filter((c) => c.homeId === b.id);
  const workers = st.citizens.filter((c) => c.workId === b.id);
  const builtBy = b.by === 'leluhur' ? 'Warisan leluhur' : `Hari ke-${b.builtDay}${b.by === 'kamu' ? ' · dibangun olehmu' : b.by === 'akuwu' ? ' · titah Pak Akuwu' : ''}`;
  let extra = '';
  if (b.type === 'sawah') {
    const p = b.crop?.progress || 0, stg = cropStage(p);
    const left = Math.max(0, (1 - p) * CROP_DAYS).toFixed(1);
    extra += `<div class="stat-card"><div class="lbl">Tanaman padi</div><div class="big">${esc(stg.label)}</div>
      <div class="bar"><i style="width:${Math.round(p * 100)}%"></i></div><small>${p >= 1 ? 'Menunggu petani memanen' : `± ${left} hari lagi panen`}${b.crop?.lastHarvest ? ` · panen terakhir hari ke-${b.crop.lastHarvest}` : ''}</small></div>`;
  }
  if (b.type === 'lumbung') {
    const cap = storageCap(st);
    extra += `<div class="stat-card"><div class="lbl">Isi semua lumbung desa</div><div class="big">${fmt(st.economy.stock.beras)} / ${fmt(cap)} bakul</div><div class="bar"><i style="width:${Math.min(100, (st.economy.stock.beras / cap) * 100)}%"></i></div></div>`;
  }
  if (b.type === 'pasar') extra += marketTable(st);
  if (b.type === 'candi' || b.type === 'pendopo') {
    const ev = nextEvents(st, sim.day, 3).filter((e) => e.place === (b.type === 'candi' ? 'candi' : 'pendopo'));
    if (ev.length) extra += `<div class="stat-card"><div class="lbl">Acara berikutnya di sini</div>${ev.map((e) => `<div>${e.icon} ${esc(e.label)} — hari ke-${e.day}, jam ${String(e.from).padStart(2, '0')}.00</div>`).join('')}</div>`;
  }
  const people = (title, list) => list.length ? `<h4>${title} (${list.length})</h4><div class="rows">${list.map((c) => citizenRow(c, npcStatus(c))).join('')}</div>` : '';
  const cap = def.capacity ? `<span class="chip">🏠 ${residents.length}/${def.capacity} penghuni</span>` : '';
  const jobs = def.jobs ? Object.entries(def.jobs).map(([p, n]) => `<span class="chip">${PROFESSIONS[p].icon} ${workers.filter((c) => c.profession === p).length}/${n} ${esc(PROFESSIONS[p].label)}</span>`).join('') : '';
  return `<div class="b-head"><div class="b-ic">${def.icon}</div><div><div class="b-type">${esc(def.label)}</div><h2>${esc(b.name)}</h2><small>${esc(builtBy)}</small></div></div>
    <p class="desc">${esc(def.desc)}</p>
    <div class="chips">${cap}${jobs}</div>
    ${extra}
    ${people('Penghuni', residents)}
    ${people('Pekerja', workers)}
    ${!residents.length && !workers.length && !def.capacity && !def.jobs ? '<p class="muted">Bangunan umum, terbuka untuk semua warga.</p>' : ''}`;
}

export function marketTable(st) {
  const e = st.economy;
  return `<div class="stat-card"><div class="lbl">Harga & stok desa</div><table class="tbl">
    ${Object.entries(GOODS).map(([k, g]) => `<tr><td>${g.icon} ${g.label}</td><td>${fmt(e.stock[k])} ${g.unit}</td><td>${coin(e.prices[k])}</td></tr>`).join('')}
  </table></div>`;
}

export function prasasti(sim, c, statusText, opt = {}) {
  const st = sim.state, p = PROFESSIONS[c.profession];
  const home = sim.building(c.homeId), work = sim.building(c.workId);
  const no = String(c.id.replace(/\D/g, '')).padStart(4, '0');
  return `<div class="prasasti">
    <div class="pr-top"><span>ꦥꦿꦱꦱ꧀ꦠꦶ</span><b>PRASASTI WARGA</b><span>No. ${no}</span></div>
    <div class="pr-body">
      <div class="pr-ava" data-prof="${esc(c.profession)}">${p.icon}</div>
      <div class="pr-fields">
        <div class="pr-name">${esc(c.name)}</div>
        <dl>
          <dt>Pakaryan</dt><dd>${esc(p.label)}</dd>
          <dt>Umur</dt><dd>${c.age} tahun · ${genderLabel(c.gender)}</dd>
          <dt>Asal</dt><dd>${esc(c.origin)}</dd>
          <dt>Tinggal di</dt><dd>${home ? `<a data-building="${esc(home.id)}">${esc(home.name)}</a>` : '—'}</dd>
          <dt>Bekerja di</dt><dd>${work ? `<a data-building="${esc(work.id)}">${esc(work.name)}</a>` : c.profession === 'anak' ? 'Masih belajar & bermain' : 'Belum ada'}</dd>
          <dt>Kegemaran</dt><dd>${esc(c.hobby)}</dd>
          <dt>Kepeng</dt><dd>${coin(c.kepeng)}</dd>
        </dl>
      </div>
    </div>
    <div class="pr-now"><small>Kegiatan sekarang</small><div data-live-act="${esc(c.id)}">${esc(statusText)}</div></div>
    <div class="pr-foot">Warga sejak hari ke-${c.sinceDay} · Desa Budaya, Trowulan</div>
  </div>
  <div class="btns">
    ${opt.player ? `<button class="btn" data-profile="1">✏️ Ubah profil</button><button class="btn primary" data-walk="1">🚶 Jalan-jalan</button>` : `<button class="btn" data-follow="${esc(c.id)}">📍 Ikuti di peta</button>`}
    ${opt.player ? '' : `<button class="btn primary" data-chat="${esc(c.id)}">💬 Ngobrol</button>`}
  </div>`;
}

export function announcementsView(sim) {
  const st = sim.state;
  const akuwu = st.citizens.find((c) => c.profession === 'akuwu');
  const ev = nextEvents(st, sim.day, 4);
  const info = dayInfo(sim.day);
  const pop = population(st);
  return `<div class="akuwu-card">
      <div class="ak-ava">👑</div>
      <div><b>${esc(akuwu?.name || 'Pak Akuwu')}</b><small>Kepala desa · rajin bikin pengumuman tiap pagi</small></div>
      <button class="btn primary sm" data-talk="1">💬 Bicara</button>
    </div>
    <div class="grid2">
      <div class="stat-card"><div class="lbl">Kas desa</div><div class="big">${coin(st.economy.kas)}</div><small>${pop.total} warga · ${pop.kids} anak</small></div>
      <div class="stat-card"><div class="lbl">Musim</div><div class="big sm">${esc(SEASON_LABEL[info.season])}</div><small>Tahun Saka ${info.year}</small></div>
    </div>
    ${marketTable(st)}
    ${ev.length ? `<h4>Acara mendatang</h4><div class="events">${ev.map((e) => `<div class="ev"><span>${e.icon}</span><div><b>${esc(e.label)}</b><small>Hari ke-${e.day} (${esc(dayInfo(e.day).weekday)} ${esc(dayInfo(e.day).pasaran)}) · jam ${String(Math.floor(e.from)).padStart(2, '0')}.00 di ${esc(e.place)}</small></div></div>`).join('')}</div>` : ''}
    <h4>Pengumuman Pak Akuwu</h4>
    ${st.announcements.length ? st.announcements.map((a, k) => `<article class="ann ${k === 0 ? 'new' : ''}"><header>📜 ${esc(a.title)}</header>${a.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</article>`).join('') : '<p class="muted">Belum ada pengumuman. Tunggu jam 06.00 ya.</p>'}`;
}

const BY_LABEL = { kamu: 'Dibangun olehmu', akuwu: 'Titah Pak Akuwu', leluhur: 'Warisan leluhur', api: 'Dari warga dunia maya' };
export function historyView(sim) {
  const h = [...sim.state.history].reverse();
  return `<p class="muted">Catatan pembangunan desa, yang terbaru di atas. Ketuk untuk melihat di peta.</p>
  <ol class="timeline">${h.map((e) => `<li ${e.buildingId ? `data-building="${esc(e.buildingId)}" data-fly="1"` : ''}>
    <span class="tl-ic">${BUILDING_TYPES[e.type]?.icon || '🏘️'}</span>
    <div><b>${esc(e.text)}</b><small>Hari ke-${e.day} · ${fmtClock(e.minute)} · ${esc(BY_LABEL[e.by] || '')}</small></div></li>`).join('')}</ol>`;
}

export function citizensView(sim, filter, query, npcStatus) {
  const st = sim.state;
  const q = (query || '').toLowerCase();
  const list = st.citizens.filter((c) => (filter === 'semua' || c.profession === filter) && (!q || c.name.toLowerCase().includes(q)));
  const counts = {};
  for (const c of st.citizens) counts[c.profession] = (counts[c.profession] || 0) + 1;
  const chips = ['semua', ...Object.keys(PROFESSIONS).filter((p) => counts[p])].map((p) =>
    `<button class="fchip ${filter === p ? 'on' : ''}" data-filter="${p}">${p === 'semua' ? `Semua ${st.citizens.length}` : `${PROFESSIONS[p].icon} ${counts[p]}`}</button>`).join('');
  return `<div class="searchbar"><input type="search" placeholder="Cari nama warga…" value="${esc(query || '')}" data-search="1" /><button class="btn primary sm" data-invite="1">➕ Undang</button></div>
    <div class="fchips">${chips}</div>
    <div class="rows">${list.map((c) => citizenRow(c, npcStatus(c))).join('') || '<p class="muted">Tidak ada warga yang cocok.</p>'}</div>`;
}

const SKINS = ['#9c6a46', '#8a5a3a', '#a87650', '#7d5034'];
const KAINS = [[0x2f4b7a, 'Nila'], [0x8e2a22, 'Mengkudu'], [0x6b4a32, 'Soga'], [0x5f7a3a, 'Daun'], [0xd4a43a, 'Kunyit'], [0x3a3a3a, 'Arang']];
export function profileForm(p) {
  const g = p?.gender || 'L', sk = p?.look?.skin ?? 0, kn = p?.look?.kainHex ?? KAINS[0][0];
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  return `<p class="muted">Ini karaktermu di desa. Setelah disimpan, kamu bisa jalan-jalan keliling, masuk ke pasar, dan menyapa warga.</p>
    <label class="field"><span>Nama</span><input data-f="pname" maxlength="32" value="${esc(p?.name || '')}" placeholder="mis. Ki Putra / Nyi Sekar" /></label>
    <div class="field"><span>Jenis kelamin</span><div class="seg" data-f="pgender">
      <button data-swatch="1" data-val="L" class="${g === 'L' ? 'on' : ''}">👨 Laki-laki</button><button data-swatch="1" data-val="P" class="${g === 'P' ? 'on' : ''}">👩 Perempuan</button></div></div>
    <div class="field"><span>Warna kulit</span><div class="swatches" data-f="pskin">${SKINS.map((c, k) => `<button data-swatch="1" data-val="${k}" class="${sk === k ? 'on' : ''}" style="background:${c}" aria-label="Kulit ${k + 1}"></button>`).join('')}</div></div>
    <div class="field"><span>Warna kain</span><div class="swatches" data-f="pkain">${KAINS.map(([c, n]) => `<button data-swatch="1" data-val="${c}" class="${kn === c ? 'on' : ''}" style="background:${hex(c)}" title="${n}" aria-label="${n}"></button>`).join('')}</div></div>
    <div class="btns"><button class="btn primary" data-saveprofile="1">${p ? '💾 Simpan' : '🚶 Simpan & mulai jalan'}</button></div>`;
}

export function chatView(c, log, status, mode, busy, suggestions) {
  const p = PROFESSIONS[c.profession];
  return `<div class="chat-head"><span class="row-ic">${p.icon}</span><div><b>${esc(c.name)}</b><small data-live-act="${esc(c.id)}">${esc(status)}</small></div>
      <button class="btn sm" data-citizen="${esc(c.id)}">📜 Prasasti</button></div>
    <div class="chat-mode">${mode === 'claude' ? '🤖 Dijawab Claude' : mode === 'lokal' ? '🧠 Otak lokal (tanpa internet)' : '…'}</div>
    <div class="chat-log">${chatLogHTML(c, log, busy)}</div>
    <div class="chat-sugg">${suggestions.map((t) => `<button class="fchip" data-sugg="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <div class="chat-input"><input data-chatinput="1" maxlength="300" placeholder="Ketik pesan untuk ${esc(c.name.split(' ').slice(-1)[0])}…" autocomplete="off" enterkeyhint="send" /><button class="btn primary" data-send="1" aria-label="Kirim">➤</button></div>`;
}

export function chatLogHTML(c, log, busy) {
  const p = PROFESSIONS[c.profession];
  const rows = log.map((m) => m.from === 'me'
    ? `<div class="msg me"><div class="bub">${esc(m.text)}</div></div>`
    : `<div class="msg npc"><span class="mava">${p.icon}</span><div class="bub">${esc(m.text)}<small>${fmtClock(m.minute)}${m.src === 'claude' ? ' · 🤖' : ''}</small></div></div>`).join('');
  return rows + (busy ? `<div class="msg npc"><span class="mava">${p.icon}</span><div class="bub typing"><i></i><i></i><i></i></div></div>` : '');
}
