import Link from "next/link";
import FadeImage from "./FadeImage";
import type { Cafe } from "@/lib/types";
import { coverThumb, isOpenNow, priceLabel } from "@/lib/utils";
import Icon from "./Icon";
import { averageScore } from "@/lib/review";
import { CROWD, reportAgo, type LiveSummary } from "@/lib/reports";

const LIVE_DOT = { 1: "bg-ok", 2: "bg-gold", 3: "bg-[#b4533a]" } as const;

export default function CafeCard({ cafe, live }: { cafe: Cafe; /** Ringkasan laporan kondisi 3 jam terakhir */ live?: LiveSummary }) {
  const cover = coverThumb(cafe);
  const open = isOpenNow(cafe.opening_hours);
  const tagNames = (cafe.tags ?? []).map((t) => t.tag?.name);
  const rating = cafe.my_rating != null ? Number(cafe.my_rating) : averageScore(cafe.scores);
  const hasWifi = tagNames.includes("Wifi") || cafe.amenities?.wifi === true;
  const hasPlug = tagNames.includes("Colokan") || cafe.amenities?.colokan === true;
  const vibe = (cafe.tags ?? []).map((t) => t.tag).find((t) => t?.type === "vibe");

  return (
    <Link href={`/kafe/${cafe.slug}`} className="reveal group block min-w-0">
      <div className="relative aspect-[5/4] overflow-hidden rounded-[var(--radius-photo)] bg-tint">
        {cover ? (
          <FadeImage src={cover} alt={cafe.name} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="grid h-full place-items-center text-mist"><Icon name="cup" className="h-12 w-12" /></div>
        )}
        {open !== null && (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-semibold backdrop-blur">
            <span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-ok" : "bg-mist"}`} />
            {open ? "Buka" : "Tutup"}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold leading-snug">{cafe.name}</h3>
          <p className="text-sm text-muted">{[cafe.area, cafe.city?.name].filter(Boolean).join(", ")}</p>
        </div>
        {rating != null && (
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold">
            <Icon name="star" filled className="h-4 w-4 text-gold" />
            {rating.toFixed(1)}
          </span>
        )}
      </div>
      {live && (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold">
          <span className={`h-2 w-2 shrink-0 rounded-full ${LIVE_DOT[live.crowd]}`} />
          <span className="min-w-0 truncate">
            {CROWD[live.crowd].label}{live.download_mbps != null && ` · ${Math.round(Number(live.download_mbps))} Mbps`}
            <span className="font-normal text-muted" suppressHydrationWarning> · {reportAgo(live.last_at)}</span>
          </span>
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="chip">{priceLabel(cafe.price_range)}</span>
        {vibe && <span className="chip">{vibe.name}</span>}
        {hasWifi && <span className="chip" title="Wifi"><Icon name="wifi" className="h-3.5 w-3.5" />Wifi</span>}
        {hasPlug && <span className="chip" title="Colokan"><Icon name="plug" className="h-3.5 w-3.5" />Colokan</span>}
      </div>
    </Link>
  );
}
