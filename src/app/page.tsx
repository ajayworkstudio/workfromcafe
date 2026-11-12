import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import CafeCard from "@/components/CafeCard";
import CafePhotoCard from "@/components/CafePhotoCard";
import LiveCafeCard from "@/components/LiveCafeCard";
import type { LiveSummary } from "@/lib/reports";
import CafeShowcase from "@/components/CafeShowcase";
import CategoryTabs from "@/components/CategoryTabs";
import { homeCategories } from "@/lib/homeCategories";
import SuggestionBox from "@/components/SuggestionBox";
import { toStackCafe } from "@/lib/stackCafe";
import HomeMotion from "@/components/HomeMotion";
import Avatar from "@/components/Avatar";
import TimeGreeting from "@/components/TimeGreeting";
import AuthorBadge from "@/components/AuthorBadge";
import { authorHref, getAuthors, pickFeatured } from "@/lib/author";
import JsonLd from "@/components/JsonLd";
import { ORGANIZATION } from "@/lib/seo";
import Icon from "@/components/Icon";
import type { Cafe } from "@/lib/types";
import { APP_NAME, CAFE_LIST_SELECT, INSTAGRAM_URL, SITE_URL } from "@/lib/utils";
import { getViewer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import ArticleCard from "@/components/ArticleCard";
import { articleCovers, cityNames, getManualArticles } from "@/lib/articles";
import { getT } from "@/lib/i18n/server";
import { translateArticles } from "@/lib/i18n/content";

export const revalidate = 300;
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const supabase = await createClient();
  const { t, lang } = await getT();
  const [viewer, settings, allArticles] = await Promise.all([getViewer(), getSettings(), getManualArticles()]);
  const articles = await translateArticles(lang, allArticles.slice(0, 3));
  const [articleCoverMap, articleCities] = await Promise.all([articleCovers(articles), cityNames()]);
  const free = settings.free_mode;
  const featuredAuthor = pickFeatured(await getAuthors(), settings.featured_author);
  const showTrial = !free && !viewer.user && settings.trial_days > 0;
  const [{ data: featured }, { data: latest, error: latestErr }, { count }, { data: liveRows }, { data: published }] = await Promise.all([
    supabase.from("cafes").select(CAFE_LIST_SELECT).eq("is_featured", true).order("visited_at", { ascending: false }).limit(6),
    supabase.from("cafes").select(CAFE_LIST_SELECT).order("created_at", { ascending: false }).limit(6),
    supabase.from("cafes").select("id", { count: "exact", head: true }).eq("is_published", true),
    // Kondisi 3 jam terakhir dari laporan pengunjung (kosong kalau migrasi 0018 belum dijalankan)
    supabase.rpc("cafe_reports_live"),
    // Bahan "Cocok untuk": semua kafe tayang, dipilah per tag WFC / Nongkrong di homeCategories
    supabase.from("cafes").select(CAFE_LIST_SELECT).eq("is_published", true),
  ]);
  // t("Lagi sepi sekarang") kalau ada kafe yang dilaporkan sepi; kalau tidak, kondisi terbaru apa pun
  const curated = count ?? 0;
  const liveAll = ((liveRows as LiveSummary[] | null) ?? []).sort((a, b) => a.crowd - b.crowd || +new Date(b.last_at) - +new Date(a.last_at));
  const quiet = liveAll.filter((l) => l.crowd === 1);
  const livePick = (quiet.length ? quiet : liveAll).slice(0, 8);
  const liveTitle = quiet.length ? t("Lagi sepi sekarang") : t("Kondisi terbaru");
  const { data: liveCafeRows } = livePick.length
    ? await supabase.from("cafes").select(CAFE_LIST_SELECT).in("id", livePick.map((l) => l.cafe_id))
    : { data: [] };
  const liveCafes = livePick
    .map((live) => ({ live, cafe: ((liveCafeRows as Cafe[] | null) ?? []).find((c) => c.id === live.cafe_id) }))
    .filter((x): x is { live: LiveSummary; cafe: Cafe } => !!x.cafe);
  const latestList = (latest as Cafe[] | null) ?? [];
  const stackCafes = latestList.map(toStackCafe);
  const cats = homeCategories((published as Cafe[] | null) ?? []);
  const catPanel = (list: Cafe[]) => (
    <>
      {/* HP: kartu foto digeser ke samping, kartu berikutnya mengintip. Layar lebar: tiga kolom. */}
      <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:hidden">
        {list.map((c) => (
          <div key={c.id} className="w-[84%] shrink-0 snap-center"><CafePhotoCard cafe={c} /></div>
        ))}
      </div>
      <div className="mt-6 hidden gap-x-5 gap-y-9 sm:grid sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => <CafeCard key={c.id} cafe={c} />)}
      </div>
    </>
  );
  const catTabs = [
    { key: "wfc", label: t("WFC"), icon: "desk", list: cats.wfc, href: "/kafe?tag=WFC", allLabel: t("Semua kafe WFC"),
      note: t("Diurutkan dari nilai internet, colokan, dan ketenangan.") },
    { key: "nongkrong", label: t("Nongkrong"), icon: "users", list: cats.nongkrong, href: "/kafe?tag=Nongkrong", allLabel: t("Semua kafe nongkrong"),
      note: t("Diurutkan dari nilai kurator. Kafe yang sudah ada di WFC tidak diulang.") },
  ].filter((x) => x.list.length).map(({ list, ...x }) => ({ ...x, panel: catPanel(list) }));

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
                {/* Foto sama dengan yang di header; inisial kalau belum ada foto */}
                <Avatar url={viewer.avatarUrl} name={viewer.name} className="h-8 w-8 text-sm" />
                <TimeGreeting name={viewer.name.split(" ")[0]} />
              </p>
            )}
            <h1 className="[text-shadow:0_2px_18px_rgb(0_0_0/0.35)]">
              <span className="block text-[clamp(1.05rem,2.6vw,1.5rem)] font-bold leading-tight text-gold">{t("Rekomendasi WFC & nongkrong")}</span>
              <span className="mt-2 block text-[clamp(2rem,6.4vw,4.6rem)] font-extrabold leading-[1.02] md:mt-3 md:leading-[0.95]">{t("Mana yang mau dikunjungi hari ini?")}</span>
            </h1>
            <p className="mt-3 text-sm font-semibold text-foam/80 md:mt-5">{t("Rekomendasi ini hasil kurasi kurator WFC Hunters.")}</p>
            <p className="mt-2 max-w-xl text-foam/85 md:text-lg">
              {/* Dibulatkan ke bawah ke puluhan dari jumlah kafe tayang: 65 jadi "60+" */}
              {curated >= 10
                ? t("{n}+ kafe sudah dikurasi para WFC Hunters, sesuai pengalaman mereka sendiri.", { n: Math.floor(curated / 10) * 10 })
                : t("{n} kafe sudah dikurasi para WFC Hunters, sesuai pengalaman mereka sendiri.", { n: curated })}
            </p>
            <form action="/kafe" className="glass mt-6 flex max-w-xl items-center gap-2 rounded-full p-1.5 pl-5 focus-within:ring-4 focus-within:ring-gold/40 md:mt-8">
              <Icon name="search" className="h-5 w-5 shrink-0 text-foam" />
              <input name="q" type="search" enterKeyHint="search" aria-label={t("Cari kafe")} placeholder={t("Cari kafe, area, atau suasana")} className="min-w-0 flex-1 bg-transparent py-2 text-base text-foam outline-none placeholder:text-foam/75" />
              <button aria-label={t("Cari")} className="btn min-h-11 shrink-0 bg-gold text-ink hover:bg-[#eab25e] max-md:h-11 max-md:w-11 max-md:!p-0">
                <Icon name="search" className="h-5 w-5 md:hidden" /><span className="hidden md:inline">{t("Cari")}</span>
              </button>
            </form>
          </div>

          {/* Dua jalan pintas pengganti pilihan kota & suasana: kafe terdekat (di peta) dan semua kafe */}
          <div className="mt-4 grid max-w-xl grid-cols-2 gap-2">
            <Link href="/peta?dekat=1" className="glass flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition-colors hover:bg-foam hover:text-ink">
              <Icon name="locate" className="h-4 w-4" />{t("Kafe terdekat")}
            </Link>
            <Link href="/kafe" className="glass flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition-colors hover:bg-foam hover:text-ink">
              <Icon name="grid" className="h-4 w-4" />{t("Semua kafe")}
            </Link>
          </div>

          {!!liveCafes.length && (
            <div className="mt-8">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="flex items-center gap-2 text-lg font-bold md:text-xl">
                  <span className="h-2 w-2 rounded-full bg-[#6fd09a] shadow-[0_0_0_4px_rgb(111_208_154/0.22)]" />
                  {liveTitle}
                </h2>
                <Link href={quiet.length ? "/kafe?sepi=1" : "/kafe"} className="glass-dark flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold text-foam">{t("Lihat semua")}</Link>
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
            <h2 className="text-xl font-bold md:text-3xl">{t("Yang paling sering aku datangi")}</h2>
            <Link href="/kafe" className="shrink-0 py-2 text-sm font-semibold text-brand hover:underline">{t("Lihat semua")}</Link>
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
            <h2 className="text-2xl font-bold md:text-3xl">{t("Baru ditambahkan")}</h2>
            <p role="alert" className="mt-6 rounded-2xl border border-dashed border-line p-6 text-muted">
              {t("Daftar kafe terbaru gagal dimuat. Muat ulang halaman ini, atau buka")} <Link href="/kafe" className="font-semibold text-brand hover:underline">{t("semua kafe")}</Link>.
            </p>
          </>
        ) : stackCafes.length ? (
          <CafeShowcase cafes={stackCafes} title={t("Baru ditambahkan")} />
        ) : (
          <>
            <h2 className="text-2xl font-bold md:text-3xl">{t("Baru ditambahkan")}</h2>
            <p className="mt-6 rounded-2xl border border-dashed border-line p-6 text-muted">
              {t("Belum ada kafe yang tayang. Punya kafe andalan?")} <Link href="/kirim" className="font-semibold text-brand hover:underline">{t("Kirim rekomendasi pertama")}</Link>.
            </p>
          </>
        )}
      </section>

      {!!catTabs.length && (
        <section className="mx-auto max-w-6xl px-4 pt-16">
          <CategoryTabs title={t("Cocok untuk")} tabs={catTabs} />
        </section>
      )}

      {!!articles.length && (
        <section className="reveal mx-auto max-w-6xl px-4 pt-16">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-2xl font-bold md:text-3xl">{t("Bacaan terbaru")}</h2>
            <Link href="/artikel" className="shrink-0 py-2 text-sm font-semibold text-brand hover:underline">{t("Semua artikel")}</Link>
          </div>
          {/* HP: digeser ke samping, kartu berikutnya mengintip. Layar lebar: tiga kolom. */}
          <ul className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
            {articles.map((a) => (
              <li key={a.id} className="w-[78vw] max-w-[22rem] shrink-0 snap-start md:w-auto md:max-w-none">
                <ArticleCard a={a} cover={articleCoverMap.get(a.id)} label={(a.city_id && articleCities.get(a.city_id)) || t("Panduan")} excerpt />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Kartu ajakan: satu kartu utama (author/kirim) lebar penuh, dua kartu pendukung berdampingan */}
      <section className="reveal mx-auto grid max-w-6xl gap-5 px-4 pt-16 md:grid-cols-2">
        {featuredAuthor ? (
          <article className="grid overflow-hidden rounded-[1.75rem] border border-line bg-surface md:col-span-2 md:grid-cols-[1.3fr_1fr]">
            <Link href={authorHref(featuredAuthor)} className="group flex flex-col gap-5 p-6 transition-colors hover:bg-brand-soft/40 sm:flex-row sm:items-center md:p-9">
              <div className="relative w-fit shrink-0">
                <Avatar url={featuredAuthor.avatar_url} name={featuredAuthor.name} className="h-24 w-24 text-3xl" />
                <span className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-gold text-ink ring-4 ring-surface"><Icon name="star" filled className="h-4 w-4" /></span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brand">{t("Author bulan ini")}</p>
                <p className="mt-1 text-2xl font-bold group-hover:text-brand md:text-3xl">{featuredAuthor.name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <AuthorBadge count={featuredAuthor.cafe_count} />
                  <span>{t("{n} kafe direkomendasikan", { n: featuredAuthor.cafe_count })}</span>
                </div>
                {featuredAuthor.bio && <p className="mt-2 line-clamp-2 text-ink/75">{featuredAuthor.bio}</p>}
                <span className="mt-3 inline-block text-sm font-semibold text-brand">{t("Lihat profil & kafenya →")}</span>
              </div>
            </Link>
            <div className="flex flex-col justify-center gap-4 border-t border-line bg-brand-soft p-6 md:border-l md:border-t-0 md:p-9">
              <div>
                <p className="text-xl font-bold md:text-2xl">{t("Punya kafe andalan buat kerja?")}</p>
                <p className="mt-1 text-ink/75">{t("Kirim rekomendasimu, dapat halaman author sendiri, dan naik level sampai Kurator Utama.")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/kirim" className="btn-primary min-h-11"><Icon name="send" className="h-4 w-4" />{t("Kirim rekomendasi")}</Link>
                <Link href="/author" className="btn-ghost min-h-11">{t("Para author")}</Link>
              </div>
            </div>
          </article>
        ) : (
          <Link href="/kirim" className="group flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] border border-line bg-surface p-6 transition-colors hover:border-brand md:col-span-2 md:p-9">
            <span className="flex items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon duo name="send" className="h-6 w-6" /></span>
              <span>
                <span className="block text-xl font-bold md:text-2xl">{t("Punya kafe andalan buat kerja?")}</span>
                <span className="block text-muted">{t("Kirim rekomendasimu dan tampil sebagai author.")}</span>
              </span>
            </span>
            <span className="btn-dark min-h-11">{t("Kirim rekomendasi")}</span>
          </Link>
        )}

        {settings.community_url && (
          <article className="flex flex-col rounded-[1.75rem] bg-ink p-6 text-white md:p-9">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#25d366]/15 text-[#25d366]"><Icon name="whatsapp" className="h-6 w-6" /></span>
            <h2 className="mt-5 text-2xl font-bold leading-tight md:text-3xl">{t("Gabung bareng WFC Hunters & Author.")}</h2>
            <p className="mt-2 text-white/75">{t("Tukar rekomendasi, cari teman kerja bareng, dan dapat kabar kafe baru lebih dulu. Gratis, terbuka untuk semua.")}</p>
            <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-6">
              <a href={settings.community_url} target="_blank" rel="noopener" className="btn min-h-11 bg-[#25d366] text-ink hover:bg-[#1fbe5b]">{t("Gabung komunitas WhatsApp")}</a>
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener" className="flex min-h-11 items-center gap-2 text-sm font-semibold text-white/85 hover:text-white">
                <Icon name="instagram" className="h-4 w-4" />@wfchunters
              </a>
            </div>
          </article>
        )}

        <article className={`flex flex-col rounded-[1.75rem] bg-brand p-6 text-white md:p-9 ${settings.community_url ? "" : "md:col-span-2"}`}>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><Icon name="map" className="h-6 w-6" /></span>
          <h2 className="mt-5 text-2xl font-bold leading-tight md:text-3xl">{t("Tahu mau pesan apa sebelum sampai.")}</h2>
          <p className="mt-2 text-white/85">
            {free
              ? t("Baca penilaian kerja, ulasan lengkap, menu yang wajib dicoba, dan lihat peta semua kafe. Semuanya gratis.")
              : t("Pelanggan bisa membaca ulasan lengkap, menu yang wajib dicoba, meja terbaik untuk kerja, dan peta semua kafe.")}
          </p>
          <div className="mt-auto pt-6">
            {free
              ? <Link href="/peta" className="btn min-h-11 bg-white text-brand hover:bg-brand-soft">{t("Buka peta kafe")}</Link>
              : showTrial
              ? <Link href="/masuk?daftar=1" className="btn min-h-11 bg-white text-brand hover:bg-brand-soft">{t("Coba gratis {n} hari", { n: settings.trial_days })}</Link>
              : <Link href="/harga" className="btn min-h-11 bg-white text-brand hover:bg-brand-soft">{t("Lihat harga langganan")}</Link>}
          </div>
        </article>
      </section>

      <div className="mx-auto max-w-6xl px-4 pt-16">
        <SuggestionBox />
      </div>
    </>
  );
}
