import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/akun", "/admin", "/bayar", "/kirim/baru", "/pemilik", "/laporan"];

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

  let user: { id: string } | null = null;
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
    // getClaims memverifikasi token & me-refresh sesi; lebih ringan dari getUser (tanpa panggilan ke server Auth bila memakai JWT signing key)
    const { data } = await supabase.auth.getClaims();
    user = data?.claims?.sub ? { id: data.claims.sub } : null;
  } catch (e) {
    console.error("[middleware] Gagal cek sesi Supabase:", e);
  }

  // Kafe / artikel / kota yang tidak ada: jawab 404 asli. Tanpa ini Next mengirim 200 + noindex karena halaman
  // di-stream (loading.tsx), dan Google mencatatnya sebagai soft 404. Hanya untuk muat halaman penuh
  // (bukan navigasi di dalam aplikasi, header rsc) supaya perpindahan halaman tetap cepat.
  const missing = !request.headers.get("rsc") && request.method === "GET" ? await isMissing(path, url, key) : false;
  if (missing) {
    const res = NextResponse.rewrite(new URL("/__tidak-ditemukan", request.url), { status: 404 });
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
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
    "/((?!_next/static|_next/image|favicon.ico|icons|logo.png|qris.png|opengraph-image|manifest.webmanifest|sw.js|offline.html|robots.txt|speedtest|foto/|sitemap.xml|api/midtrans/notification|api/cron|api/dukungan).*)",
  ],
};

const DETAIL = [
  { re: /^\/kafe\/([\w-]+)$/, table: "cafes", extra: "&is_published=eq.true" },
  { re: /^\/artikel\/([\w-]+)$/, table: "articles", extra: "&is_published=eq.true" },
  { re: /^\/kota\/([\w-]+)$/, table: "cities", extra: "&is_active=eq.true" },
] as const;

/** true kalau alamat halaman detail tidak punya baris di database. Gagal cek = anggap ada (jangan sampai 404 palsu). */
async function isMissing(path: string, url: string, key: string) {
  const hit = DETAIL.map((d) => ({ d, m: path.match(d.re) })).find((x) => x.m);
  if (!hit?.m) return false;
  try {
    const r = await fetch(`${url}/rest/v1/${hit.d.table}?select=slug&slug=eq.${encodeURIComponent(hit.m[1])}${hit.d.extra}&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(1500),
    });
    if (!r.ok) return false;
    const rows = (await r.json()) as unknown[];
    return Array.isArray(rows) && rows.length === 0;
  } catch {
    return false;
  }
}
