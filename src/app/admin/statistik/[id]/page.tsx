import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/admin/PageHeader";
import StatsPanel, { PeriodTabs } from "@/components/StatsPanel";
import Icon from "@/components/Icon";
import { createClient } from "@/lib/supabase/server";
import { periodOf, type CafeStats } from "@/lib/stats";

export const metadata: Metadata = { title: "Statistik kafe" };

export default async function CafeStatsAdmin({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ hari?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const days = periodOf(sp.hari);
  const supabase = await createClient();
  const [{ data: cafe }, { data: stats, error }, { data: owners }] = await Promise.all([
    supabase.from("cafes").select("id,name,slug,area,city:cities(name)").eq("id", id).maybeSingle(),
    supabase.rpc("cafe_stats", { p_cafe_id: id, p_days: days }),
    supabase.from("cafe_owners").select("user_id,verified_at").eq("cafe_id", id),
  ]);
  if (!cafe) notFound();
  const c = cafe as unknown as { id: string; name: string; slug: string; area: string | null; city: { name: string } | null };

  return (
    <>
      <Link href={`/admin/statistik?hari=${days}`} className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted hover:text-ink">← Semua kafe</Link>
      <PageHeader title={c.name} description={[c.area, c.city?.name].filter(Boolean).join(", ")}
        action={<PeriodTabs days={days} hrefFor={(d) => `/admin/statistik/${id}?hari=${d}`} />} />

      <div className="mb-5 flex flex-wrap gap-2">
        <a href={`/laporan/${id}/pdf?hari=${days}&unduh=1`} download data-no-transition className="btn-primary min-h-11"><Icon name="book" className="h-4 w-4" />Unduh laporan PDF</a>
        <Link href={`/laporan/${id}?hari=${days}`} className="btn-ghost min-h-11">Lihat laporan</Link>
        <Link href={`/admin/owner-chat/${id}`} className="btn-ghost min-h-11"><Icon name="chat" className="h-4 w-4" />Chat dengan owner</Link>
        <Link href={`/kafe/${c.slug}`} className="btn-ghost min-h-11">Halaman kafe</Link>
        <span className="chip self-center">{owners?.some((o) => o.verified_at) ? "Owner terverifikasi" : owners?.length ? "Klaim menunggu verifikasi" : "Belum diklaim owner"}</span>
      </div>

      {error
        ? <p className="rounded-xl bg-tint px-4 py-3 text-sm">Statistik belum aktif. Jalankan migrasi <code>0026_statistik_chat_artikel.sql</code> di Supabase.</p>
        : <StatsPanel s={stats as CafeStats} />}
    </>
  );
}
