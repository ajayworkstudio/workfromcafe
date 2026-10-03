import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CafeCard from "@/components/CafeCard";
import Icon from "@/components/Icon";
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
  const cityList = (cities as City[] | null) ?? [];

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-6 pt-12 md:pt-20">
        <div className="hero-in max-w-3xl">
          <h1 className="text-[clamp(2.6rem,7vw,5.2rem)] font-extrabold leading-[0.95]">
            Kerja dari kafe mana hari ini?
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            {count ?? 0} kafe di Jawa Tengah yang sudah aku coba sendiri. Lengkap dengan colokan, wifi, dan menu yang layak dipesan.
          </p>
          <form action="/kafe" className="mt-8 flex max-w-xl items-center gap-2 rounded-full border border-line bg-surface p-1.5 pl-5 shadow-[0_8px_30px_-12px_rgba(20,26,23,.18)] focus-within:border-brand">
            <Icon name="search" className="h-5 w-5 shrink-0 text-muted" />
            <input name="q" aria-label="Cari kafe" placeholder="Cari nama kafe atau area" className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-muted" />
            <button className="btn-primary shrink-0">Cari</button>
          </form>
        </div>

        {!!cityList.length && (
          <div className="mt-8 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
            {cityList.map((c) => (
              <Link key={c.id} href={`/kota/${c.slug}`}
                className="shrink-0 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium transition-colors hover:border-brand hover:bg-brand hover:text-white">
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      {!!featured?.length && (
        <section className="mx-auto max-w-6xl px-4 pt-10">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-2xl font-bold md:text-3xl">Yang paling sering aku datangi</h2>
            <Link href="/kafe" className="shrink-0 text-sm font-semibold text-brand hover:underline">Lihat semua</Link>
          </div>
          <div className="mt-6 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {(featured as Cafe[]).map((c) => <CafeCard key={c.id} cafe={c} />)}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pt-16">
        <h2 className="text-2xl font-bold md:text-3xl">Baru ditambahkan</h2>
        <div className="mt-6 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {(latest as Cafe[] | null)?.map((c) => <CafeCard key={c.id} cafe={c} />)}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20">
        <div className="grid gap-6 overflow-hidden rounded-3xl bg-brand p-7 text-white md:grid-cols-[1.4fr_1fr] md:items-center md:p-10">
          <div>
            <h2 className="text-3xl font-bold md:text-4xl">Tahu mau pesan apa sebelum sampai.</h2>
            <p className="mt-3 max-w-md text-white/75">
              Pelanggan bisa membaca ulasan lengkap, menu yang wajib dicoba, meja terbaik untuk kerja, dan peta semua kafe.
            </p>
          </div>
          <div className="md:text-right">
            <Link href="/harga" className="btn bg-white text-brand hover:bg-brand-soft">Lihat harga langganan</Link>
          </div>
        </div>
      </section>
    </>
  );
}
