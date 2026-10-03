import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import CafeMapLoader from "@/components/CafeMapLoader";

export const metadata: Metadata = { title: "Peta kafe" };

export default async function MapPage() {
  const viewer = await getViewer();

  if (!viewer.isPremium && !viewer.isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-roast text-2xl text-crema">⌖</div>
        <h1 className="mt-5 font-display text-3xl font-bold">Peta semua kafe</h1>
        <p className="mt-2 text-bean/70">Lihat sebaran semua kafe di Jawa Tengah dalam satu peta. Fitur khusus pelanggan premium.</p>
        <Link href="/harga" className="btn-primary mt-6">Lihat paket langganan</Link>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.from("cafes").select("slug,name,lat,lng,my_rating,city:cities(name)").not("lat", "is", null);
  const cafes = ((data ?? []) as unknown as { slug: string; name: string; lat: number; lng: number; my_rating: number | null; city: { name: string } | null }[])
    .map((c) => ({ slug: c.slug, name: c.name, lat: c.lat, lng: c.lng, city: c.city?.name ?? "", rating: c.my_rating }));

  return (
    <div className="h-[calc(100dvh-3.5rem-64px)] md:h-[calc(100dvh-3.5rem)]">
      <CafeMapLoader cafes={cafes} />
    </div>
  );
}
