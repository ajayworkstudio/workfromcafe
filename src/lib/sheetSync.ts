import readXlsxFile from "read-excel-file/node";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCoords } from "./coords";
import { PRICE_RANGES, slugify } from "./utils";
import type { DayKey, OpeningHours } from "./types";

/*
  Sinkron data kafe dari spreadsheet (Google Sheets atau file .xlsx) ke database.

  Aturan:
  - Kafe dicocokkan lewat kolom "slug" (kalau kosong, dibuat dari nama).
  - Sel KOSONG = nilai di database TIDAK diubah. Jadi aman untuk kafe yang juga diedit lewat panel admin.
  - Kafe yang tidak ada di spreadsheet tidak dihapus.
  - Menu: untuk setiap kafe yang muncul di tab "Menu", daftar menunya diganti sesuai spreadsheet.
*/

export type SyncReport = {
  cafesCreated: number;
  cafesUpdated: number;
  menuCafes: number;
  menuItems: number;
  citiesCreated: string[];
  tagsCreated: string[];
  warnings: string[];
};

type Row = Record<string, string>;

const DAY_COLUMNS: Record<string, DayKey> = { senin: "mon", selasa: "tue", rabu: "wed", kamis: "thu", jumat: "fri", sabtu: "sat", minggu: "sun" };

// ---------------------------------------------------------------------------
// Membaca file
// ---------------------------------------------------------------------------

