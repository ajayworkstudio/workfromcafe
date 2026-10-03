import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import Icon from "@/components/Icon";
import { FavoriteButton, UnlockButton, VisitedButton } from "@/components/ActionButtons";
import type { Cafe, CafeDetails, MenuItem } from "@/lib/types";
import { CAFE_LIST_SELECT, DAYS, formatSlot, SITE_URL, coverUrl, isOpenNow, priceLabel, rupiah } from "@/lib/utils";

type P = Promise<{ slug: string }>;

async function getCafe(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("cafes").select(CAFE_LIST_SELECT).eq("slug", slug).maybeSingle();
  return data as Cafe | null;
}

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const { slug } = await params;
  const cafe = await getCafe(slug);
  if (!cafe) return {};
  const cover = coverUrl(cafe);
  const title = `${cafe.name} — ${cafe.city?.name}`;
  return {
    title,
    description: cafe.short_review ?? `Ulasan ${cafe.name} di ${cafe.city?.name}`,
    openGraph: { title, description: cafe.short_review ?? undefined, images: cover ? [cover] : undefined },
    alternates: { canonical: `/kafe/${cafe.slug}` },
  };
}

export default async function CafeDetailPage({ params }: { params: P }) {
  const { slug } = await params;
  const cafe = await getCafe(slug);
  if (!cafe) notFound();

  const supabase = await createClient();
  const [viewer, settings] = await Promise.all([getViewer(), getSettings()]);

  // RLS yang menentukan: baris ini hanya kembali kalau pengguna berhak.
  const [{ data: details }, { data: menu }, fav, visit, left] = await Promise.all([
    supabase.from("cafe_details").select("*").eq("cafe_id", cafe.id).maybeSingle(),
    supabase.from("menu_items").select("*").eq("cafe_id", cafe.id).order("sort_order"),
    viewer.user
      ? supabase.from("favorites").select("cafe_id").eq("cafe_id", cafe.id).eq("user_id", viewer.user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    viewer.user
      ? supabase.from("user_visits").select("cafe_id").eq("cafe_id", cafe.id).eq("user_id", viewer.user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    viewer.user ? supabase.rpc("free_unlocks_left") : Promise.resolve({ data: 0 }),
  ]);

  const d = details as CafeDetails | null;
  const items = (menu as MenuItem[] | null) ?? [];
  const unlocked = !!d;
  const photos = [...(cafe.photos ?? [])].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);
  const open = isOpenNow(cafe.opening_hours);
  const tags = (cafe.tags ?? []).map((t) => t.tag).filter(Boolean);
  const mapsUrl = cafe.lat && cafe.lng
    ? `https://www.google.com/maps/search/?api=1&query=${cafe.lat},${cafe.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${cafe.name} ${cafe.address ?? ""}`)}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CafeOrCoffeeShop",
    name: cafe.name,
    address: { "@type": "PostalAddress", streetAddress: cafe.address, addressLocality: cafe.city?.name, addressRegion: cafe.city?.province, addressCountry: "ID" },
    geo: cafe.lat ? { "@type": "GeoCoordinates", latitude: cafe.lat, longitude: cafe.lng } : undefined,
    image: coverUrl(cafe) ?? undefined,
    priceRange: priceLabel(cafe.price_range),
    url: `${SITE_URL}/kafe/${cafe.slug}`,
  };

  const today = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", weekday: "short" }).format(new Date()).toLowerCase().slice(0, 3);

  return (
    <article className="mx-auto max-w-6xl px-4 pb-10 pt-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Galeri */}
      <div className={`grid gap-2 ${photos.length >= 3 ? "md:grid-cols-[2fr_1fr]" : ""}`}>
        <div className={`relative aspect-[4/3] overflow-hidden rounded-[var(--radius-photo)] bg-tint md:aspect-auto ${photos.length >= 3 ? "md:min-h-[420px]" : "md:h-[440px]"}`}>
          {photos[0] ? <Image src={photos[0].url} alt={cafe.name} fill priority sizes="(max-width:768px) 100vw, 66vw" className="object-cover" />
            : <div className="grid h-full place-items-center text-mist"><Icon name="cup" className="h-16 w-16" /></div>}
        </div>
        {photos.length >= 3 && <div className="hidden grid-rows-2 gap-2 md:grid">
          {[1, 2].map((i) => (
            <div key={i} className="relative overflow-hidden rounded-[var(--radius-photo)] bg-tint">
              {photos[i] && <Image src={photos[i].url} alt="" fill sizes="33vw" className="object-cover" />}
            </div>
          ))}
        </div>}
      </div>

      <div className="mt-8 grid gap-10 md:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Link href={`/kota/${cafe.city?.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand">
            <Icon name="pin" className="h-4 w-4" />
            {[cafe.area, cafe.city?.name].filter(Boolean).join(", ")}
          </Link>
          <h1 className="mt-2 text-4xl font-extrabold leading-[1.05] md:text-5xl">{cafe.name}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {cafe.my_rating != null && (
              <span className="flex items-center gap-1.5 font-semibold">
                <Icon name="star" filled className="h-4 w-4 text-gold" />
                {Number(cafe.my_rating).toFixed(1)} <span className="font-normal text-muted">dari aku</span>
              </span>
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

          {/* ===== Konten premium ===== */}
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
              <section className="mt-12">
                <h2 className="text-2xl font-bold">Yang layak dipesan</h2>
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
              </section>
            </>
          ) : (
            <section className="mt-12 rounded-3xl bg-ink p-7 text-white md:p-9">
              <Icon name="lock" className="h-6 w-6 text-gold" />
              <h2 className="mt-4 text-2xl font-bold md:text-3xl">Ulasan lengkap dan menu yang layak dipesan</h2>
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
          {cafe.visited_at && (
            <p className="border-t border-line pt-4 text-sm text-muted">
              Terakhir aku datangi {new Date(cafe.visited_at).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}.
            </p>
          )}
        </aside>
      </div>
    </article>
  );
}
