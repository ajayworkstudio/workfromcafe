import type { Metadata } from "next";
import LoginForm from "./LoginForm";
import { getSettings } from "@/lib/settings";
import { safeNext } from "@/lib/safeNext";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Masuk", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; daftar?: string; terkonfirmasi?: string }> }) {
  const { t } = await getT();
  const [{ next, error, daftar, terkonfirmasi }, settings] = await Promise.all([searchParams, getSettings()]);
  return (
    <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-md content-center px-4 py-12">
      <h1 className="text-4xl font-extrabold">{daftar ? t("Daftar") : t("Masuk")}</h1>
      <p className="mt-2 text-muted">
        {settings.free_mode
          ? t("Gratis. Kirim rekomendasi kafe andalanmu sebagai author, simpan favorit, dan tandai kafe yang sudah kamu datangi.")
          : settings.trial_days > 0
          ? t("Akun baru langsung dapat akses penuh gratis {n} hari. Tanpa bayar, tanpa kartu.", { n: settings.trial_days })
          : t("Simpan kafe favorit dan buka {n} ulasan lengkap gratis setiap bulan.", { n: settings.free_unlock_limit_per_month })}
      </p>
      {terkonfirmasi && (
        <p role="status" className="mt-5 rounded-xl bg-ok/10 p-3 text-sm text-ok">
          {t("Email kamu sudah terkonfirmasi. Silakan masuk dengan email dan kata sandi yang tadi kamu daftarkan.")}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error === "konfirmasi"
            ? t("Link konfirmasi sudah kedaluwarsa atau sudah pernah dipakai. Coba masuk dengan email dan kata sandimu. Kalau belum bisa, daftar ulang untuk mendapat link baru.")
            : t("Login tidak berhasil. Coba lagi, atau pakai cara masuk yang lain.")}
        </p>
      )}
      <LoginForm next={safeNext(next)} initialMode={daftar ? "daftar" : "login"} />
    </div>
  );
}
