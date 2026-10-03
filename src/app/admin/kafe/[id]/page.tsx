import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CafeForm from "@/components/admin/CafeForm";
import PhotoManager from "@/components/admin/PhotoManager";
import MenuEditor from "@/components/admin/MenuEditor";
import ConfirmButton from "@/components/admin/ConfirmButton";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import Icon from "@/components/Icon";
import { deleteCafe } from "../actions";
import type { Cafe, CafeDetails, City, MenuItem, Photo, Tag } from "@/lib/types";

export default async function EditCafe({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const [{ id }, { ok, err }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [{ data: cafe }, { data: details }, { data: cities }, { data: tags }, { data: cafeTags }, { data: photos }, { data: menu }] = await Promise.all([
    supabase.from("cafes").select("*").eq("id", id).maybeSingle(),
    supabase.from("cafe_details").select("*").eq("cafe_id", id).maybeSingle(),
    supabase.from("cities").select("*").order("name"),
    supabase.from("tags").select("*").order("name"),
    supabase.from("cafe_tags").select("tag_id").eq("cafe_id", id),
    supabase.from("cafe_photos").select("*").eq("cafe_id", id).order("sort_order"),
    supabase.from("menu_items").select("*").eq("cafe_id", id).order("sort_order"),
  ]);
  if (!cafe) notFound();

  return (
    <>
      <Link href="/admin/kafe" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><Icon name="arrowLeft" className="h-4 w-4" />Semua kafe</Link>
      <PageHeader title={cafe.name} description={cafe.is_published ? "Tayang di aplikasi" : "Draf, belum terlihat oleh pengunjung"}
        action={<Link href={`/kafe/${cafe.slug}`} target="_blank" className="btn-ghost"><Icon name="external" className="h-4 w-4" />Lihat halaman</Link>} />
      <Flash ok={ok} err={err} />

      <nav className="mb-5 flex gap-1 text-sm font-medium">
        {[["#foto", "Foto"], ["#menu", "Menu"], ["#info", "Info kafe"]].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full bg-tint px-3.5 py-1.5 text-muted hover:text-ink">{label}</a>
        ))}
      </nav>

      <div className="space-y-5">
        <div id="foto" className="scroll-mt-24"><PhotoManager cafeId={cafe.id} initial={(photos as Photo[]) ?? []} /></div>
        <div id="menu" className="scroll-mt-24"><MenuEditor cafeId={cafe.id} initial={(menu as MenuItem[]) ?? []} /></div>
        <div id="info" className="scroll-mt-24">
          <CafeForm cafe={cafe as Cafe} details={details as CafeDetails | null} cities={(cities as City[]) ?? []}
            tags={(tags as Tag[]) ?? []} selectedTagIds={(cafeTags ?? []).map((t) => t.tag_id)} />
        </div>

        <form action={deleteCafe} className="rounded-2xl border border-red-200 bg-red-50/50 p-5 md:p-6">
          <input type="hidden" name="id" value={cafe.id} />
          <h2 className="text-lg font-bold text-red-900">Hapus kafe</h2>
          <p className="mb-4 mt-0.5 text-sm text-red-900/70">Foto, menu, dan favorit pengguna untuk kafe ini ikut terhapus. Tidak bisa dibatalkan.</p>
          <ConfirmButton message={`Hapus "${cafe.name}" secara permanen?`} pendingText="Menghapus…"
            className="btn border border-red-300 bg-surface text-red-700 hover:bg-red-600 hover:text-white">
            <Icon name="trash" className="h-4 w-4" />Hapus kafe
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}
