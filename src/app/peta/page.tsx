import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import Icon from "@/components/Icon";
import CafeMapLoader from "@/components/CafeMapLoader";
import type { MapCafe } from "@/components/CafeMap";
import type { Cafe } from "@/lib/types";
import type { LiveSummary } from "@/lib/reports";
import { CAFE_LIST_SELECT, coverThumb, priceLabel } from "@/lib/utils";
import { averageScore } from "@/lib/review";

export const metadata: Metadata = {
  title: "Peta kafe untuk kerja di Pulau Jawa",
  description: "Lihat sebaran kafe yang nyaman untuk kerja dan nugas di Jakarta, Bandung, Yogyakarta, Semarang, Solo, Surabaya, dan kota lain di Pulau Jawa dalam satu peta.",
  alternates: { canonical: "/peta" },
};

export default async function MapPage() {
  const [viewer, settings] = await Promise.all([getViewer(), getSettings()]);

  if (!settings.free_mode && !viewer.isPremium && !viewer.isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon name="map" className="h-7 w-7" /></div>
        <h1 className="mt-5 font-display text-3xl font-bold">Peta semua kafe</h1>
        <p className="mt-2 text-muted">Lihat sebaran semua kafe di Pulau Jawa dalam satu peta. Fitur khusus pelanggan premium.</p>
        <Link href="/harga" className="btn-primary mt-6">Lihat paket langganan</Link>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data }, { data: liveRows }] = await Promise.all([
    supabase.from("cafes").select(CAFE_LIST_SELECT).not("lat", "is", null).order("my_rating", { ascending: false, nullsFirst: false }),
    // Kondisi 3 jam terakhir (kosong kalau migrasi 0018 belum dijalankan)
    supabase.rpc("cafe_reports_live"),
  ]);
  const live = new Map(((liveRows as LiveSummary[] | null) ?? []).map((r) => [r.cafe_id, r]));

  // Kirim seperlunya saja ke peta (bukan seluruh baris kafe)
  const cafes: MapCafe[] = ((data as Cafe[] | null) ?? []).map((c) => {
    const names = (c.tags ?? []).map((t) => t.tag?.name);
    const l = live.get(c.id);
    return {
      slug: c.slug, name: c.name, lat: Number(c.lat), lng: Number(c.lng),
      area: c.area ?? null, city: c.city?.name ?? "",
      rating: c.my_rating != null ? Number(c.my_rating) : averageScore(c.scores),
      price: priceLabel(c.price_range), cover: coverThumb(c), hours: c.opening_hours ?? null,
      wifi: names.includes("Wifi") || c.amenities?.wifi === true,
      plug: names.includes("Colokan") || c.amenities?.colokan === true,
      live: l ? { crowd: l.crowd, mbps: l.download_mbps != null ? Math.round(Number(l.download_mbps)) : null, at: l.last_at } : null,
    };
  });

  return (
    <div className="h-[calc(100dvh-4rem-5.5rem)] md:h-[calc(100dvh-4rem)]">
      <h1 className="sr-only">Peta kafe</h1>
      <CafeMapLoader cafes={cafes} />
    </div>
  );
}
