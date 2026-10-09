import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Flash from "@/components/admin/Flash";
import SubmitButton from "@/components/admin/SubmitButton";
import CafeScorecard from "@/components/CafeScorecard";
import Icon from "@/components/Icon";
import { averageScore } from "@/lib/review";
import { RELATIONS, STATUS_META, type Submission } from "@/lib/submission";
import { DAYS, formatSlot, priceLabel, rupiah } from "@/lib/utils";
import { approveSubmission, rejectSubmission } from "../actions";

export default async function SubmissionDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data } = await supabase.from("cafe_submissions").select("*").eq("id", id).maybeSingle();
  const s = data as Submission | null;
  if (!s) notFound();
  const d = s.data;

  // Cek kemungkinan kafe yang sama sudah ada
  const firstWord = d.name.split(/\s+/).find((w) => w.length > 3) ?? d.name;
  const { data: similar } = await supabase.from("cafes").select("id,name,area,city:cities(name)").ilike("name", `%${firstWord}%`).limit(5);
  const [{ count: authorTotal }, { count: authorApproved }] = await Promise.all([
    supabase.from("cafe_submissions").select("id", { count: "exact", head: true }).eq("user_id", s.user_id),
    supabase.from("cafe_submissions").select("id", { count: "exact", head: true }).eq("user_id", s.user_id).eq("status", "approved"),
  ]);

  const mapsUrl = d.lat && d.lng ? `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}` : d.maps_link;
  const relation = RELATIONS.find((r) => r.value === d.relation);

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[150px_1fr]"><dt className="text-sm text-muted">{label}</dt><dd className="min-w-0 break-words text-sm">{children || <span className="text-mist">–</span>}</dd></div>
  );

  return (
    <>
      <Link href="/admin/rekomendasi" className="text-sm font-medium text-muted hover:text-brand">← Semua rekomendasi</Link>
      <div className="mb-6 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">{d.name}</h1>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_META[s.status].className}`}>{STATUS_META[s.status].label}</span>
      </div>
      <Flash err={sp.err} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {!!d.photos?.length && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {d.photos.map((u, i) => (
                <a key={u} href={u} target="_blank" rel="noopener" className="relative aspect-square overflow-hidden rounded-xl bg-tint">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-semibold text-white">Sampul</span>}
                </a>
              ))}
            </div>
          )}

          <section className="card p-5">
            <h2 className="text-lg font-bold">Info kafe</h2>
            <dl className="mt-2 divide-y divide-line">
              <Row label="Kota">{d.city_name}{!d.city_id && <span className="ml-2 rounded bg-gold/20 px-1.5 text-xs text-[#8a5a00]">kota baru</span>}</Row>
              <Row label="Area">{d.area}</Row>
              <Row label="Alamat">{d.address}</Row>
              <Row label="Lokasi">{mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener" className="font-medium text-brand hover:underline">Buka di Google Maps</a>}{d.lat ? <span className="ml-2 text-muted">{d.lat}, {d.lng}</span> : d.maps_link ? <span className="ml-2 text-xs text-muted">(koordinat belum terbaca, isi manual saat edit)</span> : null}</Row>
              <Row label="Kisaran harga">{priceLabel(d.price_range)}</Row>
              <Row label="Terakhir datang">{d.visited_at && new Date(d.visited_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</Row>
              <Row label="Link menu">{d.menu_url && <a href={d.menu_url} target="_blank" rel="noopener" className="text-brand hover:underline">{d.menu_url}</a>}</Row>
              <Row label="Instagram">{d.instagram && <a href={`https://instagram.com/${d.instagram}`} target="_blank" rel="noopener" className="text-brand hover:underline">@{d.instagram}</a>}</Row>
              <Row label="Jam buka">
                {d.opening_hours ? (
                  <span className="grid grid-cols-[auto_1fr] gap-x-4">
                    {DAYS.map(({ key, label }) => <span key={key} className="contents"><span className="text-muted">{label}</span><span className="tabular-nums">{formatSlot(d.opening_hours?.[key])}</span></span>)}
                  </span>
                ) : "Tidak diisi"}
              </Row>
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="text-lg font-bold">Ulasan</h2>
            <p className="mt-3 text-lg leading-relaxed">{d.short_review}</p>
            {d.full_review && <p className="mt-3 whitespace-pre-line text-ink/85">{d.full_review}</p>}
            {(d.tips || d.best_time) && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {d.tips && <div className="rounded-xl bg-brand-soft p-4 text-sm"><p className="font-semibold text-brand">Tips duduk</p>{d.tips}</div>}
                {d.best_time && <div className="rounded-xl bg-brand-soft p-4 text-sm"><p className="font-semibold text-brand">Waktu terbaik</p>{d.best_time}</div>}
              </div>
            )}
          </section>

          <div className="card px-5 pb-5 [&>section]:mt-5">
            <CafeScorecard scores={d.scores} amenities={d.amenities} overall={averageScore(d.scores)} byContributor={s.author_name} />
            {!Object.keys(d.scores ?? {}).some((k) => k !== "notes") && !Object.keys(d.amenities ?? {}).length && <p className="pt-5 text-sm text-muted">Penilaian dan fasilitas tidak diisi.</p>}
          </div>

          {!!d.menu?.length && (
            <section className="card p-5">
              <h2 className="text-lg font-bold">Menu rekomendasi</h2>
              <ul className="mt-2 divide-y divide-line">
                {d.menu.map((m, i) => (
                  <li key={i} className="flex justify-between gap-3 py-2.5 text-sm">
                    <span>
                      <span className="font-semibold">{m.name}</span>
                      {m.is_must_try && <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-semibold text-[#8a5a00]">Wajib coba</span>}
                      {m.note && <span className="block text-muted">{m.note}</span>}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{rupiah(m.price)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <section className="card p-5">
            <p className="label">Author</p>
            <p className="font-bold">{s.author_name}</p>
            {s.author_instagram && <a href={`https://instagram.com/${s.author_instagram}`} target="_blank" rel="noopener" className="text-sm text-brand hover:underline">@{s.author_instagram}</a>}
            <p className="mt-2 text-sm text-muted">{authorTotal ?? 0} kiriman, {authorApproved ?? 0} diterima</p>
            {relation && (
              <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${d.relation === "pengunjung" ? "bg-tint" : "bg-gold/15"}`}>
                <b>{relation.label}</b>{d.relation !== "pengunjung" && ". Penilaian mungkin tidak netral, cek ulang sebelum tayang."}
              </p>
            )}
          </section>

          {!!similar?.length && (
            <section className="rounded-2xl border border-gold/60 bg-gold/10 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold"><Icon name="search" className="h-4 w-4" />Mungkin sudah ada</p>
              <ul className="mt-2 space-y-1 text-sm">
                {(similar as unknown as { id: string; name: string; area: string | null; city: { name: string } | null }[]).map((c) => (
                  <li key={c.id}><Link href={`/admin/kafe/${c.id}`} className="font-medium text-brand hover:underline">{c.name}</Link> <span className="text-muted">{[c.area, c.city?.name].filter(Boolean).join(", ")}</span></li>
                ))}
              </ul>
            </section>
          )}

          {s.status === "pending" ? (
            <>
              <form action={approveSubmission} className="card space-y-3 p-5">
                <input type="hidden" name="id" value={s.id} />
                <p className="text-sm text-muted">Membuat <b className="text-ink">draf kafe</b> (belum tayang) berisi semua data, menu, dan foto ini. Setelah itu kamu bisa merapikannya.</p>
                <SubmitButton className="btn-primary w-full"><Icon name="check" className="h-4 w-4" />Terima &amp; buat draf</SubmitButton>
              </form>
              <form action={rejectSubmission} className="card space-y-3 p-5">
                <input type="hidden" name="id" value={s.id} />
                <label htmlFor="note" className="label">Alasan menolak (dilihat author)</label>
                <textarea id="note" name="note" rows={3} maxLength={500} placeholder="Contoh: Kafe ini sudah ada di WorkFromCafe. Terima kasih!" className="input" />
                <SubmitButton className="btn-ghost w-full">Tolak</SubmitButton>
              </form>
            </>
          ) : (
            <section className="card space-y-2 p-5 text-sm">
              <p>Direview {s.reviewed_at && new Date(s.reviewed_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}.</p>
              {s.admin_note && <p className="text-muted">Catatan: {s.admin_note}</p>}
              {s.cafe_id && <Link href={`/admin/kafe/${s.cafe_id}`} className="btn-primary w-full">Buka kafe</Link>}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
