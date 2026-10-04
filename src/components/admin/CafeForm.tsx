import { saveCafe } from "@/app/admin/kafe/actions";
import type { Cafe, CafeDetails, City, Tag } from "@/lib/types";
import { PRICE_RANGES } from "@/lib/utils";
import SubmitButton from "./SubmitButton";
import CoordinateInput from "./CoordinateInput";
import OpeningHoursInput from "./OpeningHoursInput";
import Icon from "@/components/Icon";
import { AMENITIES, ASPECTS, averageScore, cleanScore } from "@/lib/review";

const SCORE_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

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
  return (
    <form action={saveCafe} className="space-y-5">
      {cafe && <input type="hidden" name="id" value={cafe.id} />}
      {cafe && averageScore(cafe.scores) != null && (
        <input type="hidden" name="prev_avg" value={Math.round(averageScore(cafe.scores)! * 10) / 10} />
      )}

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
            <label htmlFor="price_range" className="label">Kisaran harga per orang</label>
            <select id="price_range" name="price_range" defaultValue={cafe?.price_range ?? 2} className="input">
              {PRICE_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2"><label htmlFor="address" className="label">Alamat</label><input id="address" name="address" defaultValue={cafe?.address ?? ""} className="input" /></div>
          <CoordinateInput lat={cafe?.lat} lng={cafe?.lng} />
          <div>
            <label htmlFor="menu_url" className="label">Link buku menu</label>
            <input id="menu_url" name="menu_url" type="url" defaultValue={cafe?.menu_url ?? ""} placeholder="https://…" className="input" />
            <p className="mt-1 text-xs text-muted">Muncul sebagai tombol &quot;Lihat menu&quot; untuk semua pengunjung.</p>
          </div>
          <div>
            <label htmlFor="instagram" className="label">Instagram</label>
            <input id="instagram" name="instagram" defaultValue={cafe?.instagram ?? ""} placeholder="namakafe (tanpa @)" className="input" />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="short_review" className="label">Ulasan singkat</label>
            <textarea id="short_review" name="short_review" rows={2} maxLength={200} defaultValue={cafe?.short_review ?? ""}
              placeholder="Satu-dua kalimat yang muncul di kartu kafe." className="input" />
          </div>
        </div>
      </Section>

      <Section title="Penilaian" description="Rating dan status tayang.">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="my_rating" className="label">Rating keseluruhan (0–5)</label>
            <input id="my_rating" name="my_rating" type="number" step="0.1" min="0" max="5" defaultValue={cafe?.my_rating ?? ""} placeholder="Otomatis" className="input" />
            <p className="mt-1 text-xs text-muted">Kosongkan supaya dihitung dari rata-rata penilaian kerja di bawah.</p>
          </div>
          <div><label htmlFor="visited_at" className="label">Tanggal kunjungan</label><input id="visited_at" name="visited_at" type="date" defaultValue={cafe?.visited_at ?? ""} className="input" /></div>
          <div><label htmlFor="slug" className="label">Alamat halaman</label><input id="slug" name="slug" defaultValue={cafe?.slug} placeholder="Otomatis dari nama" className="input" /></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Toggle name="is_published" defaultChecked={cafe?.is_published ?? true} title="Tayang" hint="Terlihat di aplikasi" />
          <Toggle name="is_featured" defaultChecked={cafe?.is_featured ?? false} title="Favorit" hint="Muncul di beranda" />
        </div>
      </Section>

      <Section title="Penilaian kerja" description="Nilai 1–5 untuk tiap aspek. Keterangan otomatis muncul sesuai nilai, atau tulis catatanmu sendiri.">
        <div className="divide-y divide-line">
          {ASPECTS.map((a) => {
            const v = cleanScore(cafe?.scores?.[a.key]);
            return (
              <div key={a.key} className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[190px_110px_1fr] sm:items-center sm:gap-3">
                <label htmlFor={`score_${a.key}`} className="flex items-center gap-2.5 text-sm font-semibold">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand"><Icon name={a.icon} className="h-4 w-4" /></span>
                  {a.label}
                </label>
                <select id={`score_${a.key}`} name={`score_${a.key}`} defaultValue={v ?? ""} className="input !py-2">
                  <option value="">Belum dinilai</option>
                  {SCORE_OPTIONS.map((n) => <option key={n} value={n}>{n.toString().replace(".", ",")}</option>)}
                </select>
                <input name={`note_${a.key}`} defaultValue={cafe?.scores?.notes?.[a.key] ?? ""} aria-label={`Catatan ${a.label}`}
                  placeholder={a.levels[3][1]} maxLength={90} className="input !py-2" />
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Fasilitas" description="Pilih Ada, Tidak, atau ? kalau belum kamu cek.">
        <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {AMENITIES.map((m) => {
            const v = cafe?.amenities?.[m.key];
            const cur = v === true ? "ya" : v === false ? "tidak" : "";
            return (
              <fieldset key={m.key} className="flex items-center justify-between gap-3">
                <legend className="sr-only">{m.label}</legend>
                <span className="flex items-center gap-2 text-sm"><Icon name={m.icon} className="h-4 w-4 text-muted" />{m.label}</span>
                <span className="flex shrink-0 overflow-hidden rounded-lg border border-line text-xs font-semibold">
                  {[["ya", "Ada"], ["tidak", "Tidak"], ["", "?"]].map(([val, lbl]) => (
                    <label key={val} className="cursor-pointer border-l border-line first:border-l-0">
                      <input type="radio" name={`amenity_${m.key}`} value={val} defaultChecked={cur === val} className="peer sr-only" />
                      <span className={`block px-2.5 py-1.5 peer-focus-visible:ring-2 peer-focus-visible:ring-brand ${
                        val === "ya" ? "peer-checked:bg-ok peer-checked:text-white" : val === "tidak" ? "peer-checked:bg-[#b4533a] peer-checked:text-white" : "peer-checked:bg-tint"
                      }`}>{lbl}</span>
                    </label>
                  ))}
                </span>
              </fieldset>
            );
          })}
        </div>
      </Section>

      <Section title="Ulasan lengkap" description="Ulasan lengkap, tips, dan waktu terbaik. Saat mode gratis aktif, terlihat oleh semua orang.">
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
        <OpeningHoursInput hours={cafe?.opening_hours} isNew={!cafe} />
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
