import type { Metadata } from "next";
import { cache, Suspense } from "react";
import JsonLd from "@/components/JsonLd";
import { breadcrumb, clip } from "@/lib/seo";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import Icon from "@/components/Icon";
import PhotoGallery from "@/components/PhotoGallery";
import CafeScorecard from "@/components/CafeScorecard";
import CafeComments from "@/components/CafeComments";
import Avatar from "@/components/Avatar";
import AuthorBadge from "@/components/AuthorBadge";
import { AMENITIES, averageScore, filledAspects, levelOf } from "@/lib/review";
import { FavoriteButton, UnlockButton, VisitedButton } from "@/components/ActionButtons";
import ShareButton from "@/components/ShareButton";
import type { Cafe, CafeDetails, MenuItem } from "@/lib/types";
import { APP_NAME, CAFE_LIST_SELECT, DAYS, formatSlot, SITE_URL, coverUrl, isOpenNow, priceLabel, rupiah } from "@/lib/utils";

type P = Promise<{ slug: string }>;

// cache(): metadata dan halaman memakai satu query yang sama
const getCafe = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("cafes").select(CAFE_LIST_SELECT).eq("slug", slug).maybeSingle();
  return data as Cafe | null;
});

/** Deskripsi untuk Google: ulasan singkat, kalau kosong dirangkai dari penilaian & fasilitas. */
function describeCafe(cafe: Cafe) {
  const where = [cafe.area, cafe.city?.name].filter(Boolean).join(", ");
  const facts = filledAspects(cafe.scores)
    .filter((a) => ["internet", "colokan", "ketenangan"].includes(a.key))
    .map((a) => `${a.label.toLowerCase()} ${levelOf(a, a.score)[0].toLowerCase()}`);
  const base = cafe.short_review?.trim() || `Review ${cafe.name} di ${where} sebagai tempat kerja dan nugas.`;
  const factText = facts.join(", ");
  const extra = factText ? ` ${factText.charAt(0).toUpperCase()}${factText.slice(1)}.` : "";
  return clip(`${base}${extra} Harga ${priceLabel(cafe.price_range)}, jam buka & menu rekomendasi.`);
}

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const { slug } = await params;
  const cafe = await getCafe(slug);
  if (!cafe) return {};
  const cover = coverUrl(cafe);
  const title = `${cafe.name}, ${cafe.city?.name ?? ""}: review tempat kerja, wifi & colokan`;
  const description = describeCafe(cafe);
  return {
    title,
    description,
    alternates: { canonical: `/kafe/${cafe.slug}` },
    openGraph: { type: "article", title, description, url: `/kafe/${cafe.slug}`, images: cover ? [{ url: cover, alt: cafe.name }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: cover ? [cover] : undefined },
  };
}

