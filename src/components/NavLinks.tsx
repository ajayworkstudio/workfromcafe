"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Link menu header (layar lebar) yang ditandai aktif sesuai halaman, sama seperti navbar bawah di HP. */
export default function NavLink({ href, match, className = "", children }: { href: string; match?: string[]; className?: string; children: React.ReactNode }) {
  const path = usePathname() ?? "/";
  const on = (match ?? [href]).some((m) => path === m || path.startsWith(`${m}/`));
  return (
    <Link href={href} aria-current={on ? "page" : undefined}
      className={`rounded-full px-3 py-2 transition-colors ${on ? "bg-espresso font-semibold text-foam" : "hover:bg-tint hover:text-ink"} ${className}`}>
      {children}
    </Link>
  );
}
