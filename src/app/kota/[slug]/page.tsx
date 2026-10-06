import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import JsonLd from "@/components/JsonLd";
import { abs, breadcrumb, clip } from "@/lib/seo";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CafeCard from "@/components/CafeCard";
import type { Cafe, City } from "@/lib/types";
import { CAFE_LIST_SELECT, coverUrl } from "@/lib/utils";

type P = Promise<{ slug: string }>;

const getCity = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data: city } = await supabase.from("cities").select("*").eq("slug", slug).maybeSingle();
  if (!city) return null;
  const { data: cafes } = await supabase
    .from("cafes")
    .select(CAFE_LIST_SELECT)
    .eq("city_id", city.id)
    .order("my_rating", { ascending: false, nullsFirst: false });
  return { city: city as City, cafes: (cafes as Cafe[] | null) ?? [] };
});

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const res = await getCity((await params).slug);
  if (!res) return {};
  const { city, cafes } = res;
  const n = cafes.length;
  const title = `Kafe untuk kerja & nugas di ${city.name}${n ? ` (${n} rekomendasi)` : ""}`;
  const top = cafes.slice(0, 3).map((c) => c.name).join(", ");
  const description = clip(
    `${n || "Daftar"} kafe di ${city.name}${city.province ? `, ${city.province}` : ""} yang nyaman untuk kerja (WFC) dan nugas: wifi, colokan, ketenangan, jam buka, dan menu rekomendasi.${top ? ` Termasuk ${top}.` : ""}`,
  );
  const cover = cafes.map((c) => coverUrl(c)).find(Boolean);
  return {
    title,
    description,
    alternates: { canonical: `/kota/${city.slug}` },
    // Kota tanpa kafe jangan diindeks (konten tipis)
    robots: n ? undefined : { index: false, follow: true },
    openGraph: { title, description, url: `/kota/${city.slug}`, images: cover ? [{ url: cover, alt: `Kafe di ${city.name}` }] : undefined },
  };
}

export default async function CityPage({ params }: { params: P }) {
  const res = await getCity((await params).slug);
  if (!res) notFound();
  const { city, cafes } = res;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <JsonLd data={[
        breadcrumb([{ name: "Beranda", path: "/" }, { name: `Kafe di ${city.name}`, path: `/kota/${city.slug}` }]),
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Kafe untuk kerja di ${city.name}`,
          numberOfItems: cafes.length,
          itemListElement: cafes.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: abs(`/kafe/${c.slug}`), name: c.name })),
        },
      ]} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/" className="hover:text-brand">Beranda</Link> <span aria-hidden>/</span> <span>{city.name}</span>
      </nav>
      <h1 className="mt-2 text-4xl font-extrabold md:text-5xl">Kafe untuk kerja di {city.name}</h1>
      <p className="mt-2 max-w-2xl text-muted">
        {cafes.length ? `${cafes.length} kafe di ${city.name}, ${city.province}` : `Kafe di ${city.name}, ${city.province}`} yang sudah dicoba langsung untuk kerja dan nugas, lengkap dengan penilaian wifi, colokan, ketenangan, dan menu rekomendasi.
      </p>
      <div className="mt-8 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
        {cafes.map((c) => <CafeCard key={c.id} cafe={c} />)}
      </div>
      {!cafes.length && (
        <div className="mt-6 rounded-2xl bg-tint p-8 text-center text-muted">
          Belum ada kafe di kota ini. <Link href="/kirim" className="font-semibold text-brand hover:underline">Punya rekomendasi? Kirim di sini.</Link>
        </div>
      )}
    </div>
  );
}
