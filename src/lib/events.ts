export type EventKind = "kerja_bareng" | "cafe_hopping" | "workshop" | "meetup" | "lomba" | "lainnya";

export const EVENT_KINDS: { value: EventKind; label: string; icon: string }[] = [
  { value: "kerja_bareng", label: "Kerja bareng", icon: "users" },
  { value: "cafe_hopping", label: "Cafe hopping", icon: "pin" },
  { value: "workshop", label: "Workshop", icon: "edit" },
  { value: "meetup", label: "Meetup author", icon: "star" },
  { value: "lomba", label: "Tantangan", icon: "sparkle" },
  { value: "lainnya", label: "Lainnya", icon: "calendar" },
];
export const kindMeta = (k: string) => EVENT_KINDS.find((x) => x.value === k) ?? EVENT_KINDS[EVENT_KINDS.length - 1];

export type WfcEvent = {
  id: string; slug: string; title: string; kind: EventKind;
  starts_at: string; ends_at: string | null;
  city_id: string | null; cafe_id: string | null; venue: string | null;
  description: string | null; cover_url: string | null; register_url: string | null;
  quota: number | null; price: string | null; is_published: boolean;
  city?: { name: string; slug: string } | null;
  cafe?: { name: string; slug: string; address: string | null } | null;
};

export const EVENT_SELECT = "*, city:cities(name,slug), cafe:cafes(name,slug,address)";

const TZ = "Asia/Jakarta";
export function eventDate(e: Pick<WfcEvent, "starts_at" | "ends_at">) {
  const s = new Date(e.starts_at);
  const day = s.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
  const t = (d: Date) => d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).replace(".", ":");
  const end = e.ends_at ? new Date(e.ends_at) : null;
  const sameDay = end && end.toLocaleDateString("id-ID", { timeZone: TZ }) === s.toLocaleDateString("id-ID", { timeZone: TZ });
  return { day, time: end ? (sameDay ? `${t(s)}–${t(end)} WIB` : `${t(s)} WIB – ${end.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: TZ })}`) : `${t(s)} WIB` };
}

export function dateBadge(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("id-ID", { day: "numeric", timeZone: TZ }),
    month: d.toLocaleDateString("id-ID", { month: "short", timeZone: TZ }).replace(".", ""),
  };
}

/** "2026-10-12T09:00" (input datetime-local, WIB) → ISO UTC */
export function wibToIso(local: string) {
  if (!local) return null;
  const d = new Date(`${local}:00+07:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
/** ISO → nilai untuk input datetime-local dalam WIB */
export function isoToWib(iso: string | null) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 7 * 36e5);
  return d.toISOString().slice(0, 16);
}
