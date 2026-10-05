import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/Avatar";
import AuthorBadge from "@/components/AuthorBadge";
import CafeCard from "@/components/CafeCard";
import Icon from "@/components/Icon";
import { getAuthors, levelFor } from "@/lib/author";
import { getViewer } from "@/lib/auth";
import { CAFE_LIST_SELECT, SITE_URL } from "@/lib/utils";
import type { Cafe } from "@/lib/types";

type P = Promise<{ key: string }>;

async function findAuthor(key: string) {
  const k = decodeURIComponent(key).toLowerCase();
  return (await getAuthors()).find((a) => a.username === k || a.id === k) ?? null;
}

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const a = await findAuthor((await params).key);
  if (!a) return {};
  const title = `${a.name}, author WorkFromCafe`;
  const description = a.bio ?? `${a.cafe_count} kafe untuk kerja yang direkomendasikan ${a.name}.`;
  return { title, description, openGraph: { title, description, images: a.avatar_url ? [a.avatar_url] : undefined }, alternates: { canonical: `${SITE_URL}/author/${a.username ?? a.id}` } };
}

export default async function AuthorPage({ params }: { params: P }) {
  const a = await findAuthor((await params).key);
  if (!a) notFound();
  const supabase = await createClient();
  const [{ data }, viewer] = await Promise.all([
    supabase.from("cafes").select(CAFE_LIST_SELECT).eq("contributor_id", a.id).eq("is_published", true).order("created_at", { ascending: false }),
    getViewer(),
  ]);
  const cafes = (data as Cafe[] | null) ?? [];
  const cities = [...new Set(cafes.map((c) => c.city?.name).filter(Boolean))];
  const { current, next, toNext } = levelFor(a.cafe_count);
  const progress = next ? Math.min(100, ((a.cafe_count - (current?.min ?? 0)) / (next.min - (current?.min ?? 0))) * 100) : 100;
  const isMe = viewer.user?.id === a.id;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <section className="overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="h-24 bg-gradient-to-r from-brand via-brand to-tan md:h-32" aria-hidden />
        <div className="px-6 pb-7 md:px-10">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4 md:-mt-14">
            <Avatar url={a.avatar_url} name={a.name} className="h-24 w-24 text-3xl ring-4 ring-surface md:h-28 md:w-28" />
            <div className="flex gap-2">
              {isMe && <Link href="/akun" className="btn-ghost !py-2 text-sm"><Icon name="edit" className="h-4 w-4" />Edit profil</Link>}
              {a.instagram && (
                <a href={`https://instagram.com/${a.instagram}`} target="_blank" rel="noopener" className="btn-ghost !py-2 text-sm"><Icon name="instagram" className="h-4 w-4" />@{a.instagram}</a>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold md:text-4xl">{a.name}</h1>
            <AuthorBadge count={a.cafe_count} className="!text-sm" />
          </div>
          {a.bio && <p className="mt-3 max-w-2xl whitespace-pre-line text-lg leading-relaxed text-ink/80">{a.bio}</p>}

          <dl className="mt-6 grid max-w-2xl grid-cols-3 gap-3">
            {[
              [String(a.cafe_count), "kafe direkomendasikan"],
              [String(cities.length), cities.length === 1 ? "kota" : "kota dijelajahi"],
              [new Date(a.first_at).toLocaleDateString("id-ID", { month: "short", year: "numeric" }), "author sejak"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-canvas p-4">
                <dt className="sr-only">{l}</dt>
                <dd className="font-display text-2xl font-bold">{v}</dd>
                <dd className="text-xs text-muted">{l}</dd>
              </div>
            ))}
          </dl>

          {next && (
            <div className="mt-5 max-w-2xl">
              <div className="flex justify-between text-xs text-muted">
                <span>{current?.name}</span>
                <span>{toNext} kafe lagi menuju <b className="text-ink">{next.name}</b></span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-tint"><div className="h-full rounded-full bg-gradient-to-r from-tan to-brand" style={{ width: `${progress}%` }} /></div>
            </div>
          )}
        </div>
      </section>

      <h2 className="mt-12 text-2xl font-bold">Kafe rekomendasi {a.name.split(" ")[0]}</h2>
      {cities.length > 1 && <p className="mt-1 text-sm text-muted">{cities.join(" · ")}</p>}
      <div className="mt-6 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
        {cafes.map((c) => <CafeCard key={c.id} cafe={c} />)}
      </div>

      <div className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-brand-soft p-6 md:p-8">
        <div>
          <p className="text-xl font-bold">Punya kafe andalan juga?</p>
          <p className="text-muted">Kirim rekomendasimu dan dapatkan halaman author seperti ini.</p>
        </div>
        <Link href="/kirim" className="btn-primary"><Icon name="send" className="h-4 w-4" />Jadi author</Link>
      </div>
    </div>
  );
}
