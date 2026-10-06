import type { Metadata } from "next";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import AuthorBadge from "@/components/AuthorBadge";
import Icon from "@/components/Icon";
import { authorHref, getAuthors, LEVELS } from "@/lib/author";

export const metadata: Metadata = {
  title: "Para author",
  description: "Orang-orang yang merekomendasikan kafe untuk kerja dan nugas di WorkFromCafe, dari Jakarta sampai Surabaya. Jadi author dan naik level sampai Kurator Utama.",
  alternates: { canonical: "/author" },
};

export default async function AuthorsPage() {
  const authors = await getAuthors();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold md:text-5xl">Para author</h1>
          <p className="mt-2 max-w-xl text-muted">Mereka yang berbagi kafe andalannya untuk kerja. Semakin banyak kafe yang tayang, semakin tinggi levelnya.</p>
        </div>
        <Link href="/kirim" className="btn-primary"><Icon name="send" className="h-4 w-4" />Jadi author</Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        {LEVELS.map((l) => (
          <span key={l.name} className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${l.className}`}><Icon name={l.icon} filled={l.icon === "star"} className="h-3 w-3" />{l.name}</span>
            <span className="text-muted">{l.min}+ kafe</span>
          </span>
        ))}
      </div>

      {authors.length ? (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {authors.map((a, i) => (
            <li key={a.id}>
              <Link href={authorHref(a)} className="card flex h-full gap-4 p-5 transition-colors hover:border-brand">
                <div className="relative">
                  <Avatar url={a.avatar_url} name={a.name} className="h-14 w-14 text-lg" />
                  {i < 3 && <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-gold text-xs font-bold text-ink ring-2 ring-surface">{i + 1}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{a.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                    <AuthorBadge count={a.cafe_count} />
                    <span>{a.cafe_count} kafe</span>
                  </div>
                  {a.bio && <p className="mt-2 line-clamp-2 text-sm text-ink/75">{a.bio}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="text-muted">Belum ada author. Jadilah yang pertama merekomendasikan kafe andalanmu.</p>
          <Link href="/kirim" className="btn-dark mt-4">Kirim rekomendasi</Link>
        </div>
      )}
    </div>
  );
}
