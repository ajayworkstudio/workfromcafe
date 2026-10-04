import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { guessProvince, PROVINCES } from "@/lib/region";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import SubmitButton from "@/components/admin/SubmitButton";
import ConfirmButton from "@/components/admin/ConfirmButton";
import Icon from "@/components/Icon";
import type { City } from "@/lib/types";

async function saveCity(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = await createClient();
  const id = formData.get("id") as string | null;
  const name = String(formData.get("name")).trim();
  const row = {
    name,
    slug: slugify(name),
    province: String(formData.get("province") || "").trim() || guessProvince(Number(formData.get("lat")), Number(formData.get("lng"))),
    lat: Number(formData.get("lat")),
    lng: Number(formData.get("lng")),
  };
  const { error } = id
    ? await supabase.from("cities").update(row).eq("id", id)
    : await supabase.from("cities").insert({ ...row, is_active: false });
  revalidatePath("/", "layout");
  redirect(error ? `/admin/kota?err=${encodeURIComponent(error.message.includes("slug") ? "Kota dengan nama itu sudah ada." : error.message)}`
    : `/admin/kota?ok=${encodeURIComponent(id ? `${name} diperbarui.` : `${name} ditambahkan.`)}`);
}

async function toggleCity(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("cities").update({ is_active: formData.get("active") === "true" }).eq("id", String(formData.get("id")));
  revalidatePath("/", "layout");
}

async function deleteCity(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("cities").delete().eq("id", String(formData.get("id")));
  revalidatePath("/", "layout");
  redirect(error ? `/admin/kota?err=${encodeURIComponent("Kota masih punya kafe. Pindahkan atau hapus kafenya dulu.")}` : `/admin/kota?ok=${encodeURIComponent("Kota dihapus.")}`);
}

export default async function CitiesAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; edit?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data }, { data: usage }] = await Promise.all([
    supabase.from("cities").select("*").order("province").order("name"),
    supabase.rpc("admin_usage_counts"),
  ]);
  const counts = ((usage as { cities?: Record<string, number> } | null)?.cities) ?? {};
  const cities = (data as City[] | null) ?? [];
  const editing = cities.find((c) => c.id === sp.edit);

  return (
    <>
      <PageHeader title="Kota" description="Kota nonaktif tidak tampil di aplikasi. Kota otomatis aktif begitu ada kafe yang tayang." />
      <Flash ok={sp.ok} err={sp.err} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card divide-y divide-line">
          {cities.map((c) => {
            const n = counts[c.id] ?? 0;
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-3 p-3 pl-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-muted">{c.province} · {n} kafe</p>
                </div>
                <form action={toggleCity}>
                  <input type="hidden" name="id" value={c.id} /><input type="hidden" name="active" value={String(!c.is_active)} />
                  <button className={`btn !px-3 !py-1.5 ${c.is_active ? "bg-ok/10 text-ok" : "bg-tint text-muted"}`} aria-pressed={c.is_active}>
                    {c.is_active ? "Aktif" : "Nonaktif"}
                  </button>
                </form>
                <a href={`/admin/kota?edit=${c.id}`} className="btn-ghost !px-3 !py-1.5" aria-label={`Edit ${c.name}`}><Icon name="edit" className="h-4 w-4" /></a>
                {n === 0 && (
                  <form action={deleteCity}>
                    <input type="hidden" name="id" value={c.id} />
                    <ConfirmButton message={`Hapus kota ${c.name}?`} className="btn-ghost !px-3 !py-1.5 text-red-700"><Icon name="trash" className="h-4 w-4" /></ConfirmButton>
                  </form>
                )}
              </div>
            );
          })}
        </div>

        <form action={saveCity} key={editing?.id ?? "new"} className="card h-fit space-y-3 p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-bold">{editing ? `Edit ${editing.name}` : "Tambah kota"}</h2>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div><label htmlFor="c-name" className="label">Nama kota</label><input id="c-name" name="name" required defaultValue={editing?.name} className="input" /></div>
          <div><label htmlFor="c-prov" className="label">Provinsi</label><input id="c-prov" name="province" list="provinsi-list" defaultValue={editing?.province ?? ""} placeholder="Otomatis dari koordinat" className="input" />
            <datalist id="provinsi-list">{PROVINCES.map((p) => <option key={p} value={p} />)}</datalist></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label htmlFor="c-lat" className="label">Latitude</label><input id="c-lat" name="lat" type="number" step="any" required defaultValue={editing?.lat} className="input" /></div>
            <div><label htmlFor="c-lng" className="label">Longitude</label><input id="c-lng" name="lng" type="number" step="any" required defaultValue={editing?.lng} className="input" /></div>
          </div>
          <p className="text-xs text-muted">Koordinat pusat kota, dipakai untuk peta.</p>
          <div className="flex gap-2">
            <SubmitButton className="btn-dark flex-1">{editing ? "Simpan" : "Tambah kota"}</SubmitButton>
            {editing && <a href="/admin/kota" className="btn-ghost">Batal</a>}
          </div>
        </form>
      </div>
    </>
  );
}
