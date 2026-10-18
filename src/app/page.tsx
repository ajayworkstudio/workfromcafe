import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import CafeCard from "@/components/CafeCard";
import CafePhotoCard from "@/components/CafePhotoCard";
import LiveCafeCard from "@/components/LiveCafeCard";
import type { LiveSummary } from "@/lib/reports";
import CafeSwipeStack from "@/components/CafeSwipeStack";
import { toStackCafe } from "@/lib/stackCafe";
import HomeMotion from "@/components/HomeMotion";
import Avatar from "@/components/Avatar";
import AuthorBadge from "@/components/AuthorBadge";
import { authorHref, getAuthors, pickFeatured } from "@/lib/author";
import JsonLd from "@/components/JsonLd";
import { ORGANIZATION } from "@/lib/seo";
import Icon from "@/components/Icon";
import type { Cafe, City, Tag } from "@/lib/types";
import { APP_NAME, CAFE_LIST_SELECT, INSTAGRAM_URL, SITE_URL } from "@/lib/utils";
import { getViewer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const revalidate = 300;
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const supabase = await createClient();
  const [viewer, settings] = await Promise.all([getViewer(), getSettings()]);
  const free = settings.free_mode;
  const featuredAuthor = pickFeatured(await getAuthors(), settings.featured_author);
  const showTrial = !free && !viewer.user && settings.trial_days > 0;
  const [{ data: cities }, { data: featured }, { data: latest, error: latestErr }, { count }, { data: vibeRows }, { data: liveRows }] = await Promise.all([
    supabase.from("cities").select("*").eq("is_active", true).order("name"),
    supabase.from("cafes").select(CAFE_LIST_SELECT).eq("is_featured", true).order("visited_at", { ascending: false }).limit(6),
    supabase.from("cafes").select(CAFE_LIST_SELECT).order("created_at", { ascending: false }).limit(6),
    supabase.from("cafes").select("id", { count: "exact", head: true }),
    supabase.from("tags").select("*").eq("type", "vibe").order("name"),
    // Kondisi 3 jam terakhir dari laporan pengunjung (kosong kalau migrasi 0018 belum dijalankan)
    supabase.rpc("cafe_reports_live"),
  ]);
  const vibes = (vibeRows as Tag[] | null) ?? [];
  // "Lagi sepi sekarang" kalau ada kafe yang dilaporkan sepi; kalau tidak, kondisi terbaru apa pun
  const liveAll = ((liveRows as LiveSummary[] | null) ?? []).sort((a, b) => a.crowd - b.crowd || +new Date(b.last_at) - +new Date(a.last_at));
  const quiet = liveAll.filter((l) => l.crowd === 1);
  const livePick = (quiet.length ? quiet : liveAll).slice(0, 8);
  const liveTitle = quiet.length ? "Lagi sepi sekarang" : "Kondisi terbaru";
  const { data: liveCafeRows } = livePick.length
    ? await supabase.from("cafes").select(CAFE_LIST_SELECT).in("id", livePick.map((l) => l.cafe_id))
    : { data: [] };
  const liveCafes = livePick
    .map((live) => ({ live, cafe: ((liveCafeRows as Cafe[] | null) ?? []).find((c) => c.id === live.cafe_id) }))
    .filter((x): x is { live: LiveSummary; cafe: Cafe } => !!x.cafe);
  const cityList = (cities as City[] | null) ?? [];
  const latestList = (latest as Cafe[] | null) ?? [];
  const stackCafes = latestList.map(toStackCafe);

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

      {/* Hero kaca: foto kafe di belakang, panel & tombol kaca buram di atasnya. Kartu gelap membulat supaya
          tidak terasa seperti pita gelap yang menempel di header terang. */}
      <section data-hero className="relative isolate mx-2 mt-2 overflow-hidden rounded-[2rem] bg-espresso text-foam md:mx-4 md:rounded-[2.5rem]">
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          {/* Lapisan foto sedikit lebih besar supaya parallax tidak memperlihatkan tepi kosong */}
          <div data-parallax className="absolute -inset-y-[8%] inset-x-0">
            <Image src="/hero-cafe.webp" alt="" fill priority sizes="100vw" className="object-cover object-[38%_center] md:object-[70%_center]" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-espresso/45 via-espresso/60 to-espresso md:bg-gradient-to-r md:from-espresso md:via-espresso/70 md:to-espresso/15" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-6 pt-7 md:px-8 md:pb-14 md:pt-20">
          <div className="hero-in max-w-2xl">
            {viewer.name && (
              <p className="glass mb-5 inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-bold">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-tan text-ink">{viewer.name.trim().charAt(0).toUpperCase()}</span>
                Halo, {viewer.name.split(" ")[0]}
              </p>
            )}
            <h1 className="text-[clamp(2rem,7vw,5.2rem)] font-extrabold leading-[1.02] [text-shadow:0_2px_18px_rgb(0_0_0/0.35)] md:leading-[0.95]">
              Kerja dari kafe mana hari ini?
            </h1>
            <p className="mt-3 max-w-xl text-foam/85 md:mt-5 md:text-lg">
              {count ?? 0} kafe di kota-kota besar Pulau Jawa yang sudah dicoba langsung. Lengkap dengan colokan, wifi, dan menu rekomendasi.
            </p>
            <form action="/kafe" className="glass mt-6 flex max-w-xl items-center gap-2 rounded-full p-1.5 pl-5 focus-within:ring-4 focus-within:ring-gold/40 md:mt-8">
              <Icon name="search" className="h-5 w-5 shrink-0 text-foam" />
              <input name="q" type="search" enterKeyHint="search" aria-label="Cari kafe" placeholder="Cari kafe, area, atau suasana" className="min-w-0 flex-1 bg-transparent py-2 text-base text-foam outline-none placeholder:text-foam/75" />
              <button className="btn hidden min-h-11 shrink-0 bg-gold text-ink hover:bg-[#eab25e] md:inline-flex">Cari</button>
              {/* HP: tombol bulat ke halaman Jelajah yang punya filter lengkap; pencarian jalan lewat tombol Cari di keyboard */}
              <Link href="/kafe" aria-label="Filter lengkap" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold text-ink md:hidden">
                <Icon name="sliders" className="h-5 w-5" />
              </Link>
            </form>
          </div>

          {!!vibes.length && (
            <nav aria-label="Suasana" className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
              {vibes.map((t) => (
                <Link key={t.id} href={`/kafe?tag=${encodeURIComponent(t.name)}`}
                  className="glass flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors hover:bg-foam hover:text-ink">
                  {t.name}
                </Link>
              ))}
            </nav>
          )}

          {!!cityList.length && (
            <>
              <h2 className="mt-6 text-lg font-bold">Pilih kotanya</h2>
              <nav aria-label="Kota" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
                {cityList.map((c) => (
                  <Link key={c.id} href={`/kota/${c.slug}`}
                    className="flex min-h-11 shrink-0 items-center rounded-full bg-foam px-4 text-sm font-semibold text-ink transition-colors hover:bg-gold">
                    {c.name}
                  </Link>
                ))}
              </nav>
            </>
          )}

          {!!liveCafes.length && (
            <div className="mt-8">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="flex items-center gap-2 text-lg font-bold md:text-xl">
                  <span className="h-2 w-2 rounded-full bg-[#6fd09a] shadow-[0_0_0_4px_rgb(111_208_154/0.22)]" />
                  {liveTitle}
                </h2>
                <Link href={liveTitle === "Lagi sepi sekarang" ? "/kafe?sepi=1" : "/kafe"} className="glass-dark flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold text-foam">Lihat semua</Link>
              </div>
              <div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
                {liveCafes.map(({ cafe, live }) => <LiveCafeCard key={cafe.id} cafe={cafe} live={live} />)}
              </div>
            </div>
          )}
        </div>
      </section>

      {!!featured?.length && (
        <section className="mx-auto max-w-6xl px-4 pt-8 md:pt-14">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-bold md:text-3xl">Yang paling sering aku datangi</h2>
            <Link href="/kafe" className="shrink-0 py-2 text-sm font-semibold text-brand hover:underline">Lihat semua</Link>
          </div>
          {/* HP: kartu foto besar yang digeser ke samping; kartu berikutnya mengintip di kanan sebagai tanda bisa digeser */}
          <div className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:hidden">
            {(featured as Cafe[]).map((c, i) => (
              <div key={c.id} className="w-[84%] shrink-0 snap-center">
                <CafePhotoCard cafe={c} priority={i === 0} />
              </div>
            ))}
          </div>
          <div className="mt-6 hidden gap-x-5 gap-y-9 sm:grid sm:grid-cols-2 lg:grid-cols-3">
            {(featured as Cafe[]).map((c) => <CafeCard key={c.id} cafe={c} />)}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pt-16">
        {latestErr ? (
          <>
            <h2 className="text-2xl font-bold md:text-3xl">Baru ditambahkan</h2>
            <p role="alert" className="mt-6 rounded-2xl border border-dashed border-line p-6 text-muted">
              Daftar kafe terbaru gagal dimuat. Muat ulang halaman ini, atau buka <Link href="/kafe" className="font-semibold text-brand hover:underline">semua kafe</Link>.
            </p>
          </>
        ) : stackCafes.length ? (
          <CafeSwipeStack cafes={stackCafes} title="Baru ditambahkan" />
        ) : (
          <>
            <h2 className="text-2xl font-bold md:text-3xl">Baru ditambahkan</h2>
            <p className="mt-6 rounded-2xl border border-dashed border-line p-6 text-muted">
              Belum ada kafe yang tayang. Punya kafe andalan? <Link href="/kirim" className="font-semibold text-brand hover:underline">Kirim rekomendasi pertama</Link>.
            </p>
          </>
        )}
      </section>

      {/* Kartu ajakan: satu kartu utama (author/kirim) lebar penuh, dua kartu pendukung berdampingan */}
      <section className="mx-auto grid max-w-6xl gap-5 px-4 pt-16 md:grid-cols-2">
        {featuredAuthor ? (
          <article className="grid overflow-hidden rounded-[1.75rem] border border-line bg-surface md:col-span-2 md:grid-cols-[1.3fr_1fr]">
            <Link href={authorHref(featuredAuthor)} className="group flex flex-col gap-5 p-6 transition-colors hover:bg-brand-soft/40 sm:flex-row sm:items-center md:p-9">
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
            <div className="flex flex-col justify-center gap-4 border-t border-line bg-brand-soft p-6 md:border-l md:border-t-0 md:p-9">
              <div>
                <p className="text-xl font-bold md:text-2xl">Punya kafe andalan buat kerja?</p>
                <p className="mt-1 text-ink/75">Kirim rekomendasimu, dapat halaman author sendiri, dan naik level sampai Kurator Utama.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/kirim" className="btn-primary min-h-11"><Icon name="send" className="h-4 w-4" />Kirim rekomendasi</Link>
                <Link href="/author" className="btn-ghost min-h-11">Para author</Link>
              </div>
            </div>
          </article>
        ) : (
          <Link href="/kirim" className="group flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] border border-line bg-surface p-6 transition-colors hover:border-brand md:col-span-2 md:p-9">
            <span className="flex items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon name="send" className="h-6 w-6" /></span>
              <span>
                <span className="block text-xl font-bold md:text-2xl">Punya kafe andalan buat kerja?</span>
                <span className="block text-muted">Kirim rekomendasimu dan tampil sebagai author.</span>
              </span>
            </span>
            <span className="btn-dark min-h-11">Kirim rekomendasi</span>
          </Link>
        )}

        {settings.community_url && (
          <article className="flex flex-col rounded-[1.75rem] bg-ink p-6 text-white md:p-9">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#25d366]/15 text-[#25d366]"><Icon name="whatsapp" className="h-6 w-6" /></span>
            <h2 className="mt-5 text-2xl font-bold leading-tight md:text-3xl">Gabung bareng WFC Hunters &amp; Author.</h2>
            <p className="mt-2 text-white/75">Tukar rekomendasi, cari teman kerja bareng, dan dapat kabar kafe baru lebih dulu. Gratis, terbuka untuk semua.</p>
            <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-6">
              <a href={settings.community_url} target="_blank" rel="noopener" className="btn min-h-11 bg-[#25d366] text-ink hover:bg-[#1fbe5b]">Gabung komunitas WhatsApp</a>
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener" className="flex min-h-11 items-center gap-2 text-sm font-semibold text-white/85 hover:text-white">
                <Icon name="instagram" className="h-4 w-4" />@wfchunters
              </a>
            </div>
          </article>
        )}

        <article className={`flex flex-col rounded-[1.75rem] bg-brand p-6 text-white md:p-9 ${settings.community_url ? "" : "md:col-span-2"}`}>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><Icon name="map" className="h-6 w-6" /></span>
          <h2 className="mt-5 text-2xl font-bold leading-tight md:text-3xl">Tahu mau pesan apa sebelum sampai.</h2>
          <p className="mt-2 text-white/85">
            {free
              ? "Baca penilaian kerja, ulasan lengkap, menu yang wajib dicoba, dan lihat peta semua kafe. Semuanya gratis."
              : "Pelanggan bisa membaca ulasan lengkap, menu yang wajib dicoba, meja terbaik untuk kerja, dan peta semua kafe."}
          </p>
          <div className="mt-auto pt-6">
            {free
              ? <Link href="/peta" className="btn min-h-11 bg-white text-brand hover:bg-brand-soft">Buka peta kafe</Link>
              : showTrial
              ? <Link href="/masuk?daftar=1" className="btn min-h-11 bg-white text-brand hover:bg-brand-soft">Coba gratis {settings.trial_days} hari</Link>
              : <Link href="/harga" className="btn min-h-11 bg-white text-brand hover:bg-brand-soft">Lihat harga langganan</Link>}
          </div>
        </article>
      </section>
    </>
  );
}
