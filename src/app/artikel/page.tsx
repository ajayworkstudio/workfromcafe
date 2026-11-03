import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { breadcrumb } from "@/lib/seo";
import { getAutoArticles, getManualArticles } from "@/lib/articles";
import { coverThumb } from "@/lib/utils";
import FadeImage from "@/components/FadeImage";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Artikel: rekomendasi kafe buat kerja dan nugas",
  description: "Kumpulan rekomendasi kafe untuk WFC dan nugas per kota di Pulau Jawa: kafe wifi kencang, banyak colokan, tenang, dan murah, dari kunjungan langsung.",
  alternates: { canonical: "/artikel" },
};

export default async function ArticlesIndex() {
  const [auto, manual] = await Promise.all([getAutoArticles(), getManualArticles()]);
  const byCity = new Map<string, typeof auto>();
  for (const a of auto) byCity.set(a.city.name, [...(byCity.get(a.city.name) ?? []), a]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <JsonLd data={breadcrumb([{ name: "Beranda", path: "/" }, { name: "Artikel", path: "/artikel" }])} />
      <h1 className="text-4xl font-extrabold md:text-5xl">Artikel</h1>
      <p className="mt-2 max-w-2xl text-muted">Rekomendasi kafe buat kerja dan nugas, disusun dari kunjungan langsung tim dan author WFC Hunters. Daftar di setiap artikel ikut diperbarui saat ada kafe baru.</p>

      {!!manual.length && (
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Tulisan pilihan</h2>
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {manual.map((a) => (
              <li key={a.id}>
                <Link href={`/artikel/${a.slug}`} className="group block">
                  <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-photo)] bg-tint">
                    {a.cover_url && <FadeImage src={a.cover_url} alt="" fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" />}
                  </div>
                  <h3 className="mt-3 text-lg font-bold leading-snug group-hover:text-brand">{a.title}</h3>
                  {a.excerpt && <p className="mt-1 line-clamp-2 text-sm text-muted">{a.excerpt}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {[...byCity.entries()].map(([city, list]) => (
        <section key={city} className="mt-10">
          <h2 className="text-2xl font-bold">{city}</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((a) => {
              const cover = a.cafes.map((c) => coverThumb(c)).find(Boolean);
              return (
                <li key={a.slug}>
                  <Link href={`/artikel/${a.slug}`} className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-brand">
                    <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-tint">
                      {cover && <FadeImage src={cover} alt="" fill sizes="64px" className="object-cover" />}
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 font-semibold leading-snug group-hover:text-brand">{a.title}</span>
                      <span className="text-xs text-muted">{a.cafes.length} kafe</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {!auto.length && !manual.length && <p className="mt-10 rounded-2xl bg-tint p-8 text-center text-muted">Artikel muncul begitu sebuah kota punya minimal tiga kafe.</p>}
    </div>
  );
}
