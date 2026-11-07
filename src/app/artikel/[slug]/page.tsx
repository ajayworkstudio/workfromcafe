import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import FadeImage from "@/components/FadeImage";
import ArticleBody, { asSpacing } from "@/components/ArticleBody";
import ArticleActions from "@/components/ArticleActions";
import ArticleByline from "@/components/ArticleByline";
import BackButton from "@/components/BackButton";
import { abs, breadcrumb, clip, ORGANIZATION } from "@/lib/seo";
import { articleCovers, cafesBySlugs, embeddedSlugs, getManualArticles, type ManualArticle } from "@/lib/articles";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { APP_NAME, SITE_URL, coverUrl } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { translateArticles } from "@/lib/i18n/content";

type P = Promise<{ slug: string }>;

const find = cache(async (slug: string) => (await getManualArticles()).find((a) => a.slug === slug) ?? null);

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const a = await find((await params).slug);
  if (!a) notFound();
  const d = clip(a.meta_description || a.excerpt || a.body.replace(/!\[[^\]]*\]\([^)]*\)|\[(?:kiri|tengah|kanan)\]|\[\[kafe:[\w-]+\]\]|[#*[\]()]/g, ""));
  const title = a.meta_title || a.title;
  // Tanpa foto sampul: pakai gambar pertama di isi, foto kafe pertama yang disisipkan, lalu gambar bawaan situs
  const bodyImage = a.body.match(/^(?:\[(?:kiri|tengah|kanan)\][ \t]*)?!\[[^\]]*\]\((https:\/\/[^\s)]+)\)$/m)?.[1];
  const image = a.cover_url || bodyImage || (await cafesBySlugs(embeddedSlugs(a.body).slice(0, 1))).map((c) => coverUrl(c)).find(Boolean) || "/opengraph-image.png";
  return {
    title, description: d, alternates: { canonical: `/artikel/${a.slug}` },
    openGraph: { type: "article", title, description: d, url: `/artikel/${a.slug}`, images: [{ url: image, alt: a.cover_alt || a.title }],
      publishedTime: a.published_at ?? a.created_at, modifiedTime: a.updated_at },
    twitter: { card: "summary_large_image", title, description: d, images: [image] },
  };
}

const dateText = (d: string, locale = "id-ID") => new Date(d).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

