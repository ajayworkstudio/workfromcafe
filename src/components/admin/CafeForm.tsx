import { saveCafe } from "@/app/admin/kafe/actions";
import type { Cafe, CafeDetails, City, Tag } from "@/lib/types";
import { DAYS, priceLabel } from "@/lib/utils";
import SubmitButton from "./SubmitButton";
import CoordinateInput from "./CoordinateInput";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 md:p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function CafeForm({
  cafe, details, cities, tags, selectedTagIds,
}: { cafe?: Cafe; details?: CafeDetails | null; cities: City[]; tags: Tag[]; selectedTagIds: string[] }) {
  const h = cafe?.opening_hours ?? {};
  return (
    <form action={saveCafe} className="space-y-5">
      {cafe && <input type="hidden" name="id" value={cafe.id} />}

      <Section title="Info dasar" description="Terlihat oleh semua pengunjung.">
        <div className="grid gap-4 md:grid-cols-2">
          <div><label htmlFor="name" className="label">Nama kafe</label><input id="name" name="name" required defaultValue={cafe?.name} className="input" /></div>
          <div>
            <label htmlFor="city_id" className="label">Kota</label>
            <select id="city_id" name="city_id" required defaultValue={cafe?.city_id} className="input">
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_active ? "" : " (nonaktif)"}</option>)}
            </select>
          </div>
          <div><label htmlFor="area" className="label">Area atau kecamatan</label><input id="area" name="area" defaultValue={cafe?.area ?? ""} placeholder="Tembalang" className="input" /></div>
          <div>
            <label htmlFor="price_range" className="label">Kisaran harga</label>
            <select id="price_range" name="price_range" defaultValue={cafe?.price_range ?? 2} className="input">
              <option value={1}>{priceLabel(1)}, di bawah 20 ribu</option>
              <option value={2}>{priceLabel(2)}, 20–40 ribu</option>
              <option value={3}>{priceLabel(3)}, 40–70 ribu</option>
              <option value={4}>{priceLabel(4)}, di atas 70 ribu</option>
            </select>
          </div>
          <div className="md:col-span-2"><label htmlFor="address" className="label">Alamat</label><input id="address" name="address" defaultValue={cafe?.address ?? ""} className="input" /></div>
          <CoordinateInput lat={cafe?.lat} lng={cafe?.lng} />
          <div className="md:col-span-2">
            <label htmlFor="short_review" className="label">Ulasan singkat</label>
            <textarea id="short_review" name="short_review" rows={2} maxLength={200} defaultValue={cafe?.short_review ?? ""}
              placeholder="Satu-dua kalimat yang muncul di kartu kafe." className="input" />
          </div>
        </div>
      </Section>

      <Section title="Penilaian" description="Rating dan status tayang.">
        <div className="grid gap-4 md:grid-cols-3">
          <div><label htmlFor="my_rating" className="label">Rating (0–5)</label><input id="my_rating" name="my_rating" type="number" step="0.1" min="0" max="5" defaultValue={cafe?.my_rating ?? ""} className="input" /></div>
          <div><label htmlFor="visited_at" className="label">Tanggal kunjungan</label><input id="visited_at" name="visited_at" type="date" defaultValue={cafe?.visited_at ?? ""} className="input" /></div>
          <div><label htmlFor="slug" className="label">Alamat halaman</label><input id="slug" name="slug" defaultValue={cafe?.slug} placeholder="Otomatis dari nama" className="input" /></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Toggle name="is_published" defaultChecked={cafe?.is_published ?? true} title="Tayang" hint="Terlihat di aplikasi" />
          <Toggle name="is_featured" defaultChecked={cafe?.is_featured ?? false} title="Favorit" hint="Muncul di beranda" />
        </div>
      </Section>

      <Section title="Konten khusus pelanggan" description="Hanya terlihat oleh pelanggan dan member yang membuka kafe ini.">
        <div className="space-y-4">
          <div><label htmlFor="full_review" className="label">Ulasan lengkap</label><textarea id="full_review" name="full_review" rows={6} defaultValue={details?.full_review ?? ""} className="input" /></div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label htmlFor="tips" className="label">Tips duduk</label><input id="tips" name="tips" defaultValue={details?.tips ?? ""} placeholder="Meja dekat jendela lantai 2" className="input" /></div>
            <div><label htmlFor="best_time" className="label">Waktu terbaik</label><input id="best_time" name="best_time" defaultValue={details?.best_time ?? ""} placeholder="Pagi 08.00–11.00" className="input" /></div>
          </div>
        </div>
      </Section>

      <Section title="Tag" description="Dipakai untuk filter di halaman Jelajah. Kelola daftar tag di menu Tag.">
        {(["vibe", "facility"] as const).map((type) => (
          <fieldset key={type} className="mt-3 first:mt-0">
            <legend className="label">{type === "vibe" ? "Suasana" : "Fasilitas"}</legend>
            <div className="flex flex-wrap gap-1.5">
              {tags.filter((t) => t.type === type).map((t) => (
                <label key={t.id} className="cursor-pointer">
                  <input type="checkbox" name="tags" value={t.id} defaultChecked={selectedTagIds.includes(t.id)} className="peer sr-only" />
                  <span className="chip !px-3 !py-1.5 !text-sm transition-colors peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand">{t.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </Section>

      <Section title="Jam buka" description="Status buka/tutup di aplikasi dihitung dari sini (WIB).">
        <div className="space-y-2">
          {DAYS.map(({ key, label }) => {
            const slot = h[key];
            return (
              <div key={key} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-16 font-medium">{label}</span>
                <input type="time" name={`open_${key}`} aria-label={`${label} buka`} defaultValue={slot?.[0] ?? "08:00"} className="input !w-32" />
                <span className="text-muted">sampai</span>
                <input type="time" name={`close_${key}`} aria-label={`${label} tutup`} defaultValue={slot?.[1] ?? "22:00"} className="input !w-32" />
                <label className="ml-1 flex items-center gap-1.5 text-muted">
                  <input type="checkbox" name={`closed_${key}`} defaultChecked={cafe ? slot === null : false} className="h-4 w-4 accent-brand" /> Tutup
                </label>
              </div>
            );
          })}
        </div>
      </Section>

      <div className="sticky bottom-20 z-10 flex justify-end rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <SubmitButton>{cafe ? "Simpan perubahan" : "Simpan kafe"}</SubmitButton>
      </div>
    </form>
  );
}

function Toggle({ name, defaultChecked, title, hint }: { name: string; defaultChecked: boolean; title: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-brand" />
      <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-muted">{hint}</span></span>
    </label>
  );
}
