import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import SubmitButton from "@/components/admin/SubmitButton";
import ConfirmButton from "@/components/admin/ConfirmButton";
import Icon from "@/components/Icon";
import type { Tag } from "@/lib/types";

const TYPES = { vibe: "Suasana", facility: "Fasilitas" } as const;

async function saveTag(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = await createClient();
  const id = formData.get("id") as string | null;
  const row = { name: String(formData.get("name")).trim(), type: String(formData.get("type")) };
  const { error } = id ? await supabase.from("tags").update(row).eq("id", id) : await supabase.from("tags").insert(row);
  revalidatePath("/", "layout");
  redirect(error ? `/admin/tag?err=${encodeURIComponent(error.message.includes("tags_name_key") ? `Tag "${row.name}" sudah ada.` : error.message)}`
    : `/admin/tag?ok=${encodeURIComponent(id ? "Tag diperbarui." : `Tag "${row.name}" ditambahkan.`)}`);
}

async function deleteTag(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("tags").delete().eq("id", String(formData.get("id")));
  revalidatePath("/", "layout");
  redirect(`/admin/tag?ok=${encodeURIComponent("Tag dihapus.")}`);
}

export default async function TagsAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; edit?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data }, { data: usage }] = await Promise.all([
    supabase.from("tags").select("*").order("name"),
    supabase.rpc("admin_usage_counts"),
  ]);
  const counts = ((usage as { tags?: Record<string, number> } | null)?.tags) ?? {};
  const tags = (data as Tag[] | null) ?? [];
  const editing = tags.find((t) => t.id === sp.edit);

  return (
    <>
      <PageHeader title="Tag" description="Tag dipakai untuk filter di halaman Jelajah dan ditampilkan di kartu kafe." />
      <Flash ok={sp.ok} err={sp.err} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {(Object.keys(TYPES) as (keyof typeof TYPES)[]).map((type) => (
            <section key={type}>
              <h2 className="mb-2 text-lg font-bold">{TYPES[type]}</h2>
              <div className="card divide-y divide-line">
                {tags.filter((t) => t.type === type).map((t) => {
                  const n = counts[t.id] ?? 0;
                  return (
                    <div key={t.id} className="flex items-center gap-3 p-3 pl-4">
                      <p className="flex-1 font-medium">{t.name} <span className="ml-1 text-sm font-normal text-muted">{n} kafe</span></p>
                      <a href={`/admin/tag?edit=${t.id}`} className="btn-ghost !px-3 !py-1.5" aria-label={`Edit ${t.name}`}><Icon name="edit" className="h-4 w-4" /></a>
                      <form action={deleteTag}>
                        <input type="hidden" name="id" value={t.id} />
                        <ConfirmButton message={n ? `Tag "${t.name}" dipakai ${n} kafe dan akan dilepas dari kafe-kafe itu. Hapus?` : `Hapus tag "${t.name}"?`}
                          className="btn-ghost !px-3 !py-1.5 text-red-700"><Icon name="trash" className="h-4 w-4" /></ConfirmButton>
                      </form>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <form action={saveTag} key={editing?.id ?? "new"} className="card h-fit space-y-3 p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-bold">{editing ? `Edit "${editing.name}"` : "Tambah tag"}</h2>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div><label htmlFor="t-name" className="label">Nama tag</label><input id="t-name" name="name" required maxLength={30} defaultValue={editing?.name} placeholder="Pet friendly" className="input" /></div>
          <div>
            <label htmlFor="t-type" className="label">Jenis</label>
            <select id="t-type" name="type" defaultValue={editing?.type ?? "vibe"} className="input">
              <option value="vibe">Suasana</option>
              <option value="facility">Fasilitas</option>
            </select>
          </div>
          <div className="flex gap-2">
            <SubmitButton className="btn-dark flex-1">{editing ? "Simpan" : "Tambah tag"}</SubmitButton>
            {editing && <a href="/admin/tag" className="btn-ghost">Batal</a>}
          </div>
        </form>
      </div>
    </>
  );
}
