import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/Icon";
import { createPublicClient } from "@/lib/supabase/server";
import { getSettings, normalizeWa } from "@/lib/settings";
import { rupiah } from "@/lib/utils";
import type { CafePlan } from "@/lib/ads";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Untuk pemilik kafe: pantau audiens & tampil di atas pencarian",
  description: "Kafemu sudah ada di WFC Hunters? Klaim halamannya untuk melihat berapa orang yang membuka kafemu, dari mana mereka datang, dan tampil di urutan atas pencarian.",
  alternates: { canonical: "/untuk-kafe" },
};

type Reach = { views: number; visitors: number; actions: number; cafes: number; cities: number };

const BENEFITS = [
  { icon: "gauge", title: "Lihat siapa yang melihat kafemu", text: "Berapa kali halaman kafemu dibuka, dari Google, Instagram, atau WhatsApp, jam berapa paling ramai, dan berapa yang langsung membuka rute ke kafe." },
  { icon: "sparkle", title: "Tampil paling atas di pencarian", text: "Kafemu muncul berlabel Sponsored saat orang mencari kota, area, atau suasana yang kamu pilih. Bayar hanya saat diklik, budget harian kamu yang atur." },
  { icon: "book", title: "Ikut masuk artikel yang dibaca dari Google", text: "Artikel seperti \"kafe wifi kencang di kotamu\" disusun dari data kafe dan terindeks Google, jadi orang menemukan kafemu tanpa harus membuka aplikasi." },
  { icon: "chat", title: "Ngobrol langsung dengan admin", text: "Jam buka berubah, ada menu baru, atau mau tanya soal iklan? Kirim lewat chat di dashboard pemilik." },
];

