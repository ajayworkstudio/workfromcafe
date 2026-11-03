import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import { PeriodTabs } from "@/components/StatsPanel";
import { createClient } from "@/lib/supabase/server";
import { change, periodOf, type OverviewRow } from "@/lib/stats";

export const metadata: Metadata = { title: "Statistik kafe" };

const n = (v: number) => Number(v).toLocaleString("id-ID");

export default async function StatsAdmin({ searchParams }: { searchParams: Promise<{ hari?: string; q?: string }> }) {
  const sp = await searchParams;
  const days = periodOf(sp.hari);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cafes_stats_overview", { p_days: days });

  if (error) {
    return (
      <>
        <PageHeader title="Statistik kafe" />
        <p className="rounded-xl bg-tint px-4 py-3 text-sm">Statistik belum aktif. Jalankan migrasi <code>0026_statistik_chat_artikel.sql</code> di Supabase.</p>
      </>
    );
  }

  const all = (data ?? []) as OverviewRow[];
  const q = sp.q?.trim().toLowerCase();
  const rows = q ? all.filter((r) => `${r.name} ${r.city ?? ""}`.toLowerCase().includes(q)) : all;
  const total = all.reduce((a, r) => ({ views: a.views + Number(r.views), visitors: a.visitors + Number(r.visitors), actions: a.actions + Number(r.actions), prev: a.prev + Number(r.prev_views) }), { views: 0, visitors: 0, actions: 0, prev: 0 });
  const c = change(total.views, total.prev);
  // Kafe yang ramai dilihat tapi belum punya owner: calon kerja sama paling kuat
  const prospects = all.filter((r) => !r.has_owner && Number(r.views) > 0).slice(0, 5);

  return (
    <>
      <PageHeader title="Statistik kafe" description="Siapa melihat kafe mana. Angka ini yang bisa kamu tunjukkan ke owner."
        action={<PeriodTabs days={days} hrefFor={(d) => `/admin/statistik?hari=${d}`} />} />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl bg-ink p-5 text-white">
          <dt className="text-sm text-white/70">Halaman kafe dilihat</dt>
          <dd className="mt-1 text-3xl font-extrabold">{n(total.views)}</dd>
          <dd className="mt-1 text-xs text-white/70">{c === null ? `${days} hari terakhir` : `${c >= 0 ? "▲" : "▼"} ${Math.abs(c)}% dari ${days} hari sebelumnya`}</dd>
        </div>
        <Kpi label="Kunjungan unik (dijumlah per kafe)" value={n(total.visitors)} />
        <Kpi label="Aksi ke kafe" value={n(total.actions)} note="Rute, menu, Instagram, bagikan" />
        <Kpi label="Kafe dengan owner" value={`${all.filter((r) => r.has_owner).length} dari ${all.length}`} />
      </dl>

      {!!prospects.length && (
        <section className="mt-6 rounded-2xl border border-gold/60 bg-gold/10 p-5">
          <h2 className="text-lg font-bold">Calon kerja sama</h2>
          <p className="mt-0.5 text-sm text-muted">Kafe yang paling banyak dilihat tapi belum diklaim owner. Buka laporannya, lalu kirim ke owner-nya.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {prospects.map((r) => (
              <li key={r.cafe_id}>
                <Link href={`/laporan/${r.cafe_id}?hari=${days}`} className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:border-brand">
                  {r.name}<span className="font-normal text-muted">{n(r.views)} dilihat</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Per kafe</h2>
        <input type="hidden" name="hari" value={days} />
        <label className="flex min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Cari kafe</span>
          <input name="q" defaultValue={sp.q} type="search" placeholder="Cari nama kafe atau kota" className="input" />
        </label>
      </form>

      <div className="card relative mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line text-left text-muted">
            <tr>
              <th className="p-3 font-medium">Kafe</th>
              <th className="p-3 text-right font-medium">Dilihat</th>
              <th className="p-3 text-right font-medium">Unik</th>
              <th className="p-3 text-right font-medium">Aksi</th>
              <th className="p-3 text-right font-medium">Tren</th>
              <th className="p-3 text-right font-medium">Favorit</th>
              <th className="p-3"><span className="sr-only">Buka</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const t = change(Number(r.views), Number(r.prev_views));
              return (
                <tr key={r.cafe_id} className="hover:bg-tint/60">
                  <td className="p-3">
                    <Link href={`/admin/statistik/${r.cafe_id}?hari=${days}`} className="font-semibold hover:text-brand">{r.name}</Link>
                    <span className="block text-xs text-muted">{r.city ?? "Tanpa kota"}{r.has_owner ? " · punya owner" : ""}</span>
                  </td>
                  <td className="p-3 text-right font-semibold">{n(r.views)}</td>
                  <td className="p-3 text-right">{n(r.visitors)}</td>
                  <td className="p-3 text-right">{n(r.actions)}</td>
                  <td className={`p-3 text-right ${t === null ? "text-muted" : t >= 0 ? "text-ok" : "text-[#b4533a]"}`}>{t === null ? "baru" : `${t >= 0 ? "+" : ""}${t}%`}</td>
                  <td className="p-3 text-right">{n(r.favorites)}</td>
                  <td className="p-3 text-right"><Link href={`/admin/statistik/${r.cafe_id}?hari=${days}`} className="font-semibold text-brand hover:underline">Detail</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="p-6 text-center text-muted">Tidak ada kafe yang cocok.</p>}
      </div>
      <p className="mt-3 text-xs text-muted">Kunjungan admin dan owner ke kafenya sendiri tidak dihitung. Satu orang yang membuka halaman yang sama berkali-kali dalam 30 menit dihitung sekali.</p>
    </>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-3xl font-extrabold">{value}</dd>
      {note && <dd className="mt-1 text-xs text-muted">{note}</dd>}
    </div>
  );
}
