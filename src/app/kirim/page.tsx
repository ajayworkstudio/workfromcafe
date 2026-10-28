import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import Icon from "@/components/Icon";
import CommunityCard from "@/components/CommunityCard";
import { getSettings } from "@/lib/settings";
import { STATUS_META, type Submission } from "@/lib/submission";
import { LEVELS, authorHref, getAuthors, levelFor } from "@/lib/author";
import { cdnPhoto } from "@/lib/utils";
import { withdrawSubmission } from "./actions";

export const metadata: Metadata = {
  title: "Jadi author: kirim rekomendasi kafe",
  description: "Punya kafe andalan buat kerja? Kirim rekomendasimu ke WFC Hunters dan tampil sebagai author.",
  alternates: { canonical: "/kirim" },
};

const STEPS = [
  { icon: "edit", title: "Isi rekomendasi", text: "Nama kafe, link Maps, dan satu kalimat kenapa enak buat kerja. Sisanya opsional." },
  { icon: "eye", title: "Dicek admin", text: "Dirapikan supaya formatnya sama dengan kafe lain, lalu ditayangkan." },
  { icon: "star", title: "Tayang & naik level", text: "Namamu tampil di kafe dan profil author publikmu ikut naik level." },
];

const LEVEL_TEXT = ["Kafe pertamamu tayang", "Lima kafe tayang", "Lima belas kafe tayang"];

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<{ terkirim?: string; tayang?: string; disimpan?: string }> }) {
  const [{ terkirim, tayang, disimpan }, viewer, settings, authors] = await Promise.all([searchParams, getViewer(), getSettings(), getAuthors()]);
  let subs: (Submission & { cafe: { slug: string; is_published: boolean } | null })[] = [];
  if (viewer.user) {
    const supabase = await createClient();
    const { data } = await supabase.from("cafe_submissions")
      .select("*, cafe:cafes(slug,is_published)")
      .eq("user_id", viewer.user.id)
      .order("created_at", { ascending: false });
    subs = (data as typeof subs | null) ?? [];
  }
  const me = viewer.user ? authors.find((a) => a.id === viewer.user!.id) ?? null : null;
  const myCount = me?.cafe_count ?? 0;
  const { next, toNext } = levelFor(myCount);
  const startHref = viewer.user ? "/kirim/baru" : "/masuk?next=/kirim/baru";

  return (
    <div className="pb-4">
      {/* Hero kaca, sama seperti beranda: foto kafe di belakang, panel kaca di depan */}
      <section className="relative isolate mx-2 mt-2 overflow-hidden rounded-[2rem] bg-espresso text-foam md:mx-4 md:rounded-[2.5rem]">
        <div className="absolute inset-0 -z-10" aria-hidden>
          <Image src="/hero-cafe.webp" alt="" fill priority sizes="100vw" className="object-cover object-[38%_center] md:object-[70%_center]" />
          <div className="absolute inset-0 bg-gradient-to-b from-espresso/50 via-espresso/75 to-espresso md:bg-gradient-to-r md:from-espresso md:via-espresso/80 md:to-espresso/30" />
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-6 pt-8 md:px-8 md:pb-12 md:pt-16">
          <div className="hero-in max-w-2xl">
            <p className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold">
              <Icon name="sparkle" className="h-4 w-4 text-gold" />Jadi author WFC Hunters
            </p>
            <h1 className="mt-4 text-[clamp(2rem,6.5vw,4.5rem)] font-extrabold leading-[1.02] [text-shadow:0_2px_18px_rgb(0_0_0/0.35)]">
              Punya kafe andalan buat kerja?
            </h1>
            <p className="mt-3 max-w-xl text-foam/85 md:mt-5 md:text-lg">
              Bagikan ke orang yang lagi cari tempat kerja nyaman. Rekomendasi yang lolos review tayang dengan namamu sebagai author.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href={startHref} className="btn min-h-12 bg-gold px-6 text-base text-espresso hover:bg-[#eab25e]">
                <Icon name="send" className="h-5 w-5" />{viewer.user ? "Kirim rekomendasi" : "Masuk untuk mulai"}
              </Link>
              <Link href="/author" className="glass flex min-h-12 items-center gap-2 rounded-full px-5 text-sm font-bold hover:bg-foam hover:text-ink">
                Lihat para author{authors.length ? ` (${authors.length})` : ""}
              </Link>
            </div>
            {!viewer.user && <p className="mt-2 text-sm text-foam/65">Daftar gratis pakai email atau Google.</p>}
          </div>

          <ol className="mt-8 grid gap-2.5 sm:grid-cols-3 md:mt-12">
            {STEPS.map((s, i) => (
              <li key={s.title} className="glass-dark flex gap-3 rounded-[1.5rem] p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-foam/10 text-gold"><Icon name={s.icon} className="h-5 w-5" /></span>
                <span>
                  <span className="block text-xs font-bold uppercase tracking-wider text-foam/55">Langkah {i + 1}</span>
                  <span className="block font-bold">{s.title}</span>
                  <span className="mt-0.5 block text-sm text-foam/70">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        {(terkirim || disimpan) && (
          <p role="status" className="mt-6 rounded-2xl bg-ok/10 p-4 text-sm text-[#2f7049]">
            {disimpan ? "Perubahan tersimpan. Rekomendasimu tetap menunggu review admin."
              : tayang ? <>Terima kasih! Rekomendasimu lolos semua cek dan <b>langsung tayang</b>. <Link href={`/kafe/${tayang}`} className="font-semibold underline">Lihat halaman kafenya</Link>.</>
              : "Terima kasih! Rekomendasimu sudah terkirim dan akan dicek admin. Statusnya bisa kamu pantau di bawah."}
          </p>
        )}

        {/* Tangga level author */}
        <section aria-labelledby="level-judul" className="reveal mt-10 rounded-[1.75rem] border border-line bg-surface p-5 md:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="level-judul" className="text-2xl font-bold">Naik level</h2>
              <p className="mt-0.5 text-sm text-muted">
                {me ? <>Kamu punya <b className="text-ink">{myCount} kafe tayang</b>.{next ? ` ${toNext} lagi menuju ${next.name}.` : " Level tertinggi sudah kamu raih."}</>
                  : "Setiap kafe yang tayang menambah level di profil author publikmu."}
              </p>
            </div>
            {me && <Link href={authorHref(me)} className="text-sm font-semibold text-brand hover:underline">Profil author kamu →</Link>}
          </div>
          <ol className="mt-5 grid gap-2.5 sm:grid-cols-3">
            {LEVELS.map((l, i) => {
              const reached = myCount >= l.min;
              return (
                <li key={l.name} className={`flex items-center gap-3 rounded-2xl border p-4 ${reached ? "border-brand bg-brand-soft/50" : "border-line"}`}>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${l.className}`}><Icon name={l.icon} filled={l.icon === "star"} className="h-5 w-5" /></span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-bold">{l.name}{reached && <Icon name="check" className="h-4 w-4 text-ok" />}</span>
                    <span className="block text-sm text-muted">{LEVEL_TEXT[i]}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        {viewer.user && (
          <section aria-labelledby="rekom-judul" className="mt-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 id="rekom-judul" className="text-2xl font-bold">Rekomendasi kamu</h2>
                {!!subs.length && <p className="mt-0.5 text-sm text-muted">{subs.length} rekomendasi dikirim</p>}
              </div>
              {!!subs.length && <Link href="/kirim/baru" className="btn-primary min-h-11 shrink-0 whitespace-nowrap"><Icon name="plus" className="h-4 w-4" />Kirim lagi</Link>}
            </div>
            {!subs.length ? (
              <div className="mt-4 flex flex-col items-center gap-3 rounded-[1.75rem] border border-dashed border-mist bg-surface p-8 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon name="cup" className="h-6 w-6" /></span>
                <p className="max-w-sm text-muted">Belum ada. Mulai dari kafe yang paling sering kamu datangi untuk kerja.</p>
                <Link href="/kirim/baru" className="btn-primary min-h-11"><Icon name="send" className="h-4 w-4" />Kirim rekomendasi pertama</Link>
              </div>
            ) : (
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {subs.map((s) => {
                  const meta = STATUS_META[s.status];
                  const cover = s.data.photos?.[0];
                  return (
                    <li key={s.id} className="flex gap-4 rounded-[1.5rem] border border-line bg-surface p-3.5">
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-tint">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {cover ? <img src={cdnPhoto(cover)} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-mist"><Icon name="cup" className="h-7 w-7" /></div>}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className={`self-start rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
                        <h3 className="mt-1 line-clamp-2 font-sans text-base font-bold tracking-normal">{s.data.name}</h3>
                        <p className="mt-0.5 truncate text-sm text-muted">
                          {[s.data.area, s.data.city_name].filter(Boolean).join(", ")} · {new Date(s.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        {s.admin_note && <p className="mt-2 rounded-xl bg-tint px-3 py-2 text-sm"><span className="font-semibold">Catatan admin:</span> {s.admin_note}</p>}
                        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2">
                          {s.status === "approved" && (s.cafe?.is_published
                            ? <Link href={`/kafe/${s.cafe.slug}`} className="text-sm font-semibold text-brand hover:underline">Lihat kafe →</Link>
                            : <span className="text-sm text-muted">Sedang dirapikan admin</span>)}
                          {(s.status !== "approved" || s.cafe) && (
                            <Link href={`/kirim/${s.id}`} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold hover:text-brand">
                              <Icon name="edit" className="h-4 w-4" />{s.status === "rejected" ? "Perbaiki & kirim ulang" : "Edit"}
                            </Link>
                          )}
                          {s.status === "pending" && (
                            <form action={withdrawSubmission}>
                              <input type="hidden" name="id" value={s.id} />
                              <button className="min-h-10 text-sm font-medium text-muted hover:text-[#b4533a]">Tarik</button>
                            </form>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {settings.community_url && (
          <div className="mt-10"><CommunityCard url={settings.community_url} variant="compact" /></div>
        )}
      </div>
    </div>
  );
}
