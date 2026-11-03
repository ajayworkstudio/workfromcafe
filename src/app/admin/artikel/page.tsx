import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import Icon from "@/components/Icon";
import { createClient } from "@/lib/supabase/server";
import { getAutoArticles, type ManualArticle } from "@/lib/articles";

export const metadata: Metadata = { title: "Artikel" };

export default async function ArticlesAdmin({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data, error }, auto] = await Promise.all([
    supabase.from("articles").select("*").order("updated_at", { ascending: false }),
    getAutoArticles(),
  ]);
  const rows = (data ?? []) as ManualArticle[];

  return (
    <>
      <PageHeader title="Artikel" description="Artikel SEO. Yang otomatis disusun dari data kafe; yang manual kamu tulis sendiri."
        action={!error && <Link href="/admin/artikel/baru" className="btn-primary min-h-11"><Icon name="plus" className="h-4 w-4" />Tulis artikel</Link>} />
      <Flash ok={sp.ok} />

      <h2 className="text-lg font-bold">Ditulis manual</h2>
      {error ? (
        <p className="mt-2 rounded-xl bg-tint px-4 py-3 text-sm">Editor artikel aktif setelah migrasi <code>0026_statistik_chat_artikel.sql</code> dijalankan. Artikel otomatis di bawah sudah tayang.</p>
      ) : rows.length ? (
        <ul className="card mt-3 divide-y divide-line">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 p-4">
              <Link href={`/admin/artikel/${a.id}`} className="min-w-0 flex-1 font-semibold hover:text-brand">{a.title}</Link>
              <span className={`chip ${a.is_published ? "!bg-ok/10 !text-ok" : ""}`}>{a.is_published ? "Tayang" : "Draf"}</span>
              {a.is_published && <Link href={`/artikel/${a.slug}`} className="text-sm font-semibold text-brand hover:underline">Lihat</Link>}
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-muted">Belum ada. Artikel manual cocok untuk topik yang tidak bisa disusun otomatis, misalnya panduan atau cerita kafe tertentu.</p>}

      <h2 className="mt-10 text-lg font-bold">Otomatis dari data kafe ({auto.length})</h2>
      <p className="mt-0.5 text-sm text-muted">Muncul sendiri begitu sebuah kota punya minimal 3 kafe yang cocok dengan topiknya. Diperbarui tiap jam dan setiap kafe diubah.</p>
      <ul className="card mt-3 divide-y divide-line">
        {auto.map((a) => (
          <li key={a.slug} className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <Link href={`/artikel/${a.slug}`} className="min-w-0 flex-1 font-semibold hover:text-brand">{a.title}</Link>
            <span className="text-muted">{a.city.name} · {a.cafes.length} kafe</span>
          </li>
        ))}
      </ul>
    </>
  );
}
