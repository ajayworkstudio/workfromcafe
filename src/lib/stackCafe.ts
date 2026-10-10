import type { Cafe } from "./types";
import type { StackCafe } from "@/components/CafeSwipeStack";
import { coverUrl, isOpenNow, priceLabel } from "./utils";
import { averageScore } from "./review";

/** Data ringkas satu kafe untuk tumpukan kartu swipe (dikirim ke komponen klien). */
export function toStackCafe(c: Cafe): StackCafe {
  const tags = (c.tags ?? []).map((t) => t.tag);
  const names = tags.map((t) => t?.name);
  const vibe = tags.find((t) => t?.type === "vibe")?.name;
  return {
    id: c.id, slug: c.slug, name: c.name,
    place: [c.area, c.city?.name].filter(Boolean).join(", "),
    cover: coverUrl(c),
    rating: c.my_rating != null ? Number(c.my_rating) : averageScore(c.scores),
    price: priceLabel(c.price_range),
    open: isOpenNow(c.opening_hours),
    review: c.short_review,
    chips: [
      vibe,
      names.includes("Wifi") || c.amenities?.wifi === true ? "Wifi" : null,
      names.includes("Colokan") || c.amenities?.colokan === true ? "Colokan" : null,
    ].filter((x): x is string => !!x),
  };
}
