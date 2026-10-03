import { createClient } from "@/lib/supabase/server";
import CafeForm from "@/components/admin/CafeForm";
import type { City, Tag } from "@/lib/types";

export default async function NewCafe() {
  const supabase = await createClient();
  const [{ data: cities }, { data: tags }] = await Promise.all([
    supabase.from("cities").select("*").order("name"),
    supabase.from("tags").select("*").order("name"),
  ]);
  return (
    <>
      <h1 className="mb-4 font-display text-2xl font-bold">Kafe baru</h1>
      <CafeForm cities={(cities as City[]) ?? []} tags={(tags as Tag[]) ?? []} selectedTagIds={[]} />
    </>
  );
}
