import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isBot } from "@/lib/stats";

// Sinyal "sedang online" dari PresencePing (tiap 1 menit selama tab terbuka, dan saat tab ditutup).
// Akun dikenali dari cookie login di server, bukan dari isi permintaan, jadi tidak bisa dipalsukan.
// Selalu menjawab 204: sinyal yang gagal tidak boleh mengganggu pengunjung.
export async function POST(req: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  try {
    const ua = req.headers.get("user-agent") ?? "";
    if (isBot(ua) || !process.env.SUPABASE_SERVICE_ROLE_KEY) return done;
    const body = (await req.json().catch(() => null)) as { path?: string; leave?: boolean } | null;
    const raw = String(body?.path ?? "");
    // Hanya path halaman, tanpa query string (bisa berisi data pencarian atau token)
    const path = raw.startsWith("/") ? raw.split(/[?#]/)[0].slice(0, 200) : "/";

    const { data: claims } = await (await createClient()).auth.getClaims();
    const userId = (claims?.claims?.sub as string | undefined) ?? null;
    let key: string;
    if (userId) key = `u:${userId}`;
    else {
      const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
      const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
      key = `v:${createHash("sha256").update(`${ip}|${ua}|${day}|${process.env.SUPABASE_SERVICE_ROLE_KEY}`).digest("hex").slice(0, 40)}`;
    }

    const { error } = await createAdminClient().rpc("presence_ping", { p_key: key, p_user: userId, p_path: path, p_leave: body?.leave === true });
    if (error && !/does not exist|schema cache/.test(error.message)) console.error("[online]", error.message);
  } catch (e) {
    console.error("[online]", e);
  }
  return done;
}
