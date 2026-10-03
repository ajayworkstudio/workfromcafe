import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { FavoriteButton, UnlockButton, VisitedButton } from "@/components/ActionButtons";
import type { Cafe, CafeDetails, MenuItem } from "@/lib/types";
import { CAFE_LIST_SELECT, DAYS, SITE_URL, coverUrl, isOpenNow, priceLabel, rupiah } from "@/lib/utils";

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
  const viewer = await getViewer();

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

  return (
    <article className="mx-auto max-w-5xl px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Galeri */}
      <div className="grid gap-2 overflow-hidden rounded-3xl md:grid-cols-[2fr_1fr]">
        <div className="relative aspect-[4/3] bg-gradient-to-br from-latte to-bean md:aspect-auto md:min-h-[380px]">
          {photos[0] ? <Image src={photos[0].url} alt={cafe.name} fill priority sizes="(max-width:768px) 100vw, 66vw" className="object-cover" />
            : <div className="grid h-full place-items-center text-7xl text-crema/60">☕</div>}
        </div>
        <div className="hidden grid-rows-2 gap-2 md:grid">
          {[1, 2].map((i) => (
            <div key={i} className="relative bg-foam">
              {photos[i] && <Image src={photos[i].url} alt="" fill sizes="33vw" className="object-cover" />}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_300px]">
        <div>
          <Link href={`/kota/${cafe.city?.slug}`} className="text-sm font-semibold uppercase tracking-widest text-terra">
            {cafe.city?.name}{cafe.area ? ` · ${cafe.area}` : ""}
          </Link>
          <h1 className="mt-1 font-display text-4xl font-bold leading-tight">{cafe.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {cafe.my_rating != null && <span className="chip !bg-roast !text-crema">★ {Number(cafe.my_rating).toFixed(1)} versi aku</span>}
            <span className="chip">{priceLabel(cafe.price_range)}</span>
            {open !== null && <span className={`chip ${open ? "!border-leaf !text-leaf" : ""}`}>{open ? "Sedang buka" : "Sedang tutup"}</span>}
            {tags.map((t) => <span key={t.id} className="chip">{t.name}</span>)}
          </div>
          {cafe.short_review && <p className="mt-5 text-lg leading-relaxed">{cafe.short_review}</p>}

          <div className="mt-5 flex flex-wrap gap-2">
            <FavoriteButton cafeId={cafe.id} slug={cafe.slug} active={!!fav.data} loggedIn={!!viewer.user} />
            <VisitedButton cafeId={cafe.id} slug={cafe.slug} active={!!visit.data} loggedIn={!!viewer.user} />
            <a href={mapsUrl} target="_blank" rel="noopener" className="btn-ghost">↗ Buka di Google Maps</a>
          </div>

          {/* ===== Konten premium ===== */}
          {unlocked ? (
            <>
              {d?.full_review && (
                <section className="mt-10">
                  <h2 className="font-display text-2xl font-bold">Ulasan lengkap</h2>
                  <p className="mt-3 whitespace-pre-line leading-relaxed text-bean">{d.full_review}</p>
                </section>
              )}
              {(d?.tips || d?.best_time) && (
                <section className="mt-6 grid gap-3 sm:grid-cols-2">
                  {d?.tips && <div className="card bg-foam p-4"><p className="label">Tips dari aku</p><p>{d.tips}</p></div>}
                  {d?.best_time && <div className="card bg-foam p-4"><p className="label">Waktu terbaik</p><p>{d.best_time}</p></div>}
                </section>
              )}
              <section className="mt-10">
                <h2 className="font-display text-2xl font-bold">Menu rekomendasi</h2>
                <div className="mt-4 space-y-3">
                  {items.map((m) => (
                    <div key={m.id} className="card flex gap-4 p-3">
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-foam">
                        {m.photo_url ? <Image src={m.photo_url} alt={m.name} fill sizes="80px" className="object-cover" />
                          : <div className="grid h-full place-items-center text-2xl">🍽</div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold">{m.name}</h3>
                          <span className="shrink-0 text-sm font-semibold">{rupiah(m.price)}</span>
                        </div>
                        {m.is_must_try && <span className="mt-1 inline-block rounded-full bg-terra px-2 py-0.5 text-[10px] font-bold uppercase text-white">Wajib coba</span>}
                        {m.note && <p className="mt-1 text-sm text-bean/80">{m.note}</p>}
                      </div>
                    </div>
                  ))}
                  {!items.length && <p className="text-bean/70">Menu belum ditambahkan.</p>}
                </div>
              </section>
            </>
          ) : (
            <section className="relative mt-10 overflow-hidden rounded-3xl border border-roast/10">
              <div className="pointer-events-none select-none space-y-3 p-6 blur-sm" aria-hidden>
                <div className="h-6 w-48 rounded bg-foam" />
                <div className="h-4 w-full rounded bg-foam" />
                <div className="h-4 w-5/6 rounded bg-foam" />
                <div className="h-20 rounded-xl bg-foam" />
                <div className="h-20 rounded-xl bg-foam" />
              </div>
              <div className="absolute inset-0 grid place-items-center bg-crema/70 p-6 text-center">
                <div className="max-w-sm">
                  <p className="font-display text-2xl font-bold">Ulasan lengkap & {items.length || "semua"} menu rekomendasi</p>
                  <p className="mt-2 text-sm text-bean/80">Khusus pelanggan. Member gratis bisa membuka beberapa kafe tiap bulan.</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {!viewer.user ? (
                      <Link href={`/masuk?next=/kafe/${cafe.slug}`} className="btn-dark">Masuk untuk membuka</Link>
                    ) : (left.data as number) > 0 ? (
                      <UnlockButton cafeId={cafe.id} slug={cafe.slug} left={left.data as number} />
                    ) : null}
                    <Link href="/harga" className="btn-primary">Langganan</Link>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-4">
            <p className="label">Alamat</p>
            <p className="text-sm">{cafe.address ?? "-"}</p>
          </div>
          <div className="card p-4">
            <p className="label">Jam buka</p>
            <table className="w-full text-sm">
              <tbody>
                {DAYS.map(({ key, label }) => {
                  const h = cafe.opening_hours?.[key];
                  return (
                    <tr key={key}>
                      <td className="py-0.5 text-bean/70">{label}</td>
                      <td className="py-0.5 text-right">{h ? `${h[0]}–${h[1]}` : "Tutup"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {cafe.visited_at && (
            <p className="px-1 text-xs text-bean/60">
              Terakhir aku kunjungi {new Date(cafe.visited_at).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
            </p>
          )}
        </aside>
      </div>
    </article>
  );
}
