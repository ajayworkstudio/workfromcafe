import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "localhost";

const isDev = process.env.NODE_ENV !== "production";

/*
  Header keamanan untuk semua halaman.
  - CSP: skrip dan koneksi hanya ke situs ini + Supabase; situs tidak boleh dimuat di dalam iframe situs lain.
    'unsafe-inline' untuk skrip masih dibutuhkan Next.js (skrip awal halaman) selama belum memakai nonce.
  - Google Analytics (gtag) boleh memuat skrip & mengirim data ke domain Google Analytics.
  - Gambar boleh dari https mana saja (foto dari spreadsheet, peta OpenStreetMap).
*/
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lokasi tetap boleh untuk fitur "Urutkan dari yang terdekat"; kamera, mikrofon, dll. dimatikan
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  serverExternalPackages: ["read-excel-file", "sharp"],
  // File yang dibaca saat membuat kartu Kurator harus ikut ter-deploy
  outputFileTracingIncludes: {
    "/author/[key]/kartu": ["./src/assets/fonts/**", "./public/logo.png"],
    "/author/[key]/opengraph-image": ["./src/assets/fonts/**", "./public/logo.png"],
    "/kafe/[slug]/story": ["./src/assets/fonts/**", "./public/logo.png"],
  },
  images: {
    // Gambar sudah dikompres saat diunggah (src/lib/compressImage.ts), jadi tidak lewat
    // optimasi gambar Vercel yang kuotanya terbatas di paket gratis.
    unoptimized: true,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
