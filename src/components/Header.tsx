import { INSTAGRAM_URL } from "@/lib/utils";
import AdminBadge from "@/components/AdminBadge";
import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import Icon from "./Icon";
import Wordmark from "./Wordmark";
import Avatar from "./Avatar";
import BottomNav from "./BottomNav";
import NotifBell from "./NotifBell";
import NavLink from "./NavLinks";

export default async function Header() {
  const [v, settings] = await Promise.all([getViewer(), getSettings()]);
  const free = settings.free_mode;
  // Titik di lonceng: ada notifikasi baru sejak terakhir membuka /notifikasi (0 kalau migrasi 0021 belum ada)
  let unread = 0;
  if (v.user) {
    const { data } = await (await createClient()).rpc("notif_unread_count");
    unread = typeof data === "number" ? data : 0;
  }

  return (
    <>
    <header className="vt-header sticky top-0 z-40 border-b border-line/80 bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:gap-6">
        <Link href="/" className="flex items-center" aria-label="WorkFromCafe, beranda">
          <Wordmark className="!h-8 !w-auto md:!h-11" />
        </Link>
        <nav className="hidden items-center gap-1 text-sm font-medium text-muted md:flex">
          <NavLink href="/kafe" match={["/kafe", "/kota"]}>Jelajah</NavLink>
          <NavLink href="/peta">Peta</NavLink>
          <NavLink href="/kirim">Kirim kafe</NavLink>
          <NavLink href="/event" className="flex items-center gap-1.5">
            Event
            {!settings.events_public && <span className="rounded-full bg-gold/25 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8a5a00]">Segera</span>}
          </NavLink>
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
          {v.isAdmin && <NavLink href="/admin">Admin</NavLink>}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/event" aria-label={settings.events_public ? "Event" : "Event, segera hadir"}
            className="flex shrink-0 items-center gap-1 rounded-full border border-line py-1 pl-2 pr-2.5 text-[11px] font-semibold text-muted md:hidden">
            <Icon name="calendar" className="h-3.5 w-3.5" />
            {settings.events_public ? "Event" : <span className="text-[#8a5a00]">Segera</span>}
          </Link>
          {v.user && <NotifBell count={unread} />}
          {v.user ? (
            <Link href="/akun" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium hover:bg-tint">
              <span className="relative">
                <Avatar url={v.avatarUrl} name={v.name ?? v.user.email} className="h-8 w-8 text-sm" />
                {v.isPremium && !free && <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-gold text-ink ring-2 ring-canvas"><Icon name="star" filled className="h-2.5 w-2.5" /></span>}
              </span>
              <span className="hidden sm:inline">{v.name?.split(" ")[0] ?? "Akun"}</span>
              {v.isAdmin && <span className="hidden sm:inline-flex"><AdminBadge /></span>}
            </Link>
          ) : (
            <Link href="/masuk" className="btn-dark !py-2">Masuk</Link>
          )}
        </div>
      </div>
    </header>

      {/* Navigasi bawah untuk HP, di luar <header> karena backdrop-blur membuat position:fixed ikut header */}
      <BottomNav loggedIn={!!v.user} />
    </>
  );
}
