import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CafeCard from "@/components/CafeCard";
import type { Cafe } from "@/lib/types";
import { CAFE_LIST_SELECT } from "@/lib/utils";

type P = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("cities").select("name").eq("slug", slug).maybeSingle();
  if (!data) return {};
  return {
    title: `Kafe di ${data.name}`,
    description: `Daftar kafe pilihan di ${data.name}, Jawa Tengah, lengkap dengan menu rekomendasi.`,
  };
}

export default async function CityPage({ params }: { params: P }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: city } = await supabase.from("cities").select("*").eq("slug", slug).maybeSingle();
  if (!city) notFound();
  const { data: cafes } = await supabase
    .from("cafes")
    .select(CAFE_LIST_SELECT)
    .eq("city_id", city.id)
    .order("my_rating", { ascending: false, nullsFirst: false });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm font-semibold uppercase tracking-widest text-terra">{city.province}</p>
      <h1 className="mt-1 font-display text-4xl font-bold">Kafe di {city.name}</h1>
      <p className="mt-2 text-bean/70">{cafes?.length ?? 0} kafe sudah dikunjungi</p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {(cafes as Cafe[] | null)?.map((c) => <CafeCard key={c.id} cafe={c} />)}
      </div>
      {!cafes?.length && <p className="card mt-6 p-8 text-center text-bean/70">Kafe di kota ini segera hadir.</p>}
    </div>
  );
}
