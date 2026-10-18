"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

type Item = { href: string; icon: string; label: string; match: (p: string) => boolean };

/**
 * Navigasi bawah HP: pil kaca gelap mengambang (konten di belakangnya tampil buram). Menu yang aktif melebar jadi pil terang berisi ikon + nama,
 * yang lain cukup ikon, supaya posisi sekarang langsung terlihat tanpa membaca lima label sekaligus.
 */
export default function BottomNav({ loggedIn }: { loggedIn: boolean }) {
  const path = usePathname() ?? "/";

  const items: Item[] = [
    { href: "/", icon: "home", label: "Beranda", match: (p) => p === "/" },
    { href: "/kafe", icon: "search", label: "Jelajah", match: (p) => p.startsWith("/kafe") || p.startsWith("/kota") },
    { href: "/kirim", icon: "send", label: "Kirim", match: (p) => p.startsWith("/kirim") },
    { href: "/peta", icon: "map", label: "Peta", match: (p) => p.startsWith("/peta") },
    { href: loggedIn ? "/akun" : "/masuk", icon: "user", label: "Akun", match: (p) => p.startsWith("/akun") || p.startsWith("/masuk") },
  ];

  return (
    <nav aria-label="Navigasi utama"
      className="glass-dark fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 flex items-center justify-between gap-1 rounded-full p-1.5 md:hidden">
      {items.map((i) => {
        const active = i.match(path);
        return (
          <Link key={i.label} href={i.href} aria-label={i.label} aria-current={active ? "page" : undefined}
            className={`flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-[background-color,color,flex-grow] duration-200 ${
              active ? "flex-[1.8] bg-foam px-4 text-ink" : "flex-1 text-foam/80 hover:text-foam"
            }`}>
            <Icon name={i.icon} className="h-[22px] w-[22px] shrink-0" />
            {active && <span className="truncate">{i.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
