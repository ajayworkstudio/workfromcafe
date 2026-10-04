import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import Icon from "@/components/Icon";
import { RELATIONS, STATUS_META, type Submission } from "@/lib/submission";

const TABS = [
  { key: "pending", label: "Menunggu" },
  { key: "approved", label: "Diterima" },
  { key: "rejected", label: "Ditolak" },
] as const;

export default async function SubmissionsAdmin({ searchParams }: { searchParams: Promise<{ status?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const status = TABS.some((t) => t.key === sp.status) ? sp.status! : "pending";
  const supabase = await createClient();
  const [{ data, error }, ...counts] = await Promise.all([
    supabase.from("cafe_submissions").select("*").eq("status", status).order("created_at", { ascending: status === "pending" }).limit(100),
    ...TABS.map((t) => supabase.from("cafe_submissions").select("id", { count: "exact", head: true }).eq("status", t.key)),
  ]);
  const subs = (data as Submission[] | null) ?? [];

  return (
    <>
      <PageHeader title="Rekomendasi author" description="Kafe yang dikirim pengguna. Terima untuk membuat draf kafe, lalu rapikan sebelum tayang." />
      <Flash ok={sp.ok} err={sp.err ?? (error ? "Tabel rekomendasi belum ada. Jalankan migrasi 0008_rekomendasi_author.sql di Supabase." : undefined)} />

      <div className="mb-5 flex gap-1.5 overflow-x-auto">
        {TABS.map((t, i) => (
          <Link key={t.key} href={`/admin/rekomendasi?status=${t.key}`}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${status === t.key ? "bg-ink text-white" : "bg-surface text-muted hover:text-ink"}`}>
            {t.label} <span className="ml-1 tabular-nums opacity-70">{counts[i].count ?? 0}</span>
          </Link>
        ))}
      </div>

      {!subs.length ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Tidak ada rekomendasi di sini.</p>
      ) : (
        <ul className="grid gap-3">
          {subs.map((s) => {
            const d = s.data;
            const filled = Object.keys(d.scores ?? {}).filter((k) => k !== "notes").length;
            return (
              <li key={s.id}>
                <Link href={`/admin/rekomendasi/${s.id}`} className="card flex gap-4 p-4 transition-colors hover:border-brand">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-tint">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {d.photos?.[0] ? <img src={d.photos[0]} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-mist"><Icon name="cup" className="h-7 w-7" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-sans text-base font-bold tracking-normal">{d.name}</h2>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_META[s.status].className}`}>{STATUS_META[s.status].label}</span>
                      {d.relation !== "pengunjung" && (
                        <span className="rounded-full bg-tint px-2 py-0.5 text-[11px] font-semibold">{RELATIONS.find((r) => r.value === d.relation)?.label}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted">{[d.area, d.city_name].filter(Boolean).join(", ")}</p>
                    <p className="mt-1 line-clamp-1 text-sm">{d.short_review}</p>
                    <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted">
                      <span>oleh <b className="text-ink">{s.author_name}</b></span>
                      <span>{new Date(s.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                      <span>{d.photos?.length ?? 0} foto · {d.menu?.length ?? 0} menu · {filled}/8 penilaian</span>
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
