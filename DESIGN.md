# DESIGN.md: WFC Hunters

Arah desain untuk semua UI di repo ini. antislop (`.claude/skills/antislop*`) adalah filternya; file ini sumber arahnya.

Dial: ENERGY 2 / RHYTHM 3 / MOTION 2

## Identitas

- **Produk:** WFC Hunters (nama teknis di kode: WorkFromCafe). Kurasi kafe yang nyaman untuk kerja di kota-kota besar Pulau Jawa, ditulis oleh pemilik dan para author yang benar-benar datang ke kafenya.
- **Pembaca:** pekerja remote, freelancer, dan mahasiswa yang butuh colokan, wifi stabil, dan tempat duduk yang enak. Sebagian besar membuka dari HP.
- **Kepribadian:** teman yang sudah mencoba duluan. Hangat, jujur soal kekurangan kafe, tidak menjual.
- **Logo:** gambar `public/logo.png` (WFC HUNTERS, cokelat di atas transparan). Jangan dibuat ulang atau diganti tanpa diminta.

## Warna (didefinisikan di `src/app/globals.css`)

| Token | Nilai | Alasan |
|---|---|---|
| `brand` | `#6b4226` | Cokelat kopi: warna utama, tombol aksi, bidang gelap. |
| `ink` | `#1f1612` | Teks utama dan bidang paling gelap; hampir hitam dengan rona kopi. |
| `canvas` | `#f6f2ee` | Latar krem susu; terang supaya foto kafe yang jadi pusat perhatian. |
| `tan` | `#d19f7d` | Teks sekunder di atas bidang gelap. |
| `gold` | `#e0a045` | Satu-satunya aksen: rating, level author, label "Segera". Jangan dipakai sebagai dekorasi umum. |
| `ok` | `#3e8e5e` | Status positif (gratis, buka sekarang). Hanya penanda status. |

Palet inti: brand + ink + canvas, aksen gold. Hijau WhatsApp hanya di tombol komunitas karena itu warna layanan tujuannya.

## Tipografi

- **Plus Jakarta Sans** (self-hosted, variabel). Alasan: dirancang untuk Jakarta, bentuknya ramah dan agak membulat, pas dengan suasana kafe, tetap jelas di ukuran kecil HP.
- Judul besar tebal (800) dengan tracking rapat; teks isi 400–500.
- Hindari label huruf kapital dengan tracking lebar sebagai hiasan. Pakai kalimat biasa.

## Motif identitas

- **Kartu kafe yang bisa digeser.** Deret kafe terbaru tampil sebagai kartu yang digeser ke samping, seperti membalik-balik foto kafe di galeri HP. Section tidak saling menimpa.
- **Foto kafe asli** sebagai visual utama. Tidak ada ilustrasi stok.

## Komposisi

- Beranda: hero foto, grid kafe pilihan, deret geser "Baru ditambahkan", lalu kartu ajakan: author bulan ini lebar penuh, komunitas dan peta berdampingan. Kotak kontak hanya di /kontak.
- Radius: kartu 1.5–2rem, foto `--radius-photo`, tombol bulat penuh. Input tetap kotak membulat kecil (bukan pil).
- Bayangan hanya untuk kolom pencarian di hero (elemen yang paling penting untuk diisi). Kartu lain cukup border tipis.

## Gerak (MOTION 2)

- GSAP + ScrollTrigger, hanya di beranda.
- Hero: judul muncul sekali saat halaman dibuka; foto bergerak lebih lambat dari teks saat scroll (memberi kedalaman ke foto kafe).
- Deret "Baru ditambahkan": kartu masuk berurutan dari kanan saat pertama terlihat, lalu deret mengintip ke kanan sekali sebagai tanda bisa digeser.
- Tidak ada animasi berulang tanpa henti. `prefers-reduced-motion: reduce` mematikan semua animasi scroll.

## Tema

Terang saja. Alasan: foto kafe dan warna kopi paling terbaca di latar krem, dan produk dibuka siang hari di kafe. Tidak ada toggle gelap untuk saat ini.

## Bahasa

Bahasa Indonesia santai, kalimat pendek, sudut pandang "aku" untuk pemilik. Tanpa em dash, tanpa kata promosi kosong, tanpa angka yang tidak berasal dari database.
