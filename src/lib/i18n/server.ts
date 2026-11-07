import { cache } from "react";
import { cookies } from "next/headers";
import { asLang, localeOf, makeT, LANG_COOKIE, type Lang } from "./core";
import { EN } from "./en";

/** Bahasa pilihan pengunjung (cookie `lang`). Googlebot tidak membawa cookie, jadi selalu ID. */
export const getLang = cache(async (): Promise<Lang> => {
  try {
    return asLang((await cookies()).get(LANG_COOKIE)?.value);
  } catch {
    return "id"; // di luar request (build statis)
  }
});

export async function getT() {
  const lang = await getLang();
  return { t: makeT(lang, lang === "en" ? EN : null), lang, locale: localeOf(lang) };
}
