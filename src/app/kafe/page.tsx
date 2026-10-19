import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NearbyGrid from "@/components/NearbyGrid";
import AutoFilterForm from "@/components/AutoFilterForm";
import FilterSheet from "@/components/FilterSheet";
import Icon from "@/components/Icon";
import Image from "next/image";
import type { Cafe, City, Tag } from "@/lib/types";
import { CAFE_LIST_SELECT, PRICE_RANGES, isOpenNow } from "@/lib/utils";
import type { LiveSummary } from "@/lib/reports";

type SPMeta = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SPMeta }): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = Object.values(sp).some((v) => v && (Array.isArray(v) ? v.length : String(v).length));
  return {
    title: "Jelajah kafe untuk kerja & nugas di Pulau Jawa",
    description: "Cari kafe yang nyaman untuk kerja (WFC) dan nugas: filter per kota, kisaran harga, fasilitas seperti wifi dan colokan, serta kafe yang sedang buka.",
    // Hasil filter/pencarian tidak diindeks supaya tidak jadi konten ganda; Google tetap mengikuti link kafenya
    alternates: { canonical: typeof sp.kota === "string" && Object.keys(sp).length === 1 ? `/kota/${sp.kota}` : "/kafe" },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

type SP = Promise<{ q?: string; kota?: string; tag?: string | string[]; harga?: string; buka?: string; sepi?: string }>;

export default async function CafesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const selectedTags = ([] as string[]).concat(sp.tag ?? []);
  const supabase = await createClient();

  const [{ data: cities }, { data: tags }, { data: liveRows }] = await Promise.all([
    supabase.from("cities").select("*").eq("is_active", true).order("name"),
    supabase.from("tags").select("*").order("name"),
    // Kondisi 3 jam terakhir dari laporan pengunjung (kosong kalau migrasi 0018 belum dijalankan)
    supabase.rpc("cafe_reports_live"),
  ]);
  const live = Object.fromEntries(((liveRows as LiveSummary[] | null) ?? []).map((r) => [r.cafe_id, r]));

  let query = supabase.from("cafes").select(CAFE_LIST_SELECT).order("my_rating", { ascending: false, nullsFirst: false });
  if (sp.q) {
    const q = sp.q.replace(/[%,()]/g, " ");
    query = query.or(`name.ilike.%${q}%,area.ilike.%${q}%,short_review.ilike.%${q}%`);
  }
  if (sp.kota) {
    const city = (cities as City[] | null)?.find((c) => c.slug === sp.kota);
    if (city) query = query.eq("city_id", city.id);
  }
  if (sp.harga) query = query.eq("price_range", Number(sp.harga));

  const { data } = await query;
  let cafes = (data as Cafe[] | null) ?? [];
  // Filter tag (harus punya SEMUA tag yang dipilih) & buka sekarang
  if (selectedTags.length) {
    cafes = cafes.filter((c) => {
      const names = (c.tags ?? []).map((t) => t.tag?.name);
      return selectedTags.every((t) => names.includes(t));
    });
  }
  if (sp.buka === "1") cafes = cafes.filter((c) => isOpenNow(c.opening_hours));
  if (sp.sepi === "1") cafes = cafes.filter((c) => live[c.id]?.crowd === 1);

  const vibe = (tags as Tag[] | null)?.filter((t) => t.type === "vibe") ?? [];
  const facility = (tags as Tag[] | null)?.filter((t) => t.type === "facility") ?? [];
  const cityList = (cities as City[] | null) ?? [];
  const sheetCount = (sp.kota ? 1 : 0) + (sp.harga ? 1 : 0) + selectedTags.length;
  const anyFilter = !!(sp.q || sp.kota || sp.harga || sp.buka || sp.sepi || selectedTags.length);

  return (
    <div className="mx-auto max-w-6xl px-2 pt-2 md:px-4">
      <AutoFilterForm>
        {/* Kepala kaca: cari, tombol filter, dan pilihan cepat. Filter lengkap ada di lembar Filter. */}
        {/* Tanpa "isolate"/z-index di sini: lembar Filter (fixed) harus berada di atas daftar kafe, bukan terkurung di kepala ini */}
        <section className="relative overflow-hidden rounded-[2rem] bg-espresso px-4 pb-5 pt-6 text-foam md:rounded-[2.5rem] md:px-8 md:pb-7 md:pt-10">
          <div className="absolute inset-0" aria-hidden>
            <Image src="/hero-cafe.webp" alt="" fill priority sizes="100vw" className="object-cover object-[38%_center] md:object-[70%_center]" />
            <div className="absolute inset-0 bg-gradient-to-b from-espresso/55 via-espresso/70 to-espresso md:bg-gradient-to-r md:from-espresso md:via-espresso/75 md:to-espresso/30" />
          </div>

          <div className="relative">
          <h1 className="text-3xl font-extrabold md:text-5xl">Jelajah kafe</h1>

          <div className="mt-4 flex max-w-2xl items-center gap-2">
            <label className="glass flex min-w-0 flex-1 items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5 focus-within:ring-4 focus-within:ring-gold/40">
              <Icon name="search" className="h-5 w-5 shrink-0" />
              <span className="sr-only">Cari kafe</span>
              <input type="search" name="q" defaultValue={sp.q} enterKeyHint="search" placeholder="Nama kafe atau area"
                className="min-h-10 min-w-0 flex-1 bg-transparent text-base text-foam outline-none placeholder:text-foam/75" />
            </label>
            <FilterSheet count={sheetCount} total={cafes.length} resetHref="/kafe">
              <ChipGroup title="Kota" type="radio" name="kota"
                options={[{ value: "", label: "Semua kota" }, ...cityList.map((c) => ({ value: c.slug, label: c.name }))]}
                selected={[sp.kota ?? ""]} />
              <ChipGroup title="Kisaran harga" type="radio" name="harga"
                options={[{ value: "", label: "Semua" }, ...PRICE_RANGES.map((r) => ({ value: String(r.value), label: r.label }))]}
                selected={[sp.harga ?? ""]} />
              <ChipGroup title="Suasana" type="checkbox" name="tag" options={vibe.map((t) => ({ value: t.name, label: t.name }))} selected={selectedTags} />
              <ChipGroup title="Fasilitas" type="checkbox" name="tag" options={facility.map((t) => ({ value: t.name, label: t.name }))} selected={selectedTags} />
            </FilterSheet>
          </div>

          {/* Pilihan cepat: kondisi sekarang. Kota ada di lembar Filter. */}
          <div className="mt-4 flex flex-wrap gap-2">
            <QuickChip type="checkbox" name="sepi" value="1" checked={sp.sepi === "1"} dot>Sepi sekarang</QuickChip>
            <QuickChip type="checkbox" name="buka" value="1" checked={sp.buka === "1"}>Buka sekarang</QuickChip>
          </div>
          </div>
        </section>
      </AutoFilterForm>

      <section className="px-2 pt-6 md:px-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-lg font-bold">{cafes.length} kafe cocok</p>
          {anyFilter && <Link href="/kafe" className="py-2 text-sm font-semibold text-brand hover:underline">Hapus semua filter</Link>}
        </div>
        <NearbyGrid cafes={cafes} live={live} />
        {!cafes.length && (
          <p className="mt-6 rounded-2xl bg-tint p-8 text-center text-muted">
            {sp.sepi === "1" ? "Belum ada kafe yang dilaporkan sepi dalam 3 jam terakhir. Coba matikan Sepi sekarang." : "Tidak ada kafe yang cocok. Coba kurangi filternya."}
          </p>
        )}
      </section>
    </div>
  );
}

