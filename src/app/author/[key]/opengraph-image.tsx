import { ImageResponse } from "next/og";
import { createPublicClient } from "@/lib/supabase/server";
import { getAuthors, levelFor } from "@/lib/author";
import { imageDataUrl, loadAssets } from "@/lib/kuratorCard";
import { SITE_URL, coverUrl } from "@/lib/utils";
import type { Cafe } from "@/lib/types";

/*
  Gambar pratinjau saat link profil author dibagikan (WhatsApp, X, Facebook, Telegram, dll).
  Kiri: foto, nama, level, jumlah kafe. Kanan: foto 3 kafe rekomendasi terbaru, ditumpuk
  seperti kartu (motif tumpukan kartu di DESIGN.md).
*/
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Profil author WFC Hunters dan kafe rekomendasinya";

const CREAM = "#f6f2ee";
const BROWN = "#6b4226";
const INK = "#1f1612";
const MUTED = "#6f625a";
const LINE = "#c9925f";

export default async function Image({ params }: { params: Promise<{ key: string }> }) {
  const key = decodeURIComponent((await params).key).toLowerCase();
  const a = (await getAuthors().catch(() => [])).find((x) => x.username === key || x.id === key);
  const { fonts, logo } = await loadAssets();

  let cafes: { name: string; cover: string | null }[] = [];
  let cities: string[] = [];
  if (a) {
    const { data } = await createPublicClient()
      .from("cafes").select("name,city:cities(name),photos:cafe_photos(url,is_cover,sort_order)")
      .eq("contributor_id", a.id).eq("is_published", true).order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as (Pick<Cafe, "name" | "photos"> & { city: { name: string } | null })[];
    cities = [...new Set(rows.map((r) => r.city?.name).filter(Boolean) as string[])];
    cafes = await Promise.all(rows.slice(0, 3).map(async (r) => ({ name: r.name, cover: await imageDataUrl(coverUrl(r), 336, 500, "jpeg") })));
  }
  const avatar = a ? await imageDataUrl(a.avatar_url, 320, 320) : null;
  const level = a ? levelFor(a.cafe_count).current?.name ?? null : null;
  const host = SITE_URL.replace(/^https?:\/\/(www\.)?/, "");
  const initial = (a?.name ?? "W").trim().charAt(0).toUpperCase();
  const cityText = cities.slice(0, 3).join(" · ") + (cities.length > 3 ? ` +${cities.length - 3}` : "");

  // Tiga kartu kafe berjajar sedikit miring; tidak saling menutup supaya semua nama terbaca
  const fan = [
    { x: 0, y: 150, r: -4 },
    { x: 178, y: 110, r: 1 },
    { x: 356, y: 150, r: 5 },
  ].slice(0, cafes.length);

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", position: "relative", backgroundColor: CREAM, fontFamily: "Jakarta", color: INK }}>
        {/* Garis tipis ala banner Contributor */}
        <div style={{ position: "absolute", top: 34, left: 34, right: 34, bottom: 34, border: `2px solid ${LINE}`, borderRadius: 36, display: "flex" }} />

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "70px 0 70px 84px", width: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} width={116} height={75} alt="" />
            <div style={{ display: "flex", fontSize: 22, fontWeight: 600, color: BROWN, letterSpacing: 6 }}>CONTRIBUTOR</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} width={132} height={132} style={{ borderRadius: 9999, border: `5px solid ${BROWN}` }} alt="" />
              ) : (
                <div style={{ display: "flex", width: 132, height: 132, borderRadius: 9999, backgroundColor: BROWN, color: CREAM, alignItems: "center", justifyContent: "center", fontSize: 60, fontWeight: 800 }}>{initial}</div>
              )}
              {level && (
                <div style={{ display: "flex", backgroundColor: "#e0a045", color: INK, borderRadius: 9999, padding: "10px 24px", fontSize: 26, fontWeight: 800 }}>{level}</div>
              )}
            </div>
            <div style={{ display: "flex", marginTop: 26, fontSize: a && a.name.length > 18 ? 52 : 64, fontWeight: 800, lineHeight: 1.05, maxWidth: 500 }}>
              {a?.name ?? "WFC Hunters"}
            </div>
            <div style={{ display: "flex", marginTop: 14, fontSize: 30, color: MUTED }}>
              {a ? `${a.cafe_count} kafe rekomendasi untuk kerja` : "Kafe enak buat kerja di Pulau Jawa"}
            </div>
            {cityText && <div style={{ display: "flex", marginTop: 6, fontSize: 24, color: MUTED }}>{cityText}</div>}
          </div>

          <div style={{ display: "flex", fontSize: 24, fontWeight: 600, color: BROWN }}>
            {host}/author/{a?.username ?? key}
          </div>
        </div>

        {/* Tumpukan foto kafe */}
        <div style={{ display: "flex", position: "relative", width: 560, height: 630 }}>
          {cafes.map((c, i) => (
            <div key={i} style={{
              position: "absolute", left: 20 + fan[i].x, top: fan[i].y, width: 168, height: 250,
              display: "flex", flexDirection: "column", justifyContent: "flex-end",
              borderRadius: 26, overflow: "hidden", backgroundColor: BROWN, transform: `rotate(${fan[i].r}deg)`,
              boxShadow: "0 24px 40px rgba(31,22,18,0.28)", border: `6px solid ${CREAM}`,
            }}>
              {c.cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.cover} width={168} height={250} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} alt="" />
              )}
              <div style={{ display: "flex", padding: "40px 16px 16px", backgroundImage: "linear-gradient(to top, rgba(31,22,18,0.92), rgba(31,22,18,0))", color: CREAM, fontSize: 18, fontWeight: 800, lineHeight: 1.15 }}>
                {c.name.length > 40 ? `${c.name.slice(0, 38)}…` : c.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
