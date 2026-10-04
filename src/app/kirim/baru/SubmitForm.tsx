"use client";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { compressImage, uniqueName } from "@/lib/compressImage";
import { parseCoords } from "@/lib/coords";
import { PRICE_RANGES } from "@/lib/utils";
import { MAX_MENU, MAX_PHOTOS, RELATIONS } from "@/lib/submission";
import { submitRecommendation, type SubmitState } from "../actions";
import { AmenityFields, ScoreFields } from "@/components/ReviewFields";
import OpeningHoursInput from "@/components/admin/OpeningHoursInput";
import Icon from "@/components/Icon";
import type { City } from "@/lib/types";

type MenuRow = { name: string; price: string; note: string; is_must_try: boolean };
const emptyMenu = (): MenuRow => ({ name: "", price: "", note: "", is_must_try: false });

function Section({ n, title, description, children }: { n: number; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 md:p-7">
      <div className="flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">{n}</span>
        <div>
          <h2 className="text-xl font-bold leading-tight">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

const Req = () => <span className="text-[#b4533a]"> *</span>;

export default function SubmitForm({ userId, defaultName, cities }: { userId: string; defaultName: string; cities: City[] }) {
  const [state, action] = useActionState<SubmitState, FormData>(submitRecommendation, null);
  const supabase = createClient();

  const [cityId, setCityId] = useState("");
  const [mapsMsg, setMapsMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [knowHours, setKnowHours] = useState(false);
  const [menu, setMenu] = useState<MenuRow[]>([emptyMenu()]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  function onMaps(v: string) {
    if (!v.trim()) return setMapsMsg(null);
    if (parseCoords(v)) setMapsMsg({ ok: true, text: "Lokasi terbaca dari link." });
    else if (/maps\.app\.goo\.gl|goo\.gl\/maps/.test(v)) setMapsMsg({ ok: true, text: "Link tersimpan. Titik lokasi akan dicek admin." });
    else setMapsMsg({ ok: false, text: "Sepertinya bukan link Google Maps. Buka kafenya di Google Maps, tekan Bagikan, lalu salin link." });
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setPhotoErr(null);
    const list = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    if (files.length > list.length) setPhotoErr(`Maksimal ${MAX_PHOTOS} foto.`);
    setUploading((u) => u + list.length);
    for (const file of list) {
      try {
        if (!file.type.startsWith("image/")) throw new Error(`${file.name} bukan gambar.`);
        const blob = await compressImage(file);
        const path = uniqueName(`submissions/${userId}`);
        const { error } = await supabase.storage.from("cafe-photos").upload(path, blob, { contentType: "image/webp" });
        if (error) throw new Error(/row-level|policy|security/i.test(error.message) ? "Unggah foto belum diizinkan. Admin perlu menjalankan migrasi 0008." : error.message);
        const url = supabase.storage.from("cafe-photos").getPublicUrl(path).data.publicUrl;
        setPhotos((p) => [...p, url]);
      } catch (e) {
        setPhotoErr((e as Error).message);
      } finally {
        setUploading((u) => u - 1);
      }
    }
  }

  async function removePhoto(url: string) {
    setPhotos((p) => p.filter((x) => x !== url));
    const marker = "/cafe-photos/";
    await supabase.storage.from("cafe-photos").remove([url.slice(url.indexOf(marker) + marker.length)]);
  }

  const setRow = (i: number, patch: Partial<MenuRow>) => setMenu((m) => m.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="menu_json" value={JSON.stringify(menu.filter((m) => m.name.trim()))} />
      <input type="hidden" name="photos_json" value={JSON.stringify(photos)} />

      <Section n={1} title="Tentang kamu" description="Namamu akan tampil sebagai author di halaman kafe kalau rekomendasinya ditayangkan.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="author_name" className="label">Nama yang ditampilkan<Req /></label>
            <input id="author_name" name="author_name" required maxLength={60} defaultValue={defaultName} className="input" />
          </div>
          <div>
            <label htmlFor="author_instagram" className="label">Instagram kamu (opsional)</label>
            <input id="author_instagram" name="author_instagram" maxLength={40} placeholder="tanpa @" className="input" />
          </div>
        </div>
        <fieldset className="mt-5">
          <legend className="label">Hubungan kamu dengan kafe ini</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {RELATIONS.map((r, i) => (
              <label key={r.value} className="flex cursor-pointer gap-3 rounded-xl border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                <input type="radio" name="relation" value={r.value} defaultChecked={i === 0} className="mt-0.5 h-4 w-4 accent-brand" />
                <span><span className="block text-sm font-semibold">{r.label}</span><span className="block text-xs text-muted">{r.hint}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section n={2} title="Info kafe">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="label">Nama kafe<Req /></label>
            <input id="name" name="name" required maxLength={120} placeholder="Contoh: Kopi Tembalang" className="input" />
          </div>
          <div>
            <label htmlFor="city_id" className="label">Kota<Req /></label>
            <input type="hidden" name="city_id" value={cityId === "__other" ? "" : cityId} />
            <select id="city_id" required value={cityId} onChange={(e) => setCityId(e.target.value)} className="input">
              <option value="" disabled>Pilih kota</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="__other">Kota lain…</option>
            </select>
            {cityId === "__other" && <input name="city_other" required aria-label="Nama kota" placeholder="Tulis nama kotanya" maxLength={60} className="input mt-2" />}
          </div>
          <div>
            <label htmlFor="area" className="label">Area atau kecamatan</label>
            <input id="area" name="area" maxLength={80} placeholder="Tembalang" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="address" className="label">Alamat</label>
            <input id="address" name="address" maxLength={300} placeholder="Jl. …" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="maps_link" className="label">Link Google Maps</label>
            <input id="maps_link" name="maps_link" type="url" placeholder="https://maps.app.goo.gl/…" className="input" onChange={(e) => onMaps(e.target.value)} />
            <p className={`mt-1.5 text-xs ${mapsMsg && !mapsMsg.ok ? "text-[#b4533a]" : "text-muted"}`}>{mapsMsg?.text ?? "Isi alamat atau link Google Maps, minimal salah satu."}</p>
          </div>
          <div>
            <label htmlFor="price_range" className="label">Kisaran harga per orang</label>
            <select id="price_range" name="price_range" defaultValue={2} className="input">
              {PRICE_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="visited_at" className="label">Terakhir kamu datang</label>
            <input id="visited_at" name="visited_at" type="date" max={new Date().toISOString().slice(0, 10)} className="input" />
          </div>
          <div>
            <label htmlFor="menu_url" className="label">Link buku menu (opsional)</label>
            <input id="menu_url" name="menu_url" type="url" placeholder="https://…" className="input" />
          </div>
          <div>
            <label htmlFor="instagram" className="label">Instagram kafe (opsional)</label>
            <input id="instagram" name="instagram" maxLength={60} placeholder="namakafe" className="input" />
          </div>
        </div>
      </Section>

      <Section n={3} title="Ceritamu" description="Tulis seperti sedang merekomendasikan ke teman yang mau kerja di sana.">
        <div className="space-y-4">
          <div>
            <label htmlFor="short_review" className="label">Ulasan singkat<Req /></label>
            <textarea id="short_review" name="short_review" required minLength={20} maxLength={200} rows={2}
              placeholder="Meja lebar, colokan di tiap meja, dan kopi susunya pas. Enak buat kerja dari pagi." className="input" />
          </div>
          <div>
            <label htmlFor="full_review" className="label">Ulasan lengkap</label>
            <textarea id="full_review" name="full_review" maxLength={3000} rows={5}
              placeholder="Suasananya, kondisi saat ramai, pengalaman kamu kerja di sana…" className="input" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tips" className="label">Tips tempat duduk</label>
              <input id="tips" name="tips" maxLength={300} placeholder="Meja dekat jendela lantai 2" className="input" />
            </div>
            <div>
              <label htmlFor="best_time" className="label">Waktu terbaik</label>
              <input id="best_time" name="best_time" maxLength={120} placeholder="Pagi 08.00–11.00" className="input" />
            </div>
          </div>
        </div>
      </Section>

      <Section n={4} title="Penilaian kerja" description="Beri nilai 1–5. Lewati yang tidak kamu tahu.">
        <ScoreFields />
      </Section>

      <Section n={5} title="Fasilitas" description="Pilih Ada, Tidak, atau ? kalau tidak yakin.">
        <AmenityFields />
      </Section>

      <Section n={6} title="Jam buka">
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" name="know_hours" checked={knowHours} onChange={(e) => setKnowHours(e.target.checked)} className="h-4 w-4 accent-brand" />
          <span className="text-sm font-medium">Aku tahu jam bukanya</span>
        </label>
        {knowHours && <div className="mt-4"><OpeningHoursInput isNew /></div>}
      </Section>

      <Section n={7} title="Menu rekomendasi" description="Menu yang menurutmu layak dipesan.">
        <div className="space-y-3">
          {menu.map((m, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_130px_auto] sm:items-start">
              <input value={m.name} onChange={(e) => setRow(i, { name: e.target.value })} maxLength={80} placeholder="Nama menu" aria-label="Nama menu" className="input !py-2" />
              <div className="flex items-center rounded-xl border border-line bg-surface focus-within:border-brand">
                <span className="pl-3 text-sm text-muted">Rp</span>
                <input value={m.price} onChange={(e) => setRow(i, { price: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="25000" aria-label="Harga"
                  className="w-full bg-transparent px-2 py-2 text-sm tabular-nums outline-none" />
              </div>
              <button type="button" onClick={() => setMenu((x) => (x.length === 1 ? [emptyMenu()] : x.filter((_, j) => j !== i)))}
                className="btn-ghost !px-3 !py-2 text-muted" aria-label="Hapus menu"><Icon name="trash" className="h-4 w-4" /></button>
              <input value={m.note} onChange={(e) => setRow(i, { note: e.target.value })} maxLength={160} placeholder="Catatan (opsional): manisnya pas, porsinya besar…"
                aria-label="Catatan menu" className="input !py-2 sm:col-span-2" />
              <label className="flex cursor-pointer items-center gap-2 self-center text-sm">
                <input type="checkbox" checked={m.is_must_try} onChange={(e) => setRow(i, { is_must_try: e.target.checked })} className="h-4 w-4 accent-brand" />
                Wajib coba
              </label>
            </div>
          ))}
          {menu.length < MAX_MENU && (
            <button type="button" onClick={() => setMenu((x) => [...x, emptyMenu()])} className="btn-ghost"><Icon name="plus" className="h-4 w-4" />Tambah menu</button>
          )}
        </div>
      </Section>

      <Section n={8} title="Foto" description={`Hingga ${MAX_PHOTOS} foto. Foto pertama jadi sampul. Pakai foto hasil jepretanmu sendiri.`}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((url, i) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-xl bg-tint">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-semibold text-white">Sampul</span>}
              <button type="button" onClick={() => removePhoto(url)} aria-label="Hapus foto"
                className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-surface/90 text-ink shadow"><Icon name="x" className="h-4 w-4" /></button>
            </div>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <div key={`u${i}`} className="grid aspect-square animate-pulse place-items-center rounded-xl bg-tint text-xs text-muted">Mengunggah…</div>
          ))}
          {photos.length + uploading < MAX_PHOTOS && (
            <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-center text-sm text-muted hover:border-brand hover:text-brand">
              <span><Icon name="image" className="mx-auto h-6 w-6" /><span className="mt-1 block">Tambah foto</span></span>
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
            </label>
          )}
        </div>
        {photoErr && <p className="mt-2 text-sm text-[#b4533a]">{photoErr}</p>}
      </Section>

      <div className="card space-y-4 p-5 md:p-7">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 accent-brand" />
          <span>Ulasan dan foto ini milikku sendiri, dan aku setuju WorkFromCafe menampilkannya (boleh disunting seperlunya) dengan namaku sebagai author.</span>
        </label>
        {state?.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
        <Submit disabled={uploading > 0} />
      </div>
    </form>
  );
}

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending || disabled} className="btn-primary w-full sm:w-auto">
      <Icon name="send" className="h-4 w-4" />
      {pending ? "Mengirim…" : disabled ? "Tunggu foto selesai diunggah…" : "Kirim rekomendasi"}
    </button>
  );
}
