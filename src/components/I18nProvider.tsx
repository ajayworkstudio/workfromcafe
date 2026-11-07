"use client";
import { createContext, useContext, useMemo } from "react";
import { localeOf, makeT, type Lang } from "@/lib/i18n/core";

const Ctx = createContext<{ lang: Lang; dict: Record<string, string> | null }>({ lang: "id", dict: null });

/** Kamus EN dikirim ke browser hanya untuk pengunjung yang memilih English. */
export default function I18nProvider({ lang, dict, children }: { lang: Lang; dict: Record<string, string> | null; children: React.ReactNode }) {
  const value = useMemo(() => ({ lang, dict }), [lang, dict]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT() {
  const { lang, dict } = useContext(Ctx);
  return useMemo(() => ({ t: makeT(lang, dict), lang, locale: localeOf(lang) }), [lang, dict]);
}
