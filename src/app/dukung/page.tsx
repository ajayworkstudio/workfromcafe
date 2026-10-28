import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/Icon";
import { getSettings } from "@/lib/settings";
import { INSTAGRAM_URL } from "@/lib/utils";
import { createPublicClient } from "@/lib/supabase/server";
import { reportAgo } from "@/lib/reports";
import type { PublicSupporter } from "@/lib/supporters";

export const metadata: Metadata = {
  title: "Dukung WFC Hunters",
  description: "WFC Hunters gratis dipakai. Dukung pengembangannya lewat Saweria atau Trakteer, atau bantu dengan merekomendasikan kafe dan melapor kondisi.",
  alternates: { canonical: "/dukung" },
};

// Daftar pendukung diperbarui saat webhook masuk; cadangan: segarkan tiap 5 menit
export const revalidate = 300;

/** Nama layanan dari link, untuk label tombol. */
function platformName(url: string) {
  if (/saweria\.co/i.test(url)) return "Saweria";
  if (/trakteer\.id/i.test(url)) return "Trakteer";
  return null;
}

const FREE_WAYS = [
  { icon: "send", title: "Rekomendasikan kafe", text: "Kafe andalanmu untuk kerja bisa tayang dengan namamu sebagai author.", href: "/kirim", cta: "Kirim rekomendasi" },
  { icon: "users", title: "Lapor kondisi", text: "Lagi di kafe? Kabari seramai apa dan seberapa kencang wifinya.", href: "/kafe", cta: "Cari kafe" },
  { icon: "instagram", title: "Bagikan & follow", text: "Ceritakan ke teman yang suka kerja dari kafe, dan ikuti @wfchunters.", href: INSTAGRAM_URL, cta: "Buka Instagram", external: true },
  { icon: "chat", title: "Kasih masukan", text: "Lapor bug, usul fitur, atau kirim saran dan kritik.", href: "/kontak?topik=kritik#pesan", cta: "Kotak saran" },
];

export default async function SupportPage() {
  const [{ support_url: url }, { data: supData }] = await Promise.all([
    getSettings(),
    createPublicClient().rpc("supporters_public", { p_limit: 60 }), // kosong kalau migrasi 0024 belum dijalankan
  ]);
  const supporters = (supData as PublicSupporter[] | null) ?? [];
  const name = url ? platformName(url) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:py-16">
      <section className="overflow-hidden rounded-[2rem] bg-espresso p-7 text-foam md:p-12">
        <p className="text-sm font-semibold uppercase tracking-wider text-gold">Dukung WFC Hunters</p>
        <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] md:text-5xl">Bantu WFC Hunters tetap gratis dan terus berkembang</h1>
        <p className="mt-4 max-w-2xl text-lg text-foam/80">
          Semua kafe di sini didatangi dan dinilai langsung, lalu disusun supaya kamu gampang cari tempat kerja yang nyaman. Dukunganmu dipakai untuk biaya server, domain, dan penyimpanan foto, juga untuk mencoba kafe-kafe baru.
        </p>
        {url ? (
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href={url} target="_blank" rel="noopener" className="btn min-h-12 bg-gold px-6 text-base text-espresso hover:bg-[#eab25e]">
              <Icon name="heart" className="h-5 w-5" />{name ? `Dukung lewat ${name}` : "Kirim dukungan"}
            </a>
            <span className="text-sm text-foam/70">Sukarela, berapa pun nominalnya. Semua fitur tetap gratis.</span>
          </div>
        ) : (
          <p className="mt-7 text-sm text-foam/70">Halaman donasi segera dibuka. Sementara itu, kamu tetap bisa membantu dengan cara di bawah.</p>
        )}
      </section>

      <section aria-labelledby="pendukung" className="mt-12">
        <h2 id="pendukung" className="text-2xl font-bold md:text-3xl">Terima kasih, para pendukung</h2>
        {supporters.length ? (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {supporters.map((p) => (
              <li key={p.id} className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/20 text-[#8a5a00]"><Icon name="heart" filled className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <span className="block font-semibold">{p.name}</span>
                  {p.message && <span className="mt-0.5 block break-words text-sm text-ink/80">&ldquo;{p.message}&rdquo;</span>}
                  <span className="mt-1 block text-xs text-muted">{reportAgo(p.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-line p-6 text-center text-muted">Belum ada pendukung yang tercatat. Jadilah yang pertama.</p>
        )}
      </section>

      <section aria-labelledby="tanpa-uang" className="mt-12">
        <h2 id="tanpa-uang" className="text-2xl font-bold md:text-3xl">Dukung tanpa uang</h2>
        <p className="mt-1 text-muted">Bantuan seperti ini sama berharganya untuk komunitas.</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {FREE_WAYS.map((w) => {
            const inner = (
              <>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon name={w.icon} className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <span className="block font-semibold">{w.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{w.text}</span>
                  <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand">{w.cta}<Icon name="chevron" className="h-4 w-4" /></span>
                </span>
              </>
            );
            const cls = "flex h-full gap-3 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-brand";
            return (
              <li key={w.title}>
                {w.external
                  ? <a href={w.href} target="_blank" rel="noopener" className={cls}>{inner}</a>
                  : <Link href={w.href} className={cls}>{inner}</Link>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
