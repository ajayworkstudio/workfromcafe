"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";

const ITEMS = [
  { href: "/admin", label: "Ringkasan", icon: "grid", exact: true },
  { href: "/admin/kafe", label: "Kafe", icon: "cup" },
  { href: "/admin/rekomendasi", label: "Rekomendasi", icon: "inbox" },
  { href: "/admin/event", label: "Event", icon: "calendar" },
  { href: "/admin/komentar", label: "Komentar", icon: "chat" },
  { href: "/admin/pesan", label: "Pesan", icon: "send" },
  { href: "/admin/spreadsheet", label: "Spreadsheet", icon: "table" },
  { href: "/admin/kota", label: "Kota", icon: "pin" },
  { href: "/admin/tag", label: "Tag", icon: "tag" },
  { href: "/admin/pelanggan", label: "Pelanggan", icon: "users" },
  { href: "/admin/pengaturan", label: "Pengaturan", icon: "settings" },
];

export default function AdminNav() {
  const path = usePathname();
  const active = (i: (typeof ITEMS)[number]) => (i.exact ? path === i.href : path.startsWith(i.href));
  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] md:flex-col md:overflow-visible md:pb-0">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={active(i) ? "page" : undefined}
          className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
            active(i) ? "bg-brand text-white" : "text-muted hover:bg-tint hover:text-ink"}`}>
          <Icon name={i.icon} className="h-[18px] w-[18px]" />
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
