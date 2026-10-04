import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Tujuan setelah login Google dan setelah klik link konfirmasi email bawaan Supabase.
 * src=email: link konfirmasi pendaftaran. Kalau dibuka di browser/HP lain, sesi tidak bisa dibuat,
 * tapi emailnya SUDAH terkonfirmasi oleh Supabase, jadi arahkan ke halaman Masuk dengan pesan yang jelas.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const fromEmail = searchParams.get("src") === "email";
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") ? rawNext : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const dest = fromEmail && next === "/" ? "/akun?terkonfirmasi=1" : next;
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }
  if (fromEmail || searchParams.get("error_code") === "otp_expired") {
    return NextResponse.redirect(`${origin}/masuk?terkonfirmasi=1`);
  }
  return NextResponse.redirect(`${origin}/masuk?error=1`);
}
