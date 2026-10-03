import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { APP_NAME } from "@/lib/utils";

export default async function Header() {
  const v = await getViewer();
  return (
    <header className="sticky top-0 z-40 border-b border-roast/10 bg-crema/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-roast text-sm text-crema">☕</span>
          {APP_NAME}
        </Link>
        <nav className="ml-auto hidden items-center gap-5 text-sm font-medium md:flex">
          <Link href="/kafe" className="hover:text-terra">Jelajah</Link>
          <Link href="/peta" className="hover:text-terra">Peta</Link>
          {!v.isPremium && <Link href="/harga" className="hover:text-terra">Langganan</Link>}
          {v.isAdmin && <Link href="/admin" className="hover:text-terra">Admin</Link>}
        </nav>
        <div className="ml-auto md:ml-0">
          {v.user ? (
            <Link href="/akun" className="btn-ghost !py-1.5">
              {v.isPremium && <span className="text-terra">★</span>}
              {v.name?.split(" ")[0] ?? "Akun"}
            </Link>
          ) : (
            <Link href="/masuk" className="btn-dark !py-1.5">Masuk</Link>
          )}
        </div>
      </div>
      {/* Navigasi bawah untuk HP */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-roast/10 bg-paper/95 pb-[env(safe-area-inset-bottom)] text-center text-[11px] font-semibold backdrop-blur md:hidden">
        <Link href="/" className="py-2.5"><div className="text-lg">⌂</div>Beranda</Link>
        <Link href="/kafe" className="py-2.5"><div className="text-lg">☕</div>Jelajah</Link>
        <Link href="/peta" className="py-2.5"><div className="text-lg">⌖</div>Peta</Link>
        <Link href={v.user ? "/akun" : "/masuk"} className="py-2.5"><div className="text-lg">◉</div>Akun</Link>
      </nav>
    </header>
  );
}
