import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import Icon from "./Icon";
import Wordmark from "./Wordmark";

export default async function Header() {
  const [v, settings] = await Promise.all([getViewer(), getSettings()]);
  const free = settings.free_mode;
  const initial = (v.name ?? v.user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center" aria-label="WorkFromCafe, beranda">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-1 text-sm font-medium text-muted md:flex">
          <Link href="/kafe" className="rounded-full px-3 py-2 hover:bg-tint hover:text-ink">Jelajah</Link>
          <Link href="/peta" className="rounded-full px-3 py-2 hover:bg-tint hover:text-ink">Peta</Link>
          <Link href="/kirim" className="rounded-full px-3 py-2 hover:bg-tint hover:text-ink">Kirim kafe</Link>
          {!v.isPremium && !free && <Link href="/harga" className="rounded-full px-3 py-2 hover:bg-tint hover:text-ink">Harga</Link>}
          {v.isAdmin && <Link href="/admin" className="rounded-full px-3 py-2 hover:bg-tint hover:text-ink">Admin</Link>}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {v.user ? (
            <Link href="/akun" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium hover:bg-tint">
              <span className="relative grid h-8 w-8 place-items-center rounded-full bg-ink text-sm font-semibold text-white">
                {initial}
                {v.isPremium && !free && <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-gold text-ink ring-2 ring-canvas"><Icon name="star" filled className="h-2.5 w-2.5" /></span>}
              </span>
              <span className="hidden sm:inline">{v.name?.split(" ")[0] ?? "Akun"}</span>
            </Link>
          ) : (
            <Link href="/masuk" className="btn-dark !py-2">Masuk</Link>
          )}
        </div>
      </div>
    </header>

      {/* Navigasi bawah untuk HP — di luar <header> karena backdrop-blur membuat position:fixed ikut header */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] text-[11px] font-medium text-muted backdrop-blur-xl md:hidden">
        {[
          { href: "/", icon: "home", label: "Beranda" },
          { href: "/kafe", icon: "search", label: "Jelajah" },
          { href: "/kirim", icon: "send", label: "Kirim" },
          { href: "/peta", icon: "map", label: "Peta" },
          { href: v.user ? "/akun" : "/masuk", icon: "user", label: "Akun" },
        ].map((i) => (
          <Link key={i.label} href={i.href} className="flex flex-col items-center gap-1 py-2.5 hover:text-ink">
            <Icon name={i.icon} className="h-[22px] w-[22px]" />
            {i.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
