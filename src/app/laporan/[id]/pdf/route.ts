import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { createClient } from "@/lib/supabase/server";
import { articlesWithCafe } from "@/lib/articles";
import { SITE_URL } from "@/lib/utils";
import { ACTION_LABEL, SOURCE_LABEL, busiestWindow, change, periodOf, sumActions, type CafeStats, type Source } from "@/lib/stats";

// Laporan audiens sebagai file PDF asli (dibuat di server), supaya bisa diunduh dan dikirim dari mana saja,
// termasuk aplikasi WFC Hunters di layar utama iPhone yang tidak bisa mencetak halaman web.
// Hak akses sama dengan halaman laporan: cafe_stats menolak selain admin dan owner terverifikasi.

export const runtime = "nodejs";

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = { ink: hex("#1f1a17"), muted: hex("#7a6e66"), brand: hex("#6b4226"), line: hex("#e7dfd8"), tint: hex("#f3ede8"), ok: hex("#2f7049"), bad: hex("#b4533a"), white: rgb(1, 1, 1) };
const W = 595.28, H = 841.89, M = 44;
const n = (v: number) => v.toLocaleString("id-ID");
const fmt = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const days = periodOf(req.nextUrl.searchParams.get("hari") ?? undefined);
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.redirect(new URL(`/masuk?next=/laporan/${id}`, req.url));

  const [{ data: cafe }, { data: stats, error }] = await Promise.all([
    supabase.from("cafes").select("id,name,slug,area,city:cities(name)").eq("id", id).maybeSingle(),
    supabase.rpc("cafe_stats", { p_cafe_id: id, p_days: days }),
  ]);
  if (!cafe) return new NextResponse("Kafe tidak ditemukan", { status: 404 });
  if (error) return new NextResponse(/tidak berhak/.test(error.message) ? "Laporan ini hanya untuk owner terverifikasi dan admin." : "Statistik belum aktif.", { status: 403 });
  const c = cafe as unknown as { id: string; name: string; slug: string; area: string | null; city: { name: string } | null };
  const s = stats as CafeStats;
  const featured = await articlesWithCafe(c.slug);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const dir = path.join(process.cwd(), "src/assets/fonts");
  const [reg, semi, bold] = await Promise.all(["jakarta-400.woff", "jakarta-600.woff", "jakarta-800.woff"].map(async (f) => doc.embedFont(await readFile(path.join(dir, f)), { subset: true })));
  const logo = await doc.embedPng(await readFile(path.join(process.cwd(), "public/logo.png")));
  doc.setTitle(`Laporan audiens ${c.name}`);
  doc.setAuthor("WFC Hunters");
  doc.setCreationDate(new Date());

  let page = doc.addPage([W, H]);
  let y = H - M;
  const newPageIfNeeded = (need: number) => { if (y - need < M + 20) { page = doc.addPage([W, H]); y = H - M; } };

  const text = (t: string, x: number, yy: number, o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; p?: PDFPage } = {}) =>
    (o.p ?? page).drawText(t, { x, y: yy, font: o.font ?? reg, size: o.size ?? 10, color: o.color ?? C.ink });
  /** Tulis paragraf dengan pemenggalan kata; kembalikan tinggi yang dipakai. */
  const para = (t: string, x: number, width: number, o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; lh?: number } = {}) => {
    const font = o.font ?? reg, size = o.size ?? 10, lh = o.lh ?? size * 1.45;
    const words = t.split(/\s+/); let line = ""; const lines: string[] = [];
    for (const w of words) { const tryL = line ? `${line} ${w}` : w; if (font.widthOfTextAtSize(tryL, size) > width && line) { lines.push(line); line = w; } else line = tryL; }
    if (line) lines.push(line);
    for (const l of lines) { newPageIfNeeded(lh); text(l, x, y - size, { font, size, color: o.color }); y -= lh; }
  };
  const box = (x: number, yy: number, w: number, h: number, o: { fill?: ReturnType<typeof rgb>; border?: boolean } = {}) =>
    page.drawRectangle({ x, y: yy, width: w, height: h, color: o.fill, borderColor: o.border ? C.line : undefined, borderWidth: o.border ? 0.8 : 0 });
  const heading = (t: string) => { newPageIfNeeded(40); y -= 12; text(t, M, y - 12, { font: bold, size: 12.5 }); y -= 20; };

  // ===== Kepala =====
  const lw = 62, lh = (logo.height / logo.width) * lw;
  page.drawImage(logo, { x: W - M - lw, y: y - lh, width: lw, height: lh });
  text("Laporan audiens WFC Hunters", M, y - 10, { font: semi, size: 10, color: C.brand });
  y -= 16;
  para(c.name, M, W - 2 * M - lw - 16, { font: bold, size: 24, lh: 28 });
  const end = new Date(), start = new Date(Date.now() - (days - 1) * 864e5);
  para(`${[c.area, c.city?.name].filter(Boolean).join(", ")} · ${fmt(start)} sampai ${fmt(end)}`, M, W - 2 * M, { color: C.muted });
  y -= 8; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: C.line }); y -= 16;

  const actions = sumActions(s);
  if (!s.views && !actions) {
    para(`Belum ada kunjungan tercatat dalam ${days} hari terakhir.`, M, W - 2 * M, { size: 12 });
  } else {
    const top = (Object.entries(s.sources) as [Source, number][]).sort((a, b) => b[1] - a[1])[0];
    para(`Dalam ${days} hari terakhir, halaman ${c.name} di WFC Hunters dilihat ${n(s.views)} kali oleh ${n(s.visitors)} pengunjung${actions ? `, dan ${n(actions)} kali pengunjung langsung membuka rute, menu, atau Instagram kafe` : ""}.${top ? ` Sumber terbesar: ${SOURCE_LABEL[top[0]]}.` : ""}`,
      M, W - 2 * M, { size: 12, lh: 18 });
    y -= 10;

    // ===== Empat angka utama =====
    const gap = 8, bw = (W - 2 * M - gap * 3) / 4, bh = 70;
    newPageIfNeeded(bh + 10);
    const delta = (a: number, b: number) => { const v = change(a, b); return v === null ? { t: "belum ada pembanding", col: C.muted } : { t: `${v >= 0 ? "+" : ""}${v}% dari periode sebelumnya`, col: v >= 0 ? C.ok : C.bad }; };
    const kpis = [
      { label: "Dilihat", value: n(s.views), sub: delta(s.views, s.prev_views), hl: true },
      { label: "Pengunjung unik", value: n(s.visitors), sub: delta(s.visitors, s.prev_visitors) },
      { label: "Aksi ke kafe", value: n(actions), sub: { t: `${s.views ? Math.round((actions / s.views) * 100) : 0}% pengunjung bertindak`, col: C.muted } },
      { label: "Disimpan ke favorit", value: n(s.favorites), sub: { t: "sepanjang waktu", col: C.muted } },
    ];
    kpis.forEach((k, i) => {
      const x = M + i * (bw + gap);
      box(x, y - bh, bw, bh, k.hl ? { fill: C.brand } : { border: true });
      text(k.label, x + 10, y - 18, { size: 8.5, color: k.hl ? C.white : C.muted });
      text(k.value, x + 10, y - 42, { font: bold, size: 20, color: k.hl ? C.white : C.ink });
      const subT = k.sub.t.length > 26 ? k.sub.t.replace(" dari periode sebelumnya", " vs sebelumnya") : k.sub.t;
      text(subT, x + 10, y - 58, { size: 7, color: k.hl ? C.white : k.sub.col });
    });
    y -= bh + 6;

    // ===== Grafik harian =====
    heading("Dilihat per hari");
    const ch = 70, cw = W - 2 * M, max = Math.max(1, ...s.daily.map((d) => d.views));
    newPageIfNeeded(ch + 24);
    const step = cw / Math.max(1, s.daily.length), barW = Math.max(1.5, step - 2);
    s.daily.forEach((d, i) => {
      const h = d.views ? Math.max(2, (d.views / max) * ch) : 1;
      page.drawRectangle({ x: M + i * step, y: y - ch, width: barW, height: h, color: d.views ? C.brand : C.line });
    });
    y -= ch + 12;
    text(new Date(s.daily[0]?.d ?? start).toLocaleDateString("id-ID", { day: "numeric", month: "short" }), M, y, { size: 8, color: C.muted });
    const right = `Hari ini · puncak ${n(max)} tampilan sehari`;
    text(right, W - M - reg.widthOfTextAtSize(right, 8), y, { size: 8, color: C.muted });
    y -= 8;

    // ===== Sumber kunjungan =====
    heading("Dari mana mereka datang");
    const total = Object.values(s.sources).reduce((a, b) => a + (b ?? 0), 0) || 1;
    for (const [k, v] of (Object.entries(s.sources) as [Source, number][]).sort((a, b) => b[1] - a[1])) {
      newPageIfNeeded(24);
      const pct = Math.round((v / total) * 100);
      text(SOURCE_LABEL[k] ?? k, M, y - 9, { size: 10 });
      const pt = `${pct}%`; text(pt, W - M - semi.widthOfTextAtSize(pt, 10), y - 9, { font: semi, size: 10 });
      box(M, y - 18, W - 2 * M, 4, { fill: C.tint }); box(M, y - 18, (W - 2 * M) * (v / total), 4, { fill: C.brand });
      y -= 22;
    }

    // ===== Tentang pengunjung =====
    heading("Tentang pengunjungnya");
    const peak = busiestWindow(s.hours);
    const rows: [string, string][] = [
      ["Membuka dari HP", `${s.views ? Math.round(((s.devices.hp ?? 0) / s.views) * 100) : 0}%`],
      ["Pengguna terdaftar WFC Hunters", `${s.views ? Math.round((s.logged_in / s.views) * 100) : 0}%`],
      ...(peak ? [["Jam paling ramai dilihat", `${peak} WIB`] as [string, string]] : []),
      ...(s.cities.length ? [["Kota asal pengunjung", s.cities.map((x) => `${x.city} (${n(x.n)})`).join(", ")] as [string, string]] : []),
    ];
    for (const [l, v] of rows) {
      newPageIfNeeded(18);
      text(l, M, y - 9, { size: 10, color: C.muted });
      const vw = Math.min(semi.widthOfTextAtSize(v, 10), 300);
      if (semi.widthOfTextAtSize(v, 10) <= 300) text(v, W - M - vw, y - 9, { font: semi, size: 10 });
      else { y -= 14; para(v, M, W - 2 * M, { font: semi }); y += 4; }
      y -= 18;
    }

    // ===== Aksi =====
    if (actions) {
      heading("Yang dilakukan setelah melihat");
      for (const [k, v] of (Object.entries(s.actions) as [keyof typeof ACTION_LABEL, number][]).sort((a, b) => b[1] - a[1])) {
        newPageIfNeeded(22);
        box(M, y - 18, W - 2 * M, 18, { fill: C.tint });
        text(ACTION_LABEL[k] ?? k, M + 8, y - 12.5, { size: 10 });
        const t = n(v); text(t, W - M - 8 - semi.widthOfTextAtSize(t, 10), y - 12.5, { font: semi, size: 10 });
        y -= 22;
      }
    }
  }

  // ===== Tampil di mana =====
  heading(`Di mana ${c.name} tampil`);
  para(`Halaman kafe: ${SITE_URL.replace(/^https?:\/\//, "")}/kafe/${c.slug}`, M, W - 2 * M, { color: C.brand });
  if (c.city) para(`Daftar kafe kerja di ${c.city.name}`, M, W - 2 * M);
  for (const a of featured) para(`Artikel: ${a.title}`, M, W - 2 * M);

  y -= 14;
  para("Cara menghitung: satu orang yang membuka halaman berkali-kali dalam 30 menit dihitung sekali; kunjungan admin, owner, dan bot mesin pencari tidak dihitung. Pengunjung unik dihitung per hari.",
    M, W - 2 * M, { size: 8, color: C.muted, lh: 11 });
  para(`Dibuat ${fmt(end)} · ${SITE_URL.replace(/^https?:\/\//, "")}`, M, W - 2 * M, { size: 8, color: C.muted, lh: 11 });

  const bytes = await doc.save();
  const name = `laporan-${c.slug}-${days}hari.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${req.nextUrl.searchParams.get("unduh") ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