export default async function ArticlePage({ params }: { params: P }) {
  const { t, locale, lang } = await getT();
  const { slug } = await params;
  const [found, viewer, all] = await Promise.all([find(slug), getViewer(), getManualArticles()]);
  if (!found) notFound();
  const [a] = await translateArticles(lang, [found], true);
  const url = `${SITE_URL}/artikel/${a.slug}`;
  const supabase = await createClient();
  const [cafes, liked, saved] = await Promise.all([
    cafesBySlugs(embeddedSlugs(a.body)),
    viewer.user ? supabase.from("article_likes").select("article_id").eq("article_id", a.id).eq("user_id", viewer.user.id).maybeSingle() : Promise.resolve({ data: null }),
    viewer.user ? supabase.from("article_saves").select("article_id").eq("article_id", a.id).eq("user_id", viewer.user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  // Artikel lain: yang sekota dulu, lalu yang terbaru
  const others = await translateArticles(lang, all.filter((x) => x.id !== a.id).sort((x, y) => Number(y.city_id === a.city_id) - Number(x.city_id === a.city_id)).slice(0, 3));
  const [covers, { data: city }] = await Promise.all([
    articleCovers([a, ...others]),
    a.city_id ? supabase.from("cities").select("name,slug").eq("id", a.city_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const cover = covers.get(a.id) ?? null;

  return (
    <article className="mx-auto max-w-6xl px-4 pb-10 md:pt-6">
      <JsonLd data={[
        breadcrumb([{ name: "Beranda", path: "/" }, { name: "Artikel", path: "/artikel" }, { name: a.title, path: `/artikel/${a.slug}` }]),
        {
          "@context": "https://schema.org", "@type": "BlogPosting", headline: a.title, description: a.meta_description || a.excerpt || undefined,
          image: cover ? [abs(cover)] : undefined, datePublished: a.published_at ?? a.created_at, dateModified: a.updated_at,
          author: { "@type": "Organization", name: APP_NAME, url: SITE_URL }, publisher: ORGANIZATION, mainEntityOfPage: url,
          ...(a.like_count ? { interactionStatistic: { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: a.like_count } } : {}),
        },
      ]} />

      {/* Foto sampul selebar layar dengan judul di atasnya; isi artikel di lembar krem supaya nyaman dibaca */}
      <header className="relative isolate -mx-4 flex min-h-[min(76svh,620px)] flex-col justify-end overflow-hidden bg-espresso px-5 pb-14 pt-24 text-foam md:mx-0 md:min-h-[520px] md:rounded-[2rem] md:px-12 md:pb-12">
        {cover && <FadeImage src={cover} alt={a.cover_alt || a.title} fill priority sizes="(max-width:768px) 100vw, 1152px" className="-z-10 object-cover" />}
        <span className="absolute inset-0 -z-10 bg-gradient-to-t from-espresso via-espresso/65 to-espresso/10" aria-hidden />
        <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2 md:inset-x-6 md:top-6">
          <BackButton fallback="/artikel" className="glass-dark grid h-11 w-11 place-items-center rounded-full text-foam" />
          {viewer.isAdmin && <Link href={`/admin/artikel/${a.id}`} className="glass-dark inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold">{t("Edit artikel")}</Link>}
        </div>
        <div className="max-w-3xl">
          {city ? (
            <Link href={`/kota/${city.slug}`} className="glass-dark inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold hover:bg-foam hover:text-ink">{city.name}</Link>
          ) : (
            <span className="glass-dark inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold">{t("Panduan")}</span>
          )}
          <h1 className="mt-3 text-[clamp(2.1rem,7.5vw,3.75rem)] font-extrabold leading-[1.06] tracking-tight [text-shadow:0_2px_18px_rgb(0_0_0/0.35)]">{a.title}</h1>
          <div className="mt-5 flex items-end justify-between gap-4">
            <ArticleByline a={a} light />
            <ArticleActions variant="save" id={a.id} slug={a.slug} title={a.title} url={url} loggedIn={!!viewer.user}
              liked={!!liked.data} saved={!!saved.data} likes={a.like_count ?? 0} views={a.view_count ?? 0} />
          </div>
        </div>
      </header>

      <div className="relative -mx-4 -mt-8 rounded-t-[2rem] bg-canvas px-4 pt-3 md:mx-auto md:mt-10 md:max-w-3xl md:rounded-none md:px-0 md:pt-0">
        <span className="mx-auto mb-5 block h-1 w-10 rounded-full bg-line md:hidden" aria-hidden />
        {a.updated_at.slice(0, 10) !== (a.published_at ?? a.created_at).slice(0, 10) && <p className="text-sm text-muted">{t("Diperbarui {date}", { date: dateText(a.updated_at, locale) })}</p>}
        {a.excerpt && <p className="mt-2 text-xl font-semibold leading-relaxed text-ink">{a.excerpt}</p>}
        <div className="mt-6"><ArticleBody body={a.body} cafes={cafes} line={asSpacing(a.line_spacing)} gap={asSpacing(a.paragraph_spacing)} /></div>

        <div className="mt-10 border-t border-line pt-5">
          <p className="mb-3 font-semibold">{t("Bermanfaat? Bagikan ke teman kerjamu.")}</p>
          <ArticleActions track hideSave id={a.id} slug={a.slug} title={a.title} url={url} loggedIn={!!viewer.user}
            liked={!!liked.data} saved={!!saved.data} likes={a.like_count ?? 0} views={a.view_count ?? 0} />
        </div>

        {!!others.length && <RelatedList items={others} covers={covers} />}

        <aside className="mt-12 rounded-[1.75rem] bg-brand p-6 text-white">
          <p className="text-lg font-bold">{t("Punya kafe yang ada di artikel ini?")}</p>
          <p className="mt-1 text-white/85">{t("Klaim halamannya, pantau berapa orang yang melihat kafemu, dan tampil di urutan atas pencarian.")}</p>
          <Link href="/untuk-kafe" className="btn mt-4 min-h-11 bg-white text-brand hover:bg-foam">{t("Untuk pemilik kafe")}</Link>
        </aside>
      </div>
    </article>
  );
}

async function RelatedList({ items, covers }: { items: ManualArticle[]; covers: Map<string, string | null> }) {
  const { t } = await getT();
  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold">{t("Baca juga")}</h2>
      <ul className="mt-2">
        {items.map((x) => {
          const c = covers.get(x.id);
          return (
            <li key={x.id} className="border-b border-line last:border-0">
              <Link href={`/artikel/${x.slug}`} className="group flex items-center gap-4 py-4">
                <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-tint">
                  {c && <FadeImage src={c} alt="" fill sizes="80px" className="object-cover" />}
                </span>
                <span className="line-clamp-2 font-bold leading-snug group-hover:text-brand">{x.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
