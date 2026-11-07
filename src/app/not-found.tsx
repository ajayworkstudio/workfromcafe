import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Halaman tidak ditemukan", robots: { index: false, follow: true } };

export default async function NotFound() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="font-display text-7xl font-extrabold text-mist">404</p>
      <h1 className="mt-4 font-display text-3xl font-bold">{t("Halaman tidak ditemukan")}</h1>
      <p className="mt-2 text-muted">{t("Alamat ini tidak ada atau kafenya sudah dihapus.")}</p>
      <Link href="/kafe" className="btn-dark mt-6">{t("Jelajah kafe lain")}</Link>
    </div>
  );
}
