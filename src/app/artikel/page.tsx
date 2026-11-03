import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import FadeImage from "@/components/FadeImage";
import Icon from "@/components/Icon";
import { breadcrumb } from "@/lib/seo";
import { getManualArticles } from "@/lib/articles";

export const metadata: Metadata = {
  title: "Artikel: rekomendasi kafe buat kerja dan nugas",
  description: "Tulisan WFC Hunters soal kafe untuk kerja dan nugas di kota-kota Pulau Jawa: rekomendasi, panduan, dan cerita dari kunjungan langsung.",
  alternates: { canonical: "/artikel" },
};

const dateText = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

export default async function ArticlesIndex() {
  const articles = await getManualArticles();
  const [first, ...rest] = articles;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <JsonLd data={breadcrumb([{ name: "Beranda", path: "/" }, { name: "Artikel", path: "/artikel" }])} />
      <h1 className="text-4xl font-extrabold md:text-5xl">Artikel</h1>
      <p className="mt-2 max-w-2xl text-muted">Rekomendasi, panduan, dan cerita soal kafe buat kerja dan nugas, dari kunjungan langsung tim dan author WFC Hunters.</p>

      {!first ? (
        <p className="mt-10 rounded-2xl bg-tint p-8 text-center text-muted">Belum ada artikel. Tulisan pertama segera hadir.</p>
      ) : (
        <>
          {/* Artikel terbaru lebih besar, sisanya grid */}
          <Link href={`/artikel/${first.slug}`} className="group mt-8 grid overflow-hidden rounded-[1.75rem] border border-line bg-surface md:grid-cols-[1.2fr_1fr]">
            <div className="relative aspect-[16/10] bg-tint md:aspect-auto md:min-h-72">
              {first.cover_url && <FadeImage src={first.cover_url} alt="" fill priority sizes="(max-width:768px) 100vw, 60vw" className="object-cover transition duration-500 group-hover:scale-[1.02]" />}
            </div>
            <div className="flex flex-col justify-center p-6 md:p-8">
              <p className="text-sm font-semibold text-brand">Terbaru</p>
              <h2 className="mt-1 text-2xl font-bold leading-snug group-hover:text-brand md:text-3xl">{first.title}</h2>
              {first.excerpt && <p className="mt-2 line-clamp-3 text-muted">{first.excerpt}</p>}
              <Meta a={first} />
            </div>
          </Link>
          {!!rest.length && (
            <ul className="mt-8 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((a) => (
                <li key={a.id}>
                  <Link href={`/artikel/${a.slug}`} className="group block">
                    <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-photo)] bg-tint">
                      {a.cover_url && <FadeImage src={a.cover_url} alt="" fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" />}
                    </div>
                    <h2 className="mt-3 text-lg font-bold leading-snug group-hover:text-brand">{a.title}</h2>
                    {a.excerpt && <p className="mt-1 line-clamp-2 text-sm text-muted">{a.excerpt}</p>}
                    <Meta a={a} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Meta({ a }: { a: { published_at: string | null; created_at: string; view_count?: number; like_count?: number } }) {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      <span>{dateText(a.published_at ?? a.created_at)}</span>
      <span className="inline-flex items-center gap-1"><Icon name="eye" className="h-3.5 w-3.5" />{(a.view_count ?? 0).toLocaleString("id-ID")}</span>
      {!!a.like_count && <span className="inline-flex items-center gap-1"><Icon name="heart" className="h-3.5 w-3.5" />{a.like_count.toLocaleString("id-ID")}</span>}
    </p>
  );
}
