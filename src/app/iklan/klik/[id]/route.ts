import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Klik iklan Sponsored: catat lewat record_ad_click (fungsi itu yang memotong saldo dan menolak klik berulang),
// lalu teruskan ke halaman kafenya. Gagal mencatat tidak boleh menghalangi pengunjung sampai ke kafe.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slug = req.nextUrl.searchParams.get("ke") ?? "";
  const dest = new URL(/^[\w-]{1,120}$/.test(slug) ? `/kafe/${slug}` : "/kafe", req.url);

  if (/^\d{1,18}$/.test(id)) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.rpc("record_ad_click", { p_impression_id: Number(id) });
      if (error) console.error("[iklan] record_ad_click:", error.message);
    } catch (e) {
      console.error("[iklan] record_ad_click:", e);
    }
  }

  const res = NextResponse.redirect(dest, 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