export default async function CafeDetailPage({ params }: { params: P }) {
  const { slug } = await params;
  // Semua yang tidak saling bergantung diambil bersamaan (lebih sedikit bolak-balik ke database)
  const [cafe, viewer, settings] = await Promise.all([getCafe(slug), getViewer(), getSettings()]);
  if (!cafe) notFound();

  const supabase = await createClient();
  type AuthorCard = { name: string | null; avatar_url: string | null; bio: string | null; instagram: string | null; username?: string | null; cafe_count?: number; href?: string | null };

  // RLS yang menentukan: baris ini hanya kembali kalau pengguna berhak.
  const [{ data: details }, { data: menu }, fav, visit, left, { data: card }] = await Promise.all([
    supabase.from("cafe_details").select("*").eq("cafe_id", cafe.id).maybeSingle(),
    supabase.from("menu_items").select("*").eq("cafe_id", cafe.id).order("sort_order"),
    viewer.user
      ? supabase.from("favorites").select("cafe_id").eq("cafe_id", cafe.id).eq("user_id", viewer.user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    viewer.user
      ? supabase.from("user_visits").select("cafe_id").eq("cafe_id", cafe.id).eq("user_id", viewer.user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    viewer.user && !settings.free_mode ? supabase.rpc("free_unlocks_left") : Promise.resolve({ data: 0 }),
    // Profil author terbaru (nama, foto, bio)
    cafe.contributor_id
      ? supabase.rpc("author_card", { p_id: cafe.contributor_id }).maybeSingle<AuthorCard>()
      : Promise.resolve({ data: null as AuthorCard | null }),
  ]);

  // Fallback ke data saat rekomendasi diterima kalau profil belum publik
  let author: AuthorCard | null = null;
  if (cafe.contributor_id || cafe.contributor_name) {
    author = {
      name: card?.name || cafe.contributor_name || "Author",
      avatar_url: card?.avatar_url ?? null,
      bio: card?.bio ?? null,
      instagram: card?.instagram || cafe.contributor_instagram || null,
      cafe_count: card?.cafe_count ?? 0,
      href: card?.cafe_count != null && cafe.contributor_id ? `/author/${card.username ?? cafe.contributor_id}` : null,
    };
  }

  const d = details as CafeDetails | null;
  const items = (menu as MenuItem[] | null) ?? [];
  const free = settings.free_mode;
  const unlocked = !!d || free;
  const overall = cafe.my_rating != null ? Number(cafe.my_rating) : averageScore(cafe.scores);
  const photos = [...(cafe.photos ?? [])].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);
  const open = isOpenNow(cafe.opening_hours);
  const tags = (cafe.tags ?? []).map((t) => t.tag).filter(Boolean);
  const mapsUrl = cafe.lat && cafe.lng
    ? `https://www.google.com/maps/search/?api=1&query=${cafe.lat},${cafe.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${cafe.name} ${cafe.address ?? ""}`)}`;

  // ===== Data terstruktur (schema.org) untuk Google =====
  const url = `${SITE_URL}/kafe/${cafe.slug}`;
  const DAY_SCHEMA: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
  const openingHoursSpecification = DAYS.flatMap(({ key }) => {
    const h = cafe.opening_hours?.[key];
    return h ? [{ "@type": "OpeningHoursSpecification", dayOfWeek: `https://schema.org/${DAY_SCHEMA[key]}`, opens: h[0], closes: h[1] === "24:00" ? "23:59" : h[1] }] : [];
  });
  const amenityFeature = AMENITIES.flatMap((m) => {
    const v = cafe.amenities?.[m.key];
    return typeof v === "boolean" ? [{ "@type": "LocationFeatureSpecification", name: m.label, value: v }] : [];
  });
  const reviewAuthor = cafe.contributor_name
    ? { "@type": "Person", name: cafe.contributor_name }
    : { "@type": "Organization", name: APP_NAME, url: SITE_URL };
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CafeOrCoffeeShop",
      "@id": `${url}#cafe`,
      name: cafe.name,
      url,
      description: cafe.short_review ?? undefined,
      image: photos.slice(0, 6).map((p) => p.url),
      address: { "@type": "PostalAddress", streetAddress: cafe.address ?? undefined, addressLocality: cafe.city?.name, addressRegion: cafe.city?.province, addressCountry: "ID" },
      geo: cafe.lat ? { "@type": "GeoCoordinates", latitude: cafe.lat, longitude: cafe.lng } : undefined,
      hasMap: mapsUrl,
      priceRange: priceLabel(cafe.price_range),
      servesCuisine: ["Kopi", "Minuman"],
      currenciesAccepted: "IDR",
      openingHoursSpecification: openingHoursSpecification.length ? openingHoursSpecification : undefined,
      amenityFeature: amenityFeature.length ? amenityFeature : undefined,
      sameAs: cafe.instagram ? [`https://instagram.com/${cafe.instagram.replace(/^@/, "")}`] : undefined,
      hasMenu: items.length
        ? {
            "@type": "Menu",
            name: `Menu rekomendasi ${cafe.name}`,
            url: cafe.menu_url ?? undefined,
            hasMenuItem: items.slice(0, 15).map((m) => ({
              "@type": "MenuItem",
              name: m.name,
              description: m.note ?? undefined,
              offers: m.price ? { "@type": "Offer", price: m.price, priceCurrency: "IDR" } : undefined,
            })),
          }
        : cafe.menu_url ?? undefined,
      review: overall != null
        ? {
            "@type": "Review",
            author: reviewAuthor,
            datePublished: (cafe.visited_at ?? cafe.created_at)?.slice(0, 10),
            reviewBody: d?.full_review || cafe.short_review || undefined,
            reviewRating: { "@type": "Rating", ratingValue: Number(overall.toFixed(1)), bestRating: 5, worstRating: 1 },
            publisher: { "@type": "Organization", name: APP_NAME, url: SITE_URL },
          }
        : undefined,
    },
    breadcrumb([
      { name: "Beranda", path: "/" },
      ...(cafe.city ? [{ name: `Kafe di ${cafe.city.name}`, path: `/kota/${cafe.city.slug}` }] : []),
      { name: cafe.name, path: `/kafe/${cafe.slug}` },
    ]),
  ];

  const today = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", weekday: "short" }).format(new Date()).toLowerCase().slice(0, 3);

  return (
    <article className="mx-auto max-w-6xl px-4 pb-10 pt-6">
      <JsonLd data={jsonLd} />

      <PhotoGallery photos={photos.map((p) => ({ id: p.id, url: p.url }))} name={cafe.name} />

      <div className="mt-8 grid gap-10 md:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Link href={`/kota/${cafe.city?.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand">
            <Icon name="pin" className="h-4 w-4" />
            {[cafe.area, cafe.city?.name].filter(Boolean).join(", ")}
          </Link>
          <h1 className="mt-2 text-4xl font-extrabold leading-[1.05] md:text-5xl">{cafe.name}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {overall != null && (
              <a href="#penilaian" className="flex items-center gap-1.5 font-semibold hover:text-brand">
                <Icon name="star" filled className="h-4 w-4 text-gold" />
                {overall.toFixed(1)} <span className="font-normal text-muted">{cafe.contributor_name ? `dari ${cafe.contributor_name.split(" ")[0]}` : "dari aku"}</span>
              </a>
            )}
            <span className="text-muted">{priceLabel(cafe.price_range)}</span>
            {open !== null && (
              <span className="flex items-center gap-1.5 font-medium">
                <span className={`h-2 w-2 rounded-full ${open ? "bg-ok" : "bg-mist"}`} />
                {open ? "Sedang buka" : "Sedang tutup"}
              </span>
            )}
          </div>

          {cafe.short_review && <p className="mt-6 max-w-2xl text-xl leading-relaxed">{cafe.short_review}</p>}

          {!!tags.length && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {tags.map((t) => <span key={t.id} className="chip">{t.name}</span>)}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <FavoriteButton cafeId={cafe.id} slug={cafe.slug} active={!!fav.data} loggedIn={!!viewer.user} />
            <VisitedButton cafeId={cafe.id} slug={cafe.slug} active={!!visit.data} loggedIn={!!viewer.user} />
            <ShareButton url={`${SITE_URL}/kafe/${cafe.slug}`} title={cafe.name}
              text={`${cafe.name}${cafe.city?.name ? ` (${cafe.city.name})` : ""} enak buat kerja. Cek ulasan, colokan, dan menunya di WFC Hunters:`} />
            {cafe.menu_url && (
              <a href={cafe.menu_url} target="_blank" rel="noopener" className="btn-primary"><Icon name="book" className="h-4 w-4" />Lihat menu</a>
            )}
            <a href={mapsUrl} target="_blank" rel="noopener" className="btn-ghost"><Icon name="external" className="h-4 w-4" />Buka di Google Maps</a>
            {cafe.instagram && (
              <a href={`https://instagram.com/${cafe.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener" className="btn-ghost" aria-label={`Instagram ${cafe.name}`}>
                <Icon name="instagram" className="h-4 w-4" />@{cafe.instagram.replace(/^@/, "")}
              </a>
            )}
          </div>

          <CafeScorecard scores={cafe.scores} amenities={cafe.amenities} overall={overall} visitedAt={cafe.visited_at} byContributor={cafe.contributor_name} />

          {/* ===== Konten premium (terbuka untuk semua saat mode gratis) ===== */}
          {unlocked ? (
            <>
              {d?.full_review && (
                <section className="mt-12 max-w-2xl">
                  <h2 className="text-2xl font-bold">Ulasan lengkap</h2>
                  <p className="mt-3 whitespace-pre-line text-[1.05rem] leading-relaxed text-ink/85">{d.full_review}</p>
                </section>
              )}
              {(d?.tips || d?.best_time) && (
                <section className="mt-6 grid gap-3 sm:grid-cols-2">
                  {d?.tips && <div className="rounded-2xl bg-brand-soft p-5"><p className="text-sm font-semibold text-brand">Tips duduk</p><p className="mt-1">{d.tips}</p></div>}
                  {d?.best_time && <div className="rounded-2xl bg-brand-soft p-5"><p className="text-sm font-semibold text-brand">Waktu terbaik</p><p className="mt-1">{d.best_time}</p></div>}
                </section>
              )}
              {(items.length > 0 || !free) && <section className="mt-12">
                <h2 className="text-2xl font-bold">Menu Rekomendasi</h2>
                <ul className="mt-4 divide-y divide-line border-y border-line">
                  {items.map((m) => (
                    <li key={m.id} className="flex gap-4 py-4">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-tint">
                        {m.photo_url ? <Image src={m.photo_url} alt={m.name} fill sizes="64px" className="object-cover" />
                          : <div className="grid h-full place-items-center text-mist"><Icon name="cup" className="h-6 w-6" /></div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="flex items-center gap-2 font-sans text-base font-semibold tracking-normal">
                            {m.name}
                            {m.is_must_try && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-semibold text-[#8a5a00]">Wajib coba</span>}
                          </h3>
                          <span className="shrink-0 tabular-nums text-sm font-semibold">{rupiah(m.price)}</span>
                        </div>
                        {m.note && <p className="mt-1 text-sm text-muted">{m.note}</p>}
                      </div>
                    </li>
                  ))}
                  {!items.length && <li className="py-4 text-muted">Menu belum ditambahkan.</li>}
                </ul>
              </section>}
            </>
          ) : (
            <section className="mt-12 rounded-3xl bg-ink p-7 text-white md:p-9">
              <Icon name="lock" className="h-6 w-6 text-gold" />
              <h2 className="mt-4 text-2xl font-bold md:text-3xl">Ulasan lengkap dan menu rekomendasi</h2>
              <p className="mt-2 max-w-md text-white/70">
                Termasuk meja terbaik untuk kerja dan jam paling sepi. {settings.trial_days > 0 && !viewer.user ? `Daftar sekarang dan coba gratis ${settings.trial_days} hari.` : `Member gratis bisa membuka ${settings.free_unlock_limit_per_month} kafe setiap bulan.`}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {!viewer.user ? (
                  <Link href={`/masuk?daftar=1&next=/kafe/${cafe.slug}`} className="btn bg-white text-ink hover:bg-tint">{settings.trial_days > 0 ? `Coba gratis ${settings.trial_days} hari` : "Daftar untuk membuka"}</Link>
                ) : (left.data as number) > 0 ? (
                  <UnlockButton cafeId={cafe.id} slug={cafe.slug} left={left.data as number} />
                ) : (
                  <span className="self-center text-sm text-white/60">Jatah gratis bulan ini sudah habis.</span>
                )}
                <Link href="/harga" className="btn bg-gold text-ink hover:bg-[#e09c1c]">Berlangganan</Link>
              </div>
            </section>
          )}

          {/* Komentar dimuat menyusul supaya halaman kafe tampil lebih dulu */}
          <Suspense fallback={<div className="mt-12 h-40 animate-pulse rounded-2xl bg-tint" aria-label="Memuat komentar" />}>
            <CafeComments cafeId={cafe.id} slug={cafe.slug} viewerId={viewer.user?.id ?? null} viewerIsAdmin={viewer.isAdmin} contributorId={cafe.contributor_id} />
          </Suspense>
        </div>

        <aside className="space-y-6 md:sticky md:top-24 md:self-start">
          <div>
            <h2 className="flex items-center gap-2 font-sans text-sm font-semibold tracking-normal text-muted"><Icon name="pin" className="h-4 w-4" />Alamat</h2>
            <p className="mt-1.5">{cafe.address ?? "-"}</p>
          </div>
          <div>
            <h2 className="flex items-center gap-2 font-sans text-sm font-semibold tracking-normal text-muted"><Icon name="clock" className="h-4 w-4" />Jam buka</h2>
            <table className="mt-1.5 w-full text-sm">
              <tbody>
                {DAYS.map(({ key, label }) => {
                  const h = cafe.opening_hours?.[key];
                  const isToday = key === today;
                  return (
                    <tr key={key} className={isToday ? "font-semibold text-ink" : "text-muted"}>
                      <td className="py-1">{label}{isToday && <span className="ml-1.5 text-xs font-medium text-brand">hari ini</span>}</td>
                      <td className="py-1 text-right tabular-nums">{formatSlot(h)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {author && (
            <div className="rounded-2xl bg-brand-soft p-4">
              <div className="flex items-center gap-3">
                <Avatar url={author.avatar_url} name={author.name} className="h-11 w-11 text-base" />
                <div className="min-w-0 text-sm">
                  <p className="text-muted">Direkomendasikan oleh</p>
                  {author.href
                    ? <Link href={author.href} className="block truncate font-semibold hover:text-brand hover:underline">{author.name}</Link>
                    : <p className="truncate font-semibold">{author.name}</p>}
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {!!author.cafe_count && <AuthorBadge count={author.cafe_count} />}
                    {author.instagram && (
                      <a href={`https://instagram.com/${author.instagram}`} target="_blank" rel="noopener" className="text-brand hover:underline">@{author.instagram}</a>
                    )}
                  </div>
                </div>
              </div>
              {author.bio && <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-ink/80">{author.bio}</p>}
              {author.href && author.cafe_count! > 1 && (
                <Link href={author.href} className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">Lihat {author.cafe_count} kafe rekomendasinya →</Link>
              )}
            </div>
          )}
          {cafe.visited_at && (
            <p className="border-t border-line pt-4 text-sm text-muted">
              {cafe.contributor_name ? "Terakhir dikunjungi" : "Terakhir aku datangi"} {new Date(cafe.visited_at).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}.
            </p>
          )}
        </aside>
      </div>
    </article>
  );
}
