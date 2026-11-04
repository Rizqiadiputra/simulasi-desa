// Nama-nama bernuansa Jawa Kuno (rekaan, diramu dari unsur nama era Singhasari–Majapahit).
import { pick } from '../core/rng.js';

const L1 = ['Kebo', 'Lembu', 'Mahisa', 'Gajah', 'Jaran', 'Banyak', 'Gagak', 'Kuda', 'Wira', 'Arya', 'Sura', 'Bhima', 'Rangga', 'Taji', 'Macan', 'Panji', 'Jaya', 'Dhana'];
const L2 = ['Anabrang', 'Wungu', 'Ijo', 'Pangun', 'Bungalan', 'Teki', 'Wagal', 'Lembang', 'Kuning', 'Legawa', 'Seta', 'Abang', 'Rawa', 'Kenongo', 'Sempu', 'Wulung', 'Mundarang', 'Lodra', 'Pamungkas', 'Jati'];
const P1 = ['Sekar', 'Rara', 'Mayang', 'Tunjung', 'Wulan', 'Pudak', 'Kenanga', 'Sasi', 'Gendhis', 'Sri', 'Ratna', 'Nawang', 'Puspa', 'Candra', 'Andong', 'Gadung'];
const P2 = ['Arum', 'Sari', 'Kencana', 'Wangi', 'Pertiwi', 'Lestari', 'Ayu', 'Mulya', 'Rukmi', 'Sasih', 'Melati', 'Manik', 'Sekar', 'Jenar'];
const KID = ['Gendut', 'Bagus', 'Kancil', 'Tole', 'Gentho', 'Kliwon', 'Wuluh', 'Jambu', 'Kemuning', 'Cempluk', 'Ireng', 'Kunir', 'Pethak', 'Kecik'];

export const ORIGINS = ['Kahuripan', 'Daha', 'Tumapel', 'Wengker', 'Matahun', 'Lasem', 'Pajang', 'Kembang Jenar', 'Paguhan', 'Keling', 'Jagaraga', 'Kabalan', 'Tuban', 'Canggu'];
export const HOBBIES = ['Nembang kidung', 'Menabuh gamelan', 'Mendongeng cerita Panji', 'Memancing di kanal', 'Mengukir kayu', 'Menenun kain', 'Memelihara ayam jago', 'Main macanan', 'Menyabit rumput', 'Bikin layang-layang', 'Menghafal kakawin', 'Merangkai janur', 'Mengamati bintang'];

export function makeName({ gender, profession, age }, r = Math.random) {
  if (profession === 'anak' || age < 13) return `Si ${pick(KID, r)}`;
  if (gender === 'P') {
    const first = pick(P1, r);
    let second = pick(P2, r);
    if (second === first) second = 'Ayu';
    return `${profession === 'pendeta' ? 'Bhiksuni' : 'Nyi'} ${first} ${second}`;
  }
  const n = `${pick(L1, r)} ${pick(L2, r)}`;
  switch (profession) {
    case 'pendeta': return `Dang Acarya ${pick(L2, r)}`;
    case 'pandai_besi': return `Mpu ${n}`;
    case 'prajurit': return `Bhayangkara ${n}`;
    default: return `Ki ${n}`;
  }
}

export const AKUWU_LINES = [
  'Bhinneka tunggal ika, tan hana dharma mangrwa. Beda-beda asalnya, tetap satu desa kita.',
  'Kalau hujan, jangan lupa pakai caping. Kalau panas, apalagi.',
  'Saluran kanal itu nadi desa. Jangan buang sampah ke sana, ya!',
  'Kas desa itu milik bersama. Tiap kepeng saya catat di lontar.',
  'Hidup itu kayak sawah berundak: naiknya pelan-pelan, tapi pasti.',
  'Bhayangkara kita jaga siang malam. Kalian tidur saja yang nyenyak.',
  'Gerabah terakota kita sampai dibeli saudagar dari Canggu, lho!',
  'Kalau ada pendatang, sambut dengan ramah. Dulu kita juga pendatang.',
  'Sudah setor hasil panen ke lumbung? Jangan sampai paceklik.',
  'Rajin-rajinlah ke petirtaan. Badan bersih, pikiran jernih.',
];
