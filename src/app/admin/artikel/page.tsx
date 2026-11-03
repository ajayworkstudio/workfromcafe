import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import Icon from "@/components/Icon";
import { createClient } from "@/lib/supabase/server";
import type { ManualArticle } from "@/lib/articles";

export const metadata: Metadata = { title: "Artikel" };

export default async function ArticlesAdmin({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data, error }, { data: saves }] = await Promise.all([
    supabase.from("articles").select("*").order("updated_at", { ascending: false }),
    supabase.from("article_saves").select("article_id"),
  ]);
  const rows = (data ?? []) as ManualArticle[];
  const saveCount = (id: string) => (saves ?? []).filter((x) => x.article_id === id).length;

  return (
    <>
      <PageHeader title="Artikel" description="Tulisan SEO yang tampil di /artikel dan masuk sitemap Google."
        action={!error && <Link href="/admin/artikel/baru" className="btn-primary min-h-11"><Icon name="plus" className="h-4 w-4" />Tulis artikel</Link>} />
      <Flash ok={sp.ok} />

            {error ? (
        <p className="mt-2 rounded-xl bg-tint px-4 py-3 text-sm">Editor artikel aktif setelah migrasi <code>0026_statistik_chat_artikel.sql</code> dijalankan. </p>
      ) : rows.length ? (
        <ul className="card mt-3 divide-y divide-line">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 p-4">
              <Link href={`/admin/artikel/${a.id}`} className="min-w-0 flex-1 font-semibold hover:text-brand">{a.title}</Link>
              <span className="flex items-center gap-3 text-xs text-muted">
                <span title="Dilihat" className="inline-flex items-center gap-1"><Icon name="eye" className="h-3.5 w-3.5" />{(a.view_count ?? 0).toLocaleString("id-ID")}</span>
                <span title="Disukai" className="inline-flex items-center gap-1"><Icon name="heart" className="h-3.5 w-3.5" />{(a.like_count ?? 0).toLocaleString("id-ID")}</span>
                <span title="Disimpan" className="inline-flex items-center gap-1"><Icon name="book" className="h-3.5 w-3.5" />{saveCount(a.id).toLocaleString("id-ID")}</span>
              </span>
              <span className={`chip ${a.is_published ? "!bg-ok/10 !text-ok" : ""}`}>{a.is_published ? "Tayang" : "Draf"}</span>
              <Link href={`/admin/artikel/${a.id}`} className="btn-ghost min-h-11 text-sm">Edit</Link>
              {a.is_published && <Link href={`/artikel/${a.slug}`} className="min-h-11 content-center text-sm font-semibold text-brand hover:underline">Lihat</Link>}
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-muted">Belum ada artikel. Tekan Tulis artikel untuk mulai.</p>}

    </>
  );
}
