# TODO – Desa Budaya

Dicatat 2026-11-04. Belum dikerjakan.

## 1. Visualisasi tombol panah di layar
- Tampilkan ikon tombol panah (atas, bawah, kiri, kanan) di layar.
- Tombol yang sedang ditekan menyala merah, misalnya tekan ↑ maka panah atas jadi merah (seperti indikator kontrol di game open-world ala GTA).

## 2. ✅ Audio — selesai 2026-11-05 (prosedural, Web Audio API)
- Musik latar (background music).
- Efek suara (sound effect): langkah kaki, suara lingkungan, klik UI, dan lain-lain.

## 3. Wajah karakter (warga dan pemain)
- Mata, hidung, mulut, telinga, alis, rambut, dan detail wajah lainnya.

## 4. Riset tata kota Majapahit
- Riset tata kota Majapahit dari naskah kuno (mis. Nagarakretagama/Desawarnana) dan temuan arkeologi Trowulan.
- Terapkan hasilnya ke tata letak desa: jalan, alun-alun, bangunan, pembagian wilayah.

## 5. ✅ Simpan & muat game (save / load) — selesai 2026-11-05
- Ada riwayat simpanan (beberapa slot save).
- Pemain bebas memilih kapan menyimpan.
- Di menu Setting ada pilihan: **Simpan Game**, **Muat Game**, **Mulai dari Awal**.

---

## Ide tambahan (dicatat 2026-11-04)

Prioritas yang disarankan: **6 (misi)**, **12 (kontrol HP)**, **7 (hubungan warga)**.

### Gameplay
6. **Misi / tujuan pemain**: tugas kecil dari warga (antar padi ke lumbung, cari kerbau hilang, bantu bangun pendapa); hadiah berupa kepeng (uang Majapahit) atau reputasi.
7. **Hubungan dengan warga**: warga ingat obrolan dan bantuan pemain; makin sering dibantu makin ramah, kalau diabaikan jadi cuek. Terhubung dengan sistem chat.
8. **Peristiwa dan festival**: hari pasar, upacara di candi, panen raya, banjir saat musim hujan (pakai `simulation/events.js` dan `simulation/weather.js`).

### Nuansa Majapahit
9. **Ensiklopedia kecil**: klik bangunan/benda (candi, gapura, sawah, sumur) untuk penjelasan sejarah singkat. Pasangkan dengan riset tata kota (poin 4).
10. **Pakaian dan profesi yang terlihat**: petani, pande besi, pedagang, brahmana, prajurit punya pakaian dan alat sendiri. Kerjakan bersamaan dengan wajah karakter (poin 3).
11. **Bahasa**: pilihan Bahasa Indonesia / Inggris, plus sapaan Jawa Kuno sesekali dari warga.

### Kenyamanan bermain
12. **Kontrol HP**: joystick sentuh di layar; sekaligus jadi indikator tombol panah merah (poin 1).
13. **Mode foto**: kamera bebas tanpa UI untuk screenshot.
14. **Pengaturan grafis**: rendah / sedang / tinggi supaya lancar di perangkat yang kurang kuat.

### Teknis
15. ✅ **Obrolan Claude online lewat Cloudflare Worker** (selesai 2026-11-05; aktif setelah `wrangler secret put ANTHROPIC_API_KEY`): API key disimpan di Worker, beri batas pemakaian supaya biaya aman.
16. **Statistik pengunjung**: Cloudflare Web Analytics (gratis, tanpa cookie).

### Eksperimen (menunggu langganan API)
17. **Aset 3D dari Tripo AI** (https://developers.tripo3d.ai/en) — *jangan dikerjakan dulu, API belum berlangganan.*
    - Generate saat development saja, simpan GLB di repo (mis. `public/models/`), muat dengan `GLTFLoader`. Jangan panggil API Tripo dari browser pemain.
    - Mulai dari aset utama yang sedikit jumlahnya: candi, gapura bentar, pendapa. Rumah warga, pohon, dan warga tetap dibuat lewat kode supaya ringan.
    - Pakai image-to-3D dengan referensi relief/rekonstruksi Trowulan supaya akurat secara sejarah.
    - Kalau hasilnya bagus, coba satu karakter pemain yang di-rig + animasi (bisa membantu poin 3 dan 10).
    - Sebelum dipakai: cek Terms of Service untuk hak pakai komersial, dan jaga gaya visual tetap seragam dengan model buatan kode.
    - Perkiraan biaya: ~$0.10–0.30 per model, ~$0.25 untuk auto rig.
