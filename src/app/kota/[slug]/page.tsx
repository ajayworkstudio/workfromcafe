import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { translateArticles } from "@/lib/i18n/content";
import { cache } from "react";
import JsonLd from "@/components/JsonLd";
import { abs, breadcrumb, clip } from "@/lib/seo";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CafeCard from "@/components/CafeCard";
import { getManualArticles } from "@/lib/articles";
import { areasOf } from "@/lib/areas";
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
  const [res, { t }] = await Promise.all([getCity((await params).slug), getT()]);
  if (!res) notFound();
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
  const [res, { t, lang }] = await Promise.all([getCity((await params).slug), getT()]);
  if (!res) notFound();
  const { city, cafes } = res;
  const articles = await translateArticles(lang, (await getManualArticles()).filter((a) => a.city_id === city.id));
  const areas = areasOf(cafes.filter((c) => c.is_published));

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
        <Link href="/" className="hover:text-brand">{t("Beranda")}</Link> <span aria-hidden>/</span> <span>{city.name}</span>
      </nav>
      <h1 className="mt-2 text-4xl font-extrabold md:text-5xl">{t("Kafe untuk kerja di {place}", { place: city.name })}</h1>
      <p className="mt-2 max-w-2xl text-muted">
        {cafes.length ? t("{n} kafe di {place}", { n: cafes.length, place: `${city.name}, ${city.province}` }) : t("Kafe di {place}", { place: `${city.name}, ${city.province}` })} {t("yang sudah dicoba langsung untuk kerja dan nugas, lengkap dengan penilaian wifi, colokan, ketenangan, dan menu rekomendasi.")}
      </p>
      {!!articles.length && (
        <nav aria-label={t("Artikel tentang {place}", { place: city.name })} className="mt-5 flex flex-wrap gap-2">
          {articles.map((a) => (
            <Link key={a.slug} href={`/artikel/${a.slug}`} className="flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:border-brand">{a.title}</Link>
          ))}
        </nav>
      )}
      {!!areas.length && (
        <section className="mt-6">
          <h2 className="font-sans text-base font-bold tracking-normal">{t("Kafe per area")}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {areas.map((a) => (
              <Link key={a.slug} href={`/kota/${city.slug}/${a.slug}`} className="flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:border-brand">
                {a.name} <span className="ml-1.5 font-normal text-muted">{a.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <h2 className="mt-8 text-2xl font-bold">{t("Semua kafe di {place}", { place: city.name })}</h2>
      <div className="mt-4 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
        {cafes.map((c) => <CafeCard key={c.id} cafe={c} />)}
      </div>
      {!cafes.length && (
        <div className="mt-6 rounded-2xl bg-tint p-8 text-center text-muted">
          {t("Belum ada kafe di kota ini.")} <Link href="/kirim" className="font-semibold text-brand hover:underline">{t("Punya rekomendasi? Kirim di sini.")}</Link>
        </div>
      )}
    </div>
  );
}
