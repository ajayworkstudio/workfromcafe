import { ImageResponse } from "next/og";
import { loadAssets, imageDataUrl } from "./kuratorCard";
import { CROWD, summarize, type CafeReport } from "./reports";
import { averageScore } from "./review";
import { coverUrl, priceLabel, SITE_URL } from "./utils";
import type { Cafe } from "./types";

/*
  Kartu Story Instagram satu kafe (1080×1920): foto kafe penuh, panel kaca berisi nama kafe
  dan kondisi terbaru dari laporan pengunjung, lalu alamat halamannya.
  Pembuat gambar tidak mengenal blur latar, jadi "kaca" dibuat dari bidang gelap transparan + garis terang.
*/

const W = 1080, H = 1920;
const FOAM = "#fff7f0";
const GOLD = "#e0a045";
const BROWN = "#6b4226";
const CROWD_TILE = { 1: { bg: "rgba(111,208,154,0.26)", fg: "#c8f3da" }, 2: { bg: "rgba(224,160,69,0.32)", fg: "#ffe2b0" }, 3: { bg: "rgba(224,122,95,0.32)", fg: "#ffd2c4" } } as const;

function Tile({ label, value, bg = "rgba(255,255,255,0.16)", fg = FOAM }: { label: string; value: string; bg?: string; fg?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, backgroundColor: bg, borderRadius: 36, padding: "26px 24px" }}>
      <div style={{ display: "flex", fontSize: 28, color: "rgba(255,247,240,0.82)" }}>{label}</div>
      <div style={{ display: "flex", fontSize: 46, fontWeight: 800, color: fg, marginTop: 4, whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

export async function renderCafeStory(cafe: Cafe, reports: CafeReport[]) {
  const [{ fonts, logo }, photo] = await Promise.all([loadAssets(), imageDataUrl(coverUrl(cafe), W, H, "jpeg")]);
  const live = summarize(reports);
  const rating = cafe.my_rating != null ? Number(cafe.my_rating) : averageScore(cafe.scores);
  const place = [cafe.area, cafe.city?.name].filter(Boolean).join(", ");
  const link = `${SITE_URL.replace(/^https?:\/\/(www\.)?/, "")}/kafe/${cafe.slug}`;
  const nameSize = cafe.name.length > 34 ? 72 : cafe.name.length > 22 ? 86 : 100;

  const tiles = live
    ? [
        <Tile key="c" label="Sekarang" value={CROWD[live.crowd].label} bg={CROWD_TILE[live.crowd].bg} fg={CROWD_TILE[live.crowd].fg} />,
        <Tile key="w" label="Wifi" value={live.download != null ? `${live.download} Mbps` : "-"} />,
        <Tile key="r" label="Rating" value={rating != null ? rating.toFixed(1) : "-"} />,
      ]
    : [
        <Tile key="r" label="Rating" value={rating != null ? rating.toFixed(1) : "-"} />,
        <Tile key="p" label="Harga" value={priceLabel(cafe.price_range)} />,
      ];

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", position: "relative", fontFamily: "Jakarta", color: FOAM, backgroundColor: "#160f0c" }}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} width={W} height={H} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} alt="" />
        )}
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(22,15,12,0.55) 0%, rgba(22,15,12,0) 22%, rgba(22,15,12,0) 45%, rgba(22,15,12,0.78) 100%)" }} />

        {/* Logo di atas lencana krem */}
        <div style={{ position: "absolute", top: 110, left: 80, display: "flex", backgroundColor: FOAM, borderRadius: 26, padding: "18px 24px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={170} height={110} alt="" />
        </div>

        {/* Panel kaca */}
        <div style={{ position: "absolute", left: 64, right: 64, bottom: 300, display: "flex", flexDirection: "column", padding: "52px 52px 48px", borderRadius: 72, backgroundColor: "rgba(30,20,16,0.58)", border: "3px solid rgba(255,255,255,0.26)" }}>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 600, color: "rgba(255,247,240,0.86)" }}>Lagi WFC di</div>
          <div style={{ display: "flex", fontSize: nameSize, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2, marginTop: 10 }}>{cafe.name}</div>
          {place && <div style={{ display: "flex", fontSize: 36, color: "rgba(255,247,240,0.86)", marginTop: 16 }}>{place}</div>}
          <div style={{ display: "flex", gap: 20, marginTop: 40 }}>{tiles}</div>
          {live && <div style={{ display: "flex", fontSize: 26, color: "rgba(255,247,240,0.75)", marginTop: 22 }}>Dari laporan pengunjung dalam 3 jam terakhir</div>}
        </div>

        {/* Alamat halaman kafe */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 150, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, backgroundColor: FOAM, color: BROWN, borderRadius: 9999, padding: "22px 40px", fontSize: 36, fontWeight: 800 }}>
            <div style={{ display: "flex", width: 18, height: 18, borderRadius: 9999, backgroundColor: GOLD }} />
            {link}
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
