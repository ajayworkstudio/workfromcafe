import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/akun", "/admin", "/bayar"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  // Kalau Supabase mengembalikan ?code=… ke halaman selain /auth/callback
  // (terjadi bila Redirect URL belum didaftarkan), teruskan ke callback supaya login tetap selesai.
  const code = request.nextUrl.searchParams.get("code");
  if (code && path !== "/auth/callback") {
    const cb = request.nextUrl.clone();
    cb.pathname = "/auth/callback";
    cb.search = "";
    cb.searchParams.set("code", code);
    cb.searchParams.set("next", path === "/" ? "/" : path);
    return NextResponse.redirect(cb);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Jangan matikan seluruh website kalau env belum diisi; cukup catat di log Vercel.
    console.error("[middleware] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi di Environment Variables.");
    return response;
  }

  let user = null;
  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    ({ data: { user } } = await supabase.auth.getUser());
  } catch (e) {
    console.error("[middleware] Gagal cek sesi Supabase:", e);
  }

  // Halaman yang wajib login
  if (!user && PROTECTED.some((p) => path.startsWith(p))) {
    const login = request.nextUrl.clone();
    login.pathname = "/masuk";
    login.search = "";
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|logo.png|qris.png|opengraph-image|manifest.webmanifest|sw.js|offline.html|robots.txt|sitemap.xml|api/midtrans/notification|api/cron).*)",
  ],
};
