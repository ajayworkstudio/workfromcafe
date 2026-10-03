import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import type { City } from "@/lib/types";

export const dynamic = "force-dynamic";

async function toggleCity(formData: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("cities").update({ is_active: formData.get("active") === "true" }).eq("id", String(formData.get("id")));
  revalidatePath("/admin/kota");
  revalidatePath("/");
}

async function addCity(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const name = String(formData.get("name"));
  await supabase.from("cities").insert({
    name,
    slug: slugify(name),
    province: String(formData.get("province") || "Jawa Tengah"),
    lat: Number(formData.get("lat")),
    lng: Number(formData.get("lng")),
    is_active: false,
  });
  revalidatePath("/admin/kota");
}

export default async function CitiesAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.from("cities").select("*").order("province").order("name");
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_300px]">
      <div className="card divide-y divide-ink/10">
        {(data as City[] | null)?.map((c) => (
          <form key={c.id} action={toggleCity} className="flex items-center justify-between gap-3 p-3">
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="active" value={String(!c.is_active)} />
            <div>
              <p className="font-semibold">{c.name}</p>
              <p className="text-xs text-muted/60">{c.province}</p>
            </div>
            <button className={c.is_active ? "btn-dark !py-1.5" : "btn-ghost !py-1.5"}>{c.is_active ? "Aktif" : "Nonaktif"}</button>
          </form>
        ))}
      </div>
      <form action={addCity} className="card h-fit space-y-3 p-4">
        <p className="font-display text-lg font-bold">Tambah kota</p>
        <input name="name" required placeholder="Nama kota" className="input" />
        <input name="province" defaultValue="Jawa Tengah" className="input" />
        <div className="flex gap-2">
          <input name="lat" required placeholder="Lat" className="input" />
          <input name="lng" required placeholder="Lng" className="input" />
        </div>
        <button className="btn-dark w-full">Tambah</button>
        <p className="text-xs text-muted/60">Kota baru mulai nonaktif; aktifkan setelah ada kafenya.</p>
      </form>
    </div>
  );
}
