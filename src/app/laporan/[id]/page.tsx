import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import StatsPanel, { PeriodTabs } from "@/components/StatsPanel";
import PrintButton from "@/components/PrintButton";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { articlesWithCafe } from "@/lib/articles";
import { SITE_URL } from "@/lib/utils";
import { SOURCE_LABEL, periodOf, sumActions, type CafeStats, type Source } from "@/lib/stats";

export const metadata: Metadata = { title: "Laporan kafe", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

/**
 * Laporan satu kafe yang bisa dicetak atau disimpan sebagai PDF. Admin bisa membuka laporan kafe mana pun
 * (untuk ditawarkan ke owner yang belum bergabung); owner hanya kafe yang sudah diverifikasi miliknya.
 */
export default async function CafeReport({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ hari?: string }> }) {
  const [{ id }, sp, viewer] = await Promise.all([params, searchParams, getViewer()]);
  if (!viewer.user) redirect(`/masuk?next=/laporan/${id}`);
  const days = periodOf(sp.hari);
  const supabase = await createClient();
  const [{ data: cafe }, { data: stats, error }, { data: owner }] = await Promise.all([
    supabase.from("cafes").select("id,name,slug,area,city:cities(name,slug)").eq("id", id).maybeSingle(),
    supabase.rpc("cafe_stats", { p_cafe_id: id, p_days: days }),
    supabase.from("cafe_owners").select("id").eq("cafe_id", id).not("verified_at", "is", null).limit(1),
  ]);
  if (!cafe) notFound();
  const c = cafe as unknown as { id: string; name: string; slug: string; area: string | null; city: { name: string; slug: string } | null };

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Laporan tidak bisa dibuka</h1>
        <p className="mt-2 text-muted">
          {/tidak berhak/.test(error.message) ? "Laporan ini hanya untuk owner terverifikasi kafe ini dan admin WFC Hunters." : "Statistik belum aktif. Admin perlu menjalankan migrasi 0026."}
        </p>
        <Link href="/pemilik" className="btn-ghost mt-6 min-h-11">Ke halaman Kafe saya</Link>
      </div>
    );
  }

  const s = stats as CafeStats;
  const end = new Date();
  const start = new Date(Date.now() - (days - 1) * 864e5);
  const featured = await articlesWithCafe(c.slug);
  const topSource = (Object.entries(s.sources) as [Source, number][]).sort((a, b) => b[1] - a[1])[0];
  const hasOwner = !!owner?.length;
  const actions = sumActions(s);

  return (
    <div className="print-sheet mx-auto max-w-4xl px-4 py-8">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <PeriodTabs days={days} hrefFor={(d) => `/laporan/${id}?hari=${d}`} />
        <PrintButton />
      </div>

      <header className="flex items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-sm font-semibold text-brand">Laporan audiens WFC Hunters</p>
          <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">{c.name}</h1>
          <p className="mt-1 text-muted">{[c.area, c.city?.name].filter(Boolean).join(", ")} · {fmt(start)} sampai {fmt(end)}</p>
        </div>
        <Image src="/logo.png" alt="WFC Hunters" width={68} height={44} className="h-11 w-auto shrink-0" />
      </header>

      {/* Ringkasan satu kalimat, semua angka dari database */}
      {!!s.views && (
        <p className="mt-6 text-lg leading-relaxed">
          Dalam {days} hari terakhir, halaman <b>{c.name}</b> di WFC Hunters dilihat <b>{s.views.toLocaleString("id-ID")} kali</b> oleh{" "}
          <b>{s.visitors.toLocaleString("id-ID")} pengunjung</b>
          {actions ? <>, dan <b>{actions.toLocaleString("id-ID")} kali</b> pengunjung langsung membuka rute, menu, atau Instagram kafe</> : null}.
          {topSource ? <> Sumber terbesar: {SOURCE_LABEL[topSource[0]]}.</> : null}
        </p>
      )}

      <div className="mt-6"><StatsPanel s={s} tone="print" /></div>

      <section className="mt-6 rounded-2xl border border-line p-5">
        <h2 className="font-sans text-base font-bold tracking-normal">Di mana {c.name} tampil</h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          <li>Halaman kafe: <span className="break-all text-brand">{SITE_URL.replace(/^https?:\/\//, "")}/kafe/{c.slug}</span></li>
          {c.city && <li>Daftar kafe kerja di {c.city.name}</li>}
          {featured.map((a) => <li key={a.slug}>Artikel: {a.title}</li>)}
        </ul>
      </section>

      {!hasOwner && (
        <section className="mt-6 rounded-2xl bg-brand p-5 text-white">
          <h2 className="text-lg font-bold">Kelola halaman ini sendiri</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-white/90">
            <li>Pantau angka di laporan ini kapan saja dari dashboard pemilik.</li>
            <li>Tampil di urutan atas pencarian dengan label Sponsored, bayar hanya saat diklik.</li>
            <li>Minta info kafe diperbarui dan chat langsung dengan admin.</li>
          </ul>
          <p className="mt-3 text-sm text-white/85">Daftar di {SITE_URL.replace(/^https?:\/\//, "")}/untuk-kafe</p>
        </section>
      )}

      <p className="mt-6 text-xs text-muted">
        Cara menghitung: satu orang yang membuka halaman berkali-kali dalam 30 menit dihitung sekali; kunjungan admin, owner, dan bot mesin pencari tidak dihitung.
        Pengunjung unik dihitung per hari. Dibuat {fmt(end)}.
      </p>
    </div>
  );
}
