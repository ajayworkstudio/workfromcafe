"use client";
import { useEffect } from "react";
import { useT } from "@/components/I18nProvider";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useT();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-3xl font-extrabold">{t("Halaman gagal dimuat")}</h1>
      <p className="mt-2 text-muted">{t("Ada gangguan sesaat. Coba muat ulang. Kalau masih terjadi, kabari kami.")}</p>
      {error.digest ? <p className="mt-3 font-mono text-xs text-muted">Kode: {error.digest}</p>
        : process.env.NODE_ENV !== "production" && error.message && <p className="mt-3 break-words font-mono text-xs text-muted">Detail: {error.message.slice(0, 200)}</p>}
      <button onClick={reset} className="btn-dark mt-6">{t("Muat ulang")}</button>
    </div>
  );
}
