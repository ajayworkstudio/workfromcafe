import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/plus-jakarta-sans/wght-italic.css";
import "@fontsource/montserrat/800.css";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TrialBanner from "@/components/TrialBanner";
import RegisterSW from "@/components/RegisterSW";
import { APP_NAME, SITE_URL } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${APP_NAME} — Kafe untuk kerja di Pulau Jawa`, template: `%s | ${APP_NAME}` },
  description:
    "Koleksi kafe pilihan untuk kerja di kota-kota besar Pulau Jawa: Jakarta, Bandung, Yogyakarta, Semarang, Solo, Surabaya, Malang, dan lainnya. Lengkap dengan penilaian kerja dan menu yang wajib dicoba.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  openGraph: { type: "website", locale: "id_ID", siteName: APP_NAME },
};

export const viewport: Viewport = { themeColor: "#6b4226", width: "device-width", initialScale: 1 };

const REQUIRED_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Kalau env belum diisi, tampilkan daftar yang kurang (hanya nama, tanpa nilai) alih-alih error kosong.
  const missing = Object.entries(REQUIRED_ENV).filter(([, v]) => !v?.trim()).map(([k]) => k);
  if (missing.length) {
    return (
      <html lang="id">
        <body style={{ fontFamily: "system-ui, sans-serif", padding: 32, maxWidth: 640, margin: "0 auto", lineHeight: 1.6 }}>
          <h1>Konfigurasi belum lengkap</h1>
          <p>Environment variable berikut belum terbaca di server:</p>
          <ul>{missing.map((m) => <li key={m}><code>{m}</code></li>)}</ul>
          <p>Isi di Vercel → Settings → Environment Variables (centang Production), lalu Redeploy.</p>
        </body>
      </html>
    );
  }
  return (
    <html lang="id">
      <body className="flex min-h-dvh flex-col antialiased">
        <Header />
        <TrialBanner />
        <main className="flex-1">{children}</main>
        <Footer />
        <RegisterSW />
      </body>
    </html>
  );
}
