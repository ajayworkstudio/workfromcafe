import Image from "next/image";
import { readingMinutes, type ManualArticle } from "@/lib/articles";
import { APP_NAME } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const dateText = (d: string, locale: string) => new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

/** Penulis + tanggal + waktu baca. Semua artikel saat ini ditulis tim WFC Hunters. */
export default async function ArticleByline({ a, light = false }: { a: ManualArticle; light?: boolean }) {
  const { t, locale } = await getT();
  return (
    <span className="mt-3 flex items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-foam">
        <Image src="/logo.png" alt="" width={28} height={18} className="h-auto w-7" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className={`block text-sm font-semibold ${light ? "text-foam" : "text-ink"}`}>{APP_NAME}</span>
        <span className={`block text-xs ${light ? "text-foam/75" : "text-muted"}`}>{dateText(a.published_at ?? a.created_at, locale)} · {t("{n} menit baca", { n: readingMinutes(a.body) })}</span>
      </span>
    </span>
  );
}
