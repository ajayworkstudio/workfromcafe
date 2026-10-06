import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import EventCard from "@/components/EventCard";
import EventTeaser from "@/components/EventTeaser";
import Icon from "@/components/Icon";
import { EVENT_SELECT, type WfcEvent } from "@/lib/events";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: s.events_public ? "Event kerja bareng di kafe" : "Event (segera)",
    description: "Kerja bareng, cafe hopping, workshop, dan meetup para author WorkFromCafe di kafe-kafe pilihan di Pulau Jawa.",
    alternates: { canonical: "/event" },
    robots: s.events_public ? undefined : { index: false, follow: true },
  };
}

export default async function EventsPage() {
  const [viewer, settings] = await Promise.all([getViewer(), getSettings()]);
  const canSee = settings.events_public || viewer.isAdmin;
  if (!canSee) return <EventTeaser communityUrl={settings.community_url} />;

  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select(EVENT_SELECT).order("starts_at", { ascending: true });
  const all = ((data as WfcEvent[] | null) ?? []).filter((e) => e.is_published || viewer.isAdmin);
  const now = Date.now();
  const upcoming = all.filter((e) => new Date(e.ends_at ?? e.starts_at).getTime() >= now);
  const past = all.filter((e) => new Date(e.ends_at ?? e.starts_at).getTime() < now).reverse();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {!settings.events_public && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/60 bg-gold/10 px-5 py-4 text-sm">
          <span><b>Mode pratinjau admin.</b> Pengunjung umum masih melihat halaman &quot;Segera&quot;.</span>
          <Link href="/admin/event" className="btn-dark !py-1.5">Kelola event</Link>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold md:text-5xl">Event</h1>
          <p className="mt-2 max-w-xl text-muted">Kerja bareng, cafe hopping, workshop, dan meetup di kafe-kafe pilihan.</p>
        </div>
        {viewer.isAdmin && <Link href="/admin/event/baru" className="btn-primary"><Icon name="plus" className="h-4 w-4" />Buat event</Link>}
      </div>

      {error && viewer.isAdmin && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">Tabel event belum ada. Jalankan migrasi 0013_event.sql di Supabase.</p>}

      <h2 className="mt-10 text-xl font-bold">Akan datang</h2>
      {upcoming.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">{upcoming.map((e) => <EventCard key={e.id} e={e} />)}</div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-line p-8 text-center text-muted">Belum ada event terjadwal.</p>
      )}

      {!!past.length && (
        <>
          <h2 className="mt-12 text-xl font-bold">Sudah lewat</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">{past.map((e) => <EventCard key={e.id} e={e} past />)}</div>
        </>
      )}
    </div>
  );
}
