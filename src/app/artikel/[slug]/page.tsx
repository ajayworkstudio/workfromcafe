import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import FadeImage from "@/components/FadeImage";
import ArticleBody, { asSpacing } from "@/components/ArticleBody";
import ArticleActions from "@/components/ArticleActions";
import { abs, breadcrumb, clip, ORGANIZATION } from "@/lib/seo";
import { cafesBySlugs, embeddedSlugs, getManualArticles, type ManualArticle } from "@/lib/articles";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { APP_NAME, SITE_URL, coverUrl } from "@/lib/utils";

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

const dateText = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

export default async function ArticlePage({ params }: { params: P }) {
  const { slug } = await params;
  const [a, viewer, all] = await Promise.all([find(slug), getViewer(), getManualArticles()]);
  if (!a) notFound();
  const url = `${SITE_URL}/artikel/${a.slug}`;
  const supabase = await createClient();
  const [cafes, liked, saved] = await Promise.all([
    cafesBySlugs(embeddedSlugs(a.body)),
    viewer.user ? supabase.from("article_likes").select("article_id").eq("article_id", a.id).eq("user_id", viewer.user.id).maybeSingle() : Promise.resolve({ data: null }),
    viewer.user ? supabase.from("article_saves").select("article_id").eq("article_id", a.id).eq("user_id", viewer.user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  // Artikel lain: yang sekota dulu, lalu yang terbaru
  const others = all.filter((x) => x.id !== a.id).sort((x, y) => Number(y.city_id === a.city_id) - Number(x.city_id === a.city_id)).slice(0, 3);
  const actions = (track: boolean) => (
    <ArticleActions id={a.id} slug={a.slug} title={a.title} url={url} track={track} loggedIn={!!viewer.user}
      liked={!!liked.data} saved={!!saved.data} likes={a.like_count ?? 0} views={a.view_count ?? 0} />
  );

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <JsonLd data={[
        breadcrumb([{ name: "Beranda", path: "/" }, { name: "Artikel", path: "/artikel" }, { name: a.title, path: `/artikel/${a.slug}` }]),
        {
          "@context": "https://schema.org", "@type": "BlogPosting", headline: a.title, description: a.meta_description || a.excerpt || undefined,
          image: a.cover_url ? [abs(a.cover_url)] : cafes.map((c) => coverUrl(c)).filter(Boolean).slice(0, 1), datePublished: a.published_at ?? a.created_at, dateModified: a.updated_at,
          author: { "@type": "Organization", name: APP_NAME, url: SITE_URL }, publisher: ORGANIZATION, mainEntityOfPage: url,
          ...(a.like_count ? { interactionStatistic: { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: a.like_count } } : {}),
        },
      ]} />
      <div className="flex items-center justify-between gap-3">
        <Link href="/artikel" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted hover:text-ink">← Artikel</Link>
        {viewer.isAdmin && <Link href={`/admin/artikel/${a.id}`} className="btn-ghost min-h-11 text-sm">Edit artikel</Link>}
      </div>
      <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-extrabold leading-tight">{a.title}</h1>
      <p className="mt-2 text-sm text-muted">{APP_NAME} · {dateText(a.published_at ?? a.created_at)}{a.updated_at.slice(0, 10) !== (a.published_at ?? a.created_at).slice(0, 10) ? ` · diperbarui ${dateText(a.updated_at)}` : ""}</p>
      <div className="mt-4">{actions(true)}</div>
      {a.cover_url && (
        <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-[var(--radius-photo)] bg-tint">
          <FadeImage src={a.cover_url} alt={a.cover_alt || a.title} fill priority sizes="(max-width:768px) 100vw, 768px" className="object-cover" />
        </div>
      )}
      {a.excerpt && <p className="mt-6 text-lg font-medium text-ink">{a.excerpt}</p>}
      <div className="mt-6"><ArticleBody body={a.body} cafes={cafes} line={asSpacing(a.line_spacing)} gap={asSpacing(a.paragraph_spacing)} /></div>

      <div className="mt-10 border-t border-line pt-5">
        <p className="mb-3 font-semibold">Bermanfaat? Simpan atau bagikan ke teman kerjamu.</p>
        {actions(false)}
      </div>

      {!!others.length && <RelatedList items={others} />}

      <aside className="mt-12 rounded-[1.75rem] bg-brand p-6 text-white">
        <p className="text-lg font-bold">Punya kafe yang ada di artikel ini?</p>
        <p className="mt-1 text-white/85">Klaim halamannya, pantau berapa orang yang melihat kafemu, dan tampil di urutan atas pencarian.</p>
        <Link href="/untuk-kafe" className="btn mt-4 min-h-11 bg-white text-brand hover:bg-foam">Untuk pemilik kafe</Link>
      </aside>
    </article>
  );
}

function RelatedList({ items }: { items: ManualArticle[] }) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold">Baca juga</h2>
      <ul className="mt-3 space-y-2">
        {items.map((x) => (
          <li key={x.id}><Link href={`/artikel/${x.slug}`} className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline">{x.title}</Link></li>
        ))}
      </ul>
    </section>
  );
}
