import Link from "next/link";
import Image from "next/image";
import type { Cafe } from "@/lib/types";
import { coverThumb } from "@/lib/utils";
import { CROWD, reportAgo, type LiveSummary } from "@/lib/reports";
import Icon from "./Icon";

const CROWD_CHIP = { 1: "bg-[#6fd09a]/25 text-[#c8f3da]", 2: "bg-gold/30 text-[#ffe2b0]", 3: "bg-[#e07a5f]/30 text-[#ffd2c4]" } as const;

/** Kartu foto kecil dengan panel kaca berisi kondisi live, untuk deretan "Lagi sepi sekarang" di hero beranda. */
export default function LiveCafeCard({ cafe, live }: { cafe: Cafe; live: LiveSummary }) {
  const cover = coverThumb(cafe);
  return (
    <Link href={`/kafe/${cafe.slug}`} className="group relative block h-64 w-[15rem] shrink-0 snap-start overflow-hidden rounded-[1.75rem] bg-ink text-foam">
      {cover
        ? <Image src={cover} alt={cafe.name} fill sizes="240px" className="object-cover transition duration-500 group-hover:scale-[1.04]" />
        : <div className="grid h-full place-items-center text-foam/30"><Icon name="cup" className="h-12 w-12" /></div>}
      <div className="glass-dark absolute inset-x-2.5 bottom-2.5 space-y-1.5 rounded-[1.25rem] px-3.5 py-3">
        <p className="truncate font-extrabold">{cafe.name}</p>
        <p className="flex flex-wrap gap-1.5 text-xs font-bold">
          <span className={`rounded-full px-2 py-0.5 ${CROWD_CHIP[live.crowd]}`}>{CROWD[live.crowd].label}</span>
          {live.download_mbps != null && <span className="rounded-full bg-white/15 px-2 py-0.5">{Math.round(Number(live.download_mbps))} Mbps</span>}
          <span className="rounded-full bg-white/15 px-2 py-0.5">{reportAgo(live.last_at)}</span>
        </p>
      </div>
    </Link>
  );
}
