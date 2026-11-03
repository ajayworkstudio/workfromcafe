import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { EVENT_KINDS, deviceOf, isBot, sourceOf, type EventKind } from "@/lib/stats";

// Pencatat kunjungan dan klik tombol di halaman kafe (dipanggil lewat navigator.sendBeacon).
// Pengunjung disimpan sebagai hash harian IP + browser, jadi bisa dihitung unik tanpa menyimpan IP.
// Selalu menjawab 204: pencatatan yang gagal tidak boleh mengganggu pengunjung.
const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(req: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  try {
    const ua = req.headers.get("user-agent") ?? "";
    if (isBot(ua)) return done;
    const body = (await req.json().catch(() => null)) as { cafe_id?: string; kind?: string; ref?: string; utm?: string } | null;
    const cafeId = String(body?.cafe_id ?? "");
    const kind = String(body?.kind ?? "") as EventKind;
    if (!UUID.test(cafeId) || !EVENT_KINDS.includes(kind)) return done;

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const viewer = createHash("sha256").update(`${ip}|${ua}|${day}|${salt}`).digest("hex").slice(0, 40);
    let city = "";
    try { city = decodeURIComponent(req.headers.get("x-vercel-ip-city") ?? ""); } catch { /* biarkan kosong */ }

    const { data: claims } = await (await createClient()).auth.getClaims();
    const userId = (claims?.claims?.sub as string | undefined) ?? null;

    const { error } = await createAdminClient().rpc("log_cafe_event", {
      p_cafe_id: cafeId,
      p_kind: kind,
      p_viewer: viewer,
      p_source: sourceOf(String(body?.ref ?? "").slice(0, 500), String(body?.utm ?? "").slice(0, 40), req.nextUrl.hostname),
      p_device: deviceOf(ua),
      p_city: city,
      p_user_id: userId,
    });
    if (error && !/does not exist|schema cache/.test(error.message)) console.error("[lihat]", error.message);
  } catch (e) {
    console.error("[lihat]", e);
  }
  return done;
}
