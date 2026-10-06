import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import EventTeaser from "@/components/EventTeaser";
import Icon from "@/components/Icon";
import JsonLd from "@/components/JsonLd";
import { clip } from "@/lib/seo";
import { EVENT_SELECT, eventDate, kindMeta, type WfcEvent } from "@/lib/events";
import { SITE_URL } from "@/lib/utils";

type P = Promise<{ slug: string }>;

const getEvent = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select(EVENT_SELECT).eq("slug", slug).maybeSingle();
  return data as WfcEvent | null;
});

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const [e, s] = await Promise.all([getEvent((await params).slug), getSettings()]);
  if (!e || !s.events_public) return { title: "Event (segera)", robots: { index: false, follow: false } };
  const description = clip(e.description ?? `${kindMeta(e.kind).label} di ${e.cafe?.name ?? e.venue ?? e.city?.name ?? "kafe pilihan"}, ${eventDate(e).day}.`);
  return {
    title: e.title,
    description,
    alternates: { canonical: `/event/${e.slug}` },
    openGraph: { title: e.title, description, images: e.cover_url ? [e.cover_url] : undefined },
  };
}

export default async function EventDetail({ params }: { params: P }) {
  const { slug } = await params;
  const [viewer, settings] = await Promise.all([getViewer(), getSettings()]);
  if (!settings.events_public && !viewer.isAdmin) return <EventTeaser communityUrl={settings.community_url} />;
  const e = await getEvent(slug);
  if (!e || (!e.is_published && !viewer.isAdmin)) notFound();

  const k = kindMeta(e.kind);
  const when = eventDate(e);
  const where = e.cafe?.name ?? e.venue;
  const ended = new Date(e.ends_at ?? e.starts_at).getTime() < Date.now();

  return (
    <article className="mx-auto max-w-4xl px-4 py-10">
      {e.is_published && settings.events_public && (
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "Event",
          name: e.title,
          description: e.description ?? undefined,
          startDate: e.starts_at,
          endDate: e.ends_at ?? undefined,
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          eventStatus: "https://schema.org/EventScheduled",
          image: e.cover_url ? [e.cover_url] : undefined,
          location: { "@type": "Place", name: where ?? e.city?.name, address: { "@type": "PostalAddress", streetAddress: e.cafe?.address ?? undefined, addressLocality: e.city?.name, addressCountry: "ID" } },
          organizer: { "@type": "Organization", name: "WorkFromCafe", url: SITE_URL },
          offers: e.register_url ? { "@type": "Offer", url: e.register_url, price: /gratis/i.test(e.price ?? "") ? 0 : undefined, priceCurrency: "IDR", availability: "https://schema.org/InStock" } : undefined,
        }} />
      )}

      <Link href="/event" className="text-sm font-medium text-muted hover:text-brand">← Semua event</Link>
      {(!settings.events_public || !e.is_published) && (
        <p className="mt-3 rounded-xl bg-gold/10 px-4 py-2.5 text-sm"><b>Pratinjau admin.</b> {e.is_published ? "Menu Event belum dibuka untuk umum." : "Event ini masih draf."}</p>
      )}

      {e.cover_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.cover_url} alt={e.title} className="mt-5 aspect-[2/1] w-full rounded-3xl object-cover" />
      )}

      <p className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand"><Icon name={k.icon} className="h-4 w-4" />{k.label}</p>
      <h1 className="mt-1 text-4xl font-extrabold leading-tight md:text-5xl">{e.title}</h1>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {e.description
            ? <p className="whitespace-pre-line text-lg leading-relaxed text-ink/85">{e.description}</p>
            : <p className="text-muted">Detail acara menyusul.</p>}
        </div>
        <aside className="card h-fit space-y-4 p-5">
          <div className="flex gap-3"><Icon name="calendar" className="mt-0.5 h-5 w-5 shrink-0 text-brand" /><div><p className="font-semibold">{when.day}</p><p className="text-sm text-muted">{when.time}</p></div></div>
          {(where || e.city) && (
            <div className="flex gap-3"><Icon name="pin" className="mt-0.5 h-5 w-5 shrink-0 text-brand" /><div>
              {e.cafe ? <Link href={`/kafe/${e.cafe.slug}`} className="font-semibold hover:text-brand hover:underline">{e.cafe.name}</Link> : <p className="font-semibold">{where ?? e.city?.name}</p>}
              <p className="text-sm text-muted">{[e.cafe?.address, e.city?.name].filter(Boolean).join(", ")}</p>
            </div></div>
          )}
          {(e.price || e.quota) && (
            <div className="flex gap-3"><Icon name="users" className="mt-0.5 h-5 w-5 shrink-0 text-brand" /><div>
              {e.price && <p className="font-semibold">{e.price}</p>}
              {e.quota && <p className="text-sm text-muted">Kuota {e.quota} orang</p>}
            </div></div>
          )}
          {ended ? (
            <p className="rounded-xl bg-tint p-3 text-center text-sm font-semibold text-muted">Event sudah selesai</p>
          ) : e.register_url ? (
            <a href={e.register_url} target="_blank" rel="noopener" className="btn-primary w-full">Daftar sekarang</a>
          ) : (
            <p className="rounded-xl bg-tint p-3 text-center text-sm text-muted">Pendaftaran segera dibuka</p>
          )}
          {viewer.isAdmin && <Link href={`/admin/event/${e.id}`} className="btn-ghost w-full"><Icon name="edit" className="h-4 w-4" />Edit event</Link>}
        </aside>
      </div>
    </article>
  );
}
