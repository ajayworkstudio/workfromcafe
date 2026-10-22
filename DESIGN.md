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
| `espresso` | `#160f0c` | Latar gelap hero kaca di beranda. |
| `foam` | `#fff7f0` | Teks dan pil terang di atas latar espresso / kaca gelap. |

Palet inti: brand + ink + canvas, aksen gold. Hijau WhatsApp hanya di tombol komunitas karena itu warna layanan tujuannya.

## Kaca (glass)

- Kaca hanya dipakai di atas foto kafe atau latar espresso, tempat blur benar-benar terlihat: hero beranda, tombol di atas foto kafe, label kondisi live, navbar bawah HP. Isi panjang (penilaian, ulasan, komentar) tetap di lembar krem terang supaya nyaman dibaca.
- Utilitas `glass` (kaca terang tipis) dan `glass-dark` (kaca gelap pekat) di `globals.css`. Keduanya jadi bidang pekat kalau browser tidak mendukung blur atau pengguna meminta transparansi dikurangi.
- Hero beranda adalah kartu gelap membulat (bukan pita lebar penuh) supaya tidak menempel kaku dengan header terang.

## Tipografi

- **Plus Jakarta Sans** (self-hosted, variabel). Alasan: dirancang untuk Jakarta, bentuknya ramah dan agak membulat, pas dengan suasana kafe, tetap jelas di ukuran kecil HP.
- Judul besar tebal (800) dengan tracking rapat; teks isi 400–500.
- Hindari label huruf kapital dengan tracking lebar sebagai hiasan. Pakai kalimat biasa.

## Motif identitas

- **Tumpukan kartu yang diseret (gaya Tinder).** Kafe terbaru tampil sebagai tumpukan kartu foto; seret ke kiri/kanan untuk lanjut, ketuk untuk buka. Tumpukan berputar terus: setelah kafe terakhir, kafe pertama kembali dari belakang. Geser tidak berarti suka/tidak suka. Section halaman tidak saling menimpa.
- **Foto kafe asli** sebagai visual utama. Tidak ada ilustrasi stok.

## Komposisi

- Beranda: hero foto, grid kafe pilihan, tumpukan kartu "Baru ditambahkan", lalu kartu ajakan: author bulan ini lebar penuh, komunitas dan peta berdampingan. Kotak kontak hanya di /kontak.
- HP: navigasi bawah berupa pil gelap mengambang; menu aktif melebar jadi pil terang berisi ikon + nama. Beranda: judul, kolom cari dengan tombol cari bulat, dua jalan pintas kaca (Kafe terdekat ke peta, Semua kafe), lalu baris kondisi live; pilihan kota dan suasana ada di Jelajah, bukan di beranda. Detail kafe HP: foto selebar layar dengan tombol bulat (kembali, bagikan, simpan), lembar isi membulat yang menimpa tepi bawah foto, dan tab pil yang menempel untuk melompat antarbagian.
- Peta: ubin OSM dipucatkan & dihangatkan lewat CSS supaya pin menonjol. Chip saring di atas, tombol bulat (daftar, lokasi saya) dan kartu kafe yang digeser di bawah; peta terbang ke kafe di kartu tengah. Pin cokelat, hijau = dilaporkan sepi, emas = dipilih. Lokasi saya memakai titik emas dengan garis putus-putus ke kafe terpilih (jarak garis lurus, bukan rute; rute dibuka di Google Maps).
- Radius: kartu 1.5–2rem, foto `--radius-photo`, tombol bulat penuh. Input tetap kotak membulat kecil (bukan pil).
- Bayangan hanya untuk kolom pencarian di hero (elemen yang paling penting untuk diisi) dan elemen yang mengambang di atas peta (perlu terpisah dari ubin peta). Kartu lain cukup border tipis.

## Gerak (MOTION 2)

- GSAP + ScrollTrigger, hanya di beranda.
- Hero: judul muncul sekali saat halaman dibuka; foto bergerak lebih lambat dari teks saat scroll (memberi kedalaman ke foto kafe).
- "Baru ditambahkan" di beranda: panel melebar (CafeShowcase). Irisan foto bertumpuk ke bawah di HP dan berjajar ke samping di layar lebar; satu panel terbuka dengan info lengkap, berganti sendiri tiap 5 detik (garis waktu emas di bawah panel, tanpa tombol putar). Berhenti saat disentuh/diarahkan; tinggi total tetap supaya halaman tidak bergeser. Tumpukan kartu seret (CafeSwipeStack) tetap dipakai di profil author.
- Pindah halaman: View Transitions (PageTransitions.tsx). Isi halaman memudar lalu naik 14px; header & navbar bawah diam; foto kartu yang diklik terbang jadi foto besar halaman kafe (thumbnail tampil dulu sampai foto besar siap).
- Muncul saat scroll: kelas `reveal` memakai animation-timeline view() (CSS saja), untuk kartu kafe dan section bawah. Bukan untuk hero atau elemen sticky.
- Foto: FadeImage memudar dari buram ke tajam; kerangka berkilau hanya selama foto dimuat (satu-satunya animasi berulang, berhenti begitu foto tampil).
- Navbar bawah: pil aktif melebar halus, label masuk dari samping; tombol mengecil sedikit saat ditekan.
- Tidak ada animasi berulang tanpa henti selain kilau pemuatan foto. `prefers-reduced-motion: reduce` mematikan semua animasi scroll.

## Tema

Terang sebagai dasar, dengan zona gelap espresso untuk hero kaca di beranda. Alasan: foto kafe dan warna kopi paling terbaca di latar krem, kaca butuh latar gelap/foto supaya terlihat. Tidak ada toggle gelap untuk saat ini.

## Bahasa

Bahasa Indonesia santai, kalimat pendek, sudut pandang "aku" untuk pemilik. Tanpa em dash, tanpa kata promosi kosong, tanpa angka yang tidak berasal dari database.
