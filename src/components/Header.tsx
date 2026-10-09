import { INSTAGRAM_URL } from "@/lib/utils";
import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import Icon from "./Icon";
import Wordmark from "./Wordmark";
import Avatar from "./Avatar";

export default async function Header() {
  const [v, settings] = await Promise.all([getViewer(), getSettings()]);
  const free = settings.free_mode;

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:gap-6">
        <Link href="/" className="flex items-center" aria-label="WorkFromCafe, beranda">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-1 text-sm font-medium text-muted md:flex">
          <Link href="/kafe" className="rounded-full px-3 py-2 hover:bg-tint hover:text-ink">Jelajah</Link>
          <Link href="/peta" className="rounded-full px-3 py-2 hover:bg-tint hover:text-ink">Peta</Link>
          <Link href="/kirim" className="rounded-full px-3 py-2 hover:bg-tint hover:text-ink">Kirim kafe</Link>
          <Link href="/event" className="flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-tint hover:text-ink">
            Event
            {!settings.events_public && <span className="rounded-full bg-gold/25 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8a5a00]">Segera</span>}
          </Link>
          {settings.community_url && (
            <a href={settings.community_url} target="_blank" rel="noopener" className="flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-tint hover:text-ink">
              <Icon name="whatsapp" className="h-4 w-4 text-[#128c4a]" />Komunitas
            </a>
          )}
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener" aria-label="Instagram @wfchunters" title="@wfchunters"
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-tint hover:text-ink">
            <Icon name="instagram" className="h-[18px] w-[18px] text-[#c13584]" />
          </a>
          {!v.isPremium && !free && <Link href="/harga" className="rounded-full px-3 py-2 hover:bg-tint hover:text-ink">Harga</Link>}
          {v.isAdmin && <Link href="/admin" className="rounded-full px-3 py-2 hover:bg-tint hover:text-ink">Admin</Link>}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/event" aria-label={settings.events_public ? "Event" : "Event, segera hadir"}
            className="flex shrink-0 items-center gap-1 rounded-full border border-line py-1 pl-2 pr-2.5 text-[11px] font-semibold text-muted md:hidden">
            <Icon name="calendar" className="h-3.5 w-3.5" />
            {settings.events_public ? "Event" : <span className="text-[#8a5a00]">Segera</span>}
          </Link>
          {v.user ? (
            <Link href="/akun" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium hover:bg-tint">
              <span className="relative">
                <Avatar url={v.avatarUrl} name={v.name ?? v.user.email} className="h-8 w-8 text-sm" />
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

      {/* Navigasi bawah untuk HP, di luar <header> karena backdrop-blur membuat position:fixed ikut header */}
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
