import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { levelFor, type PublicAuthor } from "./author";
import { SITE_URL } from "./utils";

/*
  Kartu Kurator WFC Hunters (gambar PNG siap dibagikan).
  - story: 1080×1920 (Instagram/WhatsApp Story)
  - post : 1080×1350 (feed Instagram 4:5)
*/

export type CardFormat = "story" | "post";
export const CARD_SIZE: Record<CardFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  post: { width: 1080, height: 1350 },
};

const BROWN = "#6b4226";
const BROWN_DARK = "#3f2614";
const CREAM = "#f6f2ee";
const TAN = "#d19f7d";
const GOLD = "#e0a045";

let assets: Promise<{ fonts: { name: string; data: Buffer; weight: 400 | 600 | 800 }[]; logo: string }> | null = null;
function loadAssets() {
  assets ??= (async () => {
    const dir = join(process.cwd(), "src/assets/fonts");
    const [f400, f600, f800, logo] = await Promise.all([
      readFile(join(dir, "jakarta-400.woff")),
      readFile(join(dir, "jakarta-600.woff")),
      readFile(join(dir, "jakarta-800.woff")),
      readFile(join(process.cwd(), "public/logo.png")),
    ]);
    return {
      fonts: [
        { name: "Jakarta", data: f400, weight: 400 as const },
        { name: "Jakarta", data: f600, weight: 600 as const },
        { name: "Jakarta", data: f800, weight: 800 as const },
      ],
      logo: `data:image/png;base64,${logo.toString("base64")}`,
    };
  })();
  return assets;
}

/** Foto profil → PNG data URL (format webp tidak didukung pembuat gambar). */
async function avatarDataUrl(url: string | null) {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const png = await sharp(Buffer.from(await res.arrayBuffer())).resize(400, 400, { fit: "cover" }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

function Star({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"><path fill={color} d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9L12 2.5Z" /></svg>
  );
}
function Pin({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"><path fill={color} d="M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" /></svg>
  );
}

export async function renderKuratorCard(a: PublicAuthor, cities: string[], format: CardFormat) {
  const [{ fonts, logo }, avatar] = await Promise.all([loadAssets(), avatarDataUrl(a.avatar_url)]);
  const { width, height } = CARD_SIZE[format];
  const story = format === "story";
  const { current } = levelFor(a.cafe_count);
  const levelName = (current?.name ?? "Kurator").toUpperCase();
  const isTop = current?.name === "Kurator Utama";
  const profile = `${SITE_URL.replace(/^https?:\/\/(www\.)?/, "")}/author/${a.username ?? a.id}`;
  const cityText = cities.slice(0, 4).join("  ·  ") + (cities.length > 4 ? `  +${cities.length - 4}` : "");
  const av = story ? 360 : 280;
  const initial = (a.name || "?").trim().charAt(0).toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width, height, display: "flex", flexDirection: "column", alignItems: "center", position: "relative",
          fontFamily: "Jakarta", color: CREAM,
          backgroundColor: BROWN,
          backgroundImage: `radial-gradient(circle at 3px 3px, rgba(246,242,238,0.09) 2.5px, transparent 0), linear-gradient(160deg, ${BROWN} 0%, ${BROWN_DARK} 100%)`,
          backgroundSize: "44px 44px, 100% 100%",
          padding: story ? "150px 90px 120px" : "64px 80px 64px",
        }}
      >
        {/* Lingkaran "noda cangkir kopi" sebagai ornamen */}
        <div style={{ position: "absolute", top: story ? -160 : -200, right: -180, width: 620, height: 620, borderRadius: 9999, border: `26px solid rgba(209,159,125,0.16)`, display: "flex" }} />
        <div style={{ position: "absolute", bottom: story ? 260 : 120, left: -220, width: 520, height: 520, borderRadius: 9999, border: `18px solid rgba(209,159,125,0.12)`, display: "flex" }} />

        {/* Logo di atas lencana krem */}
        <div style={{ display: "flex", backgroundColor: CREAM, borderRadius: story ? 28 : 22, padding: story ? "22px 30px" : "16px 22px", boxShadow: "0 18px 40px rgba(0,0,0,0.25)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={story ? 210 : 140} height={story ? 136 : 90} alt="" />
        </div>

        <div style={{ display: "flex", marginTop: story ? 110 : 40, fontSize: story ? 34 : 24, fontWeight: 600, letterSpacing: 8, color: TAN }}>
          RESMI JADI
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 14, backgroundColor: isTop ? CREAM : GOLD, color: BROWN_DARK, borderRadius: 9999, padding: story ? "18px 46px" : "12px 34px", fontSize: story ? 58 : 40, fontWeight: 800, letterSpacing: 2 }}>
          <Star size={story ? 52 : 36} color={BROWN_DARK} />
          {levelName}
        </div>

        {/* Foto profil */}
        <div style={{ display: "flex", marginTop: story ? 80 : 52, width: av + (story ? 24 : 18), height: av + (story ? 24 : 18), borderRadius: 9999, backgroundColor: isTop ? CREAM : GOLD, alignItems: "center", justifyContent: "center" }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} width={av} height={av} style={{ borderRadius: 9999, objectFit: "cover" }} alt="" />
          ) : (
            <div style={{ display: "flex", width: av, height: av, borderRadius: 9999, backgroundColor: BROWN_DARK, alignItems: "center", justifyContent: "center", fontSize: av * 0.45, fontWeight: 800, color: CREAM }}>
              {initial}
            </div>
          )}
        </div>

        <div style={{ display: "flex", marginTop: story ? 48 : 32, fontSize: story ? 76 : 62, fontWeight: 800, textAlign: "center", lineHeight: 1.05, maxWidth: width - 160 }}>
          {a.name}
        </div>
        {a.instagram && (
          <div style={{ display: "flex", marginTop: story ? 10 : 6, fontSize: story ? 34 : 26, color: TAN }}>@{a.instagram}</div>
        )}

        {/* Angka utama */}
        <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: story ? 80 : 48, backgroundColor: "rgba(246,242,238,0.08)", border: "2px solid rgba(246,242,238,0.15)", borderRadius: story ? 36 : 28, padding: story ? "34px 56px" : "22px 46px" }}>
          <div style={{ display: "flex", fontSize: story ? 150 : 112, fontWeight: 800, lineHeight: 1, color: GOLD }}>{a.cafe_count}</div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: story ? 38 : 28, fontWeight: 600, lineHeight: 1.2 }}>
            <span>kafe untuk kerja</span>
            <span style={{ color: TAN }}>direkomendasikan</span>
          </div>
        </div>
        {cityText && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: story ? 28 : 26, fontSize: story ? 32 : 24, color: "rgba(246,242,238,0.8)" }}>
            <Pin size={story ? 34 : 26} color={TAN} />
            {cityText}
          </div>
        )}

        {/* Bawah */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "auto", paddingTop: story ? 0 : 24 }}>
          <div style={{ display: "flex", fontSize: story ? 30 : 22, color: "rgba(246,242,238,0.75)" }}>Cari kafe enak buat kerja di</div>
          <div style={{ display: "flex", marginTop: 10, fontSize: story ? 40 : 30, fontWeight: 800, color: CREAM, backgroundColor: "rgba(0,0,0,0.22)", borderRadius: 9999, padding: "12px 34px" }}>
            {profile}
          </div>
        </div>
      </div>
    ),
    {
      width, height, fonts,
      headers: { "Cache-Control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400" },
    },
  );
}