export default async function ForCafes() {
  const db = createPublicClient();
  const [{ data: reach }, { data: plans }, settings] = await Promise.all([
    db.rpc("platform_reach", { p_days: 30 }),
    db.from("cafe_plans").select("*").order("id"),
    getSettings(),
  ]);
  const r = reach as Reach | null;
  const paid = ((plans ?? []) as CafePlan[]).filter((p) => p.can_bid);
  const free = ((plans ?? []) as CafePlan[]).find((p) => !p.can_bid);
  const wa = normalizeWa(settings.whatsapp_number);
  const waText = encodeURIComponent("Halo, saya pemilik kafe dan ingin tahu soal kerja sama dengan WFC Hunters.");

  return (
    <div className="pb-6">
      <section className="relative isolate mx-2 mt-2 overflow-hidden rounded-[2rem] bg-espresso text-foam md:mx-4 md:rounded-[2.5rem]">
        <div className="absolute inset-0 -z-10" aria-hidden>
          <Image src="/hero-cafe.webp" alt="" fill priority sizes="100vw" className="object-cover object-[38%_center] md:object-[70%_center]" />
          <div className="absolute inset-0 bg-gradient-to-b from-espresso/50 via-espresso/75 to-espresso md:bg-gradient-to-r md:from-espresso md:via-espresso/80 md:to-espresso/30" />
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 md:px-8 md:pb-14 md:pt-20">
          <div className="hero-in max-w-2xl">
            <p className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold"><Icon name="cup" className="h-4 w-4 text-gold" />Untuk pemilik kafe</p>
            <h1 className="mt-4 text-[clamp(2rem,6.5vw,4.5rem)] font-extrabold leading-[1.02] [text-shadow:0_2px_18px_rgb(0_0_0/0.35)]">
              Orang yang mau kerja sedang mencari kafe seperti punyamu.
            </h1>
            <p className="mt-3 max-w-xl text-foam/85 md:mt-5 md:text-lg">
              WFC Hunters mengkurasi kafe yang nyaman buat kerja dan nugas. Klaim halaman kafemu untuk melihat audiensnya dan menjangkau lebih banyak pengunjung.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/pemilik" className="btn min-h-12 bg-gold px-6 text-base text-espresso hover:bg-[#eab25e]">Klaim kafeku</Link>
              <a href={`https://wa.me/${wa}?text=${waText}`} target="_blank" rel="noopener" className="glass flex min-h-12 items-center gap-2 rounded-full px-5 text-sm font-bold hover:bg-foam hover:text-ink">
                <Icon name="whatsapp" className="h-4 w-4" />Tanya dulu lewat WhatsApp
              </a>
            </div>
          </div>

          {r && (
            <dl className="mt-10 grid max-w-3xl grid-cols-2 gap-2.5 sm:grid-cols-3">
              <div className="glass-dark rounded-[1.5rem] p-4"><dt className="text-sm text-foam/70">Kafe terkurasi</dt><dd className="text-3xl font-extrabold">{r.cafes.toLocaleString("id-ID")}</dd></div>
              <div className="glass-dark rounded-[1.5rem] p-4"><dt className="text-sm text-foam/70">Kota</dt><dd className="text-3xl font-extrabold">{r.cities.toLocaleString("id-ID")}</dd></div>
              {/* Angka kunjungan baru ditampilkan setelah cukup banyak, supaya tidak menyesatkan saat pencatatan baru mulai */}
              {r.views >= 100 && (
                <div className="glass-dark col-span-2 rounded-[1.5rem] p-4 sm:col-span-1"><dt className="text-sm text-foam/70">Halaman kafe dilihat, 30 hari</dt><dd className="text-3xl font-extrabold">{r.views.toLocaleString("id-ID")}</dd></div>
              )}
            </dl>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        <section className="mt-14">
          <h2 className="text-3xl font-bold">Yang kamu dapat</h2>
          <ul className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-2">
            {BENEFITS.map((b) => (
              <li key={b.title} className="flex gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon name={b.icon} className="h-6 w-6" /></span>
                <span>
                  <span className="block text-lg font-bold">{b.title}</span>
                  <span className="mt-1 block text-muted">{b.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14 rounded-[1.75rem] border border-line bg-surface p-6 md:p-9">
          <h2 className="text-2xl font-bold">Caranya</h2>
          <ol className="mt-5 grid gap-5 md:grid-cols-3">
            {[
              ["Klaim halaman kafemu", "Masuk, pilih kafemu dari daftar. Kalau belum ada, kabari aku supaya ditambahkan."],
              ["Aku verifikasi", "Kirim bukti kepemilikan lewat chat di dashboard atau WhatsApp. Biasanya selesai di hari yang sama."],
              ["Pantau & pasang iklan", "Statistik audiens langsung terbuka. Paket berbayar membuka slot Sponsored."],
            ].map(([t, d], i) => (
              <li key={t}>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-ink font-bold text-white">{i + 1}</span>
                <p className="mt-3 font-bold">{t}</p>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {!!paid.length && (
          <section className="mt-14">
            <h2 className="text-3xl font-bold">Paket</h2>
            <p className="mt-1 text-muted">
              {free ? `${free.name} gratis: kafemu tetap tampil dan statistik audiens tetap bisa dilihat setelah klaim diverifikasi. ` : ""}
              Paket berbayar menambah slot Sponsored dan bonus saldo iklan tiap bulan.
            </p>
            <ul className="card mt-5 divide-y divide-line">
              {paid.map((p) => (
                <li key={p.id} className="grid gap-1 p-5 md:grid-cols-[10rem_minmax(0,1fr)_auto] md:items-center md:gap-6">
                  <div className="flex items-baseline justify-between gap-3 md:contents">
                    <p className="text-lg font-bold">{p.name}</p>
                    <p className="font-bold md:order-last">{rupiah(p.monthly_price)}<span className="font-normal text-muted">/bulan</span></p>
                  </div>
                  <p className="text-sm text-muted">Bonus saldo iklan {rupiah(p.bonus_ad_credit)} per bulan · {p.max_active_campaigns} kampanye berjalan bersamaan</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-14 flex flex-col items-start gap-4 rounded-[1.75rem] bg-brand p-6 text-white md:flex-row md:items-center md:justify-between md:p-9">
          <div>
            <p className="text-2xl font-bold">Kafemu sudah ada di WFC Hunters?</p>
            <p className="mt-1 text-white/85">Klaim gratis. Kamu bisa langsung melihat statistiknya setelah diverifikasi.</p>
          </div>
          <Link href="/pemilik" className="btn min-h-12 shrink-0 bg-white px-6 text-brand hover:bg-foam">Klaim kafeku</Link>
        </section>
      </div>
    </div>
  );
}