/** Chip di kepala kaca. Checkbox/radio asli (tersembunyi) supaya ikut terkirim bersama form dan bisa dipakai dengan keyboard. */
function QuickChip({ type, name, value, checked, dot, children }: { type: "checkbox" | "radio"; name: string; value: string; checked: boolean; dot?: boolean; children: React.ReactNode }) {
  return (
    <label className="shrink-0 cursor-pointer">
      <input type={type} name={name} value={value} defaultChecked={checked} className="peer sr-only" />
      <span className="glass flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors peer-checked:border-foam peer-checked:bg-foam peer-checked:text-ink peer-focus-visible:ring-2 peer-focus-visible:ring-gold">
        {dot && <span className="h-2 w-2 rounded-full bg-[#6fd09a]" aria-hidden />}
        {children}
      </span>
    </label>
  );
}

function ChipGroup({ title, type, name, options, selected }: { title: string; type: "checkbox" | "radio"; name: string; options: { value: string; label: string }[]; selected: string[] }) {
  if (!options.length) return null;
  return (
    <fieldset>
      <legend className="mb-2.5 font-bold">{title}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value || "semua"} className="cursor-pointer">
            <input type={type} name={name} value={o.value} defaultChecked={selected.includes(o.value)} className="peer sr-only" />
            <span className="flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium transition-colors hover:border-mist peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
