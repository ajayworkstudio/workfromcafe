import type { Metadata } from "next";
import LoginForm from "./LoginForm";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; daftar?: string }> }) {
  const [{ next, error, daftar }, settings] = await Promise.all([searchParams, getSettings()]);
  return (
    <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-md content-center px-4 py-12">
      <h1 className="text-4xl font-extrabold">{daftar ? "Daftar" : "Masuk"}</h1>
      <p className="mt-2 text-muted">
        {settings.trial_days > 0
          ? `Akun baru langsung dapat akses penuh gratis ${settings.trial_days} hari. Tanpa bayar, tanpa kartu.`
          : `Simpan kafe favorit dan buka ${settings.free_unlock_limit_per_month} ulasan lengkap gratis setiap bulan.`}
      </p>
      {error && (
        <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error === "konfirmasi"
            ? "Link konfirmasi sudah kedaluwarsa atau sudah pernah dipakai. Coba masuk dengan email dan kata sandimu. Kalau belum bisa, daftar ulang untuk mendapat link baru."
            : "Login tidak berhasil. Coba lagi, atau pakai cara masuk yang lain."}
        </p>
      )}
      <LoginForm next={next?.startsWith("/") ? next : "/"} initialMode={daftar ? "daftar" : "login"} />
    </div>
  );
}
