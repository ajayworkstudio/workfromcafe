// Halaman landing per area (kecamatan/kawasan) di dalam kota, misalnya /kota/semarang/banyumanik.
// Hanya area dengan minimal MIN_AREA_CAFES kafe tayang yang punya halaman, supaya tidak ada halaman tipis.

import type { Cafe } from "./types";

export const MIN_AREA_CAFES = 3;

export const areaSlug = (area: string) =>
  area.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Area yang layak punya halaman: [{ slug, name, count }], nama ditulis rapi (huruf awal kapital). */
export function areasOf(cafes: Cafe[]) {
  const map = new Map<string, { slug: string; name: string; count: number }>();
  for (const c of cafes) {
    if (!c.area?.trim()) continue;
    const slug = areaSlug(c.area);
    if (!slug) continue;
    const cur = map.get(slug);
    // Pakai penulisan yang paling sering dipakai; huruf awal tiap kata kapital
    const name = c.area.trim().replace(/\b\w/g, (ch) => ch.toUpperCase());
    map.set(slug, { slug, name: cur?.name ?? name, count: (cur?.count ?? 0) + 1 });
  }
  return [...map.values()].filter((a) => a.count >= MIN_AREA_CAFES).sort((a, b) => b.count - a.count);
}

export const areaHref = (citySlug: string, area: string) => `/kota/${citySlug}/${areaSlug(area)}`;
