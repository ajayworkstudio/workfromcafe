import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import CafeCard from "@/components/CafeCard";
import type { Cafe, City } from "@/lib/types";
import { CAFE_LIST_SELECT, coverUrl } from "@/lib/utils";

export const revalidate = 300;

const showcaseFallbacks = [
  "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85",
];

export default async function Home() {
  const supabase = await createClient();
  const [{ data: cities }, { data: featured }, { data: latest }, { count }] = await Promise.all([
    supabase.from("cities").select("*").eq("is_active", true).order("name"),
    supabase.from("cafes").select(CAFE_LIST_SELECT).eq("is_featured", true).order("visited_at", { ascending: false }).limit(6),
    supabase.from("cafes").select(CAFE_LIST_SELECT).order("created_at", { ascending: false }).limit(6),
    supabase.from("cafes").select("id", { count: "exact", head: true }),
  ]);
  const showcase = ((featured ?? []) as Cafe[]).slice(0, 3);

  return (
    <>
      <section className="relative isolate overflow-hidden bg-[#c9eef0]">
        <div className="absolute inset-0 -z-10 opacity-60" style={{ backgroundImage: "linear-gradient(120deg, transparent 46%, rgba(255,255,255,.34) 46.2%, transparent 70%), repeating-linear-gradient(165deg, transparent 0 68px, rgba(255,255,255,.16) 69px 70px)" }} />
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 md:min-h-[600px] md:grid-cols-[.92fr_1.08fr] md:gap-4 md:py-14">
          <div className="relative z-10 max-w-xl py-3 md:py-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/65 px-3.5 py-2 text-xs font-bold uppercase text-[#26717c]">
              <span className="h-2 w-2 rounded-full bg-[#1769f5]" /> Kurasi kafe Jawa Tengah
            </p>
            <h1 className="mt-5 max-w-[600px] text-[clamp(2.5rem,5vw,4.6rem)] font-extrabold leading-[1.04] text-[#172b36]">
              Temukan tempat ngopi yang terasa pas.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-[#49636d] md:text-lg">
              Jelajahi kafe pilihan, suasana favorit, dan menu yang layak dicoba di kota-kota Jawa Tengah.
            </p>
            <form action="/kafe" className="mt-7 flex max-w-lg items-center gap-2 rounded-full border border-white bg-white p-1.5 shadow-[0_14px_35px_rgba(32,100,116,.12)]">
              <input name="q" placeholder="Cari kafe, kota, atau suasana…" className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-[#172b36] outline-none placeholder:text-[#83969c]" />
              <button aria-label="Cari kafe" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-terra text-xl text-white transition hover:bg-terra-dark">⌕</button>
            </form>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-[#49636d]">
              <span><strong className="text-[#172b36]">{count ?? 0}</strong> kafe dikurasi</span>
              <span className="hidden h-1 w-1 rounded-full bg-[#739ba2] sm:block" />
              <span><strong className="text-[#172b36]">{cities?.length ?? 0}</strong> kota di Jawa Tengah</span>
            </div>
          </div>

          <div className="relative mx-auto h-[340px] w-full max-w-[570px] md:h-[500px]" aria-label="Pilihan kafe unggulan">
            <div className="absolute left-[8%] top-[13%] h-[72%] w-[35%] rotate-[-8deg] overflow-hidden rounded-[26px] border-[6px] border-white bg-[#8bd0d5] shadow-[0_22px_50px_rgba(23,75,91,.18)]">
              <Image src={showcase[1] ? coverUrl(showcase[1]) ?? showcaseFallbacks[1] : showcaseFallbacks[1]} alt={showcase[1]?.name ?? "Interior kafe yang hangat"} fill sizes="(max-width:768px) 32vw, 180px" className="object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#102d39]/85 to-transparent p-3 pt-12 text-white">
                <p className="text-[10px] uppercase tracking-[.12em]">Tempat pilihan</p>
                <p className="mt-1 line-clamp-2 text-sm font-bold">{showcase[1]?.name ?? "Ruang untuk rehat sejenak"}</p>
              </div>
            </div>
            <div className="absolute left-[30%] top-[4%] z-10 h-[87%] w-[43%] overflow-hidden rounded-[30px] border-[7px] border-white bg-white shadow-[0_26px_60px_rgba(23,75,91,.22)]">
              <Image src={showcase[0] ? coverUrl(showcase[0]) ?? showcaseFallbacks[0] : showcaseFallbacks[0]} alt={showcase[0]?.name ?? "Suasana kafe pilihan"} fill sizes="(max-width:768px) 40vw, 240px" className="object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#102d39]/90 via-[#102d39]/55 to-transparent p-4 pt-20 text-white">
                <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-semibold backdrop-blur">Favorit pribadi</span>
                <p className="mt-2 line-clamp-2 text-lg font-bold leading-tight">{showcase[0]?.name ?? "Kafe dengan cerita"}</p>
                <p className="mt-1 text-xs text-white/80">{showcase[0]?.city?.name ?? "Jawa Tengah"}</p>
              </div>
            </div>
            <div className="absolute right-[3%] top-[19%] h-[63%] w-[34%] rotate-[8deg] overflow-hidden rounded-[26px] border-[6px] border-white bg-[#aedee0] shadow-[0_22px_50px_rgba(23,75,91,.17)]">
              <Image src={showcase[2] ? coverUrl(showcase[2]) ?? showcaseFallbacks[2] : showcaseFallbacks[2]} alt={showcase[2]?.name ?? "Pilihan kafe di Jawa Tengah"} fill sizes="(max-width:768px) 30vw, 180px" className="object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#102d39]/85 to-transparent p-3 pt-12 text-white">
                <p className="text-[10px] uppercase tracking-[.12em]">Jelajah sekitar</p>
                <p className="mt-1 line-clamp-2 text-sm font-bold">{showcase[2]?.name ?? "Sudut kota yang baru"}</p>
              </div>
            </div>
            <div className="absolute bottom-[2%] right-[13%] z-20 rounded-2xl border border-white bg-white px-4 py-3 shadow-[0_12px_28px_rgba(23,75,91,.14)]">
              <p className="text-[10px] font-semibold uppercase text-[#738a91]">Temukan rasa baru</p>
              <p className="mt-0.5 text-sm font-bold text-[#172b36]">Dari dekat, buat kamu</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#36818a]">Mulai dari sini</p>
            <h2 className="mt-1 font-display text-2xl font-bold">Jelajahi berdasarkan kota</h2>
          </div>
          <Link href="/kafe" className="hidden text-sm font-bold text-terra sm:block">Semua kafe <span aria-hidden="true">→</span></Link>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {(cities as City[] | null)?.map((c) => (
            <Link key={c.id} href={`/kota/${c.slug}`} className="btn-ghost shrink-0 !border-white !bg-white/80">{c.name}</Link>
          ))}
        </div>
      </section>

      {!!featured?.length && (
        <section className="mx-auto max-w-6xl px-4 pt-10">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl font-bold">Favorit pribadi</h2>
            <Link href="/kafe" className="text-sm font-semibold text-terra">Lihat semua →</Link>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(featured as Cafe[]).map((c) => <CafeCard key={c.id} cafe={c} />)}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pt-12">
        <h2 className="font-display text-2xl font-bold">Baru ditambahkan</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(latest as Cafe[] | null)?.map((c) => <CafeCard key={c.id} cafe={c} />)}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-14">
        <div className="card flex flex-col items-start gap-4 bg-foam p-6 md:flex-row md:items-center md:p-8">
          <div className="flex-1">
            <h3 className="font-display text-2xl font-bold">Buka semua ulasan & menu rekomendasi</h3>
            <p className="mt-1 text-bean/80">Ulasan lengkap, tips tempat duduk, jam terbaik, dan peta semua kafe.</p>
          </div>
          <Link href="/harga" className="btn-primary">Lihat paket</Link>
        </div>
      </section>
    </>
  );
}
