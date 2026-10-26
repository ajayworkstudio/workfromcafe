"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

/**
 * Lonceng di header. Header tidak dirender ulang saat pindah halaman, jadi angkanya diatur di sini:
 * begitu halaman Notifikasi dibuka, angka langsung hilang (di server juga ditandai sudah dilihat).
 */
export default function NotifBell({ count }: { count: number }) {
  const path = usePathname();
  const [n, setN] = useState(count);
  useEffect(() => { setN(count); }, [count]);
  useEffect(() => { if (path === "/notifikasi") setN(0); }, [path]);
  return (
    <Link href="/notifikasi" aria-label={n ? `Notifikasi, ${n} baru` : "Notifikasi"}
      className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink hover:bg-tint">
      <Icon name="bell" className="h-[22px] w-[22px]" />
      {n > 0 && (
        <span className="absolute right-1 top-1 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-[#b4533a] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-canvas">
          {n > 9 ? "9+" : n}
        </span>
      )}
    </Link>
  );
}
