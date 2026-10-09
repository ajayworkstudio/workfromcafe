import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import CafeCard from "@/components/CafeCard";
import CommunityCard from "@/components/CommunityCard";
import ContactBox from "@/components/ContactBox";
import HomeMotion from "@/components/HomeMotion";
import Avatar from "@/components/Avatar";
import AuthorBadge from "@/components/AuthorBadge";
import { authorHref, getAuthors, pickFeatured } from "@/lib/author";
import JsonLd from "@/components/JsonLd";
import { ORGANIZATION } from "@/lib/seo";
import Icon from "@/components/Icon";
import type { Cafe, City } from "@/lib/types";
import { APP_NAME, CAFE_LIST_SELECT, SITE_URL } from "@/lib/utils";
import { getViewer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const revalidate = 300;
export const metadata: Metadata = { alternates: { canonical: "/" } };

/*
  Motif beranda: tumpukan kartu (lihat DESIGN.md).
  - Lembar kafe (putih) naik menimpa bagian bawah hero.
  - Kartu ajakan menumpuk satu sama lain. Di layar lebar menempel (sticky) dengan jarak bertingkat
    supaya tepi kartu sebelumnya tetap terlihat; di HP cukup saling menimpa sedikit karena kartu bisa
    lebih tinggi dari layar.
*/
function StackCard({ i, last, className, children }: { i: number; last?: boolean; className: string; children: ReactNode }) {
  return (
    <div data-stack-card style={{ "--i": i } as CSSProperties}
      className={`relative ${i ? "-mt-6 md:mt-8" : ""} ${last ? "" : "md:sticky md:top-[calc(5.75rem+var(--i)*1.1rem)]"}`}>
      <div data-stack-inner
        className={`relative origin-top overflow-hidden rounded-[2rem] shadow-[0_-16px_36px_-22px_rgba(31,22,18,.5)] ${last ? "" : "pb-6 md:pb-0"} ${className}`}>
        {children}
        {/* Peredup kartu yang sedang tertimpa; diatur oleh HomeMotion */}
        {!last && <div data-stack-shade aria-hidden className="pointer-events-none absolute inset-0 bg-ink opacity-0" />}
      </div>
    </div>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const [viewer, settings] = await Promise.all([getViewer(), getSettings()]);
  const free = settings.free_mode;
  const featuredAuthor = pickFeatured(await getAuthors(), settings.featured_author);
  const showTrial = !free && !viewer.user && settings.trial_days > 0;
  const [{ data: cities }, { data: featured }, { data: latest, error: latestErr }, { count }] = await Promise.all([
    supabase.from("cities").select("*").eq("is_active", true).order("name"),
    supabase.from("cafes").select(CAFE_LIST_SELECT).eq("is_featured", true).order("visited_at", { ascending: false }).limit(6),
    supabase.from("cafes").select(CAFE_LIST_SELECT).order("created_at", { ascending: false }).limit(6),
    supabase.from("cafes").select("id", { count: "exact", head: true }),
  ]);
  const cityList = (cities as City[] | null) ?? [];
  const latestList = (latest as Cafe[] | null) ?? [];

  const stack: { key: string; className: string; node: ReactNode }[] = [];

  stack.push(featuredAuthor ? {
    key: "author",
    className: "bg-surface",
    node: (
      <div className="grid md:grid-cols-[1.25fr_1fr]">
        <Link href={authorHref(featuredAuthor)} className="group flex flex-col gap-5 p-6 transition-colors hover:bg-brand-soft/40 sm:flex-row sm:items-center md:p-10">
          <div className="relative w-fit shrink-0">
            <Avatar url={featuredAuthor.avatar_url} name={featuredAuthor.name} className="h-24 w-24 text-3xl" />
            <span className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-gold text-ink ring-4 ring-surface"><Icon name="star" filled className="h-4 w-4" /></span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand">Author bulan ini</p>
            <p className="mt-1 text-2xl font-bold group-hover:text-brand md:text-3xl">{featuredAuthor.name}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
              <AuthorBadge count={featuredAuthor.cafe_count} />
              <span>{featuredAuthor.cafe_count} kafe direkomendasikan</span>
            </div>
            {featuredAuthor.bio && <p className="mt-2 line-clamp-2 text-ink/75">{featuredAuthor.bio}</p>}
            <span className="mt-3 inline-block text-sm font-semibold text-brand">Lihat profil &amp; kafenya →</span>
          </div>
        </Link>
        <div className="flex flex-col justify-center gap-4 border-t border-line bg-brand p-6 text-white md:border-l md:border-t-0 md:p-10">
          <div>
            <p className="text-xl font-bold md:text-2xl">Punya kafe andalan buat kerja?</p>
            <p className="mt-1 text-white/85">Kirim rekomendasimu, dapat halaman author sendiri, dan naik level sampai Kurator Utama.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/kirim" className="btn min-h-11 bg-white text-brand hover:bg-brand-soft"><Icon name="send" className="h-4 w-4" />Kirim rekomendasi</Link>
            <Link href="/author" className="btn min-h-11 border border-white/40 text-white hover:bg-white/10">Para author</Link>
          </div>
        </div>
      </div>
    ),
  } : {
    key: "kirim",
    className: "bg-surface",
    node: (
      <Link href="/kirim" className="group flex flex-wrap items-center justify-between gap-4 p-6 transition-colors hover:bg-brand-soft/40 md:p-10">
        <span className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon name="send" className="h-6 w-6" /></span>
          <span>
            <span className="block text-xl font-bold md:text-2xl">Punya kafe andalan buat kerja?</span>
            <span className="block text-muted">Kirim rekomendasimu dan tampil sebagai author.</span>
          </span>
        </span>
        <span className="btn-dark min-h-11">Kirim rekomendasi</span>
      </Link>
    ),
  });

  if (settings.community_url) stack.push({
    key: "komunitas",
    className: "bg-ink",
    node: <CommunityCard url={settings.community_url} className="rounded-none" />,
  });

  stack.push({
    key: "peta",
    className: "bg-brand text-white",
    node: (
      <div className="grid gap-6 p-7 md:grid-cols-[1.4fr_1fr] md:items-center md:p-10">
        <div>
          <h2 className="text-3xl font-bold md:text-4xl">Tahu mau pesan apa sebelum sampai.</h2>
          <p className="mt-3 max-w-md text-white/85">
            {free
              ? "Baca penilaian kerja, ulasan lengkap, menu yang wajib dicoba, dan lihat peta semua kafe. Semuanya gratis."
              : "Pelanggan bisa membaca ulasan lengkap, menu yang wajib dicoba, meja terbaik untuk kerja, dan peta semua kafe."}
          </p>
        </div>
        <div className="md:text-right">
          {free
            ? <Link href="/peta" className="btn min-h-11 bg-white text-brand hover:bg-brand-soft"><Icon name="map" className="h-4 w-4" />Buka peta kafe</Link>
            : showTrial
            ? <Link href="/masuk?daftar=1" className="btn min-h-11 bg-white text-brand hover:bg-brand-soft">Coba gratis {settings.trial_days} hari</Link>
            : <Link href="/harga" className="btn min-h-11 bg-white text-brand hover:bg-brand-soft">Lihat harga langganan</Link>}
        </div>
      </div>
    ),
  });

  stack.push({
    key: "kontak",
    className: "bg-surface border border-line",
    node: (
      <div id="kontak" className="scroll-mt-24 p-6 md:p-10">
        <ContactBox defaultName={viewer.name} defaultEmail={viewer.user?.email} communityUrl={settings.community_url} />
      </div>
    ),
  });

  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          ORGANIZATION,
          {
            "@type": "WebSite",
            "@id": `${SITE_URL}/#website`,
            url: SITE_URL,
            name: APP_NAME,
            inLanguage: "id-ID",
            publisher: { "@id": `${SITE_URL}/#organization` },
            potentialAction: {
              "@type": "SearchAction",
              target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/kafe?q={search_term_string}` },
              "query-input": "required name=search_term_string",
            },
          },
        ],
      }} />
      <HomeMotion />

      <section data-hero className="relative isolate overflow-hidden">
        {/* Gambar latar + gradasi: di HP gambar di atas memudar ke bawah, di layar lebar gambar di kanan memudar ke kiri */}
        <div className="absolute inset-x-0 top-0 -z-10 h-[300px] overflow-hidden md:inset-y-0 md:left-[38%] md:right-0 md:h-auto" aria-hidden>
          {/* Lapisan foto sedikit lebih besar supaya parallax tidak memperlihatkan tepi kosong */}
          <div data-parallax className="absolute -inset-y-[8%] inset-x-0">
            <Image src="/hero-cafe.webp" alt="" fill priority sizes="(max-width:768px) 100vw, 62vw" className="object-cover object-[38%_center]" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-canvas/10 via-canvas/40 to-canvas md:bg-gradient-to-r md:from-canvas md:via-canvas/55 md:to-canvas/0" />
          <div className="absolute inset-x-0 bottom-0 hidden h-32 bg-gradient-to-t from-canvas to-canvas/0 md:block" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-12 pt-[210px] md:pb-32 md:pt-24">
          <div className="hero-in max-w-2xl">
            <h1 className="text-[clamp(2.6rem,7vw,5.2rem)] font-extrabold leading-[0.95]">
              Kerja dari kafe mana hari ini?
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink/75">
              {count ?? 0} kafe di kota-kota besar Pulau Jawa yang sudah dicoba langsung. Lengkap dengan colokan, wifi, dan menu rekomendasi.
            </p>
            <form action="/kafe" className="mt-8 flex max-w-xl items-center gap-2 rounded-full border border-line bg-surface p-1.5 pl-5 shadow-[0_8px_30px_-12px_rgba(20,26,23,.18)] focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
              <Icon name="search" className="h-5 w-5 shrink-0 text-muted" />
              <input name="q" aria-label="Cari kafe" placeholder="Cari nama kafe atau area" className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-muted" />
              <button className="btn-primary min-h-11 shrink-0">Cari</button>
            </form>
            {free && (
              <p className="mt-5 flex flex-wrap items-center gap-2 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ok/10 px-3 py-1 font-semibold text-ok"><Icon name="gift" className="h-4 w-4" />Gratis</span>
                Semua ulasan, menu, dan peta terbuka tanpa langganan.
              </p>
            )}
            {showTrial && (
              <p className="mt-5 flex flex-wrap items-center gap-3 text-sm">
                <Link href="/masuk?daftar=1" className="btn-dark !py-2"><Icon name="gift" className="h-4 w-4" />Coba gratis {settings.trial_days} hari</Link>
                <span className="text-muted">Daftar pakai email, tanpa bayar.</span>
              </p>
            )}
          </div>

          {!!cityList.length && (
            <nav aria-label="Kota" className="mt-8 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
              {cityList.map((c) => (
                <Link key={c.id} href={`/kota/${c.slug}`}
                  className="flex min-h-11 shrink-0 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium transition-colors hover:border-brand hover:bg-brand hover:text-white">
                  {c.name}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </section>

      {/* Lembar kafe: naik menimpa bagian bawah hero */}
      <div className="relative z-10 -mt-6 rounded-t-[2.5rem] bg-surface pb-24 shadow-[0_-18px_40px_-24px_rgba(31,22,18,.45)] md:-mt-20 md:pb-36">
        {!!featured?.length && (
          <section className="mx-auto max-w-6xl px-4 pt-10 md:pt-14">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-2xl font-bold md:text-3xl">Yang paling sering aku datangi</h2>
              <Link href="/kafe" className="shrink-0 py-2 text-sm font-semibold text-brand hover:underline">Lihat semua</Link>
            </div>
            <div className="mt-6 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
              {(featured as Cafe[]).map((c) => <CafeCard key={c.id} cafe={c} />)}
            </div>
          </section>
        )}

        <section className="mx-auto max-w-6xl px-4 pt-16">
          <h2 className="text-2xl font-bold md:text-3xl">Baru ditambahkan</h2>
          {latestErr ? (
            <p role="alert" className="mt-6 rounded-2xl border border-dashed border-line p-6 text-muted">
              Daftar kafe terbaru gagal dimuat. Muat ulang halaman ini, atau buka <Link href="/kafe" className="font-semibold text-brand hover:underline">semua kafe</Link>.
            </p>
          ) : latestList.length ? (
            <div className="mt-6 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
              {latestList.map((c) => <CafeCard key={c.id} cafe={c} />)}
            </div>
          ) : (
            <p className="mt-6 rounded-2xl border border-dashed border-line p-6 text-muted">
              Belum ada kafe yang tayang. Punya kafe andalan? <Link href="/kirim" className="font-semibold text-brand hover:underline">Kirim rekomendasi pertama</Link>.
            </p>
          )}
        </section>
      </div>

      {/* Tumpukan kartu ajakan: kartu pertama menimpa lembar kafe */}
      <div data-stack className="relative z-20 mx-auto -mt-14 max-w-6xl px-4 md:-mt-20">
        {stack.map((s, i) => (
          <StackCard key={s.key} i={i} last={i === stack.length - 1} className={s.className}>{s.node}</StackCard>
        ))}
      </div>
    </>
  );
}
