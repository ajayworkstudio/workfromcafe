import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CafeCard from "@/components/CafeCard";
import type { Cafe, City } from "@/lib/types";
import { CAFE_LIST_SELECT } from "@/lib/utils";

export const revalidate = 300;

export default async function Home() {
  const supabase = await createClient();
  const [{ data: cities }, { data: featured }, { data: latest }, { count }] = await Promise.all([
    supabase.from("cities").select("*").eq("is_active", true).order("name"),
    supabase.from("cafes").select(CAFE_LIST_SELECT).eq("is_featured", true).order("visited_at", { ascending: false }).limit(6),
    supabase.from("cafes").select(CAFE_LIST_SELECT).order("created_at", { ascending: false }).limit(6),
    supabase.from("cafes").select("id", { count: "exact", head: true }),
  ]);

  return (
    <>
      <section className="relative overflow-hidden bg-roast text-crema">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-terra/30 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 md:py-20">
          <p className="text-sm font-semibold uppercase tracking-[.2em] text-latte">Kurasi kafe Jawa Tengah</p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-bold leading-[1.05] md:text-6xl">
            Kafe yang benar-benar sudah aku datangi, plus menu yang wajib kamu pesan.
          </h1>
          <form action="/kafe" className="mt-8 flex max-w-xl gap-2">
            <input name="q" placeholder="Cari kafe, area, atau suasana…" className="input !bg-crema !text-roast" />
            <button className="btn-primary shrink-0">Cari</button>
          </form>
          <p className="mt-4 text-sm text-latte">{count ?? 0} kafe di {cities?.length ?? 0} kota · diperbarui rutin</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-10">
        <h2 className="font-display text-2xl font-bold">Pilih kota</h2>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {(cities as City[] | null)?.map((c) => (
            <Link key={c.id} href={`/kota/${c.slug}`} className="btn-ghost shrink-0">{c.name}</Link>
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
