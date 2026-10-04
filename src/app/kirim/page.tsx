import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import Icon from "@/components/Icon";
import { STATUS_META, type Submission } from "@/lib/submission";
import { withdrawSubmission } from "./actions";

export const metadata: Metadata = {
  title: "Jadi author: kirim rekomendasi kafe",
  description: "Punya kafe andalan buat kerja? Kirim rekomendasimu ke WorkFromCafe dan tampil sebagai author.",
};

const STEPS = [
  { icon: "edit", title: "Isi rekomendasi", text: "Lokasi, ulasan, penilaian kerja, fasilitas, menu andalan, dan foto." },
  { icon: "eye", title: "Dicek admin", text: "Kami cek dan rapikan supaya formatnya sama dengan kafe lain." },
  { icon: "star", title: "Tayang dengan namamu", text: "Halaman kafe menampilkan namamu sebagai author." },
];

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<{ terkirim?: string }> }) {
  const [{ terkirim }, viewer] = await Promise.all([searchParams, getViewer()]);
  let subs: (Submission & { cafe: { slug: string; is_published: boolean } | null })[] = [];
  if (viewer.user) {
    const supabase = await createClient();
    const { data } = await supabase.from("cafe_submissions")
      .select("*, cafe:cafes(slug,is_published)")
      .eq("user_id", viewer.user.id)
      .order("created_at", { ascending: false });
    subs = (data as typeof subs | null) ?? [];
  }
  const startHref = viewer.user ? "/kirim/baru" : "/masuk?next=/kirim/baru";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {terkirim && (
        <p role="status" className="mb-6 rounded-xl bg-ok/10 p-4 text-sm text-ok">
          Terima kasih! Rekomendasimu sudah terkirim dan akan dicek admin. Statusnya bisa kamu pantau di halaman ini.
        </p>
      )}

      <section className="overflow-hidden rounded-3xl bg-brand text-white">
        <div className="grid gap-8 p-7 md:grid-cols-[1.3fr_1fr] md:items-end md:p-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-tan">Jadi author</p>
            <h1 className="mt-2 text-4xl font-extrabold leading-[1.05] md:text-5xl">Punya kafe andalan buat kerja?</h1>
            <p className="mt-4 max-w-md text-white/75">
              Bagikan ke orang lain yang lagi cari tempat kerja nyaman. Rekomendasi yang lolos review tayang di WorkFromCafe dengan namamu.
            </p>
          </div>
          <div className="md:text-right">
            <Link href={startHref} className="btn bg-white text-brand hover:bg-brand-soft">
              <Icon name="send" className="h-4 w-4" />{viewer.user ? "Kirim rekomendasi" : "Masuk untuk mulai"}
            </Link>
            {!viewer.user && <p className="mt-2 text-sm text-white/60">Daftar gratis pakai email atau Google.</p>}
          </div>
        </div>
        <ol className="grid border-t border-white/15 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3 border-white/15 p-6 max-sm:border-b max-sm:last:border-b-0 sm:border-l sm:first:border-l-0">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-tan"><Icon name={s.icon} className="h-[18px] w-[18px]" /></span>
              <span>
                <span className="block font-semibold">{i + 1}. {s.title}</span>
                <span className="mt-0.5 block text-sm text-white/65">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {viewer.user && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-2xl font-bold">Rekomendasi kamu</h2>
            {!!subs.length && <Link href="/kirim/baru" className="text-sm font-semibold text-brand hover:underline">+ Kirim lagi</Link>}
          </div>
          {!subs.length ? (
            <div className="mt-4 rounded-2xl border border-dashed border-line p-8 text-center text-muted">
              Belum ada. Mulai dari kafe yang paling sering kamu datangi untuk kerja.
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {subs.map((s) => {
                const meta = STATUS_META[s.status];
                const cover = s.data.photos?.[0];
                return (
                  <li key={s.id} className="flex gap-4 p-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-tint">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-mist"><Icon name="cup" className="h-6 w-6" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="truncate font-sans text-base font-semibold tracking-normal">{s.data.name}</h3>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
                      </div>
                      <p className="text-sm text-muted">
                        {[s.data.area, s.data.city_name].filter(Boolean).join(", ")} · dikirim {new Date(s.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      {s.admin_note && <p className="mt-1.5 rounded-lg bg-tint px-3 py-2 text-sm"><span className="font-semibold">Catatan admin:</span> {s.admin_note}</p>}
                      {s.status === "approved" && (
                        s.cafe?.is_published
                          ? <Link href={`/kafe/${s.cafe.slug}`} className="mt-1.5 inline-block text-sm font-semibold text-brand hover:underline">Lihat halaman kafe →</Link>
                          : <p className="mt-1.5 text-sm text-muted">Sedang dirapikan admin sebelum tayang.</p>
                      )}
                    </div>
                    {s.status === "pending" && (
                      <form action={withdrawSubmission} className="shrink-0 self-center">
                        <input type="hidden" name="id" value={s.id} />
                        <button className="text-sm font-medium text-muted hover:text-[#b4533a]">Tarik</button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
