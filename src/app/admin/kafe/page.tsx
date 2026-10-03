import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { priceLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCafes() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cafes")
    .select("id,name,slug,is_published,is_featured,my_rating,price_range,city:cities(name),menu_items(count)")
    .order("created_at", { ascending: false });

  type Row = { id: string; name: string; slug: string; is_published: boolean; is_featured: boolean; my_rating: number | null; price_range: number; city: { name: string } | null; menu_items: { count: number }[] };

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs font-medium text-muted">
          <tr><th className="p-3">Kafe</th><th className="p-3">Kota</th><th className="p-3">Rating</th><th className="p-3">Harga</th><th className="p-3">Menu</th><th className="p-3">Status</th><th /></tr>
        </thead>
        <tbody className="divide-y divide-ink/10">
          {((data ?? []) as unknown as Row[]).map((c) => (
            <tr key={c.id}>
              <td className="p-3 font-semibold">{c.name}{c.is_featured && <span className="ml-2 chip">Favorit</span>}</td>
              <td className="p-3">{c.city?.name}</td>
              <td className="p-3">{c.my_rating ?? "-"}</td>
              <td className="p-3">{priceLabel(c.price_range)}</td>
              <td className="p-3">{c.menu_items?.[0]?.count ?? 0}</td>
              <td className="p-3"><span className="chip">{c.is_published ? "Tayang" : "Draf"}</span></td>
              <td className="p-3 text-right">
                <Link href={`/admin/kafe/${c.id}`} className="font-semibold text-brand">Edit</Link>
                <Link href={`/kafe/${c.slug}`} className="ml-3 text-muted/60">Lihat</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!data?.length && <p className="p-4 text-muted/60">Belum ada kafe. Tambahkan yang pertama!</p>}
    </div>
  );
}
