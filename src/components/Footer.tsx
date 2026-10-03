import Link from "next/link";
import { APP_NAME } from "@/lib/utils";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-roast/10 pb-24 pt-8 text-sm text-bean/70 md:pb-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 md:flex-row md:justify-between">
        <p>© {new Date().getFullYear()} {APP_NAME}. Dikurasi langsung dari kunjungan pribadi.</p>
        <div className="flex gap-4">
          <Link href="/harga">Langganan</Link>
          <Link href="/kafe">Semua kafe</Link>
        </div>
      </div>
    </footer>
  );
}
