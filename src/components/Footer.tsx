import Link from "next/link";
import Wordmark from "./Wordmark";
import { getSettings } from "@/lib/settings";

export default async function Footer() {
  const { free_mode } = await getSettings();
  return (
    <footer className="mt-20 border-t border-line pb-24 pt-8 text-sm text-muted md:pb-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 md:flex-row md:items-center md:justify-between">
        <p><Wordmark className="text-[13px]" />. Kurasi rekomendasi pilihan nyaman bekerja di Cafe.</p>
        <div className="flex gap-5">
          <Link href="/kafe" className="hover:text-ink">Semua kafe</Link>
          <Link href="/peta" className="hover:text-ink">Peta</Link>
          {!free_mode && <Link href="/harga" className="hover:text-ink">Harga langganan</Link>}
        </div>
      </div>
    </footer>
  );
}
