import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { translateArticles } from "@/lib/i18n/content";
import { cache } from "react";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import CafeCard from "@/components/CafeCard";
import { abs, breadcrumb, clip } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { getManualArticles, embeddedSlugs } from "@/lib/articles";
import { areaSlug, areasOf } from "@/lib/areas";
import type { Cafe, City } from "@/lib/types";
import { CAFE_LIST_SELECT, coverUrl, priceLabel } from "@/lib/utils";

type P = Promise<{ slug: string; area: string }>;

const getArea = cache(async (citySlug: string, slug: string) => {
  const supabase = await createClient();
  const { data: city } = await supabase.from("cities").select("*").eq("slug", citySlug).maybeSingle();
  if (!city) return null;
  const { data } = await supabase.from("cafes").select(CAFE_LIST_SELECT).eq("city_id", city.id).eq("is_published", true)
    .order("my_rating", { ascending: false, nullsFirst: false });
  const all = (data as Cafe[] | null) ?? [];
  const areas = areasOf(all);
  const area = areas.find((a) => a.slug === slug);
  if (!area) return null; // area dengan kafe terlalu sedikit tidak punya halaman (404, bukan halaman tipis)
  const cafes = all.filter((c) => c.area && areaSlug(c.area) === slug);
  return { city: city as City, area, cafes, others: areas.filter((a) => a.slug !== slug), cityCount: all.length };
});

/** Ringkasan fakta dari data kafe di area ini (tidak ada angka karangan). */
function facts(cafes: Cafe[]) {
  const has = (c: Cafe, tag: string, key: "wifi" | "colokan") => (c.tags ?? []).some((t) => t.tag?.name === tag) || c.amenities?.[key] === true;
  const prices = [...new Set(cafes.map((c) => c.price_range))].sort();
  return {
    wifi: cafes.filter((c) => has(c, "Wifi", "wifi")).length,
    plug: cafes.filter((c) => has(c, "Colokan", "colokan")).length,
    price: prices.length ? (prices.length === 1 ? priceLabel(prices[0]) : `${priceLabel(prices[0])} sampai ${priceLabel(prices.at(-1)!)}`) : null,
  };
}

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const { slug, area } = await params;
  const r = await getArea(slug, area);
  if (!r) notFound();
  const f = facts(r.cafes);
  const title = `Kafe WFC & nugas di ${r.area.name}, ${r.city.name}`;
  const description = clip(`${r.cafes.length} kafe di ${r.area.name}, ${r.city.name} yang nyaman buat kerja dan nugas${f.wifi ? `, ${f.wifi} dengan wifi` : ""}${f.plug ? `, ${f.plug} dengan colokan` : ""}. Termasuk ${r.cafes.slice(0, 3).map((c) => c.name).join(", ")}.`);
  const cover = r.cafes.map((c) => coverUrl(c)).find(Boolean);
  const path = `/kota/${r.city.slug}/${r.area.slug}`;
  return {
    title, description, alternates: { canonical: path },
    openGraph: { title, description, url: path, images: cover ? [{ url: cover, alt: `Kafe di ${r.area.name}, ${r.city.name}` }] : undefined },
  };
}

export default async function AreaPage({ params }: { params: P }) {
  const { slug, area } = await params;
  const [r, { t, lang }] = await Promise.all([getArea(slug, area), getT()]);
  if (!r) notFound();
  const { city, cafes, others } = r;
  const f = facts(cafes);
  const path = `/kota/${city.slug}/${r.area.slug}`;
  const ids = new Set(cafes.map((c) => c.slug));
  const articles = (await getManualArticles()).filter((a) => embeddedSlugs(a.body).some((s) => ids.has(s)) || a.city_id === city.id).slice(0, 4);
  const shownArticles = await translateArticles(lang, articles);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <JsonLd data={[
        breadcrumb([{ name: "Beranda", path: "/" }, { name: `Kafe di ${city.name}`, path: `/kota/${city.slug}` }, { name: r.area.name, path }]),
        {
          "@context": "https://schema.org", "@type": "ItemList", name: `Kafe untuk kerja di ${r.area.name}, ${city.name}`, numberOfItems: cafes.length,
          itemListElement: cafes.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: abs(`/kafe/${c.slug}`), name: c.name })),
        },
      ]} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/" className="hover:text-brand">{t("Beranda")}</Link> <span aria-hidden>/</span>{" "}
        <Link href={`/kota/${city.slug}`} className="hover:text-brand">{city.name}</Link> <span aria-hidden>/</span> <span>{r.area.name}</span>
      </nav>
      <h1 className="mt-2 text-4xl font-extrabold md:text-5xl">{t("Kafe untuk kerja di {place}", { place: `${r.area.name}, ${city.name}` })}</h1>
      <p className="mt-3 max-w-2xl text-muted">
        {t("{n} kafe di {area} yang sudah didatangi langsung untuk kerja dan nugas", { n: cafes.length, area: r.area.name })}
        {f.wifi || f.plug ? <>: {[f.wifi && t("{n} punya wifi", { n: f.wifi }), f.plug && t("{n} punya colokan", { n: f.plug })].filter(Boolean).join(` ${t("dan")} `)}</> : null}
        {f.price ? <>{t(", dengan kisaran harga {price} per orang", { price: f.price.replace(" sampai ", ` ${t("sampai")} `).replace("ke atas", t("ke atas")) })}</> : null}. {t("Ketuk kafenya untuk melihat penilaian internet, colokan, ketenangan, jam buka, dan menu rekomendasi.")}
      </p>

      <h2 className="sr-only">{t("Daftar kafe di {place}", { place: r.area.name })}</h2>
      <div className="mt-8 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
        {cafes.map((c) => <CafeCard key={c.id} cafe={c} />)}
      </div>

      {!!articles.length && (
        <section className="mt-14">
          <h2 className="text-2xl font-bold">{t("Bacaan terkait")}</h2>
          <ul className="mt-3 space-y-1">
            {shownArticles.map((a) => <li key={a.id}><Link href={`/artikel/${a.slug}`} className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline">{a.title}</Link></li>)}
          </ul>
        </section>
      )}

      <section className="mt-14">
        <h2 className="text-2xl font-bold">{t("Area lain di {place}", { place: city.name })}</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {others.map((o) => (
            <Link key={o.slug} href={`/kota/${city.slug}/${o.slug}`} className="flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:border-brand">
              {o.name} <span className="ml-1.5 font-normal text-muted">{o.count}</span>
            </Link>
          ))}
          <Link href={`/kota/${city.slug}`} className="flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-semibold text-white">{t("Semua {n} kafe di {place}", { n: r.cityCount, place: city.name })}</Link>
        </div>
      </section>
    </div>
  );
}
