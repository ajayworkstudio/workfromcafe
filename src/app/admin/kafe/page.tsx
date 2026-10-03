import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { toggleCafeFlag } from "./actions";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import Icon from "@/components/Icon";
import { coverUrl, priceLabel } from "@/lib/utils";
import type { City, Photo } from "@/lib/types";

type SP = Promise<{ q?: string; kota?: string; status?: string; ok?: string }>;
type Row = {
  id: string; name: string; slug: string; area: string | null; is_published: boolean; is_featured: boolean;
  my_rating: number | null; price_range: number; updated_at: string;
  city: { name: string } | null; photos: Photo[]; menu_items: { count: number }[];
};

export default async function AdminCafes({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("cafes")
    .select("id,name,slug,area,is_published,is_featured,my_rating,price_range,updated_at,city:cities(name),photos:cafe_photos(id,url,is_cover,sort_order),menu_items(count)")
    .order("updated_at", { ascending: false });
  if (sp.q) query = query.or(`name.ilike.%${sp.q.replace(/[%,()]/g, " ")}%,area.ilike.%${sp.q.replace(/[%,()]/g, " ")}%`);
  if (sp.kota) query = query.eq("city_id", sp.kota);
  if (sp.status === "tayang") query = query.eq("is_published", true);
  if (sp.status === "draf") query = query.eq("is_published", false);
  if (sp.status === "favorit") query = query.eq("is_featured", true);

  const [{ data }, { data: cities }] = await Promise.all([query, supabase.from("cities").select("id,name").order("name")]);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="Kafe" description={`${rows.length} kafe${sp.q || sp.kota || sp.status ? " cocok dengan filter" : ""}`}
        action={<Link href="/admin/kafe/baru" className="btn-primary"><Icon name="plus" className="h-4 w-4" />Tambah kafe</Link>} />
      <Flash ok={sp.ok} />

      <form className="mb-5 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={sp.q} placeholder="Cari nama atau area" aria-label="Cari kafe" className="input !pl-9" />
        </div>
        <select name="kota" defaultValue={sp.kota ?? ""} aria-label="Kota" className="input !w-auto">
          <option value="">Semua kota</option>
          {(cities as Pick<City, "id" | "name">[] | null)?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="input !w-auto">
          <option value="">Semua status</option>
          <option value="tayang">Tayang</option>
          <option value="draf">Draf</option>
          <option value="favorit">Favorit</option>
        </select>
        <button className="btn-dark">Terapkan</button>
      </form>

      <div className="card divide-y divide-line">
        {rows.map((c) => {
          const cover = coverUrl(c);
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-4 p-3 sm:flex-nowrap">
              <Link href={`/admin/kafe/${c.id}`} className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-tint">
                {cover ? <Image src={cover} alt="" fill sizes="80px" className="object-cover" />
                  : <span className="grid h-full place-items-center text-mist"><Icon name="image" className="h-6 w-6" /></span>}
              </Link>
              <div className="min-w-0 flex-1 basis-40">
                <Link href={`/admin/kafe/${c.id}`} className="font-semibold hover:text-brand">{c.name}</Link>
                <p className="truncate text-sm text-muted">
                  {[c.area, c.city?.name].filter(Boolean).join(", ")} · {priceLabel(c.price_range)} · {c.menu_items?.[0]?.count ?? 0} menu · {c.photos.length} foto
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className={`chip ${c.is_published ? "!bg-ok/10 !text-ok" : ""}`}>{c.is_published ? "Tayang" : "Draf"}</span>
                  {c.is_featured && <span className="chip !bg-gold/20 !text-[#7a4f00]">Favorit</span>}
                  {c.my_rating != null && <span className="chip"><Icon name="star" filled className="h-3 w-3 text-gold" />{Number(c.my_rating).toFixed(1)}</span>}
                </div>
              </div>
              <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
                <form action={toggleCafeFlag}>
                  <input type="hidden" name="id" value={c.id} /><input type="hidden" name="field" value="is_published" />
                  <input type="hidden" name="value" value={String(!c.is_published)} />
                  <button className="btn-ghost !px-3 !py-2" title={c.is_published ? "Sembunyikan dari publik" : "Tayangkan"}>
                    <Icon name={c.is_published ? "eyeOff" : "eye"} className="h-4 w-4" />
                    <span className="hidden lg:inline">{c.is_published ? "Sembunyikan" : "Tayangkan"}</span>
                  </button>
                </form>
                <form action={toggleCafeFlag}>
                  <input type="hidden" name="id" value={c.id} /><input type="hidden" name="field" value="is_featured" />
                  <input type="hidden" name="value" value={String(!c.is_featured)} />
                  <button className="btn-ghost !px-3 !py-2" title={c.is_featured ? "Hapus dari favorit" : "Jadikan favorit"} aria-pressed={c.is_featured}>
                    <Icon name="star" filled={c.is_featured} className={`h-4 w-4 ${c.is_featured ? "text-gold" : ""}`} />
                  </button>
                </form>
                <Link href={`/admin/kafe/${c.id}`} className="btn-dark !px-3 !py-2"><Icon name="edit" className="h-4 w-4" />Edit</Link>
              </div>
            </div>
          );
        })}
        {!rows.length && (
          <div className="p-8 text-center">
            <p className="text-muted">{sp.q || sp.kota || sp.status ? "Tidak ada kafe yang cocok dengan filter ini." : "Belum ada kafe."}</p>
            <Link href="/admin/kafe/baru" className="btn-primary mt-4">Tambah kafe pertama</Link>
          </div>
        )}
      </div>
    </>
  );
}
