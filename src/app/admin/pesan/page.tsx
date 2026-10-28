import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import { topicLabel } from "@/lib/contact";
import { timeAgo } from "@/lib/utils";
import { spamReason } from "@/lib/spam";

type Row = { id: string; topic: string; name: string; email: string; body: string; page: string | null; is_read: boolean; created_at: string };

async function act(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const op = String(formData.get("op"));
  if (op === "delete") await supabase.from("contact_messages").delete().eq("id", id);
  else await supabase.from("contact_messages").update({ is_read: op === "read" }).eq("id", id);
  revalidatePath("/admin/pesan");
  revalidatePath("/admin");
}

async function deleteSpam() {
  "use server";
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("contact_messages").select("id,name,email,body").limit(1000);
  const ids = ((data as Pick<Row, "id" | "name" | "email" | "body">[] | null) ?? []).filter((r) => spamReason(r)).map((r) => r.id);
  if (ids.length) await supabase.from("contact_messages").delete().in("id", ids);
  revalidatePath("/admin/pesan");
  revalidatePath("/admin");
}

export default async function MessagesAdmin({ searchParams }: { searchParams: Promise<{ tampil?: string }> }) {
  const { tampil } = await searchParams;
  const unreadOnly = tampil !== "semua";
  const supabase = await createClient();
  let q = supabase.from("contact_messages").select("id,topic,name,email,body,page,is_read,created_at")
    .order("created_at", { ascending: false }).limit(100);
  if (unreadOnly) q = q.eq("is_read", false);
  const { data, error } = await q;
  const rows = (data as Row[] | null) ?? [];
  const spamCount = rows.filter((r) => spamReason(r)).length;

  return (
    <>
      <PageHeader title="Pesan masuk" description="Pesan dari kotak kontak di beranda dan halaman /kontak. Balas lewat email pengirim." />
      <Flash err={error ? "Tabel pesan belum ada. Jalankan migrasi 0015_pesan_kontak.sql di Supabase." : undefined} />
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {[["", "Belum dibaca"], ["semua", "Semua"]].map(([k, l]) => (
          <Link key={k} href={k ? `/admin/pesan?tampil=${k}` : "/admin/pesan"}
            className={`rounded-full px-4 py-2 text-sm font-medium ${(tampil ?? "") === k ? "bg-ink text-white" : "bg-surface text-muted hover:text-ink"}`}>{l}</Link>
        ))}
        {spamCount > 0 && (
          <form action={deleteSpam} className="sm:ml-auto">
            <button className="btn-ghost min-h-11 text-sm text-[#b4533a]">Hapus {spamCount} kemungkinan spam</button>
          </form>
        )}
      </div>
      {!error && !rows.length ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          {unreadOnly ? "Tidak ada pesan baru. Semua sudah dibaca." : "Belum ada pesan masuk."}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const spam = spamReason(r);
            return (
            <li key={r.id} className={`card min-w-0 p-5 ${spam ? "opacity-70" : r.is_read ? "" : "border-brand/40"}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="min-w-0 break-words font-semibold">{r.name} <span className="font-normal text-muted">&lt;{r.email}&gt;</span></p>
                <p className="text-sm text-muted">{timeAgo(r.created_at)}</p>
              </div>
              <p className="mt-1 flex flex-wrap gap-2 text-sm">
                <span className="chip">{topicLabel(r.topic)}</span>
                {spam && <span className="chip !bg-[#b4533a]/10 !text-[#8c3b25]" title={spam}>Kemungkinan spam: {spam}</span>}
                {r.page && <span className="text-muted">dari {r.page}</span>}
              </p>
              <p className="mt-3 whitespace-pre-wrap break-words">{r.body}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={`mailto:${r.email}?subject=${encodeURIComponent("Re: pesanmu ke WFC Hunters")}`} className="btn-primary !py-1.5 text-sm">Balas lewat email</a>
                <form action={act}>
                  <input type="hidden" name="id" value={r.id} />
                  <button name="op" value={r.is_read ? "unread" : "read"} className="btn-ghost !py-1.5 text-sm">{r.is_read ? "Tandai belum dibaca" : "Tandai sudah dibaca"}</button>
                </form>
                <form action={act}>
                  <input type="hidden" name="id" value={r.id} />
                  <button name="op" value="delete" className="btn-ghost !py-1.5 text-sm text-[#b4533a]">Hapus</button>
                </form>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
