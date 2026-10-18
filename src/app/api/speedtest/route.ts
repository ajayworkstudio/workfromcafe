import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Tujuan tes unggah: badan request dibaca lalu dibuang. Hanya untuk pengguna login supaya tidak disalahgunakan.
const MAX = 3 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return new NextResponse(null, { status: 401 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX) return new NextResponse(null, { status: 413 });
  let size = 0;
  const reader = req.body?.getReader();
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX) return new NextResponse(null, { status: 413 });
  }
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
