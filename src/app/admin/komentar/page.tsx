import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import Avatar from "@/components/Avatar";
import { timeAgo } from "@/lib/utils";

type Row = {
  id: string; body: string; created_at: string; is_hidden: boolean; parent_id: string | null;
  cafe: { name: string; slug: string } | null;
  author: { name: string | null; email: string | null; avatar_url: string | null } | null;
};

async function moderate(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const op = String(formData.get("op"));
  if (op === "delete") await supabase.from("cafe_comments").delete().eq("id", id);
  else await supabase.from("cafe_comments").update({ is_hidden: op === "hide" }).eq("id", id);
  revalidatePath("/admin/komentar");
  revalidatePath("/kafe/[slug]", "page");
}

export default async function CommentsAdmin({ searchParams }: { searchParams: Promise<{ tampil?: string }> }) {
  const { tampil } = await searchParams;
  const onlyHidden = tampil === "disembunyikan";
  const supabase = await createClient();
  let q = supabase.from("cafe_comments")
    .select("id,body,created_at,is_hidden,parent_id, cafe:cafes(name,slug), author:profiles(name,email,avatar_url)")
    .order("created_at", { ascending: false }).limit(100);
  if (onlyHidden) q = q.eq("is_hidden", true);
  const { data, error } = await q;
  const rows = (data as unknown as Row[] | null) ?? [];

  return (
    <>
      <PageHeader title="Komentar" description="Komentar terbaru dari semua kafe. Sembunyikan yang tidak pantas, atau hapus spam." />
      <Flash err={error ? "Tabel komentar belum ada. Jalankan migrasi 0011_komentar_kafe.sql di Supabase." : undefined} />
      <div className="mb-5 flex gap-1.5">
        {[["", "Terbaru"], ["disembunyikan", "Disembunyikan"]].map(([k, l]) => (
          <Link key={k} href={k ? `/admin/komentar?tampil=${k}` : "/admin/komentar"}
            className={`rounded-full px-4 py-2 text-sm font-medium ${(tampil ?? "") === k ? "bg-ink text-white" : "bg-surface text-muted hover:text-ink"}`}>{l}</Link>
        ))}
      </div>
      {!rows.length ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Belum ada komentar.</p>
      ) : (
        <ul className="card divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className={`flex gap-3 p-4 ${r.is_hidden ? "bg-tint/60" : ""}`}>
              <Avatar url={r.author?.avatar_url} name={r.author?.name ?? r.author?.email} className="h-9 w-9 text-sm" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-sm">
                  <span className="font-semibold">{r.author?.name || r.author?.email || "Pengguna"}</span>
                  <span className="text-muted">di</span>
                  {r.cafe && <Link href={`/kafe/${r.cafe.slug}#komentar`} className="font-medium text-brand hover:underline">{r.cafe.name}</Link>}
                  <span className="text-xs text-muted">{timeAgo(r.created_at)}{r.parent_id ? " · balasan" : ""}</span>
                  {r.is_hidden && <span className="rounded-full bg-[#b4533a]/12 px-2 py-0.5 text-[11px] font-semibold text-[#b4533a]">Disembunyikan</span>}
                </p>
                <p className="mt-1 whitespace-pre-line break-words text-sm">{r.body}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5 text-xs font-semibold">
                <form action={moderate}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="op" value={r.is_hidden ? "show" : "hide"} />
                  <button className="text-muted hover:text-ink">{r.is_hidden ? "Tampilkan" : "Sembunyikan"}</button>
                </form>
                <form action={moderate}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="op" value="delete" />
                  <button className="text-muted hover:text-[#b4533a]">Hapus</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
