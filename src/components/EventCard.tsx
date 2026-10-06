import Link from "next/link";
import Icon from "./Icon";
import { dateBadge, eventDate, kindMeta, type WfcEvent } from "@/lib/events";

export default function EventCard({ e, past }: { e: WfcEvent; past?: boolean }) {
  const b = dateBadge(e.starts_at);
  const k = kindMeta(e.kind);
  const where = e.cafe?.name ?? e.venue;
  return (
    <Link href={`/event/${e.slug}`} className={`group card flex overflow-hidden transition-colors hover:border-brand ${past ? "opacity-70" : ""}`}>
      <div className="relative w-28 shrink-0 bg-brand-soft sm:w-36">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {e.cover_url && <img src={e.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute left-2 top-2 rounded-xl bg-surface px-2.5 py-1.5 text-center shadow-sm">
          <p className="text-lg font-extrabold leading-none">{b.day}</p>
          <p className="text-[11px] font-semibold uppercase text-brand">{b.month}</p>
        </div>
      </div>
      <div className="min-w-0 flex-1 p-4">
        <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-brand">
          <span className="inline-flex items-center gap-1"><Icon name={k.icon} className="h-3.5 w-3.5" />{k.label}</span>
          {!e.is_published && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[#8a5a00]">Draf</span>}
        </p>
        <h3 className="mt-1 font-sans text-lg font-bold leading-snug tracking-normal group-hover:text-brand">{e.title}</h3>
        <p className="mt-1 text-sm text-muted">{eventDate(e).day} · {eventDate(e).time}</p>
        {(where || e.city) && <p className="mt-0.5 flex items-center gap-1 text-sm text-muted"><Icon name="pin" className="h-3.5 w-3.5" />{[where, e.city?.name].filter(Boolean).join(", ")}</p>}
        {e.price && <p className="mt-2 inline-block rounded-full bg-tint px-2.5 py-0.5 text-xs font-semibold">{e.price}</p>}
      </div>
    </Link>
  );
}
