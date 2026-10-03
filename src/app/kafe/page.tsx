import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CafeCard from "@/components/CafeCard";
import type { Cafe, City, Tag } from "@/lib/types";
import { CAFE_LIST_SELECT, isOpenNow, priceLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Jelajah kafe" };

type SP = Promise<{ q?: string; kota?: string; tag?: string | string[]; harga?: string; buka?: string }>;

export default async function CafesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const selectedTags = ([] as string[]).concat(sp.tag ?? []);
  const supabase = await createClient();

  const [{ data: cities }, { data: tags }] = await Promise.all([
    supabase.from("cities").select("*").eq("is_active", true).order("name"),
    supabase.from("tags").select("*").order("name"),
  ]);

  let query = supabase.from("cafes").select(CAFE_LIST_SELECT).order("my_rating", { ascending: false, nullsFirst: false });
  if (sp.q) {
    const q = sp.q.replace(/[%,()]/g, " ");
    query = query.or(`name.ilike.%${q}%,area.ilike.%${q}%,short_review.ilike.%${q}%`);
  }
  if (sp.kota) {
    const city = (cities as City[] | null)?.find((c) => c.slug === sp.kota);
    if (city) query = query.eq("city_id", city.id);
  }
  if (sp.harga) query = query.lte("price_range", Number(sp.harga));

  const { data } = await query;
  let cafes = (data as Cafe[] | null) ?? [];
  // Filter tag (harus punya SEMUA tag yang dipilih) & buka sekarang
  if (selectedTags.length) {
    cafes = cafes.filter((c) => {
      const names = (c.tags ?? []).map((t) => t.tag?.name);
      return selectedTags.every((t) => names.includes(t));
    });
  }
  if (sp.buka === "1") cafes = cafes.filter((c) => isOpenNow(c.opening_hours));

  const vibe = (tags as Tag[] | null)?.filter((t) => t.type === "vibe") ?? [];
  const facility = (tags as Tag[] | null)?.filter((t) => t.type === "facility") ?? [];

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[260px_1fr]">
      <aside>
        <form className="card sticky top-20 space-y-5 p-4">
          <div>
            <label className="label">Cari</label>
            <input name="q" defaultValue={sp.q} placeholder="Nama, area…" className="input" />
          </div>
          <div>
            <label className="label">Kota</label>
            <select name="kota" defaultValue={sp.kota ?? ""} className="input">
              <option value="">Semua kota</option>
              {(cities as City[] | null)?.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Harga maksimal</label>
            <select name="harga" defaultValue={sp.harga ?? ""} className="input">
              <option value="">Semua</option>
              {[1, 2, 3, 4].map((p) => <option key={p} value={p}>{priceLabel(p)}</option>)}
            </select>
          </div>
          <TagGroup title="Suasana" tags={vibe} selected={selectedTags} />
          <TagGroup title="Fasilitas" tags={facility} selected={selectedTags} />
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="buka" value="1" defaultChecked={sp.buka === "1"} className="accent-terra" />
            Buka sekarang
          </label>
          <div className="flex gap-2">
            <button className="btn-dark flex-1">Terapkan</button>
            <Link href="/kafe" className="btn-ghost">Reset</Link>
          </div>
        </form>
      </aside>

      <section>
        <h1 className="font-display text-3xl font-bold">Jelajah kafe</h1>
        <p className="mt-1 text-sm text-bean/70">{cafes.length} kafe ditemukan</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cafes.map((c) => <CafeCard key={c.id} cafe={c} />)}
        </div>
        {!cafes.length && <p className="card mt-6 p-8 text-center text-bean/70">Belum ada kafe yang cocok dengan filter ini.</p>}
      </section>
    </div>
  );
}

function TagGroup({ title, tags, selected }: { title: string; tags: Tag[]; selected: string[] }) {
  return (
    <div>
      <span className="label">{title}</span>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <label key={t.id} className="cursor-pointer">
            <input type="checkbox" name="tag" value={t.name} defaultChecked={selected.includes(t.name)} className="peer sr-only" />
            <span className="chip peer-checked:border-terra peer-checked:bg-terra peer-checked:text-white">{t.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
