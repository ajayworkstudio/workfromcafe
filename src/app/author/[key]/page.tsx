import type { Metadata } from "next";
import AdminBadge from "@/components/AdminBadge";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/Avatar";
import AuthorBadge from "@/components/AuthorBadge";
import CafeSwipeStack from "@/components/CafeSwipeStack";
import { toStackCafe } from "@/lib/stackCafe";
import Icon from "@/components/Icon";
import JsonLd from "@/components/JsonLd";
import KuratorShare from "@/components/KuratorShare";
import ShareButton from "@/components/ShareButton";
import { breadcrumb } from "@/lib/seo";
import { getAuthors, levelFor } from "@/lib/author";
import { getViewer } from "@/lib/auth";
import { CAFE_LIST_SELECT, SITE_URL } from "@/lib/utils";
import type { Cafe } from "@/lib/types";
import { getT } from "@/lib/i18n/server";

type P = Promise<{ key: string }>;

async function findAuthor(key: string) {
  const k = decodeURIComponent(key).toLowerCase();
  return (await getAuthors()).find((a) => a.username === k || a.id === k) ?? null;
}

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const a = await findAuthor((await params).key);
  if (!a) notFound();
  const title = `${a.name}: ${a.cafe_count} kafe rekomendasi untuk kerja`;
  const description = a.bio ?? `${a.cafe_count} kafe untuk kerja yang direkomendasikan ${a.name}.`;
  return {
    title,
    description,
    alternates: { canonical: `/author/${a.username ?? a.id}` },
    // Gambar pratinjau dibuat oleh opengraph-image.tsx (foto author + kafe rekomendasinya)
    openGraph: { type: "profile", title, description, url: `/author/${a.username ?? a.id}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function AuthorPage({ params }: { params: P }) {
  const { t, locale } = await getT();
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

  const profileUrl = `${SITE_URL}/author/${a.username ?? a.id}`;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <JsonLd data={[
        {
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: profileUrl,
          dateCreated: a.first_at,
          dateModified: a.last_at,
          mainEntity: {
            "@type": "Person",
            name: a.name,
            description: a.bio ?? undefined,
            image: a.avatar_url ?? undefined,
            url: profileUrl,
            sameAs: a.instagram ? [`https://instagram.com/${a.instagram}`] : undefined,
          },
        },
        breadcrumb([{ name: "Beranda", path: "/" }, { name: "Para author", path: "/author" }, { name: a.name, path: `/author/${a.username ?? a.id}` }]),
      ]} />
      <section className="overflow-hidden rounded-3xl border border-line bg-surface">
        {/* Banner author: rasio asli 8:3 di HP; di layar lebar tingginya dibatasi dan sisi kiri-kanan (ornamen) terpotong, tulisan tetap di tengah */}
        <div className="relative aspect-[8/3] w-full md:aspect-auto md:h-[300px]">
          <Image src="/author-banner.webp" alt="WFC Hunters Contributor: good places, better stories" fill priority sizes="(max-width: 1152px) 100vw, 1152px" className="object-cover" />
        </div>
        <div className="px-6 pb-7 md:px-10">
          <div className="relative z-10 -mt-12 flex flex-wrap items-end justify-between gap-4 md:-mt-14">
            <Avatar url={a.avatar_url} name={a.name} className="h-24 w-24 text-3xl ring-4 ring-surface md:h-28 md:w-28" />
            <div className="flex flex-wrap gap-2">
              <ShareButton align="right" className="btn-ghost !py-2 text-sm" url={profileUrl} title={`${a.name} di WFC Hunters`}
                text={isMe ? t("Ini {n} kafe enak buat kerja yang aku rekomendasikan di WFC Hunters:", { n: a.cafe_count }) : t("{n} kafe enak buat kerja rekomendasi {name} di WFC Hunters:", { n: a.cafe_count, name: a.name })} />
              {isMe && <Link href="/akun" className="btn-ghost !py-2 text-sm"><Icon name="edit" className="h-4 w-4" />{t("Edit profil")}</Link>}
              {a.instagram && (
                <a href={`https://instagram.com/${a.instagram}`} target="_blank" rel="noopener" className="btn-ghost !py-2 text-sm"><Icon name="instagram" className="h-4 w-4" />@{a.instagram}</a>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 break-words text-3xl font-extrabold md:text-4xl">{a.name}</h1>
            <AuthorBadge count={a.cafe_count} className="!text-sm" />
            {a.is_admin && <AdminBadge className="!px-2.5 !py-1 !text-xs" />}
          </div>
          {a.bio && <p className="mt-3 max-w-2xl whitespace-pre-line break-words text-lg leading-relaxed text-ink/80 [overflow-wrap:anywhere]">{a.bio}</p>}

          {/* Label pendek di HP supaya tiga kotak muat di layar sempit; label lengkap mulai layar sm */}
          <dl className="mt-6 grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
            {[
              { v: String(a.cafe_count), short: t("kafe"), full: t("kafe direkomendasikan") },
              { v: String(cities.length), short: t("kota"), full: cities.length === 1 ? t("kota") : t("kota dijelajahi") },
              {
                v: new Date(a.first_at).toLocaleDateString(locale, { year: "numeric" }),
                short: t("sejak {m}", { m: new Date(a.first_at).toLocaleDateString(locale, { month: "short" }) }),
                full: t("author sejak {m}", { m: new Date(a.first_at).toLocaleDateString(locale, { month: "long" }) }),
              },
            ].map((s) => (
              <div key={s.full} className="min-w-0 rounded-2xl bg-canvas px-3 py-3 sm:p-4">
                <dt className="sr-only">{s.full}</dt>
                <dd className="font-display text-xl font-bold sm:text-2xl">{s.v}</dd>
                <dd className="text-xs text-muted"><span className="sm:hidden">{s.short}</span><span className="hidden sm:inline">{s.full}</span></dd>
              </div>
            ))}
          </dl>

          {next && (
            <div className="mt-5 max-w-2xl">
              <div className="flex flex-wrap justify-between gap-x-3 text-xs text-muted">
                <span>{current ? t(current.name) : ""}</span>
                <span>{t("{n} kafe lagi menuju", { n: toNext })} <b className="text-ink">{t(next.name)}</b></span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-tint"><div className="h-full rounded-full bg-gradient-to-r from-tan to-brand" style={{ width: `${progress}%` }} /></div>
            </div>
          )}
        </div>
      </section>

      {isMe && current && a.cafe_count >= 5 && (
        <KuratorShare base={`/author/${a.username ?? a.id}/kartu`} slug={a.username ?? a.id.slice(0, 8)} levelName={current.name} profileUrl={profileUrl} />
      )}
      {isMe && a.cafe_count < 5 && (
        <div className="mt-8 flex flex-wrap items-center gap-4 rounded-3xl border border-dashed border-line p-6">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold/20 text-[#8a5a00]"><Icon name="lock" className="h-5 w-5" /></span>
          <div className="flex-1">
            <p className="font-bold">{t("Kartu Kurator terbuka di 5 kafe")}</p>
            <p className="text-sm text-muted">{t("Tinggal {n} kafe lagi. Begitu tembus, kamu dapat kartu khusus untuk dibagikan ke Instagram dan kabar lewat email.", { n: 5 - a.cafe_count })}</p>
          </div>
          <Link href="/kirim/baru" className="btn-primary !py-2 text-sm">{t("Kirim kafe")}</Link>
        </div>
      )}

      <section className="mt-12">
        {cafes.length ? (
          <CafeSwipeStack centered allHref={null} cafes={cafes.map(toStackCafe)}
            title={t("Kafe rekomendasi {name}", { name: a.name.split(" ")[0] })} subtitle={cities.length > 1 ? cities.join(" · ") : undefined} />
        ) : (
          <>
            <h2 className="text-2xl font-bold">Kafe rekomendasi {a.name.split(" ")[0]}</h2>
            <p className="mt-4 rounded-2xl border border-dashed border-line p-6 text-muted">{t("Belum ada kafe rekomendasi yang tayang.")}</p>
          </>
        )}
      </section>

      <div className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-brand-soft p-6 md:p-8">
        <div>
          <p className="text-xl font-bold">{t("Punya kafe andalan juga?")}</p>
          <p className="text-muted">{t("Kirim rekomendasimu dan dapatkan halaman author seperti ini.")}</p>
        </div>
        <Link href="/kirim" className="btn-primary"><Icon name="send" className="h-4 w-4" />{t("Jadi author")}</Link>
      </div>
    </div>
  );
}
