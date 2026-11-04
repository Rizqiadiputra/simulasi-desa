# Desa Majapahit

Simulasi hidup sebuah desa era Majapahit (abad ke-14, sekitar Trowulan) dalam 3D low-poly. Peta desa bisa dijelajahi, dihuni warga, dan terus tumbuh. Terinspirasi dari kampungkomen.id.

```bash
npm install
npm run dev      # http://localhost:5173 (juga bisa dibuka dari HP di jaringan yang sama)
npm run build
```

## Fitur
- **Dunia**: kanal bata, sawah berundak, jalan tanah, beringin & kelapa, dan gunung di kejauhan. Semua aset dibuat procedural di kode, tanpa model eksternal.
- **Bangunan** (13 tipe): candi, gapura bentar, gapura paduraksa (mirip Bajang Ratu), petirtaan (mirip Candi Tikus), rumah panggung, kediaman Akuwu, pendopo, lumbung, pasar, pande besi, bengkel terakota, pura, pos Bhayangkara.
- **Siang-malam**: matahari & bulan bergerak, langit gradasi, bintang, kabut pagi, hujan, serta obor & pelita yang menyala di malam hari.
- **Warga**: petani, pedagang, pandai besi, pengrajin terakota, prajurit Bhayangkara (shift siang/malam), pendeta, anak-anak, dan Pak Akuwu. Tiap warga punya jadwal harian dan berjalan lewat pathfinding A* di grid jalan.
- **Simulasi**:
  - Mata uang kepeng, stok beras, kelapa, gerabah, dan alat besi, dengan harga dinamis.
  - Padi tumbuh lalu dipanen kira-kira tiap 8 hari.
  - Musim Rendheng (hujan) dan Ketiga (kemarau).
  - Kalender Jawa Kuno (saptawara + pancawara).
  - Acara: Upacara Purnama, Pasar Umanis, Pesta Panen, dan Festival Caitra.
  - Desa tumbuh sendiri: pendatang baru, bayi lahir, dan Pak Akuwu membangun rumah, sawah, atau lumbung.
- **UI**:
  - Header dengan hari, jam, kalender, cuaca, jumlah warga, dan kas.
  - Tab Peta | Pengumuman | Riwayat | Warga.
  - Prasasti Warga, panel info bangunan, chat dengan warga, mode Bangun, dan Undang Warga.
- **Waktu**: mengikuti jam asli perangkat (1 hari desa = 1 hari nyata, jam 20.00 di HP = 20.00 di desa). Waktu tetap berjalan saat aplikasi ditutup (maksimal 30 hari dikejar). Mode cepat bisa dinyalakan lagi lewat `TIME_MODE = 'fast'` di `src/data/config.js`.
- **Karakter pemain & ngobrol**:
  - Buat profil, lalu jalan-jalan dengan W/S atau ↑↓ (atau joystick). A/D atau ← → memutar kamera, Space untuk loncat, C untuk ganti kamera (Atas / Belakang / Mata).
  - Dekati warga lalu tekan E (atau tombol 💬 di Prasasti) untuk ngobrol bebas lewat chat.
- **Kuda & kereta kencana**:
  - Istal Kuda berisi 3 kuda yang merumput dan berkeliaran. Desa lama otomatis dibangunkan satu istal oleh Pak Akuwu, dan istal juga bisa dibangun lewat menu Bangun.
  - Kereta Kencana Jatayu keliling desa jam 07.00–17.00, lalu parkir di istal saat malam.
  - Dekati kuda atau kereta lalu tekan E untuk naik. Tekan E lagi untuk turun.

## Struktur
```
src/
  core/        rng, emitter, util
  data/        config, buildingTypes, names, initialState, store (localStorage)
  simulation/  grid, clock (kalender), schedule, economy, weather, events, sim (orkestrator)
  scene/       stage (renderer+kamera), terrain, vegetation, sky (day/night), torches
  buildings/   builder (merge geometry), models (procedural), manager
  npc/         pathfinding (A*), model (InstancedMesh), manager (perilaku)
  ui/          ui (header/tab/sheet/build), panels (isi panel)
  player/      karakter pemain, fisika & tabrakan
  chat/        persona warga, otak lokal, layanan chat
  vehicles/    kuda & kereta kencana (model + perilaku)
worker/        Cloudflare Worker: /api/save (Postgres/Supabase) + /api/chat (Claude)
```
`simulation/` dan `data/` tidak bergantung pada three.js, jadi bisa dijalankan di server/Node.

## Ngobrol dengan warga (Claude, opsional)
Tanpa konfigurasi apa pun, warga menjawab memakai **otak lokal**: jawaban berbasis kata kunci yang tahu nama, pekerjaan, keluarga, kegiatan, cuaca, harga pasar, acara, dan sejarah Majapahit.

Supaya obrolan bebas seperti manusia, isi API key Claude:

```bash
cp worker/.dev.vars.example worker/.dev.vars   # lalu isi ANTHROPIC_API_KEY=...
cd worker && npm run dev                       # Worker di :8787 (terminal 1)
npm run dev                                    # game di :5173 (terminal 2)
```

- Endpoint `POST /api/chat` ada di Cloudflare Worker (`worker/src/chat.js`), memanggil model `claude-opus-5-5` dengan effort `low`, plus fallback server-side otomatis kalau permintaan ditolak.
- Key disimpan sebagai secret Worker (`npx wrangler secret put ANTHROPIC_API_KEY`), tidak pernah dikirim ke browser.
- Pengaman biaya: batas 8 pesan/menit per IP, kuota harian per IP dan global (`CHAT_DAILY_PER_IP`, `CHAT_DAILY_GLOBAL` di `worker/wrangler.jsonc`).
- Persona tiap warga dirakit dari state desa (`src/chat/brain.js`).
- Kalau key tidak ada, kuota habis, atau API gagal, otomatis kembali ke otak lokal.

## State & integrasi backend
Seluruh desa adalah satu objek JSON (`desa.state`): `clock`, `economy`, `weather`, `roads`, `water`, `trees`, `buildings`, `citizens`, `history`, `announcements`. Untuk menyambungkan ke backend (mis. warga baru dari komentar/follower media sosial):

```js
desa.api.addCitizen({ name: 'Ki Komentator', profession: 'petani' }); // muncul dari gapura
desa.api.addBuilding({ type: 'rumah', ci: 10, cj: 38, rot: 2 });
desa.api.exportState();
```

## Performa (mobile)
- Satu draw call per bangunan (geometry di-merge, vertex color).
- Pohon, jalan, padi, air, obor, dan warga memakai `InstancedMesh`.
- Pixel ratio dibatasi.
- Kualitas adaptif: kalau FPS < 45, resolusi diturunkan, lalu bayangan dimatikan.

Debug di console: `desa.sim.clock.advance(60)` memajukan 1 jam desa. Di mode realtime, jam akan kembali menyesuaikan jam asli.
# simulasi-desa
