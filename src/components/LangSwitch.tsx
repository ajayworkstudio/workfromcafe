"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LANG_COOKIE, type Lang } from "@/lib/i18n/core";
import { useT } from "./I18nProvider";

/** Tombol ID / EN. Pilihan disimpan di cookie satu tahun, lalu halaman dimuat ulang dari server. */
export default function LangSwitch({ className = "" }: { className?: string }) {
  const { lang, t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const pick = (to: Lang) => {
    if (to === lang) return;
    document.cookie = `${LANG_COOKIE}=${to}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  };
  return (
    <div role="group" aria-label={t("Bahasa")} className={`flex rounded-full border border-line bg-surface p-0.5 text-xs font-bold ${pending ? "opacity-60" : ""} ${className}`}>
      {(["id", "en"] as const).map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => pick(l)}
          className={`min-h-11 min-w-11 rounded-full px-3 uppercase transition ${lang === l ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>
          {l === "id" ? "ID" : "EN"}
          <span className="sr-only">{l === "id" ? " Bahasa Indonesia" : " English"}</span>
        </button>
      ))}
    </div>
  );
}
