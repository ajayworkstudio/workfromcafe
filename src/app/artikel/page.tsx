import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import FadeImage from "@/components/FadeImage";
import Icon from "@/components/Icon";
import { breadcrumb } from "@/lib/seo";
import ArticleCard from "@/components/ArticleCard";
import { articleCovers, cityNames, getManualArticles, type ManualArticle } from "@/lib/articles";

export const metadata: Metadata = {
  title: "Artikel: rekomendasi kafe buat kerja dan nugas",
  description: "Tulisan WFC Hunters soal kafe untuk kerja dan nugas di kota-kota Pulau Jawa: rekomendasi, panduan, dan cerita dari kunjungan langsung.",
  alternates: { canonical: "/artikel" },
};

const dateText = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const published = (a: ManualArticle) => a.published_at ?? a.created_at;

export default async function ArticlesIndex() {
  const articles = await getManualArticles();
  const [covers, cities] = await Promise.all([articleCovers(articles), cityNames()]);
  const label = (a: ManualArticle) => (a.city_id && cities.get(a.city_id)) || "Panduan";
  const latest = articles.slice(0, 6);
  const popular = [...articles].sort((x, y) => (y.view_count ?? 0) - (x.view_count ?? 0)).slice(0, 8);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 md:pt-10">
      <JsonLd data={breadcrumb([{ name: "Beranda", path: "/" }, { name: "Artikel", path: "/artikel" }])} />
      <h1 className="text-[clamp(2.25rem,7vw,3.5rem)] font-extrabold leading-[1.05] tracking-tight">Bacaan buat yang kerja dari kafe</h1>
      <p className="mt-2 max-w-2xl text-muted">Rekomendasi, panduan, dan cerita dari kunjungan langsung tim dan author WFC Hunters.</p>

      {!latest.length ? (
        <p className="mt-10 rounded-2xl bg-tint p-8 text-center text-muted">Belum ada artikel. Tulisan pertama segera hadir.</p>
      ) : (
        <>
          <section aria-labelledby="terbaru" className="mt-8">
            <h2 id="terbaru" className="text-xl font-bold">Terbaru</h2>
            {/* Kartu foto digeser ke samping; kartu berikutnya mengintip supaya terlihat bisa digeser */}
            <ul className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] md:gap-4 [&::-webkit-scrollbar]:hidden">
              {latest.map((a, i) => (
                <li key={a.id} className="w-[78vw] max-w-[22rem] shrink-0 snap-start">
                  <ArticleCard a={a} cover={covers.get(a.id)} label={label(a)} priority={i < 2} />
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="populer" className="mt-10 rounded-[2rem] border border-line bg-surface p-4 sm:p-6 md:p-8">
            <h2 id="populer" className="text-xl font-bold">Paling banyak dibaca</h2>
            <ul className="mt-2 grid gap-x-8 md:grid-cols-2">
              {popular.map((a) => {
                const cover = covers.get(a.id);
                return (
                  <li key={a.id} className="border-b border-line last:border-0 md:[&:nth-last-child(2):nth-child(odd)]:border-0">
                    <Link href={`/artikel/${a.slug}`} className="group flex gap-4 py-4">
                      <span className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-tint">
                        {cover && <FadeImage src={cover} alt="" fill sizes="96px" className="object-cover" />}
                      </span>
                      <span className="min-w-0 self-center">
                        <span className="block text-sm font-semibold text-brand">{label(a)}</span>
                        <span className="mt-0.5 line-clamp-2 font-bold leading-snug group-hover:text-brand">{a.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                          <span>{dateText(published(a))}</span>
                          <span aria-hidden>·</span>
                          <span className="inline-flex items-center gap-1"><Icon name="eye" className="h-3.5 w-3.5" />{(a.view_count ?? 0).toLocaleString("id-ID")}<span className="sr-only"> kali dibaca</span></span>
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
