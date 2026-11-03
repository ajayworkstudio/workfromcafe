import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import FadeImage from "@/components/FadeImage";
import ArticleBody from "@/components/ArticleBody";
import Icon from "@/components/Icon";
import { abs, breadcrumb, clip, ORGANIZATION } from "@/lib/seo";
import { cafesBySlugs, embeddedSlugs, getAutoArticles, getManualArticles } from "@/lib/articles";
import { APP_NAME, SITE_URL, coverUrl, priceLabel } from "@/lib/utils";
import { averageScore } from "@/lib/review";

export const revalidate = 3600;

type P = Promise<{ slug: string }>;

const find = cache(async (slug: string) => {
  const [manual, auto] = await Promise.all([getManualArticles(), getAutoArticles()]);
  const m = manual.find((a) => a.slug === slug);
  if (m) return { kind: "manual" as const, m, auto };
  const a = auto.find((x) => x.slug === slug);
  return a ? { kind: "auto" as const, a, auto } : null;
});

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const r = await find((await params).slug);
  if (!r) return {};
  if (r.kind === "manual") {
    const d = clip(r.m.excerpt || r.m.body.replace(/[#*[\]()]/g, ""));
    return { title: r.m.title, description: d, alternates: { canonical: `/artikel/${r.m.slug}` },
      openGraph: { type: "article", title: r.m.title, description: d, images: r.m.cover_url ? [{ url: r.m.cover_url }] : undefined } };
  }
  const cover = r.a.cafes.map((c) => coverUrl(c)).find(Boolean);
  return { title: r.a.title, description: clip(r.a.description), alternates: { canonical: `/artikel/${r.a.slug}` },
    openGraph: { type: "article", title: r.a.title, description: clip(r.a.description), images: cover ? [{ url: cover }] : undefined } };
}

const dateText = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

export default async function ArticlePage({ params }: { params: P }) {
  const { slug } = await params;
  const r = await find(slug);
  if (!r) notFound();
  const url = `${SITE_URL}/artikel/${slug}`;
  const crumbs = breadcrumb([{ name: "Beranda", path: "/" }, { name: "Artikel", path: "/artikel" }, { name: r.kind === "manual" ? r.m.title : r.a.title, path: `/artikel/${slug}` }]);

  if (r.kind === "manual") {
    const a = r.m;
    const cafes = await cafesBySlugs(embeddedSlugs(a.body));
    return (
      <article className="mx-auto max-w-3xl px-4 py-10">
        <JsonLd data={[crumbs, {
          "@context": "https://schema.org", "@type": "Article", headline: a.title, description: a.excerpt ?? undefined,
          image: a.cover_url ? [abs(a.cover_url)] : undefined, datePublished: a.published_at ?? a.created_at, dateModified: a.updated_at,
          author: { "@type": "Organization", name: APP_NAME, url: SITE_URL }, publisher: ORGANIZATION, mainEntityOfPage: url,
        }]} />
        <Link href="/artikel" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted hover:text-ink">← Artikel</Link>
        <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-extrabold leading-tight">{a.title}</h1>
        <p className="mt-2 text-sm text-muted">{APP_NAME} · {dateText(a.published_at ?? a.created_at)}</p>
        {a.cover_url && (
          <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-[var(--radius-photo)] bg-tint">
            <FadeImage src={a.cover_url} alt="" fill priority sizes="(max-width:768px) 100vw, 768px" className="object-cover" />
          </div>
        )}
        {a.excerpt && <p className="mt-6 text-lg font-medium text-ink">{a.excerpt}</p>}
        <div className="mt-6"><ArticleBody body={a.body} cafes={cafes} /></div>
        <Footer />
      </article>
    );
  }

  const a = r.a;
  const related = a.related.map((s) => r.auto.find((x) => x.slug === s)).filter(Boolean).slice(0, 4);
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <JsonLd data={[crumbs,
        {
          "@context": "https://schema.org", "@type": "Article", headline: a.title, description: a.description,
          image: a.cafes.map((c) => coverUrl(c)).filter(Boolean).slice(0, 3), dateModified: a.updated,
          author: { "@type": "Organization", name: APP_NAME, url: SITE_URL }, publisher: ORGANIZATION, mainEntityOfPage: url,
        },
        {
          "@context": "https://schema.org", "@type": "ItemList", name: a.h1, numberOfItems: a.cafes.length,
          itemListElement: a.cafes.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/kafe/${c.slug}`, name: c.name })),
        },
        ...(a.faq.length ? [{
          "@context": "https://schema.org", "@type": "FAQPage",
          mainEntity: a.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }] : []),
      ]} />
      <Link href="/artikel" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted hover:text-ink">← Artikel</Link>
      <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-extrabold leading-tight">{a.h1}</h1>
      <p className="mt-2 text-sm text-muted">{APP_NAME} · diperbarui {dateText(a.updated)}</p>
      <p className="mt-6 text-lg">{a.intro}</p>
      <p className="mt-3 rounded-2xl bg-tint px-4 py-3 text-sm text-muted"><b className="text-ink">Cara memilih:</b> {a.method}</p>

      <ol className="mt-8 space-y-10">
        {a.cafes.map((c, i) => {
          const cover = coverUrl(c);
          const rate = c.my_rating != null ? Number(c.my_rating) : averageScore(c.scores);
          const hl = a.highlight(c);
          return (
            <li key={c.id}>
              <h2 className="text-2xl font-bold"><span className="text-brand">{i + 1}.</span> <Link href={`/kafe/${c.slug}`} className="hover:text-brand">{c.name}</Link></h2>
              <p className="mt-1 text-sm text-muted">{[c.area, c.city?.name].filter(Boolean).join(", ")} · {priceLabel(c.price_range)}{rate != null ? ` · ★ ${rate.toFixed(1)}` : ""}</p>
              {cover && (
                <Link href={`/kafe/${c.slug}`} className="relative mt-3 block aspect-[16/10] overflow-hidden rounded-[var(--radius-photo)] bg-tint">
                  <FadeImage src={cover} alt={c.name} fill sizes="(max-width:768px) 100vw, 768px" className="object-cover" />
                </Link>
              )}
              {c.short_review && <p className="mt-3">{c.short_review}</p>}
              {hl && <p className="mt-2 text-sm"><b>Buat kerja:</b> {hl}.</p>}
              <Link href={`/kafe/${c.slug}`} className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand hover:underline">Baca review lengkap, jam buka & menu <Icon name="arrow" className="h-4 w-4" /></Link>
            </li>
          );
        })}
      </ol>

      {!!a.faq.length && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold">Pertanyaan yang sering ditanyakan</h2>
          <dl className="mt-4 space-y-4">
            {a.faq.map((f) => (<div key={f.q}><dt className="font-bold">{f.q}</dt><dd className="mt-1 text-ink/85">{f.a}</dd></div>))}
          </dl>
        </section>
      )}

      {!!related.length && (
        <section className="mt-12">
          <h2 className="text-xl font-bold">Artikel lain di {a.city.name}</h2>
          <ul className="mt-3 space-y-2">
            {related.map((x) => <li key={x!.slug}><Link href={`/artikel/${x!.slug}`} className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline">{x!.title}</Link></li>)}
          </ul>
        </section>
      )}

      <Link href={`/kota/${a.city.slug}`} className="btn-ghost mt-10 min-h-11">Lihat semua kafe di {a.city.name}</Link>
      <Footer />
    </article>
  );
}

function Footer() {
  return (
    <aside className="mt-12 rounded-[1.75rem] bg-brand p-6 text-white">
      <p className="text-lg font-bold">Punya kafe yang ada di daftar ini?</p>
      <p className="mt-1 text-white/85">Klaim halamannya, pantau berapa orang yang melihat kafemu, dan tampil di urutan atas pencarian.</p>
      <Link href="/untuk-kafe" className="btn mt-4 min-h-11 bg-white text-brand hover:bg-foam">Untuk pemilik kafe</Link>
    </aside>
  );
}
