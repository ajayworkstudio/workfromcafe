import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CafeForm from "@/components/admin/CafeForm";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import Icon from "@/components/Icon";
import type { City, Tag } from "@/lib/types";

export default async function NewCafe({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const { err } = await searchParams;
  const supabase = await createClient();
  const [{ data: cities }, { data: tags }] = await Promise.all([
    supabase.from("cities").select("*").order("name"),
    supabase.from("tags").select("*").order("name"),
  ]);
  return (
    <>
      <Link href="/admin/kafe" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><Icon name="arrowLeft" className="h-4 w-4" />Semua kafe</Link>
      <PageHeader title="Tambah kafe" description="Foto dan menu bisa ditambahkan setelah kafe disimpan." />
      <Flash err={err} />
      <CafeForm cities={(cities as City[]) ?? []} tags={(tags as Tag[]) ?? []} selectedTagIds={[]} />
    </>
  );
}
