import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CafeForm from "@/components/admin/CafeForm";
import PhotoManager from "@/components/admin/PhotoManager";
import MenuEditor from "@/components/admin/MenuEditor";
import SubmitButton from "@/components/admin/SubmitButton";
import { deleteCafe } from "../actions";
import type { Cafe, CafeDetails, City, MenuItem, Photo, Tag } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditCafe({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tersimpan?: string }> }) {
  const { id } = await params;
  const { tersimpan } = await searchParams;
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
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{cafe.name}</h1>
        <Link href={`/kafe/${cafe.slug}`} className="btn-ghost !py-1.5" target="_blank">Lihat halaman ↗</Link>
      </div>
      {tersimpan && <p className="rounded-xl bg-leaf/10 p-3 text-sm text-leaf">Tersimpan.</p>}

      <PhotoManager cafeId={cafe.id} initial={(photos as Photo[]) ?? []} />
      <MenuEditor cafeId={cafe.id} initial={(menu as MenuItem[]) ?? []} />
      <CafeForm
        cafe={cafe as Cafe}
        details={details as CafeDetails | null}
        cities={(cities as City[]) ?? []}
        tags={(tags as Tag[]) ?? []}
        selectedTagIds={(cafeTags ?? []).map((t) => t.tag_id)}
      />

      <form action={deleteCafe} className="card border-terra/30 p-5">
        <input type="hidden" name="id" value={cafe.id} />
        <p className="font-semibold">Hapus kafe</p>
        <p className="mb-3 text-sm text-bean/70">Foto, menu, dan favorit pengguna untuk kafe ini ikut terhapus.</p>
        <SubmitButton className="btn border border-terra text-terra hover:bg-terra hover:text-white">Hapus permanen</SubmitButton>
      </form>
    </div>
  );
}