/** Ubah link Google Sheets biasa menjadi link unduh .xlsx (sheet harus dibagikan "Siapa saja yang memiliki link"). */
export function sheetExportUrl(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=xlsx` : null;
}

export async function fetchSheetWorkbook(url: string): Promise<ArrayBuffer> {
  const exportUrl = sheetExportUrl(url);
  if (!exportUrl) throw new Error("Link bukan link Google Sheets. Contoh: https://docs.google.com/spreadsheets/d/…/edit");
  const res = await fetch(exportUrl, { redirect: "follow", cache: "no-store" });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || type.includes("text/html")) {
    throw new Error("Spreadsheet tidak bisa dibuka. Di Google Sheets klik Bagikan → Akses umum → \"Siapa saja yang memiliki link\" (Pelihat).");
  }
  return res.arrayBuffer();
}

type Cell = string | number | boolean | Date | null | undefined;
type Sheets = { sheet: string; data: Cell[][] }[];

function cellText(v: Cell): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10); // tanggal Excel
  return String(v);
}

const normHeader = (h: string) => slugify(h).replace(/-/g, "_");

function readSheet(sheets: Sheets, name: string): Row[] | null {
  const ws = sheets.find((w) => w.sheet.trim().toLowerCase() === name.toLowerCase());
  if (!ws) return null;
  const [head = [], ...body] = ws.data;
  const headers = head.map((h) => normHeader(cellText(h)));
  const rows: Row[] = [];
  for (const line of body) {
    const r: Row = {};
    headers.forEach((key, i) => { if (key) r[key] = cellText(line[i]).trim(); });
    if (Object.values(r).some(Boolean)) rows.push(r);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Konversi nilai sel
// ---------------------------------------------------------------------------

const yes = (v: string) => /^(ya|y|yes|true|1|v|✓|x)$/i.test(v.trim());

function parseNumber(v: string): number | null {
  if (!v) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parsePriceRange(v: string): number | null {
  if (!v) return null;
  const n = Number(v);
  if (Number.isInteger(n) && n >= 1 && n <= 5) return n;
  const key = v.toUpperCase().replace(/RP|\s|\.|–/g, (m) => (m === "–" ? "-" : ""));
  const hit = PRICE_RANGES.find((r) => r.label.toUpperCase().replace(/RP|\s|–/g, (m) => (m === "–" ? "-" : "")) === key);
  if (hit) return hit.value;
  if (/60K?(\+|KEATAS|UP)|>60|ATAS60/.test(key)) return 5;
  return null;
}

function parseHours(v: string): [string, string] | null | undefined {
  const t = v.trim().toLowerCase();
  if (!t) return undefined; // kosong = tidak diubah
  if (/^(tutup|libur|closed|-)$/.test(t)) return null;
  if (/24\s*jam|24 ?h|24\/7/.test(t)) return ["00:00", "24:00"];
  const m = t.match(/(\d{1,2})[.:](\d{2})\s*[-–sampaid/]+\s*(\d{1,2})[.:](\d{2})/);
  if (!m) return undefined;
  const pad = (h: string, mm: string) => `${h.padStart(2, "0")}:${mm}`;
  return [pad(m[1], m[2]), pad(m[3], m[4])];
}

function parseDate(v: string): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

const cleanIg = (v: string) => v.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/[/?#].*$/, "").trim();
const splitList = (v: string) => v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);

// ---------------------------------------------------------------------------
// Sinkron
// ---------------------------------------------------------------------------

export async function syncWorkbook(db: SupabaseClient, data: ArrayBuffer | Buffer): Promise<SyncReport> {
  let sheets: Sheets;
  try {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(new Uint8Array(data));
    sheets = (await readXlsxFile(buf)) as unknown as Sheets;
  } catch {
    throw new Error("File tidak bisa dibaca. Pastikan formatnya .xlsx.");
  }

  const cafeRows = readSheet(sheets, "Kafe");
  if (!cafeRows) throw new Error('Tab "Kafe" tidak ditemukan di spreadsheet.');
  const menuRows = readSheet(sheets, "Menu") ?? [];

  const report: SyncReport = { cafesCreated: 0, cafesUpdated: 0, menuCafes: 0, menuItems: 0, citiesCreated: [], tagsCreated: [], warnings: [] };

  // Data referensi
  const [{ data: cities }, { data: tags }] = await Promise.all([
    db.from("cities").select("id,name,is_active"),
    db.from("tags").select("id,name,type"),
  ]);
  const cityByName = new Map((cities ?? []).map((c) => [c.name.toLowerCase(), c as { id: string; name: string; is_active: boolean }]));
  const tagByName = new Map((tags ?? []).map((t) => [t.name.toLowerCase(), t as { id: string; name: string; type: string }]));
  const slugByName = new Map<string, string>();

  async function ensureCity(name: string, lat: number | null, lng: number | null) {
    const key = name.toLowerCase();
    const hit = cityByName.get(key);
    if (hit) return hit;
    const { data, error } = await db.from("cities")
      .insert({ name, slug: slugify(name), province: "Jawa Tengah", lat: lat ?? -7.15, lng: lng ?? 110.14, is_active: false })
      .select("id,name,is_active").single();
    if (error) throw new Error(`Gagal membuat kota ${name}: ${error.message}`);
    cityByName.set(key, data);
    report.citiesCreated.push(name);
    return data;
  }

  async function ensureTag(name: string, type: "vibe" | "facility") {
    const key = name.toLowerCase();
    const hit = tagByName.get(key);
    if (hit) return hit.id;
    const { data, error } = await db.from("tags").insert({ name, type }).select("id,name,type").single();
    if (error) { report.warnings.push(`Tag "${name}" gagal dibuat: ${error.message}`); return null; }
    tagByName.set(key, data);
    report.tagsCreated.push(name);
    return data.id;
  }

  for (const [i, r] of cafeRows.entries()) {
    const line = i + 2; // nomor baris di spreadsheet
    const name = r.nama ?? "";
    if (!name) continue;
    const slug = slugify(r.slug || name);
    slugByName.set(name.toLowerCase(), slug);
    if (!r.kota) { report.warnings.push(`Baris ${line} (${name}): kolom kota kosong, dilewati.`); continue; }

    let lat = parseNumber(r.latitude ?? "");
    let lng = parseNumber(r.longitude ?? "");
    if ((lat == null || lng == null) && r.link_maps) {
      const c = parseCoords(r.link_maps);
      if (c) [lat, lng] = c;
    }

    const city = await ensureCity(r.kota, lat, lng);
    const { data: existing } = await db.from("cafes").select("id,opening_hours,is_published").eq("slug", slug).maybeSingle();

    // Hanya kolom yang terisi yang dikirim
    const fields: Record<string, unknown> = { name, slug, city_id: city.id };
    const set = (k: string, v: unknown) => { if (v !== null && v !== undefined && v !== "") fields[k] = v; };
    set("area", r.area);
    set("address", r.alamat);
    set("lat", lat);
    set("lng", lng);
    const price = parsePriceRange(r.kisaran_harga ?? "");
    if (r.kisaran_harga && price == null) report.warnings.push(`Baris ${line} (${name}): kisaran harga "${r.kisaran_harga}" tidak dikenal.`);
    set("price_range", price);
    const rating = parseNumber(r.rating ?? "");
    set("my_rating", rating != null ? Math.max(0, Math.min(5, rating)) : null);
    set("short_review", r.ulasan_singkat);
    set("menu_url", r.link_menu);
    set("instagram", r.instagram ? cleanIg(r.instagram) : null);
    set("visited_at", parseDate(r.tanggal_kunjungan ?? ""));
    if (r.tayang) fields.is_published = yes(r.tayang);
    else if (!existing) fields.is_published = false;
    if (r.favorit) fields.is_featured = yes(r.favorit);

    const hours: OpeningHours = { ...((existing?.opening_hours as OpeningHours) ?? {}) };
    let hoursChanged = false;
    for (const [col, key] of Object.entries(DAY_COLUMNS)) {
      const h = parseHours(r[col] ?? "");
      if (h !== undefined) { hours[key] = h; hoursChanged = true; }
      else if (r[col]) report.warnings.push(`Baris ${line} (${name}): jam ${col} "${r[col]}" tidak terbaca. Contoh: 08:00-22:00, 24 jam, Tutup.`);
    }
    if (hoursChanged) fields.opening_hours = hours;

    let cafeId: string;
    if (existing) {
      const { error } = await db.from("cafes").update(fields).eq("id", existing.id);
      if (error) { report.warnings.push(`Baris ${line} (${name}): ${error.message}`); continue; }
      cafeId = existing.id;
      report.cafesUpdated++;
    } else {
      const { data, error } = await db.from("cafes").insert(fields).select("id").single();
      if (error) { report.warnings.push(`Baris ${line} (${name}): ${error.message}`); continue; }
      cafeId = data.id;
      report.cafesCreated++;
    }

    // Konten khusus pelanggan
    const details: Record<string, unknown> = {};
    if (r.ulasan_lengkap) details.full_review = r.ulasan_lengkap;
    if (r.tips) details.tips = r.tips;
    if (r.waktu_terbaik) details.best_time = r.waktu_terbaik;
    if (Object.keys(details).length) {
      await db.from("cafe_details").upsert({ cafe_id: cafeId, ...details }, { onConflict: "cafe_id" });
    }

    // Tag
    if (r.suasana || r.fasilitas) {
      const ids: string[] = [];
      for (const t of splitList(r.suasana ?? "")) { const id = await ensureTag(t, "vibe"); if (id) ids.push(id); }
      for (const t of splitList(r.fasilitas ?? "")) { const id = await ensureTag(t, "facility"); if (id) ids.push(id); }
      await db.from("cafe_tags").delete().eq("cafe_id", cafeId);
      if (ids.length) await db.from("cafe_tags").insert([...new Set(ids)].map((tag_id) => ({ cafe_id: cafeId, tag_id })));
    }

    // Foto sampul dari link
    if (r.foto_sampul && /^https?:\/\//.test(r.foto_sampul)) {
      const url = r.foto_sampul;
      const { data: same } = await db.from("cafe_photos").select("id").eq("cafe_id", cafeId).eq("url", url).maybeSingle();
      if (!same) {
        await db.from("cafe_photos").update({ is_cover: false }).eq("cafe_id", cafeId);
        await db.from("cafe_photos").insert({ cafe_id: cafeId, url, is_cover: true, sort_order: 0 });
      }
    }

    if (fields.is_published && !city.is_active) {
      await db.from("cities").update({ is_active: true }).eq("id", city.id);
      city.is_active = true;
    }
  }

  // Menu: kelompokkan per kafe
  const groups = new Map<string, Row[]>();
  for (const r of menuRows) {
    if (!r.nama_menu) continue;
    const slug = r.slug_kafe ? slugify(r.slug_kafe) : r.nama_kafe ? (slugByName.get(r.nama_kafe.toLowerCase()) ?? slugify(r.nama_kafe)) : "";
    if (!slug) { report.warnings.push(`Menu "${r.nama_menu}": kolom slug_kafe kosong.`); continue; }
    groups.set(slug, [...(groups.get(slug) ?? []), r]);
  }
  for (const [slug, items] of groups) {
    const { data: cafe } = await db.from("cafes").select("id").eq("slug", slug).maybeSingle();
    if (!cafe) { report.warnings.push(`Menu untuk "${slug}": kafe tidak ditemukan.`); continue; }
    await db.from("menu_items").delete().eq("cafe_id", cafe.id);
    const rows = items.map((m, i) => ({
      cafe_id: cafe.id,
      name: m.nama_menu,
      price: parseNumber((m.harga ?? "").replace(/[^\d.,]/g, "").replace(/[.,](?=\d{3}\b)/g, "")),
      note: m.catatan || null,
      is_must_try: yes(m.wajib_coba ?? ""),
      photo_url: /^https?:\/\//.test(m.foto ?? "") ? m.foto : null,
      sort_order: i,
    }));
    const { error } = await db.from("menu_items").insert(rows);
    if (error) report.warnings.push(`Menu "${slug}": ${error.message}`);
    else { report.menuCafes++; report.menuItems += rows.length; }
  }

  return report;
}

export function summarize(r: SyncReport) {
  const parts = [`${r.cafesCreated} kafe baru`, `${r.cafesUpdated} kafe diperbarui`, `${r.menuItems} menu di ${r.menuCafes} kafe`];
  if (r.citiesCreated.length) parts.push(`kota baru: ${r.citiesCreated.join(", ")}`);
  if (r.tagsCreated.length) parts.push(`tag baru: ${r.tagsCreated.join(", ")}`);
  return parts.join(" · ");
}


/** Jalankan sinkron dari URL Google Sheets lalu simpan laporan ke app_settings. */
export async function syncFromUrlAndRecord(db: SupabaseClient, url: string, source: "manual" | "cron" | "upload", data?: ArrayBuffer | Buffer) {
  const at = new Date().toISOString();
  try {
    const buf = data ?? (await fetchSheetWorkbook(url));
    const report = await syncWorkbook(db, buf);
    await db.from("app_settings").upsert({ key: "sheet_last_sync", value: JSON.stringify({ at, source, ok: true, report }) });
    return { ok: true as const, report };
  } catch (e) {
    const message = (e as Error).message;
    await db.from("app_settings").upsert({ key: "sheet_last_sync", value: JSON.stringify({ at, source, ok: false, error: message }) });
    return { ok: false as const, error: message };
  }
}
