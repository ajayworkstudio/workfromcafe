import Link from "next/link";
import Wordmark from "./Wordmark";
import { getSettings } from "@/lib/settings";
import { INSTAGRAM_URL } from "@/lib/utils";
import Icon from "./Icon";
import LangSwitch from "./LangSwitch";
import { getT } from "@/lib/i18n/server";

export default async function Footer() {
  const { free_mode, community_url } = await getSettings();
  const year = new Date().getFullYear();
  const { t } = await getT();
  return (
    <footer className="mt-20 border-t border-line pb-28 pt-8 text-sm text-muted md:pb-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Wordmark height={34} />
          <p>{t("Kurasi kafe yang nyaman untuk kerja di kota-kota Pulau Jawa.")}</p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/kafe" className="hover:text-ink">{t("Semua kafe")}</Link>
          <Link href="/peta" className="hover:text-ink">{t("Peta")}</Link>
          <Link href="/artikel" className="hover:text-ink">{t("Artikel")}</Link>
          <Link href="/untuk-kafe" className="hover:text-ink">{t("Untuk pemilik kafe")}</Link>
          <Link href="/kirim" className="hover:text-ink">{t("Jadi author")}</Link>
          <Link href="/author" className="hover:text-ink">{t("Para author")}</Link>
          <Link href="/event" className="hover:text-ink">Event</Link>
          {community_url && <a href={community_url} target="_blank" rel="noopener" className="hover:text-ink">{t("Komunitas WhatsApp")}</a>}
          <Link href="/kontak" className="hover:text-ink">{t("Kotak saran & kontak")}</Link>
          <Link href="/dukung" className="inline-flex items-center gap-1.5 font-semibold text-brand hover:text-ink"><Icon name="heart" className="h-4 w-4" />{t("Dukung WFC Hunters")}</Link>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 hover:text-ink"><Icon name="instagram" className="h-4 w-4" />@wfchunters</a>
          {!free_mode && <Link href="/harga" className="hover:text-ink">{t("Harga langganan")}</Link>}
        </div>
      </div>
      <div className="mx-auto mt-6 flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-4 pt-5 text-xs">
        <p>© {year === 2026 ? "2026" : `2026–${year}`} WFC Hunters. {t("Semua hak dilindungi.")}</p>
        <Link href="/syarat" className="hover:text-ink">{t("Syarat penggunaan & hak cipta")}</Link>
        <LangSwitch className="ml-auto" />
      </div>
    </footer>
  );
}
