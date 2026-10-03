import Link from "next/link";
import Image from "next/image";
import type { Cafe } from "@/lib/types";
import { coverUrl, isOpenNow, priceLabel } from "@/lib/utils";
import Icon from "./Icon";

export default function CafeCard({ cafe }: { cafe: Cafe }) {
  const cover = coverUrl(cafe);
  const open = isOpenNow(cafe.opening_hours);
  const tagNames = (cafe.tags ?? []).map((t) => t.tag?.name);
  const vibe = (cafe.tags ?? []).map((t) => t.tag).find((t) => t?.type === "vibe");

  return (
    <Link href={`/kafe/${cafe.slug}`} className="group block">
      <div className="relative aspect-[5/4] overflow-hidden rounded-[var(--radius-photo)] bg-tint">
        {cover ? (
          <Image src={cover} alt={cafe.name} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
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
        {cafe.my_rating != null && (
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold">
            <Icon name="star" filled className="h-4 w-4 text-gold" />
            {Number(cafe.my_rating).toFixed(1)}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="chip">{priceLabel(cafe.price_range)}</span>
        {vibe && <span className="chip">{vibe.name}</span>}
        {tagNames.includes("Wifi") && <span className="chip" title="Wifi"><Icon name="wifi" className="h-3.5 w-3.5" />Wifi</span>}
        {tagNames.includes("Colokan") && <span className="chip" title="Colokan"><Icon name="plug" className="h-3.5 w-3.5" />Colokan</span>}
      </div>
    </Link>
  );
}
