import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Syarat penggunaan & hak cipta",
  description: "Ketentuan memakai WFC Hunters: hak cipta konten, desain, dan data kafe, serta hak atas ulasan dan foto yang dikirim author.",
  alternates: { canonical: "/syarat" },
};

const UPDATED = "22 Oktober 2026";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-judul`} className="scroll-mt-24 border-t border-line pt-8">
      <h2 id={`${id}-judul`} className="text-2xl font-bold">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-ink/85 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 md:py-16">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand">Berlaku sejak {UPDATED}</p>
      <h1 className="mt-2 text-4xl font-extrabold leading-tight md:text-5xl">Syarat penggunaan &amp; hak cipta</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        Dengan membuka atau memakai WFC Hunters (wfchunters.com), kamu setuju dengan ketentuan di bawah ini.
      </p>

      <div className="mt-10 space-y-10">
        <Section id="hak-cipta" title="Hak cipta WFC Hunters">
          <p>
            Isi situs ini adalah milik WFC Hunters dan dilindungi Undang-Undang Nomor 28 Tahun 2014 tentang Hak Cipta. Semua hak dilindungi. Ini mencakup:
          </p>
          <ul>
            <li>nama, logo, dan identitas visual WFC Hunters;</li>
            <li>desain, tata letak, ilustrasi, dan kode program situs;</li>
            <li>ulasan, penilaian, dan foto yang dibuat oleh WFC Hunters;</li>
            <li>kumpulan data kafe yang kami susun: pilihan kafe, penilaian kerja, fasilitas, jam buka, menu andalan, dan laporan kondisi.</li>
          </ul>
        </Section>

        <Section id="boleh" title="Yang boleh kamu lakukan">
          <ul>
            <li>Membagikan link halaman kafe, author, atau event ke mana saja.</li>
            <li>Membagikan kartu Story dan gambar yang dibuat lewat tombol Bagikan di situs ini.</li>
            <li>Mengutip sebagian kecil ulasan, dengan menyebut WFC Hunters dan menautkan halaman sumbernya.</li>
          </ul>
        </Section>

        <Section id="tidak-boleh" title="Yang tidak boleh tanpa izin tertulis">
          <ul>
            <li>Menyalin ulasan, foto, penilaian, atau daftar kafe lalu menerbitkannya ulang di situs, aplikasi, atau akun media sosial lain.</li>
            <li>Mengambil data secara otomatis (scraping, bot, atau salinan massal) dari situs ini.</li>
            <li>Meniru desain atau memakai nama dan logo WFC Hunters sehingga orang mengira itu bagian dari WFC Hunters.</li>
            <li>Mengakui konten, desain, atau data WFC Hunters sebagai karya sendiri.</li>
          </ul>
          <p>Untuk kerja sama atau izin pemakaian, hubungi kami lewat <Link href="/kontak?topik=kerja_sama" className="font-semibold text-brand hover:underline">halaman kontak</Link>.</p>
        </Section>

        <Section id="author" title="Ulasan dan foto dari author">
          <p>
            Ulasan, foto, laporan kondisi, dan komentar yang kamu kirim tetap milikmu. Dengan mengirimnya, kamu memberi WFC Hunters izin tanpa biaya dan tanpa batas waktu untuk menampilkan, merapikan format, dan membagikannya di situs dan media sosial WFC Hunters, dengan namamu dicantumkan sebagai author. Izin ini tidak eksklusif: kamu tetap boleh memakai karyamu di tempat lain.
          </p>
          <p>
            Kamu menjamin konten yang kamu kirim adalah buatanmu sendiri dan tidak melanggar hak orang lain. Kamu bisa mengedit rekomendasimu kapan saja, atau meminta kontenmu dihapus lewat halaman kontak.
          </p>
        </Section>

        <Section id="kafe" title="Nama dan info kafe">
          <p>
            Nama, logo, dan merek tiap kafe adalah milik kafe tersebut. Info seperti jam buka, harga, dan kondisi bisa berubah sewaktu-waktu, jadi cek ulang sebelum datang. Pemilik kafe yang ingin mengoreksi info atau meminta halamannya diturunkan bisa menghubungi kami lewat <Link href="/kontak?topik=koreksi" className="font-semibold text-brand hover:underline">halaman kontak</Link>.
          </p>
        </Section>

        <Section id="pelanggaran" title="Melaporkan pelanggaran">
          <p>
            Kalau kamu menemukan konten WFC Hunters dipakai tanpa izin, atau menurutmu ada konten di situs ini yang melanggar hak ciptamu, kirim link dan penjelasannya lewat <Link href="/kontak" className="font-semibold text-brand hover:underline">halaman kontak</Link>. Kami akan meninjau dan menindaklanjutinya.
          </p>
        </Section>

        <Section id="perubahan" title="Perubahan ketentuan">
          <p>Ketentuan ini bisa diperbarui. Tanggal di bagian atas halaman menunjukkan versi yang berlaku.</p>
        </Section>
      </div>
    </article>
  );
}
