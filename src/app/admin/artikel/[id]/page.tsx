import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import SubmitButton from "@/components/admin/SubmitButton";
import ConfirmButton from "@/components/admin/ConfirmButton";
import ArticleEditor from "@/components/admin/ArticleEditor";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ManualArticle } from "@/lib/articles";

export const metadata: Metadata = { title: "Tulis artikel" };

const toSlug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);

async function save(f: FormData) {
  "use server";
  const admin = await requireAdmin();
  const id = String(f.get("id") ?? "");
  const title = String(f.get("title") ?? "").trim().slice(0, 120);
  const slug = toSlug(String(f.get("slug") ?? "") || title);
  const publish = f.get("is_published") === "on";
  const back = (q: string) => redirect(`/admin/artikel/${id || "baru"}?${q}`);
  if (title.length < 5) back("err=Judul minimal 5 huruf.");
  if (slug.length < 3) back("err=Alamat artikel minimal 3 huruf.");

  const supabase = await createClient();
  const { data: prev } = id ? await supabase.from("articles").select("published_at").eq("id", id).maybeSingle() : { data: null };
  const row = {
    title, slug,
    excerpt: String(f.get("excerpt") ?? "").trim().slice(0, 300) || null,
    body: String(f.get("body") ?? "").slice(0, 60000),
    cover_url: String(f.get("cover_url") ?? "").trim() || null,
    city_id: String(f.get("city_id") ?? "") || null,
    is_published: publish,
    published_at: publish ? (prev?.published_at ?? new Date().toISOString()) : prev?.published_at ?? null,
    updated_at: new Date().toISOString(),
  };
  const res = id
    ? await supabase.from("articles").update(row).eq("id", id).select("id").single()
    : await supabase.from("articles").insert({ ...row, author_id: admin.user!.id }).select("id").single();
  if (res.error) back(`err=${encodeURIComponent(/duplicate|unique/.test(res.error.message) ? "Alamat artikel itu sudah dipakai. Ganti sedikit." : res.error.message)}`);
  revalidatePath("/artikel");
  revalidatePath(`/artikel/${slug}`);
  redirect(`/admin/artikel/${res.data!.id}?ok=${encodeURIComponent(publish ? "Tersimpan dan tayang." : "Tersimpan sebagai draf.")}`);
}

async function remove(f: FormData) {
  "use server";
  await requireAdmin();
  await (await createClient()).from("articles").delete().eq("id", String(f.get("id")));
  revalidatePath("/artikel");
  redirect("/admin/artikel?ok=Artikel+dihapus.");
}

export default async function EditArticle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const isNew = id === "baru";
  const [{ data }, { data: cities }, { data: cafes }] = await Promise.all([
    isNew ? Promise.resolve({ data: null }) : supabase.from("articles").select("*").eq("id", id).maybeSingle(),
    supabase.from("cities").select("id,name").eq("is_active", true).order("name"),
    supabase.from("cafes").select("slug,name").eq("is_published", true).order("name"),
  ]);
  if (!isNew && !data) notFound();
  const a = data as ManualArticle | null;

  return (
    <>
      <Link href="/admin/artikel" className="mb-3 inline-flex min-h-11 items-center text-sm font-semibold text-muted hover:text-ink">← Semua artikel</Link>
      <PageHeader title={isNew ? "Tulis artikel" : "Edit artikel"} action={a?.is_published && <Link href={`/artikel/${a.slug}`} className="btn-ghost min-h-11">Lihat di situs</Link>} />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={save} className="space-y-4">
        <input type="hidden" name="id" value={a?.id ?? ""} />
        <div><label htmlFor="t" className="label">Judul</label><input id="t" name="title" required minLength={5} maxLength={120} defaultValue={a?.title} placeholder="Panduan WFC di Semarang saat musim hujan" className="input" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="s" className="label">Alamat (kosongkan supaya dibuat dari judul)</label><input id="s" name="slug" defaultValue={a?.slug} placeholder="panduan-wfc-semarang" className="input" /></div>
          <div><label htmlFor="c" className="label">Kota (opsional)</label>
            <select id="c" name="city_id" defaultValue={a?.city_id ?? ""} className="input"><option value="">Tanpa kota</option>{(cities ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        </div>
        <div><label htmlFor="e" className="label">Ringkasan untuk Google (maks 300 huruf)</label><textarea id="e" name="excerpt" rows={2} maxLength={300} defaultValue={a?.excerpt ?? ""} className="input" /></div>
        <div><label htmlFor="cv" className="label">Link foto sampul (opsional)</label><input id="cv" name="cover_url" defaultValue={a?.cover_url ?? ""} placeholder="https://…" className="input" /></div>
        <div>
          <p className="label">Isi artikel</p>
          <ArticleEditor defaultValue={a?.body ?? ""} cafes={cafes ?? []} />
          <details className="mt-2 rounded-xl bg-tint p-3 text-sm">
            <summary className="cursor-pointer font-semibold">Cara menulis</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              <li>Pakai tombol di atas kolom, atau ketik langsung: baris kosong memisahkan paragraf.</li>
              <li><code>## Judul bagian</code> dan <code>### Sub judul</code> di awal baris.</li>
              <li><code>- butir</code> untuk daftar, <code>**tebal**</code>, <code>[teks](https://link)</code>. Link ke halaman sendiri cukup <code>[teks](/kota/semarang)</code>.</li>
              <li>Kartu kafe: pilih kafe di bawah kolom lalu tekan Sisipkan, atau ketik <code>[[kafe:slug-kafe]]</code> di baris sendiri.</li>
            </ul>
          </details>
        </div>
        <label className="flex min-h-11 items-center gap-2 font-semibold"><input type="checkbox" name="is_published" defaultChecked={a?.is_published} className="h-5 w-5" />Tayangkan</label>
        <SubmitButton className="btn-primary min-h-11">Simpan</SubmitButton>
      </form>
      {a && (
        <form action={remove} className="mt-8 border-t border-line pt-5">
          <input type="hidden" name="id" value={a.id} />
          <ConfirmButton message={`Hapus artikel "${a.title}"?`} className="btn-ghost min-h-11 text-[#b4533a]">Hapus artikel</ConfirmButton>
        </form>
      )}
    </>
  );
}
