import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import AutoFilterForm from "@/components/AutoFilterForm";
import Avatar from "@/components/Avatar";
import AuthorBadge from "@/components/AuthorBadge";
import { authorHref, getAuthors } from "@/lib/author";
import { timeAgo } from "@/lib/utils";

const PER_PAGE = 50;

type Row = { id: string; name: string | null; email: string | null; avatar_url: string | null; role: string; created_at: string; username: string | null };

export default async function UsersAdmin({ searchParams }: { searchParams: Promise<{ q?: string; peran?: string; hal?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.hal) || 1);
  const supabase = await createClient();
  const authors = await getAuthors().catch(() => []);
  const cafeCount = new Map(authors.map((a) => [a.id, a.cafe_count]));

  let query = supabase.from("profiles").select("id,name,email,avatar_url,role,created_at,username", { count: "exact" })
    .order("created_at", { ascending: false });
  if (sp.q) {
    const q = sp.q.replace(/[%,()]/g, " ").trim();
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,username.ilike.%${q}%`);
  }
  if (sp.peran === "admin") query = query.eq("role", "admin");
  if (sp.peran === "author") {
    const ids = authors.filter((a) => a.cafe_count > 0).map((a) => a.id);
    query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data, count, error } = await query.range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  const rows = (data as Row[] | null) ?? [];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const filtered = !!(sp.q || sp.peran);
  const pageHref = (n: number) => {
    const qs = new URLSearchParams();
    if (sp.q) qs.set("q", sp.q);
    if (sp.peran) qs.set("peran", sp.peran);
    if (n > 1) qs.set("hal", String(n));
    return qs.size ? `/admin/pengguna?${qs}` : "/admin/pengguna";
  };

  return (
    <>
      <PageHeader title="Pengguna" description={error ? "Daftar akun yang terdaftar." : `${total} akun${filtered ? " cocok dengan filter" : " terdaftar"}, terbaru di atas.`} />
      <Flash err={error ? `Daftar pengguna gagal dimuat: ${error.message}` : undefined} />

      <AutoFilterForm className="mb-5 flex flex-wrap gap-2">
        <input type="search" name="q" defaultValue={sp.q} placeholder="Cari nama, email, atau username" aria-label="Cari pengguna" className="input min-w-[200px] flex-1" />
        <select name="peran" defaultValue={sp.peran ?? ""} aria-label="Peran" className="input !w-auto">
          <option value="">Semua pengguna</option>
          <option value="author">Author (punya kafe tayang)</option>
          <option value="admin">Admin</option>
        </select>
      </AutoFilterForm>

      {!error && !rows.length ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          {filtered ? "Tidak ada pengguna yang cocok. Coba kata kunci lain." : "Belum ada yang mendaftar."}
        </p>
      ) : (
        <ul className="card divide-y divide-line">
          {rows.map((u) => {
            const n = cafeCount.get(u.id) ?? 0;
            return (
              <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <Avatar url={u.avatar_url} name={u.name ?? u.email} className="h-11 w-11 text-base" />
                <div className="min-w-0 flex-1 basis-48">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    <span className="truncate">{u.name || "(tanpa nama)"}</span>
                    {u.role === "admin" && <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-white">Admin</span>}
                    {n > 0 && <AuthorBadge count={n} />}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {u.email ? <a href={`mailto:${u.email}`} className="hover:text-brand hover:underline">{u.email}</a> : "Tanpa email"}
                  </p>
                </div>
                <div className="text-right text-sm">
                  {n > 0 && (
                    <Link href={authorHref({ username: u.username, id: u.id })} target="_blank" className="block font-semibold text-brand hover:underline">
                      {n} kafe tayang
                    </Link>
                  )}
                  <p className="text-muted" title={new Date(u.created_at).toLocaleString("id-ID")}>
                    Daftar {timeAgo(u.created_at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Halaman" className="mt-5 flex items-center justify-between gap-3 text-sm">
          {page > 1 ? <Link href={pageHref(page - 1)} className="btn-ghost min-h-11">Sebelumnya</Link> : <span />}
          <span className="text-muted">Halaman {page} dari {pages}</span>
          {page < pages ? <Link href={pageHref(page + 1)} className="btn-ghost min-h-11">Berikutnya</Link> : <span />}
        </nav>
      )}
    </>
  );
}
